const admin = require('firebase-admin');
// Use the compiled JS file
require('dotenv').config();

// Require API Key BEFORE requiring googleMaps
if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.error('[CRITICAL] GOOGLE_MAPS_API_KEY environment variable is not set. Exiting.');
    process.exit(1);
}

// Use the compiled JS file
const { snapToRoads, calculatePathDistanceKm } = require('./lib/googleMaps.js');

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'REDACTED_FIREBASE_PROJECT_ID'
    });
}
const db = admin.firestore();

const fs = require('fs');
const logFile = fs.createWriteStream('reprocess_log.txt', { flags: 'w' });
const originalLog = console.log;
const originalError = console.error;

console.log = function (...args) {
    const msg = args.map(a => String(a)).join(' ');
    logFile.write('[LOG] ' + msg + '\n');
    originalLog.apply(console, args);
};
console.error = function (...args) {
    const msg = args.map(a => String(a)).join(' ');
    logFile.write('[ERR] ' + msg + '\n');
    originalError.apply(console, args);
};

const TRIP_ID = process.argv[2] || 'x3N5VIajJ54ahunKiIEU';

async function reprocessTrip() {
    console.log(`Starting reproccess for trip ${TRIP_ID}...`);

    let tripDoc;
    // Fallback: iterate vehicles (slow but works without index/FieldPath issues)
    console.log('Iterating vehicles to find trip...');
    const vehicles = await db.collection('bydVehicles').get();
    for (const vDoc of vehicles.docs) {
        const tDoc = await vDoc.ref.collection('trips').doc(TRIP_ID).get();
        if (tDoc.exists) {
            tripDoc = tDoc;
            break;
        }
    }

    if (!tripDoc) {
        console.error('Trip not found in any vehicle.');
        process.exit(1);
    }

    await processTripDoc(tripDoc);
}

async function processTripDoc(tripDoc) {
    const tripRef = tripDoc.ref;
    const tripData = tripDoc.data();
    // Check structure of tripRef.parent.parent
    const vin = tripRef.parent.parent ? tripRef.parent.parent.id : 'unknown';

    console.log(`Found trip for vehicle VIN: ${vin}`);
    console.log(`Current points in document: ${tripData.points ? tripData.points.length : 0}`);

    // Fetch points from subcollection
    console.log('Fetching points from subcollection...');
    const pointsSnap = await tripRef.collection('points').orderBy('timestamp').get();
    const subPoints = pointsSnap.docs.map(doc => doc.data());
    console.log(`Found ${subPoints.length} points in subcollection.`);

    // Merge points
    let rawPoints = [...(tripData.points || []), ...subPoints];

    // Sort and Deduplicate
    rawPoints.sort((a, b) => a.timestamp - b.timestamp);
    rawPoints = rawPoints.filter((p, i, arr) =>
        i === 0 || p.timestamp > arr[i - 1].timestamp
    );

    console.log(`Total merged points: ${rawPoints.length}`);

    let snappedPoints = rawPoints;
    let gpsDistance = tripData.gpsDistanceKm || 0;

    if (rawPoints.length >= 2) {
        // Run Snap to Road
        console.log('Running snapToRoads...');
        snappedPoints = await snapToRoads(rawPoints);
        console.log(`Snap complete. Resulting points: ${snappedPoints.length}`);

        // Update Trip
        gpsDistance = calculatePathDistanceKm(snappedPoints);
        console.log(`Calculated GPS Distance: ${gpsDistance} km`);
    } else {
        console.log('Not enough points to snap. Skipping map update.');
    }

    // Calculate Electricity
    let electricityKwh = tripData.electricity;

    // Fetch vehicle for capacity
    const vehicleRef = tripRef.parent.parent;
    if (vehicleRef) {
        const vSnap = await vehicleRef.get();
        const vData = vSnap.data();
        const capacity = vData.batteryCapacity || 82.56; // Default to 82.56

        if (tripData.startSoC !== undefined && tripData.endSoC !== undefined) {
            const delta = tripData.startSoC - tripData.endSoC;
            // Allow negative delta (charging) to show as 0 consumption, or handle as regen?
            // For now, simple consumption
            const calculated = Math.round(Math.max(0, delta * capacity) * 100) / 100;
            console.log(`Recalculating Electricity: ${delta.toFixed(2)} * ${capacity} = ${calculated} kWh`);
            electricityKwh = calculated;
        }
    }

    await tripRef.update({
        points: snappedPoints.length > 0 ? snappedPoints : tripData.points, // Keep original if no snap
        gpsDistanceKm: gpsDistance,
        electricity: electricityKwh,
        lastUpdate: admin.firestore.Timestamp.now()
    });



    await tripRef.update({
        points: snappedPoints,
        gpsDistanceKm: gpsDistance,
        electricity: electricityKwh,
        lastUpdate: admin.firestore.Timestamp.now()
    });

    console.log('Trip updated successfully!');
}

reprocessTrip().then(() => {
    console.log('Done.');
}).catch(err => {
    console.error(err);
});
