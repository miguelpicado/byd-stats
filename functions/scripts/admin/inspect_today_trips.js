
const admin = require('firebase-admin');
const fs = require('fs');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'REDACTED_FIREBASE_PROJECT_ID'
    });
}
const db = admin.firestore();

async function inspectTrips() {
    fs.writeFileSync('today_trips.txt', ''); // Clear file
    const logVal = (msg) => {
        fs.appendFileSync('today_trips.txt', msg + '\n');
        console.log(msg);
    };

    logVal('Fetching trips for Feb 16...');

    const startDate = admin.firestore.Timestamp.fromDate(new Date('2026-02-16T00:00:00Z'));

    const vehicles = await db.collection('bydVehicles').get();

    for (const vDoc of vehicles.docs) {
        const vin = vDoc.id;
        const vData = vDoc.data();
        logVal(`\nVehicle: ${vin}`);

        const trips = await vDoc.ref.collection('trips')
            .where('startDate', '>=', startDate)
            .get();

        if (trips.empty) {
            logVal('  No trips found for today.');
            continue;
        }

        trips.docs.forEach(doc => {
            const data = doc.data();
            logVal(`ID: ${doc.id} | Status: ${data.status} | SoC: ${data.startSoC}->${data.endSoC} | kWh: ${data.electricity}`);
        });
    }
}

inspectTrips().then(() => console.log('Done.')).catch(console.error);
