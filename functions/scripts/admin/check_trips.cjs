const admin = require('firebase-admin');
admin.initializeApp({
    projectId: 'REDACTED_FIREBASE_PROJECT_ID'
});
const db = admin.firestore();

async function check() {
    console.log('Checking trips...');
    const snapshot = await db.collectionGroup('trips').orderBy('startDate', 'desc').limit(5).get();
    if (snapshot.empty) {
        console.log('No trips found in Firestore.');
        return;
    }
    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`Trip ID: ${doc.id}`);
        console.log(`  Date: ${data.startDate?.toDate()}`);
        console.log(`  Distance: ${data.distanceKm} km`);
        console.log(`  Status: ${data.status}`);
        console.log(`  Source: ${data.source}`);
    });
}

check().catch(console.error);
