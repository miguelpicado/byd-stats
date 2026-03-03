const admin = require('firebase-admin');

// Initialize
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'REDACTED_FIREBASE_PROJECT_ID'
  });
}

const db = admin.firestore();

async function listTrips() {
  const trips = await db.collectionGroup('trips').orderBy('startDate', 'desc').limit(30).get();

  console.log('ID | Start | Status | Distance | Source | Type');
  console.log('---'.repeat(30));

  trips.forEach(doc => {
    const d = doc.data();
    const start = d.startDate?.toDate?.().toISOString().slice(0, 16) || 'N/A';
    const status = d.status || 'unknown';
    const dist = (d.distanceKm || 0).toFixed(2);
    const source = d.source || d.detectionMethod || 'unknown';
    const type = d.type || 'unknown';
    console.log(`${doc.id} | ${start} | ${status} | ${dist}km | ${source} | ${type}`);
  });

  console.log('\nTotal:', trips.size, 'trips');
}

listTrips().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
