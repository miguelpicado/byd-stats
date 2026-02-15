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

        // Save session to mqttSession for ALL vehicles so subsequent API calls use the fresh session
        // This is critical: when user reconnects, the old session becomes invalid on BYD's server
        const session = client.getSession();
        if (session) {
            for (const vehicle of vehicles) {
                await db.collection('bydVehicles').doc(vehicle.vin).collection('private').doc('mqttSession').set({
                    userId: session.token.userId,
                    signToken: session.token.signToken,
                    encryToken: session.token.encryToken,
                    cookies: JSON.stringify(session.cookies || {}),
                    updatedAt: admin.firestore.Timestamp.now(),
                });
                console.log(`[bydConnect] Saved fresh session to mqttSession for ${vehicle.vin}`);
            }
        }

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

/**
 * Decrypt helper for credentials
 */
function getDecryptor() {
    const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;
    if (!ENCRYPTION_KEY) {
        throw new Error('Encryption key not configured');
    }

    const crypto = require('crypto');
    return (encrypted: string) => {
        const [ivHex, authTagHex, dataHex] = encrypted.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const data = Buffer.from(dataHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
        decipher.setAuthTag(authTag);
        return decipher.update(data, undefined, 'utf8') + decipher.final('utf8');
    };
}

/**
 * Get the stored control PIN for a vehicle
 * Used by control functions (lock, unlock, climate, etc.)
 */
async function getStoredControlPin(vin: string): Promise<string | undefined> {
    const credentialsRef = db.collection('bydVehicles').doc(vin).collection('private').doc('credentials');
    const credentialsDoc = await credentialsRef.get();

    if (!credentialsDoc.exists) {
        return undefined;
    }

    const creds = credentialsDoc.data()!;
    if (!creds.controlPin) {
        return undefined;
    }

    const decrypt = getDecryptor();
    return decrypt(creds.controlPin);
}

async function getBydClientForVehicle(vin: string): Promise<BydClient> {
    ensureBydInit();

    const credentialsRef = db.collection('bydVehicles').doc(vin).collection('private').doc('credentials');
    const credentialsDoc = await credentialsRef.get();

    if (!credentialsDoc.exists) {
        throw new Error('Vehicle not connected to BYD');
    }

    const creds = credentialsDoc.data()!;
    const decrypt = getDecryptor();

    const config: BydConfig = {
        username: decrypt(creds.username),
        password: decrypt(creds.password),
        countryCode: creds.countryCode,
        controlPin: creds.controlPin ? decrypt(creds.controlPin) : undefined,
    };

    return new BydClient(config);
}

/**
 * Get BYD client with RESTORED session (doesn't create new tokens)
 * This is crucial for MQTT decryption - all functions must use the SAME session
 *
 * If no stored session exists, falls back to login() and stores the new session
 */
async function getBydClientWithSession(vin: string): Promise<BydClient> {
    const client = await getBydClientForVehicle(vin);

    // Try to restore existing session from Firestore
    const sessionDoc = await db.collection('bydVehicles').doc(vin).collection('private').doc('mqttSession').get();

    if (sessionDoc.exists) {
        const sessionData = sessionDoc.data()!;

        // Check if session is recent (less than 12 hours old)
        const updatedAt = sessionData.updatedAt?.toDate?.() || new Date(0);
        const ageHours = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);

        if (ageHours < 12) {
            // Restore existing session - NO new tokens created!
            client.restoreSession({
                userId: sessionData.userId,
                signToken: sessionData.signToken,
                encryToken: sessionData.encryToken,
                cookies: sessionData.cookies ? JSON.parse(sessionData.cookies) : {},
            });
            console.log(`[getBydClientWithSession] Restored session for ${vin} (age: ${ageHours.toFixed(1)}h)`);
            return client;
        }

        console.log(`[getBydClientWithSession] Session expired for ${vin} (age: ${ageHours.toFixed(1)}h), creating new one...`);
    } else {
        console.log(`[getBydClientWithSession] No stored session for ${vin}, creating new one...`);
    }

    // No valid session - create new one and store it
    await client.login();
    const session = client.getSession();

    if (session) {
        await db.collection('bydVehicles').doc(vin).collection('private').doc('mqttSession').set({
            userId: session.token.userId,
            signToken: session.token.signToken,
            encryToken: session.token.encryToken,
            cookies: JSON.stringify(session.cookies || {}),
            updatedAt: admin.firestore.Timestamp.now(),
        });
        console.log(`[getBydClientWithSession] Created and stored new session for ${vin}`);
    }

    return client;
}

// =============================================================================
// VEHICLE DATA
// =============================================================================

/**
 * Helper to filter out undefined values from an object (Firestore rejects undefined)
 */
function removeUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v !== undefined)
    ) as Partial<T>;
}

/**
 * Get realtime vehicle data (battery, range, odometer, etc.)
 */
