const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function recover() {
    console.log('Starting recovery of the trip...');

    // We split the 9km trip into two segments as per logs
    const trips = [
        {
            vehicleId: '557430f4-6dbe-464e-833d-5b419a0e4eca',
            startDate: admin.firestore.Timestamp.fromDate(new Date('2026-02-03T16:29:00Z')),
            endDate: admin.firestore.Timestamp.fromDate(new Date('2026-02-03T17:25:00Z')),
            startOdometer: 11845,
            endOdometer: 11852,
            distanceKm: 7,
            startSoC: 84,
            endSoC: 83.5,
            status: 'completed',
            source: 'smartcar_recovered',
            type: 'trip',
            durationMinutes: 56,
            consumptionKwh: 0.6
        },
        {
            vehicleId: '557430f4-6dbe-464e-833d-5b419a0e4eca',
            startDate: admin.firestore.Timestamp.fromDate(new Date('2026-02-03T17:30:00Z')),
            endDate: admin.firestore.Timestamp.fromDate(new Date('2026-02-03T18:26:00Z')),
            startOdometer: 11852,
            endOdometer: 11854,
            distanceKm: 2,
            startSoC: 83.5,
            endSoC: 83.2,
            status: 'completed',
            source: 'smartcar_recovered',
            type: 'trip',
            durationMinutes: 56,
            consumptionKwh: 0.2
        }
    ];

    for (const trip of trips) {
        const res = await db.collection('bydVehicles').doc(trip.vehicleId).collection('trips').add(trip);
        console.log('Added trip with ID:', res.id);
    }
}

recover().catch(console.error);
