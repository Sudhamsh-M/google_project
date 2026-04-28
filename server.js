const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const { URL } = require('url');
const webpush = require('web-push');
const twilio = require('twilio');
const admin = require('firebase-admin');

const rootDir = path.resolve(__dirname);
const port = process.env.PORT || 8000;
let GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Updated to 1.5-flash for faster response in crisis scenarios
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

// --- Guest Push Notification State ---
const guestSubscriptions = []; // { subscription, room, floor, phone, subscribedAt }

let serverThreatLevel = 'green';
let serverEvacuationActive = false;
let serverLockdownActive = false;
let serverAllClear = false;
let serverActiveIncidents = 0;

// --- VAPID Keys ---
let VAPID_PUBLIC_KEY = '';
let VAPID_PRIVATE_KEY = '';

async function loadDotEnv() {
  const envPath = path.join(rootDir, '.env');
  try {
    const envText = await fs.readFile(envPath, 'utf8');
    let currentKey = null;
    let currentValue = '';

    envText.split(/\r?\n/).forEach((line) => {
      if (currentKey) {
        currentValue += '\n' + line;
        if (line.endsWith('"')) {
          process.env[currentKey] = currentValue.slice(0, -1);
          currentKey = null;
        }
        return;
      }

      if (line.trim().startsWith('#') || !line.includes('=')) return;

      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1];
        let value = match[2].trim();

        if (value.startsWith('"') && !value.endsWith('"')) {
          currentKey = key;
          currentValue = value.slice(1);
          return;
        }

        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    });
    GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  } catch {
    console.log("No .env file found, using system environment variables.");
  }
}

async function setupVapidKeys() {
  const envPath = path.join(rootDir, '.env');

  // Check if VAPID keys exist in env
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
    VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
  } else {
    // Generate new VAPID keys
    const vapidKeys = webpush.generateVAPIDKeys();
    VAPID_PUBLIC_KEY = vapidKeys.publicKey;
    VAPID_PRIVATE_KEY = vapidKeys.privateKey;

    // Append to .env file
    try {
      let envContent = '';
      try {
        envContent = await fs.readFile(envPath, 'utf8');
      } catch { /* file may not exist */ }

      const newLines = `\nVAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY}\nVAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY}\n`;
      await fs.writeFile(envPath, envContent + newLines, 'utf8');
      console.log('[VAPID] Generated and saved new VAPID keys to .env');
    } catch (err) {
      console.error('[VAPID] Could not save keys to .env:', err.message);
    }
  }

  webpush.setVapidDetails(
    'mailto:aegis@grandmeridian.hotel',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );

  console.log('[PUSH] VAPID keys configured');
}

// --- Twilio Setup ---
let twilioClient = null;
function setupTwilio() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const phone = process.env.TWILIO_PHONE_NUMBER;

  if (sid && token && phone) {
    try {
      twilioClient = twilio(sid, token);
      console.log('[SMS] Twilio service enabled');
    } catch (err) {
      console.error('[SMS] Twilio init error:', err.message);
    }
  } else {
    console.warn('[SMS] Twilio credentials missing in .env — SMS alerts disabled');
  }
}

