const admin = require('firebase-admin');
require('dotenv').config();

const projectId = process.env.FIREBASE_PROJECT_ID?.replace(/^"|"$/g, '').trim();
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.replace(/^"|"$/g, '').trim();
let privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();

if (privateKey) {
  privateKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
}

async function testDatabase(dbName) {
  console.log(`\n--- Testing Database ID: "${dbName}" ---`);
  try {
    const app = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      databaseId: dbName
    }, dbName); // Use name as app name too for uniqueness

    const db = app.firestore();
    await db.collection('test').doc('ping').get();
    console.log(`SUCCESS: Found and reached database "${dbName}"`);
    return true;
  } catch (err) {
    console.error(`FAILED for "${dbName}":`, err.message);
    return false;
  }
}

async function run() {
  console.log('--- Firebase Multi-Database Debug ---');
  console.log('Project ID:', projectId);

  const foundDefaultWithParens = await testDatabase('(default)');
  const foundDefaultNoParens = await testDatabase('default');

  if (foundDefaultWithParens || foundDefaultNoParens) {
    console.log('\n=========================================');
    console.log('RESULT: One of the database IDs worked!');
    console.log('Please tell me which one worked so I can update the main server.');
    console.log('=========================================');
  } else {
    console.log('\n=========================================');
    console.log('RESULT: Both failed.');
    console.log('This almost certainly means the "Cloud Firestore API" is DISABLED.');
    console.log('Please check your "API/Service Details" tab and click ENABLE.');
    console.log('=========================================');
  }
}

run();