export const bydGetRealtime = regionalFunctions.https.onCall(async (data, context) => {
    const { vin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    try {
        const client = await getBydClientWithSession(vin);
        const realtime = await client.getRealtime(vin);

        // Build update object, filtering out undefined values (Firestore rejects them)
        // Only update primary metrics if we have real values (car is awake)
        // This preserves the last known good values when car is sleeping
        const vehicleRef = db.collection('bydVehicles').doc(vin);
        const updateData = removeUndefined({
            // Primary metrics - only update if > 0 to preserve last known values
            lastSoC: realtime.soc > 0 ? realtime.soc / 100 : undefined,
            lastRange: realtime.range > 0 ? realtime.range : undefined,
            lastOdometer: realtime.odometer > 0 ? realtime.odometer : undefined,
            lastSpeed: realtime.speed ?? 0,

            // State indicators
            isCharging: realtime.isCharging,
            isLocked: realtime.isLocked,
            isOnline: realtime.isOnline,

            // Temperatures (may be undefined when car is asleep)

            interiorTemp: realtime.interiorTemp,

            // Door and window status
            doors: realtime.doors,
            windows: realtime.windows,

            // Tire pressure
            tirePressure: realtime.tirePressure,

            lastUpdate: admin.firestore.Timestamp.now(),
        });

        await vehicleRef.update(updateData);

        console.log(`[bydGetRealtime] ${vin}: SOC=${realtime.soc}%, range=${realtime.range}km, odo=${realtime.odometer}km, online=${realtime.isOnline}`);

        // Warn if car appears offline (all zeros)
        const warning = !realtime.isOnline
            ? 'Vehicle appears offline - data may be stale. Try again when the car is awake (driving, charging, or recently used).'
            : undefined;

        return {
            success: true,
            data: realtime,
            warning,
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
        const client = await getBydClientWithSession(vin);
        const gps = await client.getGps(vin);

        // Update vehicle location in Firestore
        const vehicleRef = db.collection('bydVehicles').doc(vin);
        const location: any = { lat: gps.latitude, lon: gps.longitude };
        if (gps.heading !== undefined) location.heading = gps.heading;
        await vehicleRef.update({
            lastLocation: location,
            lastLocationUpdate: admin.firestore.Timestamp.now(),
        });

        console.log(`[bydGetGps] ${vin}: lat=${gps.latitude}, lon=${gps.longitude}, heading=${gps.heading}`);

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
        const client = await getBydClientWithSession(vin);
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
        const client = await getBydClientWithSession(vin);
        const controlPin = pin || await getStoredControlPin(vin);
        const success = await client.lock(vin, controlPin);

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
        const client = await getBydClientWithSession(vin);
        const controlPin = pin || await getStoredControlPin(vin);
        const success = await client.unlock(vin, controlPin);

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
        const client = await getBydClientWithSession(vin);
        // Use stored PIN if not provided in request
        const controlPin = pin || await getStoredControlPin(vin);
        const success = await client.startClimate(vin, temperature || 22, controlPin);

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
        const client = await getBydClientWithSession(vin);
        const controlPin = pin || await getStoredControlPin(vin);
        const success = await client.stopClimate(vin, controlPin);

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
        const client = await getBydClientWithSession(vin);
        const controlPin = pin || await getStoredControlPin(vin);
        const success = await client.flashLights(vin, controlPin);

        console.log(`[bydFlashLights] ${vin}: ${success ? 'SUCCESS' : 'FAILED'}`);

        return { success };

    } catch (error: any) {
        console.error('[bydFlashLights] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Close windows
 */
export const bydCloseWindows = regionalFunctions.https.onCall(async (data, context) => {
    const { vin, pin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    try {
        const client = await getBydClientWithSession(vin);
        const controlPin = pin || await getStoredControlPin(vin);
        const success = await client.closeWindows(vin, controlPin);

        console.log(`[bydCloseWindows] ${vin}: ${success ? 'SUCCESS' : 'FAILED'}`);

        return { success };

    } catch (error: any) {
        console.error('[bydCloseWindows] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Control seat climate/heating
 * @param seat 0=driver, 1=passenger
 * @param mode 0=off, 1=low, 2=medium, 3=high
 */
export const bydSeatClimate = regionalFunctions.https.onCall(async (data, context) => {
    const { vin, seat, mode, pin } = data;

    if (!vin || seat === undefined || mode === undefined) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: vin, seat, mode');
    }

    try {
        const client = await getBydClientWithSession(vin);
        const controlPin = pin || await getStoredControlPin(vin);
        const success = await client.seatClimate(vin, seat, mode, controlPin);

        console.log(`[bydSeatClimate] ${vin}: seat=${seat}, mode=${mode}, ${success ? 'SUCCESS' : 'FAILED'}`);

        return { success };

    } catch (error: any) {
        console.error('[bydSeatClimate] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Control battery heating
 */
export const bydBatteryHeat = regionalFunctions.https.onCall(async (data, context) => {
    const { vin, pin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    try {
        const client = await getBydClientWithSession(vin);
        const controlPin = pin || await getStoredControlPin(vin);
        const success = await client.batteryHeat(vin, controlPin);

        console.log(`[bydBatteryHeat] ${vin}: ${success ? 'SUCCESS' : 'FAILED'}`);

        return { success };

    } catch (error: any) {
        console.error('[bydBatteryHeat] Error:', error.message);
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
        const client = await getBydClientWithSession(vin);

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

        // Calculate movement using odometer
        // IMPORTANT: When prevOdometer is 0 (first poll, no prior data), skip detection
        const odoDelta = prevOdometer > 0 ? (realtime.odometer - prevOdometer) : 0;
        const hasOdoMovement = odoDelta >= 1; // 1km or more (odometer increments)

        // GPS-based detection if available
        let hasGpsMovement = false;
        if (gps) {
            const prevLat = vehicleData.lastLocation?.lat;
            const prevLon = vehicleData.lastLocation?.lon;
            if (prevLat !== undefined && prevLon !== undefined) {
                const latDelta = Math.abs(gps.latitude - prevLat);
                const lonDelta = Math.abs(gps.longitude - prevLon);
                hasGpsMovement = (latDelta + lonDelta) > 0.0005; // ~50 meters at equator
            }
        }

        const hasMovement = hasOdoMovement || hasGpsMovement;
        const isStationary = !hasMovement;

        console.log(`[bydPollVehicle] ${vin}: odo=${realtime.odometer} (delta=${odoDelta.toFixed(2)}km, odo_move=${hasOdoMovement}), gps_move=${hasGpsMovement}, movement=${hasMovement}, locked=${realtime.isLocked}`);

        const vehicleUpdate: any = {
            lastSpeed: realtime.speed || 0,

            // State indicators
            isCharging: realtime.isCharging,
            isLocked: realtime.isLocked,
            isOnline: realtime.isOnline,

            lastPollTime: now,
            lastUpdate: now,
        };

        // Primary metrics - only update if > 0 to preserve last known values
        if (realtime.soc > 0) vehicleUpdate.lastSoC = realtime.soc / 100;
        if (realtime.range > 0) vehicleUpdate.lastRange = realtime.range;
        if (realtime.odometer > 0) vehicleUpdate.lastOdometer = realtime.odometer;

        // Temperatures (may be undefined when car is asleep)

        if (realtime.interiorTemp !== undefined) vehicleUpdate.interiorTemp = realtime.interiorTemp;

        // Door and window status (may be undefined)
        if (realtime.doors !== undefined) vehicleUpdate.doors = realtime.doors;
        if (realtime.windows !== undefined) vehicleUpdate.windows = realtime.windows;

        // Tire pressure (may be undefined)
        if (realtime.tirePressure !== undefined) vehicleUpdate.tirePressure = realtime.tirePressure;

        if (gps) {
            const location: any = { lat: gps.latitude, lon: gps.longitude };
            if (gps.heading !== undefined) location.heading = gps.heading;
            vehicleUpdate.lastLocation = location;
        }

        if (hasMovement) {
            vehicleUpdate.lastMoveTime = now;
            vehicleUpdate.stationaryPollCount = 0;
        }

        // Trip logic (same as Smartcar v3.6.0)
        if (!activeTripId && hasMovement) {
            // Start new trip
            const tripRef = db.collection('bydVehicles').doc(vin).collection('trips').doc();
            await tripRef.set({
                vin,
                startDate: now,
                startOdometer: prevOdometer,
                startSoC: vehicleData.lastSoC || realtime.soc / 100,
                endOdometer: realtime.odometer,
                endSoC: realtime.soc / 100,
                distanceKm: Math.round(odoDelta * 100) / 100,
                status: 'in_progress',
                type: 'unknown',
                source: 'byd_polling',
                vehicleId: vin,
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
            const tripRef = db.collection('bydVehicles').doc(vin).collection('trips').doc(activeTripId);
            const tripDoc = await tripRef.get();
            const tripData = tripDoc.data();

            if (tripData) {
                const totalDistance = realtime.odometer - (tripData.startOdometer || 0);
                const adjustedEndDate = admin.firestore.Timestamp.fromMillis(now.toMillis() - 5 * 60 * 1000);

                // Calculate duration in minutes
                const startTimestamp = tripData.startDate?.toMillis?.() || tripData.startDate || 0;
                const durationMinutes = Math.round((adjustedEndDate.toMillis() - startTimestamp) / 60000);

                // Calculate electricity (kWh) from SoC delta
                // Default BYD SEAL battery: 82.56 kWh (can be customized per vehicle)
                const batteryCapacity = vehicleData.batteryCapacity || 82.56;
                const socDelta = (tripData.startSoC || 0) - (realtime.soc / 100);
                const electricityKwh = Math.round(Math.max(0, socDelta * batteryCapacity) * 100) / 100;

                if (gps) {
                    await tripRef.collection('points').add({
                        lat: gps.latitude,
                        lon: gps.longitude,
                        timestamp: adjustedEndDate,
                        type: 'end',
                    });
                }

                const updateData: any = {
                    status: 'completed',
                    type: totalDistance >= 0.5 ? 'trip' : 'idle',
                    endDate: adjustedEndDate,
                    endOdometer: realtime.odometer,
                    endSoC: realtime.soc / 100,
                    distanceKm: Math.round(Math.max(0, totalDistance) * 100) / 100,
                    durationMinutes,
                    electricity: electricityKwh,
                    lastUpdate: now,
                };

                if (gps) {
                    updateData.endLocation = { lat: gps.latitude, lon: gps.longitude };
                }

                await tripRef.update(updateData);

                console.log(`[bydPollVehicle] CLOSED trip: ${activeTripId}, ${totalDistance.toFixed(2)}km, ${electricityKwh}kWh, ${durationMinutes}min`);
            }

            vehicleUpdate.activeTripId = admin.firestore.FieldValue.delete();
            vehicleUpdate.stationaryPollCount = 0;
            vehicleUpdate.pollingActive = false;

        } else if (activeTripId && realtime.isLocked && isStationary) {
            // Increment stationary counter
            vehicleUpdate.stationaryPollCount = stationaryPollCount + 1;
            console.log(`[bydPollVehicle] Locked + stationary: ${stationaryPollCount + 1}/5`);

            // Update trip
            const tripRef = db.collection('bydVehicles').doc(vin).collection('trips').doc(activeTripId);
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

            const tripRef = db.collection('bydVehicles').doc(vin).collection('trips').doc(activeTripId);
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
// WAKE VEHICLE (called when user opens BYD Stats app)
// =============================================================================

/**
 * Wake vehicle and get current data
 * Called when user opens the BYD Stats app to refresh vehicle state
 * Also activates polling temporarily in case the user is about to drive
 *
 * Flow:
 * 1. First request: Try to get data (this also wakes the car)
 * 2. If car is sleeping (all zeros), wait 3 seconds and retry
 * 3. Return fresh data
 */
export const bydWakeVehicle = regionalFunctions.https.onCall(async (data, context) => {
    const { vin, activatePolling = true } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    console.log(`[bydWakeVehicle] Waking vehicle ${vin}...`);

    try {
        const client = await getBydClientWithSession(vin);

        // Fetch all data - charging endpoint is most reliable for SOC on BYD Seal
        console.log(`[bydWakeVehicle] ${vin}: Fetching data...`);
        const [realtimeResult, gpsResult, chargingResult] = await Promise.allSettled([
            client.getRealtime(vin),
            client.getGps(vin),
            client.getChargingStatus(vin),
        ]);

        const realtime = realtimeResult.status === 'fulfilled' ? realtimeResult.value : null;
        const gps = gpsResult.status === 'fulfilled' ? gpsResult.value : null;
        const charging = chargingResult.status === 'fulfilled' ? chargingResult.value : null;

        // Use charging SOC as fallback when realtime returns zeros
        const effectiveSoc = (realtime?.soc || 0) > 0 ? realtime!.soc : (charging?.soc || 0);
        const isAwake = effectiveSoc > 0 || (realtime?.odometer || 0) > 0 || (realtime?.isOnline || false);

        console.log(`[bydWakeVehicle] ${vin}: realtime.soc=${realtime?.soc}, charging.soc=${charging?.soc}, effectiveSoc=${effectiveSoc}, awake=${isAwake}`);

        // Prepare Firestore update
        const vehicleRef = db.collection('bydVehicles').doc(vin);
        const updateData: any = {
            lastWake: admin.firestore.Timestamp.now(),
        };

        if (realtime || charging) {
            // Primary metrics - use effectiveSoc (charging fallback) for SOC
            if (effectiveSoc > 0) {
                updateData.lastSoC = effectiveSoc / 100;
            }
            if (realtime && realtime.range > 0) {
                updateData.lastRange = realtime.range;
            }
            if (realtime && realtime.odometer > 0) {
                updateData.lastOdometer = realtime.odometer;
            }
            updateData.lastSpeed = realtime?.speed || 0;

            // State indicators
            updateData.isCharging = realtime?.isCharging || charging?.isCharging || false;
            updateData.isLocked = realtime?.isLocked || false;
            updateData.isOnline = isAwake;

            // Temperatures (may be undefined when car is asleep)

            if (realtime?.interiorTemp !== undefined) updateData.interiorTemp = realtime.interiorTemp;

            // Door and window status (may be undefined when car is asleep)
            if (realtime?.doors !== undefined) updateData.doors = realtime.doors;
            if (realtime?.windows !== undefined) updateData.windows = realtime.windows;

            // Tire pressure (may be undefined when car is asleep)
            if (realtime?.tirePressure !== undefined) updateData.tirePressure = realtime.tirePressure;

            updateData.lastUpdate = admin.firestore.Timestamp.now();
        }

        if (gps) {
            const location: any = {
                lat: gps.latitude,
                lon: gps.longitude,
            };
            if (gps.heading !== undefined) location.heading = gps.heading;
            updateData.lastLocation = location;
        }

        // Activate polling if requested (default: yes)
        // This ensures we catch trips that start after the user checks their car
        if (activatePolling) {
            updateData.pollingActive = true;
            updateData.pollingActivatedAt = admin.firestore.Timestamp.now();
            updateData.pollingReason = 'app_wake';
            console.log(`[bydWakeVehicle] Polling activated for ${vin}`);
        }

        await vehicleRef.update(updateData);

        return {
            success: true,
            isAwake,
            pollingActivated: activatePolling,
            data: {
                soc: effectiveSoc,
                socPercent: effectiveSoc / 100,
                range: realtime?.range || 0,
                odometer: realtime?.odometer || 0,
                isCharging: realtime?.isCharging || charging?.isCharging || false,
                isLocked: realtime?.isLocked || false,
                isOnline: isAwake,
                location: gps ? { lat: gps.latitude, lon: gps.longitude, heading: gps.heading } : null,
            },
            message: isAwake
                ? 'Vehicle is awake - data is current'
                : 'Vehicle is in deep sleep - polling activated, data will update when car wakes.',
        };

    } catch (error: any) {
        console.error('[bydWakeVehicle] Error:', error.message);
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
        const client = await getBydClientWithSession(vin);

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

// =============================================================================
// MQTT WEBHOOK (receives events from Raspberry Pi listener)
// =============================================================================

const WEBHOOK_SECRET = process.env.BYD_WEBHOOK_SECRET || 'change-me-in-production';

/**
 * Webhook endpoint for MQTT listener
 * Receives vehicle events and processes them
 */
export const bydMqttWebhook = regionalFunctions.https.onRequest(async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }

    // Validate webhook secret
    const secret = req.headers['x-webhook-secret'];
    if (secret !== WEBHOOK_SECRET) {
        console.error('[bydMqttWebhook] Invalid webhook secret');
        res.status(401).send('Unauthorized');
        return;
    }

    try {
        const { source, timestamp, event } = req.body;

        if (!event) {
            res.status(400).send('Missing event data');
            return;
        }

        console.log(`[bydMqttWebhook] Received ${event.event} event for VIN ${event.vin} from ${source} at ${timestamp}`);

        // Process based on event type
        switch (event.event) {
            case 'vehicleInfo':
                await processVehicleInfoEvent(event);
                break;
            case 'remoteControl':
                await processRemoteControlEvent(event);
                break;
            default:
                console.log(`[bydMqttWebhook] Unknown event type: ${event.event}`);
        }

        res.status(200).json({ success: true });

    } catch (error: any) {
        console.error('[bydMqttWebhook] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Process vehicleInfo MQTT event
 * Updates vehicle state and detects trips
 */
async function processVehicleInfoEvent(event: any): Promise<void> {
    const vin = event.vin;
    if (!vin) {
        console.log('[processVehicleInfoEvent] No VIN in event');
        return;
    }

    const data = event.data?.respondData || event.data || {};
    const vehicleRef = db.collection('bydVehicles').doc(vin);

    // Get previous state for trip detection
    const prevDoc = await vehicleRef.get();
    const prevState = prevDoc.exists ? prevDoc.data() : null;

    // Parse new state - only include values > 0 to preserve last known values
    const newState: any = {
        isCharging: data.chargeState === 1,
        isOnline: true, // If we received MQTT event, car is online
        lastMqttUpdate: admin.firestore.Timestamp.now(),
    };

    // Only update primary metrics if we have real values
    const soc = data.elecPercent || 0;
    const range = data.evEndurance || data.enduranceMileage || 0;
    const odometer = data.totalMileageV2 || data.totalMileage || data.odo || data.mileage || 0;

    if (soc > 0) newState.lastSoC = soc / 100;
    if (range > 0) newState.lastRange = range;
    if (odometer > 0) newState.lastOdometer = odometer;

    // Update vehicle state
    await vehicleRef.update(newState);

    // Trip detection: check if odometer increased
    if (prevState && prevState.lastOdometer && odometer > prevState.lastOdometer) {
        const distance = odometer - prevState.lastOdometer;

        // Only create trip if distance > 0.5 km (avoid noise)
        if (distance > 0.5) {
            await createTripFromMqtt(vin, prevState, newState, distance);
        }
    }

    console.log(`[processVehicleInfoEvent] Updated ${vin}: SOC=${soc}%, odo=${odometer}km`);
}

/**
 * Process remoteControl MQTT event
 */
async function processRemoteControlEvent(event: any): Promise<void> {
    const vin = event.vin;
    if (!vin) return;

    console.log(`[processRemoteControlEvent] Control event for ${vin}:`, event.data);

    // Log the control event
    const vehicleRef = db.collection('bydVehicles').doc(vin);
    await vehicleRef.update({
        lastControlEvent: {
            type: event.data?.controlType,
            status: event.data?.controlState,
            timestamp: admin.firestore.Timestamp.now(),
        },
    });
}

/**
 * Create a trip record from MQTT state changes
 */
async function createTripFromMqtt(
    vin: string,
    prevState: any,
    newState: any,
    distance: number
): Promise<void> {
    const tripData = {
        vin,
        source: 'byd_mqtt-webhook',
        startTime: prevState.lastMqttUpdate || prevState.lastUpdate,
        endTime: admin.firestore.Timestamp.now(),
        distance,
        startOdometer: prevState.lastOdometer,
        endOdometer: newState.lastOdometer,
        startSoC: prevState.lastSoC,
        endSoC: newState.lastSoC,
        // energyUsed: (prevState.lastSoC - newState.lastSoC) * 100, // REMOVED: calculated at end of trip
        createdAt: admin.firestore.Timestamp.now(),
        vehicleId: vin,
    };

    // Store in trips subcollection
    const tripRef = await db.collection('bydVehicles').doc(vin).collection('trips').add(tripData);

    console.log(`[createTripFromMqtt] Created trip ${tripRef.id}: ${distance.toFixed(1)}km, SOC ${(prevState.lastSoC * 100).toFixed(0)}% → ${(newState.lastSoC * 100).toFixed(0)}%`);
}

/**
 * Get MQTT credentials for a vehicle
 * Used by Raspberry Pi to get the tokens needed for MQTT connection
 * Also triggers a data refresh to "activate" the session for push notifications
 */
export const bydGetMqttCredentials = regionalFunctions.https.onCall(async (data, context) => {
    const { vin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    ensureBydInit();

    try {
        // Get a fresh session to get current tokens
        const client = await getBydClientForVehicle(vin);
        await client.login();

        // Get session tokens
        const session = (client as any).session;
        if (!session || !session.token) {
            throw new Error('No active session');
        }

        // Get MQTT broker info
        const brokerInfo = await client.getEmqBrokerInfo();
        console.log('[bydGetMqttCredentials] brokerInfo:', JSON.stringify(brokerInfo));

        const credentials = {
            userId: session.token.userId,
            signToken: session.token.signToken,
            encryToken: session.token.encryToken,
            brokerHost: brokerInfo?.host || 'emqoversea-eu.byd.auto',
            brokerPort: brokerInfo?.port || 8883,
        };
        console.log('[bydGetMqttCredentials] Returning broker:', credentials.brokerHost, credentials.brokerPort);

        // Store session in Firestore so we can reuse it for triggerMqttRefresh
        // This allows the MQTT listener to trigger a refresh AFTER connecting
        await db.collection('bydVehicles').doc(vin).collection('private').doc('mqttSession').set({
            userId: session.token.userId,
            signToken: session.token.signToken,
            encryToken: session.token.encryToken,
            cookies: JSON.stringify(session.cookies || {}),
            updatedAt: admin.firestore.Timestamp.now(),
        });

        return {
            success: true,
            credentials,
        };

    } catch (error: any) {
        console.error('[bydGetMqttCredentials] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Trigger a data refresh using stored MQTT session
 * Called by Raspberry Pi AFTER it connects to MQTT
 * This should generate a response that arrives via MQTT
 */
export const bydTriggerMqttRefresh = regionalFunctions.https.onCall(async (data, context) => {
    const { vin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    ensureBydInit();

    try {
        // Get stored MQTT session (created by bydGetMqttCredentials)
        const sessionDoc = await db.collection('bydVehicles').doc(vin).collection('private').doc('mqttSession').get();

        if (!sessionDoc.exists) {
            throw new Error('No MQTT session found. Call bydGetMqttCredentials first.');
        }

        const sessionData = sessionDoc.data()!;
        console.log('[bydTriggerMqttRefresh] Using stored session for userId:', sessionData.userId);

        // Create a client using the stored session
        const client = await getBydClientForVehicle(vin);

        // Override the session with the stored one to use same credentials as MQTT
        (client as any).session = {
            token: {
                userId: sessionData.userId,
                signToken: sessionData.signToken,
                encryToken: sessionData.encryToken,
            },
            cookies: JSON.parse(sessionData.cookies || '{}'),
        };

        let result: any;
        const command = data.command || 'refresh';
        const pin = data.pin;

        // Execute command using the MQTT session
        if (command === 'flashLights') {
            console.log('[bydTriggerMqttRefresh] Sending flashLights command...');
            result = await client.flashLights(vin, pin);
            console.log('[bydTriggerMqttRefresh] flashLights result:', result);
        } else {
            // Default: trigger refresh
            console.log('[bydTriggerMqttRefresh] Triggering realtime refresh...');
            result = await client.getRealtime(vin);
            console.log('[bydTriggerMqttRefresh] Got realtime data:', JSON.stringify(result).substring(0, 200));
        }

        return {
            success: true,
            message: `Command '${command}' triggered, check MQTT for response`,
            result,
        };

    } catch (error: any) {
        console.error('[bydTriggerMqttRefresh] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// =============================================================================
// SCHEDULED POLLING (runs every minute)
// =============================================================================

/**
 * Scheduled function that runs every minute
 * Polls all BYD vehicles that have pollingActive = true
 */
export const bydScheduledPoll = regionalFunctions.pubsub
    .schedule('every 1 minutes')
    .onRun(async (context) => {
        console.log('[bydScheduledPoll] Starting scheduled poll...');

        ensureBydInit();

        try {
            // Find all vehicles with active polling
            const activeVehicles = await db.collection('bydVehicles')
                .where('pollingActive', '==', true)
                .get();

            if (activeVehicles.empty) {
                console.log('[bydScheduledPoll] No vehicles with active polling');
                return null;
            }

            console.log(`[bydScheduledPoll] Polling ${activeVehicles.size} active vehicle(s)`);

            // Poll each vehicle
            const promises = activeVehicles.docs.map(async (doc) => {
                const vin = doc.id;
                try {
                    await pollVehicleInternal(vin);
                } catch (error: any) {
                    console.error(`[bydScheduledPoll] Error polling ${vin}:`, error.message);
                }
            });

            await Promise.all(promises);

            console.log('[bydScheduledPoll] Scheduled poll complete');
            return null;

        } catch (error: any) {
            console.error('[bydScheduledPoll] Error:', error.message);
            return null;
        }
    });

/**
 * Internal polling function - used by both scheduler and manual calls
 */
async function pollVehicleInternal(vin: string): Promise<void> {
    const client = await getBydClientWithSession(vin);

    // Get data sequentially - if session expired (1002), the first call
    // will auto-relogin and subsequent calls will use the new session
    const realtime = await client.getRealtime(vin);
    const gps = await client.getGps(vin).catch(() => null); // GPS might fail

    // Always get charging status - it's more reliable than realtime for SOC on some models (e.g. BYD Seal)
    const charging = await client.getChargingStatus(vin).catch(() => null);

    // After successful API calls, save the session back in case it was refreshed
    // (e.g. auto-relogin after 1002 "another device" error)
    const currentSession = client.getSession();
    if (currentSession) {
        await db.collection('bydVehicles').doc(vin).collection('private').doc('mqttSession').set({
            userId: currentSession.token.userId,
            signToken: currentSession.token.signToken,
            encryToken: currentSession.token.encryToken,
            cookies: JSON.stringify(currentSession.cookies || {}),
            updatedAt: admin.firestore.Timestamp.now(),
        });
    }

    const now = admin.firestore.Timestamp.now();
    const vehicleRef = db.collection('bydVehicles').doc(vin);
    const vehicleDoc = await vehicleRef.get();
    const vehicleData = vehicleDoc.data() || {};

    // Use charging SOC as fallback when realtime returns zeros
    const effectiveSoc = realtime.soc > 0 ? realtime.soc : (charging?.soc || 0);
    const effectiveIsCharging = realtime.isCharging || charging?.isCharging || false;

    console.log(`[pollVehicleInternal] ${vin}: realtime.soc=${realtime.soc}, charging.soc=${charging?.soc}, effectiveSoc=${effectiveSoc}`);

    const prevOdometer = vehicleData.lastOdometer || 0;
    const activeTripId = vehicleData.activeTripId || null;
    const stationaryPollCount = vehicleData.stationaryPollCount || 0;

    // Calculate movement using odometer
    // IMPORTANT: When prevOdometer is 0 (first poll, no prior data), skip odometer-based detection
    // to avoid false trip starts (e.g., 12214 - 0 = 12214km "movement")
    const odoDelta = prevOdometer > 0 ? (realtime.odometer - prevOdometer) : 0;
    const hasOdoMovement = odoDelta >= 1; // 1km or more (odometer increments)

    // GPS-based detection if available
    let hasGpsMovement = false;
    if (gps && gps.latitude > 0) {
        const prevLat = vehicleData.lastLocation?.lat;
        const prevLon = vehicleData.lastLocation?.lon;
        // Only compare GPS if we have a previous location (avoid first-poll false positive)
        if (prevLat !== undefined && prevLon !== undefined) {
            const latDelta = Math.abs(gps.latitude - prevLat);
            const lonDelta = Math.abs(gps.longitude - prevLon);
            hasGpsMovement = (latDelta + lonDelta) > 0.0005; // ~50 meters at equator
        }
    }

    const hasMovement = hasOdoMovement || hasGpsMovement;
    const isStationary = !hasMovement;

    // Detect if car is sleeping: realtime returns zeros AND charging also has no data
    const isCarSleeping = realtime.soc === 0 && realtime.range === 0 && realtime.odometer === 0 && effectiveSoc === 0;

    console.log(`[pollVehicleInternal] ${vin}: odo=${realtime.odometer} (delta=${odoDelta.toFixed(2)}km, odo_move=${hasOdoMovement}), gps_move=${hasGpsMovement}, movement=${hasMovement}, locked=${realtime.isLocked}, sleeping=${isCarSleeping}`);

    // If truly sleeping (no data from any source), preserve last known values
    if (isCarSleeping) {
        console.log(`[pollVehicleInternal] ${vin}: Car sleeping (all sources zero), preserving last known values`);
        await vehicleRef.update({
            lastPollTime: now,
            isOnline: false,
        });
        return;
    }

    const vehicleUpdate: any = {
        lastPollTime: now,
        lastUpdate: now,

        // State indicators - use effective values that combine realtime + charging
        isCharging: effectiveIsCharging,
        isLocked: realtime.isLocked,
        isOnline: effectiveSoc > 0 || realtime.isOnline, // If we have SOC from charging, car is online

        lastSpeed: realtime.speed || 0,
    };

    // Only update metrics if they have real values (preserve last known good values)
    // Use effectiveSoc which falls back to charging endpoint when realtime returns zeros
    if (effectiveSoc > 0) vehicleUpdate.lastSoC = effectiveSoc / 100;
    if (realtime.range > 0) vehicleUpdate.lastRange = realtime.range;
    if (realtime.odometer > 0) vehicleUpdate.lastOdometer = realtime.odometer;

    // Only update optional fields if defined (avoid Firestore undefined error)
    if (realtime.interiorTemp !== undefined) vehicleUpdate.interiorTemp = realtime.interiorTemp;
    if (realtime.doors !== undefined) vehicleUpdate.doors = realtime.doors;
    if (realtime.windows !== undefined) vehicleUpdate.windows = realtime.windows;
    if (realtime.tirePressure !== undefined) vehicleUpdate.tirePressure = realtime.tirePressure;

    if (gps) {
        const location: any = { lat: gps.latitude, lon: gps.longitude };
        if (gps.heading !== undefined) location.heading = gps.heading;
        vehicleUpdate.lastLocation = location;
    }

    if (hasMovement) {
        vehicleUpdate.lastMoveTime = now;
        vehicleUpdate.stationaryPollCount = 0;
    }

    // Trip logic
    if (!activeTripId && hasMovement) {
        // Start new trip
        const tripRef = db.collection('bydVehicles').doc(vin).collection('trips').doc();
        await tripRef.set({
            vin,
            startDate: now,
            startOdometer: prevOdometer,
            startSoC: vehicleData.lastSoC || effectiveSoc / 100,
            endOdometer: realtime.odometer,
            endSoC: effectiveSoc / 100,
            distanceKm: Math.round(odoDelta * 100) / 100,
            status: 'in_progress',
            type: 'unknown',
            source: 'byd_polling',
            vehicleId: vin,
            lastUpdate: now,
            points: gps ? [{
                lat: gps.latitude,
                lon: gps.longitude,
                timestamp: now.toMillis(),
                type: 'start',
            }] : [],
            startLocation: gps ? { lat: gps.latitude, lon: gps.longitude } : null,
        });

        vehicleUpdate.activeTripId = tripRef.id;
        console.log(`[pollVehicleInternal] STARTED trip: ${tripRef.id}`);

    } else if (activeTripId && realtime.isLocked && isStationary && stationaryPollCount >= 4) {
        // Close trip after 5 stationary polls while locked
        const tripRef = db.collection('bydVehicles').doc(vin).collection('trips').doc(activeTripId);
        const tripDoc = await tripRef.get();
        const tripData = tripDoc.data();

        if (tripData) {
            const totalDistance = realtime.odometer - (tripData.startOdometer || 0);
            // Adjust end time backwards by 5 minutes (since we've been stationary)
            const adjustedEndDate = admin.firestore.Timestamp.fromMillis(now.toMillis() - 5 * 60 * 1000);

            // Calculate duration in minutes
            const startTimestamp = tripData.startDate?.toMillis?.() || tripData.startDate || 0;
            const durationMinutes = Math.round((adjustedEndDate.toMillis() - startTimestamp) / 60000);

            // Calculate electricity (kWh) from SoC delta
            // Default BYD SEAL battery: 82.56 kWh (can be customized per vehicle)
            const batteryCapacity = vehicleData.batteryCapacity || 82.56;
            const socDelta = (tripData.startSoC || 0) - (effectiveSoc / 100);
            const electricityKwh = Math.round(Math.max(0, socDelta * batteryCapacity) * 100) / 100;

            const updateData: any = {
                status: 'completed',
                type: totalDistance >= 0.5 ? 'trip' : 'idle',
                endDate: adjustedEndDate,
                endOdometer: realtime.odometer,
                endSoC: effectiveSoc / 100,
                distanceKm: Math.round(Math.max(0, totalDistance) * 100) / 100,
                durationMinutes,
                electricity: electricityKwh,
                lastUpdate: now,
            };

            // Add end point and location if we have GPS
            if (gps) {
                updateData.endLocation = { lat: gps.latitude, lon: gps.longitude };
                if (tripData.points) {
                    updateData.points = [...tripData.points, {
                        lat: gps.latitude,
                        lon: gps.longitude,
                        timestamp: adjustedEndDate.toMillis(),
                        type: 'end',
                    }];
                }
            }

            await tripRef.update(updateData);
            console.log(`[pollVehicleInternal] CLOSED trip: ${activeTripId}, ${totalDistance.toFixed(2)}km, ${electricityKwh}kWh, ${durationMinutes}min`);
        }

        // Deactivate polling - trip is done
        vehicleUpdate.activeTripId = admin.firestore.FieldValue.delete();
        vehicleUpdate.stationaryPollCount = 0;
        vehicleUpdate.pollingActive = false; // STOP POLLING!

        console.log(`[pollVehicleInternal] Polling DEACTIVATED for ${vin} - trip complete`);

    } else if (activeTripId && realtime.isLocked && isStationary) {
        // Increment stationary counter
        vehicleUpdate.stationaryPollCount = stationaryPollCount + 1;
        console.log(`[pollVehicleInternal] Locked + stationary: ${stationaryPollCount + 1}/5`);

        // Update trip with current data
        const tripRef = db.collection('bydVehicles').doc(vin).collection('trips').doc(activeTripId);
        const tripDoc = await tripRef.get();
        if (tripDoc.exists) {
            const tripData = tripDoc.data()!;
            const updateData: any = {
                endOdometer: realtime.odometer,
                endSoC: effectiveSoc / 100,
                distanceKm: Math.round(Math.max(0, realtime.odometer - (tripData.startOdometer || 0)) * 100) / 100,
                lastUpdate: now,
            };

            // Add tracking point if GPS available
            if (gps && tripData.points) {
                updateData.points = [...tripData.points, {
                    lat: gps.latitude,
                    lon: gps.longitude,
                    timestamp: now.toMillis(),
                    type: 'tracking',
                }];
            }

            await tripRef.update(updateData);
        }

    } else if (activeTripId && hasMovement) {
        // Trip ongoing with movement - add tracking point
        vehicleUpdate.stationaryPollCount = 0;

        const tripRef = db.collection('bydVehicles').doc(vin).collection('trips').doc(activeTripId);
        const tripDoc = await tripRef.get();
        if (tripDoc.exists) {
            const tripData = tripDoc.data()!;
            const updateData: any = {
                endOdometer: realtime.odometer,
                endSoC: effectiveSoc / 100,
                distanceKm: Math.round(Math.max(0, realtime.odometer - (tripData.startOdometer || 0)) * 100) / 100,
                lastUpdate: now,
            };

            // Add tracking point
            if (gps && tripData.points) {
                updateData.points = [...tripData.points, {
                    lat: gps.latitude,
                    lon: gps.longitude,
                    timestamp: now.toMillis(),
                    type: 'tracking',
                }];
            }

            await tripRef.update(updateData);
        }
    }

    // Update vehicle state
    await vehicleRef.update(vehicleUpdate);
}