// --- Firebase Setup ---
let db = null;
function setupFirebase() {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    if (privateKey) {
      // Fix accidental extra quotes and correctly format newlines
      privateKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
    }
    
    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey })
      });
      db = admin.firestore();
      console.log('[DB] Firebase Firestore connected');

      // Load initial system status from DB
      db.collection('system').doc('status').get().then(doc => {
        if (doc.exists) {
          const data = doc.data();
          serverThreatLevel = data.threatLevel || 'green';
          serverEvacuationActive = data.evacuationActive || false;
          serverLockdownActive = data.lockdownActive || false;
          serverAllClear = data.allClear || false;
          console.log(`[DB] Restored system status: ${serverThreatLevel.toUpperCase()}`);
        } else {
          // Initialize default state if document is missing
          db.collection('system').doc('status').set({
            threatLevel: 'green', evacuationActive: false, lockdownActive: false, allClear: false
          }).catch(() => {});
        }
      }).catch(err => {
        if (err.message.includes('NOT_FOUND')) {
          console.log('[DB] Initializing new system status (first run)');
          db.collection('system').doc('status').set({ threatLevel: 'green', evacuationActive: false, lockdownActive: false, allClear: false }).catch(() => {});
        } else {
          console.error('[DB] Failed to load system status', err.message);
        }
      });
    } else {
      console.warn('[DB] Firebase setup skipped. Missing credentials in .env:');
      if (!projectId) console.warn('  -> FIREBASE_PROJECT_ID is missing');
      if (!clientEmail) console.warn('  -> FIREBASE_CLIENT_EMAIL is missing');
      if (!privateKey) console.warn('  -> FIREBASE_PRIVATE_KEY is missing');
    }
  } catch (err) {
    console.error('[DB] Firebase init error:', err.message);
  }
}

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

async function readRequestBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }
  return body;
}

function buildPrompt(incident) {
  const summary = [
    `Incident ID: ${incident.id}`,
    `Type: ${incident.type}`,
    `Severity: ${incident.severity}`,
    `Location: ${incident.location}`,
    `Status: ${incident.status}`,
    `Reported By: ${incident.reportedBy || 'Unknown'}`,
    `Description: ${incident.description || 'No description available.'}`,
  ].join('\n');

  return `You are a Rapid Crisis Response analyst for a hospitality venue. 
  Provide a concise, professional set of recommended actions for this incident. 
  Include: 
  1. Immediate first responder priority.
  2. Evacuation instructions for guests in the affected zone.
  3. Key coordination steps for on-site staff.
  
  Keep it under 200 words for quick reading.
  
  ${summary}`;
}

function buildEvacuationPrompt(room, floor, crisisType, severity) {
  return `You are the AEGIS emergency guidance AI for Grand Meridian Hotel & Resort.
A ${severity} ${crisisType} emergency is in progress.

Generate EXACTLY 5 clear, specific evacuation steps for a guest in Room ${room}, ${floor}.

Rules:
- Each step must be 1-2 sentences max
- Use specific room numbers and floor references
- Be direct and action-oriented
- Mention the nearest exit based on the room number (rooms ending in 1-5 use Stairwell A on the west side, rooms ending in 6-10 use Stairwell B on the east side)
- Include a final step about reporting to the assembly point in the parking lot
- For fire: mention staying low, covering mouth
- For security threats: mention hiding and barricading
- For medical: mention clearing the path for responders
- For natural disasters: mention structural shelter points

Respond with ONLY a JSON array of 5 strings. No markdown, no explanation.
Example: ["Step 1 text", "Step 2 text", "Step 3 text", "Step 4 text", "Step 5 text"]`;
}

async function handleDecisionRequest(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (!GEMINI_API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'GEMINI_API_KEY is missing. Check your .env file.' }));
    return;
  }

  const body = await readRequestBody(req);
  let payload;
  try {
    payload = JSON.parse(body);
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
    return;
  }

  const incident = payload?.incident;
  if (!incident || !incident.id) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Incident data is required.' }));
    return;
  }

  const prompt = buildPrompt(incident);

  // CORRECT API ENDPOINT FOR 2026
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  // CORRECT REQUEST STRUCTURE
  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 500,
    }
  };

  try {
    const apiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const apiData = await apiRes.json();

    // SAFE PARSING OF GEMINI RESPONSE
    const decision = apiData?.candidates?.[0]?.content?.parts?.[0]?.text
      || "Warning: System unable to generate a response. Follow standard emergency protocols.";

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ decision }));
  } catch (error) {
    console.error("Gemini API Error:", error);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: "Failed to connect to AI Analysis service." }));
  }
}

// --- Guest Identity & Verification ---

