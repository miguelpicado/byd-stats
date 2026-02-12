/**
 * BYD Direct API Functions
 * Alternative to Smartcar - uses BYD API directly
 *
 * Version: 1.0.0 - Initial BYD direct API integration
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { BydClient, BydConfig, initBydModule } from './byd';

// Initialize Firestore (may already be initialized by main index.ts)
try {
    admin.initializeApp();
} catch (e) {
    // Already initialized
}

const db = admin.firestore();

// Region: Europe (Belgium) - matches Firestore eur3 location
const REGION = 'europe-west1';
const regionalFunctions = functions.region(REGION);

// Initialize BYD module on cold start
let bydInitialized = false;
function ensureBydInit() {
    if (!bydInitialized) {
        initBydModule();
        bydInitialized = true;
    }
}

// =============================================================================
// BYD AUTHENTICATION
// =============================================================================

/**
 * Connect BYD account using username/password
 * Stores encrypted credentials in Firestore
 */
export const bydConnect = regionalFunctions.https.onCall(async (data, context) => {
    const { username, password, countryCode, controlPin, userId } = data;

    if (!username || !password || !countryCode || !userId) {
        throw new functions.https.HttpsError('invalid-argument',
            'Missing required fields: username, password, countryCode, userId');
    }

    ensureBydInit();

    try {
        // Test credentials by logging in
        const config: BydConfig = {
            username,
            password,
            countryCode,
            controlPin,
        };

        const client = new BydClient(config);
        await client.login();

        // Get vehicles
        const vehicles = await client.getVehicles();

        if (vehicles.length === 0) {
            throw new functions.https.HttpsError('not-found', 'No vehicles found in BYD account');
        }

        // Store credentials (encrypted) for each vehicle
        const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;
        if (!ENCRYPTION_KEY) {
            throw new functions.https.HttpsError('internal', 'Encryption key not configured');
        }

        const crypto = require('crypto');
        const encrypt = (text: string) => {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
            const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
            const authTag = cipher.getAuthTag();
            return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
        };

        const batch = db.batch();
        const connectedVehicles: any[] = [];

        for (const vehicle of vehicles) {
            const vehicleRef = db.collection('bydVehicles').doc(vehicle.vin);

            batch.set(vehicleRef, {
                vin: vehicle.vin,
                vehicleId: vehicle.vehicleId,
                vehicleType: vehicle.vehicleType,
                vehicleName: vehicle.vehicleName,
                brandName: vehicle.brandName,
                modelName: vehicle.modelName,
                plateNo: vehicle.plateNo,
                userId,
                connectedAt: admin.firestore.Timestamp.now(),
                lastUpdate: admin.firestore.Timestamp.now(),
            }, { merge: true });

            // Store encrypted credentials in subcollection
            const credentialsRef = vehicleRef.collection('private').doc('credentials');
            batch.set(credentialsRef, {
                username: encrypt(username),
                password: encrypt(password),
                countryCode,
                controlPin: controlPin ? encrypt(controlPin) : null,
                lastLogin: admin.firestore.Timestamp.now(),
            });

            connectedVehicles.push({
                vin: vehicle.vin,
                name: vehicle.vehicleName,
                model: vehicle.modelName,
            });
        }

        await batch.commit();

        console.log(`[bydConnect] Connected ${vehicles.length} vehicles for user ${userId}`);

        return {
            success: true,
            vehicles: connectedVehicles,
        };

    } catch (error: any) {
        console.error('[bydConnect] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Disconnect BYD account
 */
export const bydDisconnect = regionalFunctions.https.onCall(async (data, context) => {
    const { vin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    try {
        const vehicleRef = db.collection('bydVehicles').doc(vin);
        const credentialsRef = vehicleRef.collection('private').doc('credentials');

        await credentialsRef.delete();
        await vehicleRef.update({
            disconnectedAt: admin.firestore.Timestamp.now(),
        });

        console.log(`[bydDisconnect] Disconnected vehicle ${vin}`);

        return { success: true };

    } catch (error: any) {
        console.error('[bydDisconnect] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// =============================================================================
// HELPER: Get BYD Client for a vehicle
// =============================================================================

async function getBydClientForVehicle(vin: string): Promise<BydClient> {
    ensureBydInit();

    const credentialsRef = db.collection('bydVehicles').doc(vin).collection('private').doc('credentials');
    const credentialsDoc = await credentialsRef.get();

    if (!credentialsDoc.exists) {
        throw new Error('Vehicle not connected to BYD');
    }

    const creds = credentialsDoc.data()!;
    const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;
    if (!ENCRYPTION_KEY) {
        throw new Error('Encryption key not configured');
    }

    const crypto = require('crypto');
    const decrypt = (encrypted: string) => {
        const [ivHex, authTagHex, dataHex] = encrypted.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const data = Buffer.from(dataHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
        decipher.setAuthTag(authTag);
        return decipher.update(data, undefined, 'utf8') + decipher.final('utf8');
    };

    const config: BydConfig = {
        username: decrypt(creds.username),
        password: decrypt(creds.password),
        countryCode: creds.countryCode,
        controlPin: creds.controlPin ? decrypt(creds.controlPin) : undefined,
    };

    return new BydClient(config);
}

// =============================================================================
// VEHICLE DATA
// =============================================================================

/**
 * Get realtime vehicle data (battery, range, odometer, etc.)
 */
export const bydGetRealtime = regionalFunctions.https.onCall(async (data, context) => {
    const { vin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    try {
        const client = await getBydClientForVehicle(vin);
        await client.login();
        const realtime = await client.getRealtime(vin);

        // Update vehicle state in Firestore
        const vehicleRef = db.collection('bydVehicles').doc(vin);
        await vehicleRef.update({
            lastSoC: realtime.soc / 100, // Normalize to 0-1
            lastRange: realtime.range,
            lastOdometer: realtime.odometer,
            isCharging: realtime.isCharging,
            isLocked: realtime.isLocked,
            isOnline: realtime.isOnline,
            lastUpdate: admin.firestore.Timestamp.now(),
        });

        console.log(`[bydGetRealtime] ${vin}: SOC=${realtime.soc}%, range=${realtime.range}km, odo=${realtime.odometer}km`);

        return {
            success: true,
            data: realtime,
        };

    } catch (error: any) {
        console.error('[bydGetRealtime] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Get GPS location
 */
export const bydGetGps = regionalFunctions.https.onCall(async (data, context) => {
    const { vin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    try {
        const client = await getBydClientForVehicle(vin);
        await client.login();
        const gps = await client.getGps(vin);

        // Update vehicle location in Firestore
        const vehicleRef = db.collection('bydVehicles').doc(vin);
        await vehicleRef.update({
            lastLocation: {
                lat: gps.latitude,
                lon: gps.longitude,
                heading: gps.heading,
            },
            lastLocationUpdate: admin.firestore.Timestamp.now(),
        });

        console.log(`[bydGetGps] ${vin}: ${gps.latitude}, ${gps.longitude}`);

        return {
            success: true,
            data: gps,
        };

    } catch (error: any) {
        console.error('[bydGetGps] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Get charging status
 */
export const bydGetCharging = regionalFunctions.https.onCall(async (data, context) => {
    const { vin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    try {
        const client = await getBydClientForVehicle(vin);
        await client.login();
        const charging = await client.getChargingStatus(vin);

        console.log(`[bydGetCharging] ${vin}: SOC=${charging.soc}%, charging=${charging.isCharging}`);

        return {
            success: true,
            data: charging,
        };

    } catch (error: any) {
        console.error('[bydGetCharging] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// =============================================================================
// REMOTE CONTROL
// =============================================================================

/**
 * Lock vehicle
 */
export const bydLock = regionalFunctions.https.onCall(async (data, context) => {
    const { vin, pin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    try {
        const client = await getBydClientForVehicle(vin);
        await client.login();
        const success = await client.lock(vin, pin);

        if (success) {
            await db.collection('bydVehicles').doc(vin).update({
                isLocked: true,
                lastUpdate: admin.firestore.Timestamp.now(),
            });
        }

        console.log(`[bydLock] ${vin}: ${success ? 'SUCCESS' : 'FAILED'}`);

        return { success };

    } catch (error: any) {
        console.error('[bydLock] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Unlock vehicle
 */
export const bydUnlock = regionalFunctions.https.onCall(async (data, context) => {
    const { vin, pin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    try {
        const client = await getBydClientForVehicle(vin);
        await client.login();
        const success = await client.unlock(vin, pin);

        if (success) {
            await db.collection('bydVehicles').doc(vin).update({
                isLocked: false,
                lastUpdate: admin.firestore.Timestamp.now(),
            });
        }

        console.log(`[bydUnlock] ${vin}: ${success ? 'SUCCESS' : 'FAILED'}`);

        return { success };

    } catch (error: any) {
        console.error('[bydUnlock] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Start climate
 */
export const bydStartClimate = regionalFunctions.https.onCall(async (data, context) => {
    const { vin, temperature, pin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    try {
        const client = await getBydClientForVehicle(vin);
        await client.login();
        const success = await client.startClimate(vin, temperature || 22, pin);

        console.log(`[bydStartClimate] ${vin}: ${success ? 'SUCCESS' : 'FAILED'}`);

        return { success };

    } catch (error: any) {
        console.error('[bydStartClimate] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Stop climate
 */
export const bydStopClimate = regionalFunctions.https.onCall(async (data, context) => {
    const { vin, pin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    try {
        const client = await getBydClientForVehicle(vin);
        await client.login();
        const success = await client.stopClimate(vin, pin);

        console.log(`[bydStopClimate] ${vin}: ${success ? 'SUCCESS' : 'FAILED'}`);

        return { success };

    } catch (error: any) {
        console.error('[bydStopClimate] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Flash lights / Find car
 */
export const bydFlashLights = regionalFunctions.https.onCall(async (data, context) => {
    const { vin, pin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    try {
        const client = await getBydClientForVehicle(vin);
        await client.login();
        const success = await client.flashLights(vin, pin);

        console.log(`[bydFlashLights] ${vin}: ${success ? 'SUCCESS' : 'FAILED'}`);

        return { success };

    } catch (error: any) {
        console.error('[bydFlashLights] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// =============================================================================
// POLLING FOR TRIPS (Similar to Smartcar but using BYD API)
// =============================================================================

/**
 * Poll vehicle for trip tracking (called by scheduler)
 * This is the BYD equivalent of the Smartcar scheduledPoll
 */
export const bydPollVehicle = regionalFunctions.https.onCall(async (data, context) => {
    const { vin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    try {
        const client = await getBydClientForVehicle(vin);
        await client.login();

        // Get all data in parallel
        const [realtime, gps] = await Promise.all([
            client.getRealtime(vin),
            client.getGps(vin).catch(() => null), // GPS might fail
        ]);

        const now = admin.firestore.Timestamp.now();
        const vehicleRef = db.collection('bydVehicles').doc(vin);
        const vehicleDoc = await vehicleRef.get();
        const vehicleData = vehicleDoc.data() || {};

        const prevOdometer = vehicleData.lastOdometer || 0;
        const activeTripId = vehicleData.activeTripId || null;
        const stationaryPollCount = vehicleData.stationaryPollCount || 0;

        // Calculate movement
        const odoDelta = realtime.odometer - prevOdometer;
        const hasMovement = odoDelta > 0.03; // 30 meters
        const isStationary = !hasMovement;

        console.log(`[bydPollVehicle] ${vin}: odo=${realtime.odometer}, delta=${odoDelta.toFixed(3)}, movement=${hasMovement}, locked=${realtime.isLocked}`);

        const vehicleUpdate: any = {
            lastSoC: realtime.soc / 100,
            lastRange: realtime.range,
            lastOdometer: realtime.odometer,
            isCharging: realtime.isCharging,
            isLocked: realtime.isLocked,
            isOnline: realtime.isOnline,
            lastPollTime: now,
            lastUpdate: now,
        };

        if (gps) {
            vehicleUpdate.lastLocation = { lat: gps.latitude, lon: gps.longitude };
        }

        if (hasMovement) {
            vehicleUpdate.lastMoveTime = now;
            vehicleUpdate.stationaryPollCount = 0;
        }

        // Trip logic (same as Smartcar v3.6.0)
        if (!activeTripId && hasMovement) {
            // Start new trip
            const tripRef = db.collection('bydTrips').doc();
            await tripRef.set({
                vin,
                startDate: now,
                startOdometer: prevOdometer,
                startSoC: vehicleData.lastSoC || realtime.soc / 100,
                endOdometer: realtime.odometer,
                endSoC: realtime.soc / 100,
                distanceKm: Math.round(odoDelta * 100) / 100,
                status: 'in_progress',
                source: 'byd_polling',
                lastUpdate: now,
            });

            if (gps) {
                await tripRef.collection('points').add({
                    lat: gps.latitude,
                    lon: gps.longitude,
                    timestamp: now,
                    type: 'start',
                });
            }

            vehicleUpdate.activeTripId = tripRef.id;
            console.log(`[bydPollVehicle] STARTED trip: ${tripRef.id}`);

        } else if (activeTripId && realtime.isLocked && isStationary && stationaryPollCount >= 4) {
            // Close trip after 5 stationary polls while locked
            const tripRef = db.collection('bydTrips').doc(activeTripId);
            const tripDoc = await tripRef.get();
            const tripData = tripDoc.data();

            if (tripData) {
                const totalDistance = realtime.odometer - (tripData.startOdometer || 0);
                const adjustedEndDate = admin.firestore.Timestamp.fromMillis(now.toMillis() - 5 * 60 * 1000);

                if (gps) {
                    await tripRef.collection('points').add({
                        lat: gps.latitude,
                        lon: gps.longitude,
                        timestamp: adjustedEndDate,
                        type: 'end',
                    });
                }

                await tripRef.update({
                    status: 'completed',
                    endDate: adjustedEndDate,
                    endOdometer: realtime.odometer,
                    endSoC: realtime.soc / 100,
                    distanceKm: Math.round(Math.max(0, totalDistance) * 100) / 100,
                    lastUpdate: now,
                });

                console.log(`[bydPollVehicle] CLOSED trip: ${activeTripId}, ${totalDistance.toFixed(2)}km`);
            }

            vehicleUpdate.activeTripId = admin.firestore.FieldValue.delete();
            vehicleUpdate.stationaryPollCount = 0;
            vehicleUpdate.pollingActive = false;

        } else if (activeTripId && realtime.isLocked && isStationary) {
            // Increment stationary counter
            vehicleUpdate.stationaryPollCount = stationaryPollCount + 1;
            console.log(`[bydPollVehicle] Locked + stationary: ${stationaryPollCount + 1}/5`);

            // Update trip
            const tripRef = db.collection('bydTrips').doc(activeTripId);
            const tripDoc = await tripRef.get();
            if (tripDoc.exists) {
                const tripData = tripDoc.data()!;
                await tripRef.update({
                    endOdometer: realtime.odometer,
                    endSoC: realtime.soc / 100,
                    distanceKm: Math.round(Math.max(0, realtime.odometer - (tripData.startOdometer || 0)) * 100) / 100,
                    lastUpdate: now,
                });
            }

            if (gps) {
                await tripRef.collection('points').add({
                    lat: gps.latitude,
                    lon: gps.longitude,
                    timestamp: now,
                    type: 'waypoint',
                });
            }

        } else if (activeTripId) {
            // Trip in progress, moving
            vehicleUpdate.stationaryPollCount = 0;

            const tripRef = db.collection('bydTrips').doc(activeTripId);
            const tripDoc = await tripRef.get();
            if (tripDoc.exists) {
                const tripData = tripDoc.data()!;
                await tripRef.update({
                    endOdometer: realtime.odometer,
                    endSoC: realtime.soc / 100,
                    distanceKm: Math.round(Math.max(0, realtime.odometer - (tripData.startOdometer || 0)) * 100) / 100,
                    lastUpdate: now,
                });
            }

            if (gps) {
                await tripRef.collection('points').add({
                    lat: gps.latitude,
                    lon: gps.longitude,
                    timestamp: now,
                    type: 'waypoint',
                });
                console.log(`[bydPollVehicle] Added GPS waypoint`);
            }
        }

        await vehicleRef.set(vehicleUpdate, { merge: true });

        return {
            success: true,
            data: {
                soc: realtime.soc,
                range: realtime.range,
                odometer: realtime.odometer,
                isCharging: realtime.isCharging,
                isLocked: realtime.isLocked,
                location: gps ? { lat: gps.latitude, lon: gps.longitude } : null,
                hasMovement,
                activeTripId: vehicleUpdate.activeTripId || activeTripId,
            },
        };

    } catch (error: any) {
        console.error('[bydPollVehicle] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// =============================================================================
// DIAGNOSTIC
// =============================================================================

/**
 * Test BYD connection and get all vehicle data
 */
export const bydDiagnostic = regionalFunctions.https.onCall(async (data, context) => {
    const { vin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    try {
        const client = await getBydClientForVehicle(vin);
        await client.login();

        const [realtime, gps, charging] = await Promise.allSettled([
            client.getRealtime(vin),
            client.getGps(vin),
            client.getChargingStatus(vin),
        ]);

        return {
            success: true,
            vin,
            realtime: realtime.status === 'fulfilled' ? realtime.value : { error: (realtime as any).reason?.message },
            gps: gps.status === 'fulfilled' ? gps.value : { error: (gps as any).reason?.message },
            charging: charging.status === 'fulfilled' ? charging.value : { error: (charging as any).reason?.message },
        };

    } catch (error: any) {
        console.error('[bydDiagnostic] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
