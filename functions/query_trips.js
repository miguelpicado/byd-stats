const admin = require('firebase-admin');

// Initialize with default credentials (uses GOOGLE_APPLICATION_CREDENTIALS env var)
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

async function getRecentTrips() {
    try {
        // Get trips from Feb 3rd and 4th, 2026
        const feb3Start = new Date('2026-02-03T00:00:00Z');
        const feb5Start = new Date('2026-02-05T00:00:00Z');

        const tripsSnapshot = await db.collectionGroup('trips')
            .where('startDate', '>=', admin.firestore.Timestamp.fromDate(feb3Start))
            .where('startDate', '<', admin.firestore.Timestamp.fromDate(feb5Start))
            .orderBy('startDate', 'asc')
            .get();

        console.log(`\n=== TRIPS FROM FEB 3-4, 2026 ===\n`);
        console.log(`Total trips found: ${tripsSnapshot.size}\n`);

        tripsSnapshot.forEach((doc, index) => {
            const data = doc.data();
            console.log(`\n--- TRIP ${index + 1} (ID: ${doc.id}) ---`);
            console.log(`Status: ${data.status}`);
            console.log(`Type: ${data.type}`);
            console.log(`Source: ${data.source}`);

            // Timestamps
            if (data.startDate) {
                const startDate = data.startDate.toDate();
                console.log(`Start Date: ${startDate.toISOString()} (${startDate.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })})`);
            }
            if (data.endDate) {
                const endDate = data.endDate.toDate();
                console.log(`End Date: ${endDate.toISOString()} (${endDate.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })})`);
            }
            if (data.lastUpdate) {
                const lastUpdate = data.lastUpdate.toDate();
                console.log(`Last Update: ${lastUpdate.toISOString()} (${lastUpdate.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })})`);
            }

            // Distance and consumption
            console.log(`Distance: ${data.distanceKm || 0} km`);
            console.log(`GPS Distance: ${data.gpsDistanceKm || 'N/A'} km`);
            console.log(`Start Odometer: ${data.startOdometer || 'N/A'} km`);
            console.log(`End Odometer: ${data.endOdometer || 'N/A'} km`);
            console.log(`Start SoC: ${data.startSoC || 'N/A'}%`);
            console.log(`End SoC: ${data.endSoC || 'N/A'}%`);
            console.log(`Consumption: ${data.consumptionKwh || 'N/A'} kWh`);
            console.log(`Duration: ${data.durationMinutes || 'N/A'} minutes`);

            // GPS data
            if (data.startLocation) {
                console.log(`Start Location: ${data.startLocation.latitude}, ${data.startLocation.longitude}`);
            }
            if (data.endLocation) {
                console.log(`End Location: ${data.endLocation.latitude}, ${data.endLocation.longitude}`);
            }

            console.log(`\nRAW DATA:`);
            console.log(JSON.stringify(data, null, 2));
        });

        process.exit(0);
    } catch (error) {
        console.error('Error fetching trips:', error);
        process.exit(1);
    }
}

getRecentTrips();
