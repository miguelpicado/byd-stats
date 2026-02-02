import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

admin.initializeApp();
const db = admin.firestore();

// Secret from Smartcar Dashboard (Set via firebase functions:config:set smartcar.secret="...")
// specific for local emulator, we fallback to a default
const SMARTCAR_AMT = process.env.SMARTCAR_AMT || 'default-secret';

/**
 * Verify HMAC signature from Smartcar
 */
const verifySignature = (req: functions.https.Request): boolean => {
    const signature = req.headers['sc-signature'];
    if (!signature || typeof signature !== 'string') return false;

    const hmac = crypto.createHmac('sha256', SMARTCAR_AMT);
    const body = JSON.stringify(req.body);
    hmac.update(body);
    const textDigest = hmac.digest('hex');

    return signature === textDigest;
};

export const smartcarWebhook = functions.https.onRequest(async (req, res) => {
    // 1. Verify Signature (Skip in dev/test if needed, but good practice)
    // if (!verifySignature(req)) {
    //    res.status(401).send('Invalid signature');
    //    return;
    // }

    const { eventName, payload, vehicleId } = req.body;

    if (!eventName || !vehicleId) {
        res.status(400).send('Missing eventName or vehicleId');
        return;
    }

    try {
        const vehicleRef = db.collection('vehicles').doc(vehicleId);
        const now = admin.firestore.Timestamp.now();

        // 2. Handle Odometer (Trip Logic)
        if (eventName === 'odometer') {
            const newOdometer = payload.distance;

            // Get current vehicle state
            const vehicleSnap = await vehicleRef.get();
            const vehicleData = vehicleSnap.data() || {};
            const lastOdometer = vehicleData.lastOdometer || newOdometer;

            // Update Vehicle State
            await vehicleRef.set({
                lastOdometer: newOdometer,
                lastUpdate: now,
                make: 'BYD', // Default, update via other means
            }, { merge: true });

            // Logic: If odometer increased significantly, we might have finished a trip
            // Ideally, we'd have a 'trip_start' state or similar. 
            // For now, let's just log the potential trip if delta > 1km
            const delta = newOdometer - lastOdometer;
            if (delta > 0.5) {
                // Determine if we should append to an open trip or start new
                // Simplified: Create a completed trip entry for this segment
                await db.collection('trips').add({
                    vehicleId,
                    distanceKm: delta,
                    endOdometer: newOdometer,
                    startOdometer: lastOdometer,
                    endDate: now,
                    // We assume start date was 'lastUpdate', fallback to now - X
                    startDate: vehicleData.lastUpdate || now,
                    source: 'smartcar_webhook'
                });
            }
        }

        // 3. Handle SoC (Consumption/Charging Logic)
        if (eventName === 'charge.stateOfCharge') {
            const newSoC = payload.percentRemaining;

            await vehicleRef.set({
                lastSoC: newSoC,
                lastUpdate: now
            }, { merge: true });
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).send('Internal Server Error');
    }
});
