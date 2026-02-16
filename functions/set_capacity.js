
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'REDACTED_FIREBASE_PROJECT_ID'
    });
}
const db = admin.firestore();

async function setCapacity() {
    const vin = 'LGXCH6CD0S2052990';
    console.log(`Setting batteryCapacity for ${vin}...`);

    await db.collection('bydVehicles').doc(vin).update({
        batteryCapacity: 82.56
    });

    console.log('Updated successfully.');
}

setCapacity().then(() => process.exit(0)).catch(console.error);