async function handleGuestVerify(req, res) {
  const body = await readRequestBody(req);
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  const { roomNumber } = payload;
  if (!roomNumber) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Room number required' }));
    return;
  }

  if (!db) {
    return res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Database not configured' }));
  }

  const doc = await db.collection('guests').doc(String(roomNumber)).get();
  const guest = doc.exists ? doc.data() : null;

  if (guest) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      room: guest.room,
      floor: guest.floor,
      name: guest.name
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Room not found in guest database' }));
  }
}

// --- Guest API Handlers ---

function handleVapidPublicKey(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ publicKey: VAPID_PUBLIC_KEY }));
}

async function handleGuestSubscribe(req, res) {
  const body = await readRequestBody(req);
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  const { subscription, room, floor } = payload;
  if (!subscription || !subscription.endpoint) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid subscription' }));
    return;
  }

  // Auto-link phone number if room is verified
  let phone = null;
  if (room && db) {
    const doc = await db.collection('guests').doc(String(room)).get();
    if (doc.exists && doc.data().phone) {
      phone = doc.data().phone;
    }
  }

  // Remove existing subscription for same endpoint (re-subscribe)
  const existingIdx = guestSubscriptions.findIndex(s => s.subscription.endpoint === subscription.endpoint);
  if (existingIdx >= 0) guestSubscriptions.splice(existingIdx, 1);

  guestSubscriptions.push({
    subscription,
    room: room || 'unknown',
    floor: floor || 'unknown',
    phone,
    subscribedAt: new Date().toISOString(),
  });

  console.log(`[GUEST] New subscription: Room ${room} (SMS Linked: ${phone ? 'YES' : 'NO'})`);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, total: guestSubscriptions.length }));
}

async function handleGuestUnsubscribe(req, res) {
  const body = await readRequestBody(req);
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  const { endpoint } = payload;
  const idx = guestSubscriptions.findIndex(s => s.subscription.endpoint === endpoint);
  if (idx >= 0) guestSubscriptions.splice(idx, 1);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, total: guestSubscriptions.length }));
}

function handleGuestStatus(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    threatLevel: serverThreatLevel,
    evacuationActive: serverEvacuationActive,
    lockdownActive: serverLockdownActive,
    allClear: serverAllClear,
    activeIncidents: serverActiveIncidents,
  }));
}

async function handleGuestCount(req, res) {
  let count = 0;
  if (db) {
    try {
      const snapshot = await db.collection('guests').count().get();
      count = snapshot.data().count || 0;
    } catch (err) {
      console.log('[DB] Guest collection empty or not found. Defaulting count to 0.');
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    subscriptions: guestSubscriptions.length,
    database: count,
    count: count
  }));
}

