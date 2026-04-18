const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const { URL } = require('url');
const webpush = require('web-push');

const rootDir = path.resolve(__dirname);
const port = process.env.PORT || 8000;
let GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Updated to 1.5-flash for faster response in crisis scenarios
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

// --- Guest Push Notification State ---
const guestSubscriptions = []; // { subscription, room, floor, subscribedAt }
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
    envText.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1];
        let value = match[2].trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
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

  console.log('[VAPID] Push notification keys configured');
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

  // Remove existing subscription for same endpoint (re-subscribe)
  const existingIdx = guestSubscriptions.findIndex(s => s.subscription.endpoint === subscription.endpoint);
  if (existingIdx >= 0) guestSubscriptions.splice(existingIdx, 1);

  guestSubscriptions.push({
    subscription,
    room: room || 'unknown',
    floor: floor || 'unknown',
    subscribedAt: new Date().toISOString(),
  });

  console.log(`[GUEST] New subscription: Room ${room}, ${floor} (Total: ${guestSubscriptions.length})`);
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

function handleGuestCount(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ count: guestSubscriptions.length }));
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

  const notifPayload = JSON.stringify({
    title: title || 'AEGIS Emergency Alert',
    body: notifBody || 'Emergency situation. Check the app for details.',
    severity: severity || 'high',
    type: type || 'alert',
    crisisType: crisisType || 'Emergency',
    url: '/guest',
  });

  // Filter by floors if specified
  let targets = guestSubscriptions;
  if (floors && Array.isArray(floors) && floors.length > 0) {
    targets = guestSubscriptions.filter(s => floors.includes(s.floor));
  }

  let sent = 0;
  let failed = 0;

  const sendPromises = targets.map(async (guest) => {
    try {
      await webpush.sendNotification(guest.subscription, notifPayload);
      sent++;
    } catch (err) {
      failed++;
      // Remove invalid subscriptions (410 Gone or 404)
      if (err.statusCode === 410 || err.statusCode === 404) {
        const idx = guestSubscriptions.findIndex(s => s.subscription.endpoint === guest.subscription.endpoint);
        if (idx >= 0) guestSubscriptions.splice(idx, 1);
      }
    }
  });

  await Promise.all(sendPromises);

  console.log(`[NOTIFY] Sent ${sent} notifications, ${failed} failed`);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ sent, failed, total: targets.length }));
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

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true }));
}

async function serveStatic(req, res, pathname) {
  let filePath = path.join(rootDir, pathname);
  if (pathname === '/' || pathname === '') {
    filePath = path.join(rootDir, 'index.html');
  }
  // Serve guest page
  if (pathname === '/guest' || pathname === '/guest/') {
    filePath = path.join(rootDir, 'guest.html');
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath) || '.html';
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File not found');
  }
}

async function requestListener(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

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
  if (req.method === 'POST' && url.pathname === '/api/guest/unsubscribe') {
    return handleGuestUnsubscribe(req, res);
  }
  if (req.method === 'GET' && url.pathname === '/api/guest/status') {
    return handleGuestStatus(req, res);
  }
  if (req.method === 'GET' && url.pathname === '/api/guest/count') {
    return handleGuestCount(req, res);
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
  await setupVapidKeys();

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