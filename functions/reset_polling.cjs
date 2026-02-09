// Reset polling state for a vehicle
const admin = require('firebase-admin');

// Initialize
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'REDACTED_FIREBASE_PROJECT_ID'
  });
}

const db = admin.firestore();

async function resetPolling() {
  // Get all vehicles
  const vehiclesSnap = await db.collection('vehicles').get();

  for (const doc of vehiclesSnap.docs) {
    const data = doc.data();
    console.log(`Vehicle ${doc.id}:`);
    console.log(`  - pollingActive: ${data.pollingActive}`);
    console.log(`  - idlePollCount: ${data.idlePollCount || 0}`);
    console.log(`  - activeTripId: ${data.activeTripId || 'none'}`);

    // Reset polling state
    await doc.ref.update({
      pollingActive: false,
      idlePollCount: 0,
      errorPollCount: 0,
    });
    console.log(`  -> Reset pollingActive to FALSE`);
  }

  console.log('\nDone! Polling should stop on next scheduled run.');
}

resetPolling().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