async function handleGuestMagicLink(req, res) {
  const body = await readRequestBody(req);
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  const { room } = payload;
  
  if (!db) {
    return res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Database not configured' }));
  }

  const doc = await db.collection('guests').doc(String(room)).get();
  const guest = doc.exists ? doc.data() : null;

  if (!guest || !guest.phone) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Guest or phone number not found for this room' }));
    return;
  }

  const host = req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const magicUrl = `${protocol}://${host}/guest?magic_room=${room}`;

  if (twilioClient) {
    try {
      await twilioClient.messages.create({
        body: `AEGIS Safety Portal: ${magicUrl}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: guest.phone
      });
      console.log(`[SMS] Magic Link sent to Room ${room} (${guest.phone})`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Magic link SMS sent' }));
    } catch (err) {
      console.error('[SMS] Magic Link error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Twilio failed to send SMS' }));
    }
  } else {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: 'Twilio not configured',
      simulatedUrl: magicUrl
    }));
  }
}

async function handleGuestAdd(req, res) {
  const body = await readRequestBody(req);
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  const { room, name, floor, phone, sendMagicLink } = payload;
  if (!room || !name) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Room and Name are required' }));
    return;
  }

  // Normalize floor: "Floor 1" -> 1
  let normalizedFloor = floor;
  if (typeof floor === 'string' && floor.startsWith('Floor ')) {
    normalizedFloor = parseInt(floor.replace('Floor ', ''));
  } else if (floor === 'Lobby') {
    normalizedFloor = 0;
  }

  if (!db) {
    return res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Database not configured' }));
  }

  const newGuest = {
    room: String(room),
    name: String(name),
    floor: normalizedFloor !== undefined ? normalizedFloor : 'Unknown',
    phone: phone || null
  };

  try {
    await db.collection('guests').doc(String(room)).set(newGuest, { merge: true });
  } catch (err) {
    console.error('[DB] Guest insert error:', err);
    return res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'DB Error: ' + err.message }));
  }

  console.log(`[GUEST] Manually added guest: ${name} to Room ${room}`);

  let smsSent = false;
  if (sendMagicLink && phone && twilioClient) {
    try {
      const host = req.headers.host;
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const magicUrl = `${protocol}://${host}/guest?magic_room=${room}`;

      await twilioClient.messages.create({
        body: `AEGIS Safety Portal: ${magicUrl}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });
      smsSent = true;
    } catch (err) {
      console.error('[SMS] Magic Link error during add:', err.message);
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: true,
    guest: newGuest,
    smsSent
  }));
}

async function handleGuestNotify(req, res) {
  const body = await readRequestBody(req);
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  const { title, body: notifBody, severity, type, crisisType, floors } = payload;

  // Update server state
  if (type === 'evacuation') {
    serverEvacuationActive = true;
    serverThreatLevel = 'red';
  } else if (type === 'lockdown') {
    serverLockdownActive = true;
    serverThreatLevel = 'red';
  } else if (type === 'all-clear') {
    serverEvacuationActive = false;
    serverLockdownActive = false;
    serverAllClear = true;
    serverThreatLevel = 'green';
  }

  // Sync status changes to Firebase
  if (db) {
    try {
      await db.collection('system').doc('status').set({
        threatLevel: serverThreatLevel,
        evacuationActive: serverEvacuationActive,
        lockdownActive: serverLockdownActive,
        allClear: serverAllClear,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error('[DB] Failed to sync system status:', err.message);
    }
  }

  const notifPayload = JSON.stringify({
    title: title || 'AEGIS Emergency Alert',
    body: notifBody || 'Emergency situation. Check the app for details.',
    severity: severity || 'high',
    type: type || 'alert',
    crisisType: crisisType || 'Emergency',
    url: '/guest',
  });

  // 1. Process PUSH NOTIFICATIONS (for active browser sessions)
  let pushTargets = guestSubscriptions;
  if (floors && Array.isArray(floors) && floors.length > 0) {
    pushTargets = guestSubscriptions.filter(s => {
      const subFloor = typeof s.floor === 'string' ? s.floor.replace('Floor ', '') : s.floor;
      return floors.some(f => {
        const targetFloor = typeof f === 'string' ? f.replace('Floor ', '') : f;
        return String(subFloor) === String(targetFloor);
      });
    });
  }

  let sentPush = 0;
  let failedPush = 0;

  const pushPromises = pushTargets.map(async (guest) => {
    try {
      await webpush.sendNotification(guest.subscription, notifPayload);
      sentPush++;
    } catch (err) {
      failedPush++;
      if (err.statusCode === 410 || err.statusCode === 404) {
        const idx = guestSubscriptions.findIndex(s => s.subscription.endpoint === guest.subscription.endpoint);
        if (idx >= 0) guestSubscriptions.splice(idx, 1);
      }
    }
  });

  // 2. Process SMS ALERTS (for everyone in the registry with a phone number)
  let sentSms = 0;
  let smsPromises = [];

  if (twilioClient && db) {
    const snapshot = await db.collection('guests').get();
    let smsTargets = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.phone) smsTargets.push(data);
    });

    if (floors && Array.isArray(floors) && floors.length > 0) {
      smsTargets = smsTargets.filter(guest => {
        return floors.some(f => {
          const targetFloor = typeof f === 'string' ? f.replace('Floor ', '') : f;
          return String(guest.floor) === String(targetFloor);
        });
      });
    }

    smsPromises = smsTargets.map(async (guest) => {
      const room = guest.room;
      try {
        const host = req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const magicUrl = `${protocol}://${host}/guest?magic_room=${room}`;

        await twilioClient.messages.create({
          body: `ALERT: ${title}. Portal: ${magicUrl}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: guest.phone
        });
        console.log(`[SMS] Alert delivered to Room ${room} (${guest.phone})`);
        sentSms++;
      } catch (err) {
        console.error(`[SMS] Failed for Room ${room}:`, err.message);
      }
    });
  }

  await Promise.all([...pushPromises, ...smsPromises]);

  console.log(`[NOTIFY] Push: ${sentPush} sent, ${failedPush} failed | SMS: ${sentSms} sent`);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    push: { sent: sentPush, failed: failedPush },
    sms: { sent: sentSms },
    total: pushTargets.length 
  }));
}

async function handleEvacuationGuide(req, res) {
  const body = await readRequestBody(req);
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  const { room, floor, crisisType, severity } = payload;

  // Try Gemini API first
  if (GEMINI_API_KEY) {
    try {
      const prompt = buildEvacuationPrompt(room, floor, crisisType, severity);
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

      const apiRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
        }),
      });

      const apiData = await apiRes.json();
      const text = apiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Try to parse JSON array from the response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const steps = JSON.parse(jsonMatch[0]);
        if (Array.isArray(steps) && steps.length > 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ steps }));
          return;
        }
      }
    } catch (err) {
      console.error('[EVAC-AI] Gemini error:', err.message);
    }
  }

  // Fallback static steps
  const roomNum = parseInt(room);
  const stairwell = (!isNaN(roomNum) && roomNum % 10 > 5) ? 'Stairwell B (East End)' : 'Stairwell A (West End)';

  const fallbackSteps = [
    `Leave Room ${room} immediately. Take your phone and room key only.`,
    `Turn right and proceed to ${stairwell}. Do not use elevators.`,
    `Walk down the stairs to the ground floor. Hold the handrail.`,
    `Exit through the emergency doors to the main parking lot assembly point.`,
    `Report to hotel staff at the assembly area. Identify yourself and your room number.`,
  ];

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ steps: fallbackSteps }));
}

async function handleUpdateStatus(req, res) {
  const body = await readRequestBody(req);
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  if (payload.threatLevel) serverThreatLevel = payload.threatLevel;
  if (payload.evacuationActive !== undefined) serverEvacuationActive = payload.evacuationActive;
  if (payload.lockdownActive !== undefined) serverLockdownActive = payload.lockdownActive;
  if (payload.allClear !== undefined) serverAllClear = payload.allClear;
  if (payload.activeIncidents !== undefined) serverActiveIncidents = payload.activeIncidents;

  // Sync to Firebase
  if (db) {
    try {
      await db.collection('system').doc('status').set({
        threatLevel: serverThreatLevel,
        evacuationActive: serverEvacuationActive,
        lockdownActive: serverLockdownActive,
        allClear: serverAllClear,
        activeIncidents: serverActiveIncidents,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error('[DB] Failed to sync system status:', err.message);
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true }));
}

async function serveStatic(req, res, pathname) {
  // Normalize pathname to remove potential directory traversal or leading slashes issues
  let normalizedPath = pathname;
  if (normalizedPath === '/' || normalizedPath === '') {
    normalizedPath = '/index.html';
  }
  if (normalizedPath === '/guest' || normalizedPath === '/guest/') {
    normalizedPath = '/guest.html';
  }

  // Ensure path is relative to rootDir
  const relativePath = normalizedPath.startsWith('/') ? normalizedPath.slice(1) : normalizedPath;
  const filePath = path.join(rootDir, relativePath);

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase() || '.html';
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // Set charset for text types
    const headerContentType = (contentType.startsWith('text/') || contentType === 'application/javascript')
      ? `${contentType}; charset=utf-8`
      : contentType;

    res.writeHead(200, {
      'Content-Type': headerContentType,
      'X-Content-Type-Options': 'nosniff' // Prevent MIME type sniffing issues
    });
    res.end(data);
    console.log(`[GET] 200 - ${normalizedPath} (${headerContentType})`);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File not found');
    console.error(`[GET] 404 - ${normalizedPath} (Resolved: ${filePath})`);
  }
}

async function requestListener(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  console.log(`[${req.method}] ${url.pathname}`);


  // CORS headers for API
  if (url.pathname.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
  }

  // API ROUTES
  if (req.method === 'POST' && url.pathname === '/api/decision') {
    return handleDecisionRequest(req, res);
  }

  // Guest API routes
  if (req.method === 'GET' && url.pathname === '/api/guest/vapid-public-key') {
    return handleVapidPublicKey(req, res);
  }
  if (req.method === 'POST' && url.pathname === '/api/guest/subscribe') {
    return handleGuestSubscribe(req, res);
  }
  if (req.method === 'POST' && url.pathname === '/api/guest/verify') {
    return handleGuestVerify(req, res);
  }
  if (req.method === 'POST' && url.pathname === '/api/guest/unsubscribe') {
    return handleGuestUnsubscribe(req, res);
  }
  if (req.method === 'GET' && url.pathname === '/api/guest/status') {
    return handleGuestStatus(req, res);
  }
  if (req.method === 'GET' && url.pathname === '/api/guest/count') {
    return handleGuestCount(req, res);
  }
  if (req.method === 'GET' && url.pathname === '/api/guest/list') {
    let guestsObj = {};
    if (db) {
      const snapshot = await db.collection('guests').get();
      snapshot.forEach(doc => {
        guestsObj[doc.id] = doc.data();
      });
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      guests: guestsObj,
      subscriptions: guestSubscriptions.map(s => ({ room: s.room, subscribedAt: s.subscribedAt }))
    }));
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/guest/add') {
    return handleGuestAdd(req, res);
  }
  if (req.method === 'POST' && url.pathname === '/api/guest/remove') {
    const body = await readRequestBody(req);
    const { room } = JSON.parse(body);
    
    if (room && db) {
      try {
        await db.collection('guests').doc(String(room)).delete();
        // Also remove any active subscriptions for this room
        const idx = guestSubscriptions.findIndex(s => String(s.room) === String(room));
        if (idx >= 0) guestSubscriptions.splice(idx, 1);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      } catch (err) { /* fallback below */ }
    }
    
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Room not found or delete failed' }));
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/guest/magic-link') {
    return handleGuestMagicLink(req, res);
  }
  if (req.method === 'POST' && url.pathname === '/api/guest/notify') {
    return handleGuestNotify(req, res);
  }
  if (req.method === 'POST' && url.pathname === '/api/guest/evacuation-guide') {
    return handleEvacuationGuide(req, res);
  }
  if (req.method === 'POST' && url.pathname === '/api/guest/update-status') {
    return handleUpdateStatus(req, res);
  }

  // STATIC FILE SERVING
  if (req.method === 'GET') {
    let pathname = url.pathname;
    if (pathname.endsWith('/') && pathname !== '/') pathname += 'index.html';
    return serveStatic(req, res, pathname);
  }

  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method not allowed');
}

loadDotEnv().then(async () => {
  setupFirebase();
  await setupVapidKeys();
  setupTwilio();

  const server = http.createServer(requestListener);
  server.listen(port, () => {
    console.log(`\x1b[32m%s\x1b[0m`, `[AEGIS] Rapid Crisis Response System Live`);
    console.log(`[URL] http://localhost:${port}`);
    console.log(`[GUEST] http://localhost:${port}/guest?room=305&floor=3`);
    if (!GEMINI_API_KEY) {
      console.error('\x1b[31m%s\x1b[0m', 'WARNING: GEMINI_API_KEY is not set — AI features will use fallbacks');
    }
    console.log(`[PUSH] VAPID keys configured. Ready for guest subscriptions.`);
  });
});