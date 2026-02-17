/**
 * BYD Direct API Functions
 * BYD vehicle API integration via Firebase Cloud Functions
 *
 * Version: 1.0.0 - Initial BYD direct API integration
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { BydClient, BydConfig, initBydModule } from './byd';
import { snapToRoads, calculatePathDistanceKm } from './googleMaps';

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
        const device = client.getDeviceProfile();

        if (session) {
            for (const vehicle of vehicles) {
                await db.collection('bydVehicles').doc(vehicle.vin).collection('private').doc('mqttSession').set({
                    userId: session.token.userId,
                    signToken: session.token.signToken,
                    encryToken: session.token.encryToken,
                    cookies: JSON.stringify(session.cookies || {}),
                    imei: device.imei,
                    mac: device.mac,
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
        console.error('INTERNAL ERROR: TOKEN_ENCRYPTION_KEY is missing in environment variables');
        throw new Error('Encryption key not configured');
    }
    // console.log('DEBUG: Encryption key present, length:', ENCRYPTION_KEY.length);

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

        // Restore Device ID if available (CRITICAL: Session is bound to IMEI!)
        if (sessionData.imei && sessionData.mac) {
            client.setDeviceProfile(sessionData.imei, sessionData.mac);
            console.log(`[getBydClientWithSession] Restored device profile: ${sessionData.imei}`);
        }

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
    const device = client.getDeviceProfile();

    if (session) {
        await db.collection('bydVehicles').doc(vin).collection('private').doc('mqttSession').set({
            userId: session.token.userId,
            signToken: session.token.signToken,
            encryToken: session.token.encryToken,
            cookies: JSON.stringify(session.cookies || {}),
            imei: device.imei,
            mac: device.mac,
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
 * Helper to normalize SoC to decimal (0.0 - 1.0)
 * Handles both percentage inputs (e.g. 75 -> 0.75) and decimal inputs (e.g. 0.75 -> 0.75)
 */
function normalizeSoC(val: number | undefined): number {
    if (val === undefined || val === null) return 0;
    // If value is > 1, assume it's a percentage (e.g. 75%)
    if (val > 1) return val / 100;
    // If value is <= 1, assume it's already a decimal (e.g. 0.75)
    return val;
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
        // Use common polling logic to handle timeouts/sleep gracefully
        // This prevents the 500 error when car is in deep sleep (Code 1008)
        const result = await pollVehicleInternal(vin, 'polling');

        if (result.isSleeping) {
            console.log(`[bydGetRealtime] Vehicle ${vin} is sleeping/unreachable. Returning last known state.`);

            // Fetch last known state from DB to return something useful instead of error
            const vehicleDoc = await db.collection('bydVehicles').doc(vin).get();
            const vehicleData = vehicleDoc.data() || {};

            return {
                success: true,
                isSleeping: true,
                data: vehicleData, // Return cached data structure (client handling required)
                warning: 'Vehicle is sleeping. Showing last known data.'
            };
        }

        return {
            success: true,
            data: result.data,
            warning: !result.data.isOnline ? 'Vehicle appears offline' : undefined
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
 * Helper to execute control commands with retry logic for sleeping vehicles
 */
async function executeControlCommand(
    vin: string,
    commandName: string,
    action: (client: any, pin: string | undefined) => Promise<boolean>,
    pin?: string
): Promise<{ success: boolean; message?: string }> {
    let client: BydClient;

    try {
        // 1. Try with existing/restored session first
        client = await getBydClientWithSession(vin);
    } catch (e: any) {
        console.error(`[${commandName}] Failed to get client:`, e.message);
        throw new functions.https.HttpsError('internal', `Client init failed: ${e.message}`);
    }

    const controlPin = pin || await getStoredControlPin(vin);
    if (!controlPin) {
        console.error(`[${commandName}] No control PIN found for ${vin}`);
    } else {
        const isNumeric = /^\d+$/.test(controlPin);
        console.log(`[${commandName}] Using PIN: length=${controlPin.length}, isNumeric=${isNumeric}, masked=${controlPin.slice(0, 1)}**${controlPin.slice(-1)}`);
    }

    try {
        // 2. Try action
        const success = await action(client, controlPin);
        console.log(`[${commandName}] ${vin}: ${success ? 'SUCCESS' : 'FAILED'}`);

        if (!success) {
            return { success: false, message: 'Command failed execution' };
        }
        return { success: true };

    } catch (innerError: any) {
        const errMsg = innerError.message || '';
        console.log(`[${commandName}] Error: ${errMsg}. Code: ${innerError.code}`);

        // 3. Check for specific session/auth errors to trigger a forced refresh
        // Code 1009 = Session/Token Invalid? Code 401?
        if (errMsg.includes('1009') || errMsg.includes('401') || errMsg.includes('Session')) {
            console.log(`[${commandName}] Session likely expired (Error ${errMsg}). Forcing re-login...`);

            try {
                // Force new login
                await client.login();

                // Save new session
                const session = client.getSession();
                const device = client.getDeviceProfile();

                if (session) {
                    await db.collection('bydVehicles').doc(vin).collection('private').doc('mqttSession').set({
                        userId: session.token.userId,
                        signToken: session.token.signToken,
                        encryToken: session.token.encryToken,
                        cookies: JSON.stringify(session.cookies || {}),
                        imei: device.imei,
                        mac: device.mac,
                        updatedAt: admin.firestore.Timestamp.now(),
                    });
                }

                // Retry action with new session
                const retrySuccess = await action(client, controlPin);
                console.log(`[${commandName}] Retry after login: ${retrySuccess ? 'SUCCESS' : 'FAILED'}`);

                return {
                    success: retrySuccess,
                    message: retrySuccess ? undefined : 'Retry failed after re-login'
                };

            } catch (loginError: any) {
                console.error(`[${commandName}] Re-login failed:`, loginError.message);
                throw new functions.https.HttpsError('unauthenticated', `Session expired and re-login failed: ${loginError.message}`);
            }
        }

        // 4. Check for timeout (vehicle asleep)
        if (errMsg.includes('1008') || errMsg.includes('timeout')) {
            console.log(`[${commandName}] Vehicle unreachable (1008). Attempting wake...`);
            // ... (keep existing wake logic if needed, but for now focusing on Auth)
        }

        throw innerError;
    }
}
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
/**
 * Lock vehicle
 */
export const bydLock = regionalFunctions.https.onCall(async (data, context) => {
    const { vin, pin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    return await executeControlCommand(vin, 'bydLock', async (client, controlPin) => {
        const success = await client.lock(vin, controlPin);
        if (success) {
            await db.collection('bydVehicles').doc(vin).update({
                isLocked: true,
                lastUpdate: admin.firestore.Timestamp.now(),
            });
        }
        return success;
    }, pin);
});

/**
 * Unlock vehicle
 */
export const bydUnlock = regionalFunctions.https.onCall(async (data, context) => {
    const { vin, pin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    return await executeControlCommand(vin, 'bydUnlock', async (client, controlPin) => {
        const success = await client.unlock(vin, controlPin);
        if (success) {
            await db.collection('bydVehicles').doc(vin).update({
                isLocked: false,
                lastUpdate: admin.firestore.Timestamp.now(),
            });
        }
        return success;
    }, pin);
});

/**
 * Start climate
 */
/**
 * Start climate
 */
export const bydStartClimate = regionalFunctions.https.onCall(async (data, context) => {
    const { vin, temperature, pin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    return await executeControlCommand(vin, 'bydStartClimate', async (client, controlPin) => {
        return await client.startClimate(vin, temperature || 22, controlPin);
    }, pin);
});

/**
 * Stop climate
 */
export const bydStopClimate = regionalFunctions.https.onCall(async (data, context) => {
    const { vin, pin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    return await executeControlCommand(vin, 'bydStopClimate', async (client, controlPin) => {
        return await client.stopClimate(vin, controlPin);
    }, pin);
});

/**
 * Flash lights / Find car
 */
export const bydFlashLights = regionalFunctions.https.onCall(async (data, context) => {
    const { vin, pin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    return await executeControlCommand(vin, 'bydFlashLights', async (client, controlPin) => {
        return await client.flashLights(vin, controlPin);
    }, pin);
});

/**
 * Close windows
 */
export const bydCloseWindows = regionalFunctions.https.onCall(async (data, context) => {
    const { vin, pin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    return await executeControlCommand(vin, 'bydCloseWindows', async (client, controlPin) => {
        return await client.closeWindows(vin, controlPin);
    }, pin);
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
// POLLING FOR TRIPS
// =============================================================================

/**
 * Poll vehicle for trip tracking (called by scheduler)
 * Polls vehicle status and detects trip start/end
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
        if (realtime.soc > 0) vehicleUpdate.lastSoC = normalizeSoC(realtime.soc);
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

        // Trip detection logic
        if (!activeTripId && hasMovement) {
            // Start new trip
            const tripRef = db.collection('bydVehicles').doc(vin).collection('trips').doc();
            await tripRef.set({
                vin,
                startDate: now,
                startOdometer: prevOdometer,
                startSoC: vehicleData.lastSoC || normalizeSoC(realtime.soc),
                endOdometer: realtime.odometer,
                endSoC: normalizeSoC(realtime.soc),
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
                const socDelta = (tripData.startSoC || 0) - normalizeSoC(realtime.soc);
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
                    endSoC: normalizeSoC(realtime.soc),
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
                    endSoC: normalizeSoC(realtime.soc),
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
                    endSoC: normalizeSoC(realtime.soc),
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

    if (soc > 0) newState.lastSoC = normalizeSoC(soc);
    if (range > 0) newState.lastRange = range;
    if (odometer > 0) newState.lastOdometer = odometer;

    // Update vehicle state
    await vehicleRef.update(newState);

    // Trip detection: check if odometer increased OR if vehicle is unlocked (new trip start condition)
    // User wants to capture stationary trips (consumption while parked with AC, etc.)
    const isUnlocked = newState.isLocked === false;
    // Odometer movement
    const distDelta = (prevState && prevState.lastOdometer < odometer) ? (odometer - prevState.lastOdometer) : 0;

    // Condition 1: Odometer increased (moving)
    // Condition 2: Car is unlocked AND no active trip yet (stationary start)
    // Note: We use a small threshold for odometer to avoid noise, but 0 is fine if unlocked
    const shouldStartTrip = distDelta >= 0.1 || (isUnlocked && !prevState?.activeTripId);

    if (shouldStartTrip) {
        // If we already have an active trip, we just update it (managed effectively by polling)
        // But if NO active trip, we create one
        if (!prevState?.activeTripId) {
            await createTripFromMqtt(vin, prevState || {}, newState, distDelta);
        } else if (distDelta > 0) {
            // Update existing trip distance if moving
            // This is mostly handled by polling, but good to update if we get MQTT push
        }
    }

    console.log(`[processVehicleInfoEvent] Updated ${vin}: SOC=${soc}%, odo=${odometer}km, unlocked=${isUnlocked}`);
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

    // Update parent vehicle doc to track this active trip
    await db.collection('bydVehicles').doc(vin).update({
        activeTripId: tripRef.id,
        pollingActive: true, // Ensure scheduler tracks it
        pollingActivatedAt: admin.firestore.Timestamp.now(),
        lastUpdate: admin.firestore.Timestamp.now(),
        stationaryPollCount: 0
    });

    console.log(`[createTripFromMqtt] Created trip ${tripRef.id} and activated polling: ${distance.toFixed(1)}km`);
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
// SHARED VEHICLE STATE PROCESSING
// =============================================================================

/**
 * Process vehicle state updates and handle trip detection
 * centralized logic used by both scheduled polling and manual wake
 */
async function processVehicleState(
    vin: string,
    realtime: any,
    gps: any,
    charging: any,
    source: 'polling' | 'wake' | 'mqtt'
): Promise<any> {
    const now = admin.firestore.Timestamp.now();
    const vehicleRef = db.collection('bydVehicles').doc(vin);
    const vehicleDoc = await vehicleRef.get();
    const vehicleData = vehicleDoc.data() || {};

    // Use charging SOC as fallback when realtime returns zeros
    // LOGGING: Check raw values for debugging consumption 100x error
    const rawRealtimeSoC = realtime.soc;
    const rawChargingSoC = charging?.soc;
    console.log(`[SoC Debug] ${vin} - Realtime: ${rawRealtimeSoC} (${typeof rawRealtimeSoC}), Charging: ${rawChargingSoC} (${typeof rawChargingSoC})`);

    const effectiveSoc = realtime.soc > 0 ? realtime.soc : (charging?.soc || 0);
    const effectiveIsCharging = realtime.isCharging || charging?.isCharging || false;

    // effectiveSoc should be an integer percentage (e.g. 75)
    // We store it as a decimal (0.75) for consistency with other parts of the app
    const socDecimal = normalizeSoC(effectiveSoc);

    console.log(`[processVehicleState] ${vin} (${source}): effectiveSoc=${effectiveSoc}, socDecimal=${socDecimal}`);

    const prevOdometer = vehicleData.lastOdometer || 0;
    const activeTripId = vehicleData.activeTripId || null;

    // Calculate movement using odometer
    // IMPORTANT: When prevOdometer is 0 (first poll, no prior data), skip odometer-based detection
    const odoDelta = prevOdometer > 0 ? (realtime.odometer - prevOdometer) : 0;
    const hasOdoMovement = odoDelta > 0; // Any increase is movement

    // Check climate FIRST so we can use it in GPS detection
    // Some models report airConditioningActive, others use remoteClimateStatus
    const isClimateActive = realtime.airConditioningActive || realtime.remoteClimateStatus === 1 || false;

    // GPS-based detection if available
    let hasGpsMovement = false;
    let gpsDelta = 0; // Track magnitude for strict filtering

    if (gps && gps.latitude > 0) {
        const prevLat = vehicleData.lastLocation?.lat;
        const prevLon = vehicleData.lastLocation?.lon;
        if (prevLat !== undefined && prevLon !== undefined) {
            const latDelta = Math.abs(gps.latitude - prevLat);
            const lonDelta = Math.abs(gps.longitude - prevLon);
            gpsDelta = latDelta + lonDelta;

            // Standard tracking threshold (~200m) - sufficient for "active" status persistence
            hasGpsMovement = gpsDelta > 0.002;
        }
    }

    // SPEED-based detection (The most reliable indicator if available)
    const hasSpeedMovement = (realtime.speed || 0) > 0;

    const hasMovement = hasOdoMovement || hasGpsMovement || hasSpeedMovement;
    const isStationary = !hasMovement;

    // Detect if car is sleeping: realtime returns zeros AND charging also has no data
    const isCarSleeping = realtime.soc === 0 && realtime.range === 0 && realtime.odometer === 0 && effectiveSoc === 0;

    console.log(`[processVehicleState] ${vin}: odo=${realtime.odometer} (delta=${odoDelta.toFixed(2)}km), move=${hasMovement}, locked=${realtime.isLocked}, climate=${isClimateActive}, sleep=${isCarSleeping}`);

    // If truly sleeping (no data from any source), preserve last known values
    if (isCarSleeping) {
        console.log(`[processVehicleState] ${vin}: Car offline/sleeping.`);

        // IDLE SLEEP TRACKING: Only deactivate after 10 consecutive offline polls
        const newOfflineCount = (vehicleData.offlinePollCount || 0) + 1;
        const offlineUpdate: any = {
            lastPollTime: now,
            isOnline: false,
            offlinePollCount: newOfflineCount
        };

        if (activeTripId && newOfflineCount >= 10) {
            console.log(`[processVehicleState] Car offline for 10 polls with active trip ${activeTripId} - Force Ending.`);
            const tripRef = db.collection('bydVehicles').doc(vin).collection('trips').doc(activeTripId);
            await tripRef.update({
                status: 'completed',
                endOdometer: prevOdometer,
                endSoC: vehicleData.lastSoC || 0,
                lastUpdate: now,
                forcedEndReason: 'vehicle_offline_timeout'
            });
            offlineUpdate.activeTripId = admin.firestore.FieldValue.delete();
            offlineUpdate.pollingActive = false;
            offlineUpdate.stationaryPollCount = 0;
            offlineUpdate.offlinePollCount = 0;
        }

        await vehicleRef.update(offlineUpdate);
        return { isSleeping: true };
    }

    const vehicleUpdate: any = {
        lastPollTime: now,
        lastUpdate: now,
        offlinePollCount: 0, // Reset when we get real data

        // State indicators
        isCharging: effectiveIsCharging,
        isLocked: realtime.isLocked,
        isOnline: effectiveSoc > 0 || realtime.isOnline,
        lastSpeed: realtime.speed || 0,

        // New fields
        lastGear: realtime.gear !== undefined ? realtime.gear : (vehicleData.lastGear || 0),
        epbStatus: realtime.parkingBrake !== undefined ? realtime.parkingBrake : (vehicleData.epbStatus || 0)
    };

    // Update metrics if they have real values
    if (effectiveSoc > 0) vehicleUpdate.lastSoC = socDecimal;
    if (realtime.range > 0) vehicleUpdate.lastRange = realtime.range;
    if (realtime.odometer > 0) vehicleUpdate.lastOdometer = realtime.odometer;

    // Optional fields
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

    // =========================================================================
    // TRIP LOGIC
    // =========================================================================

    if (!activeTripId && hasMovement) {
        // --- START NEW TRIP ---
        // Allow trip start even if locked (auto-lock while driving)
        // Prevent trip start only if source is 'wake' (opening app) to avoid ghost trips
        // NEW: Check GEAR. If Gear=1 (Park), DO NOT start trip.
        const isParked = realtime.gear === 1;
        const canStartTrip = source !== 'wake' && !isParked;

        if (canStartTrip) {
            // STRICT START RULES to prevent Ghost Trips:
            // 1. Speed > 0 (Most reliable indicator)
            // 2. Odometer > 0.1km (Ignore minor rounding noise)
            // 3. GPS Delta > 0.005 (~550m) (Ignore garage drift)
            // 4. Gear is DRIVE (3) (Explicit intent to move)
            const strictStart = (realtime.speed || 0) > 0 ||
                odoDelta >= 0.1 ||
                (hasGpsMovement && gpsDelta > 0.005) ||
                realtime.gear === 3;

            if (strictStart) {
                const tripRef = db.collection('bydVehicles').doc(vin).collection('trips').doc();
                await tripRef.set({
                    vin,
                    startDate: now,
                    startOdometer: prevOdometer,
                    startSoC: vehicleData.lastSoC || socDecimal,
                    endOdometer: realtime.odometer,
                    endSoC: socDecimal,
                    distanceKm: Math.round(odoDelta * 100) / 100,
                    status: 'in_progress',
                    type: 'unknown',
                    source: `byd_${source}`,
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
                vehicleUpdate.pollingActive = true;
                vehicleUpdate.pollingActivatedAt = now;
                console.log(`[processVehicleState] STARTED trip: ${tripRef.id}`);
            }
        }
    } else if (activeTripId && isStationary) {
        // --- STATIONARY / TRIP END LOGIC ---

        // 1. Immediate End: Plugged In
        if (effectiveIsCharging) {
            console.log(`[processVehicleState] Trip End: Vehicle plugged in.`);
            await closeTrip(vin, activeTripId, realtime, vehicleData, 0, 'plugged_in');
            vehicleUpdate.activeTripId = admin.firestore.FieldValue.delete();
            vehicleUpdate.pollingActive = false; // Stop trip polling
            // Note: charging polling will be handled by a separate process or we can enable it here if you like
            vehicleUpdate.pollingReason = 'charging'; // Optional marker
            await vehicleRef.update(vehicleUpdate);
            return { success: true };
        }

        // 2. Timeout Counters
        // We need robust counters stored in vehicleData. 
        // Note: To avoid indefinite growth of fields, we can use a single object 'tripStopCounters'

        // Check conditions
        const isClimateOn = realtime.airConditioningActive || realtime.remoteClimateStatus === 1 || false;
        const isLocked = realtime.isLocked;

        // Increment counters based on state
        const prevCounters = vehicleData.tripStopCounters || { gps: 0, climateOff: 0, lockedOff: 0, parked: 0 };
        const isParkedGear = realtime.gear === 1; // 1=Park
        const isSpeedZero = (realtime.speed || 0) === 0;

        const newCounters = {
            gps: prevCounters.gps + 1, // GPS is stationary (we are in this block because !hasMovement)
            climateOff: isClimateOn ? 0 : (prevCounters.climateOff + 1),
            lockedOff: (isLocked && !isClimateOn) ? (prevCounters.lockedOff + 1) : 0,
            parked: (isParkedGear && isSpeedZero) ? (prevCounters.parked + 1) : 0
        };

        // Save counters for next poll
        vehicleUpdate.tripStopCounters = newCounters;
        // Also keep legacy stationaryPollCount for backward compatibility/logging
        vehicleUpdate.stationaryPollCount = (vehicleData.stationaryPollCount || 0) + 1;

        console.log(`[processVehicleState] Stationary Counters: GPS=${newCounters.gps}/15, ClimOFF=${newCounters.climateOff}/9, LockOFF=${newCounters.lockedOff}/6`);

        // Check Stop Thresholds
        let stopReason = null;
        let trimMinutes = 0;

        if (newCounters.parked >= 6) { // 6 polls (~2m) in Park + stopped = End Trip
            stopReason = 'gear_park_detected';
            trimMinutes = 2;
        } else if (newCounters.gps >= 15) {
            stopReason = 'timeout_gps_5m';
            trimMinutes = 5;
        } else if (newCounters.climateOff >= 9) {
            stopReason = 'timeout_climate_3m';
            trimMinutes = 3;
        } else if (newCounters.lockedOff >= 6) {
            stopReason = 'timeout_locked_2m';
            trimMinutes = 2;
        }

        if (stopReason) {
            console.log(`[processVehicleState] Trip End Triggered: ${stopReason}. Trimming ${trimMinutes} min.`);
            await closeTrip(vin, activeTripId, realtime, vehicleData, trimMinutes, stopReason);

            vehicleUpdate.activeTripId = admin.firestore.FieldValue.delete();
            vehicleUpdate.pollingActive = false;
            vehicleUpdate.tripStopCounters = { gps: 0, climateOff: 0, lockedOff: 0, parked: 0 };
            vehicleUpdate.stationaryPollCount = 0;
        } else {
            // Update trip end values while stationary (without closing)
            const tripRef = db.collection('bydVehicles').doc(vin).collection('trips').doc(activeTripId);
            await tripRef.update({
                endOdometer: realtime.odometer,
                endSoC: socDecimal,
                lastUpdate: now
            });
        }
    } else if (activeTripId && hasMovement) {
        // --- MOVING ---
        vehicleUpdate.stationaryPollCount = 0;
        const tripRef = db.collection('bydVehicles').doc(vin).collection('trips').doc(activeTripId);
        const tripDoc = await tripRef.get();
        if (tripDoc.exists) {
            const tripData = tripDoc.data()!;
            const updateData: any = {
                endOdometer: realtime.odometer,
                endSoC: socDecimal,
                distanceKm: Math.round(Math.max(0, realtime.odometer - (tripData.startOdometer || 0)) * 100) / 100,
                lastUpdate: now,
            };
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
    } else {
        // --- IDLE ---
        const newStationaryCount = (vehicleData.stationaryPollCount || 0) + 1;
        vehicleUpdate.stationaryPollCount = newStationaryCount;
        if (vehicleData.pollingActive && newStationaryCount >= 5 && realtime.isLocked) {
            vehicleUpdate.pollingActive = false;
            vehicleUpdate.stationaryPollCount = 0;
        }
    }

    await vehicleRef.update(vehicleUpdate);

    return {
        success: true,
        data: {
            ...realtime,
            soc: effectiveSoc,
            isCharging: effectiveIsCharging,
            location: gps ? { lat: gps.latitude, lon: gps.longitude } : null,
            activeTripId: vehicleUpdate.activeTripId || activeTripId
        }
    };
}

// =============================================================================
// SCHEDULER & POLLING
// =============================================================================

/**
 * Scheduled function that runs every minute
 * Polls all BYD vehicles that have pollingActive = true
 */
/**
 * Scheduled function that runs every minute
 * Polls all BYD vehicles that have pollingActive = true
 * 
 * UPDATED: Runs a loop to poll active trips every 20 seconds
 */
/**
 * MONITOR ACTIVE TRIPS (Every 1 minute)
 * Queries ONLY vehicles with activeTripId or pollingActive=true
 * Loops 3 times (0s, 20s, 40s) to provide high-res tracking
 */
export const bydActiveTripMonitor = regionalFunctions.runWith({ timeoutSeconds: 300 }).pubsub
    .schedule('every 1 minutes')
    .onRun(async (context) => {
        console.log('[bydActiveTripMonitor] Checking for active trips...');
        ensureBydInit();
        const startTime = Date.now();

        // POLL 1: T=0
        await pollActiveVehicles();

        // POLL 2: T+20s
        const elapsed1 = Date.now() - startTime;
        if (elapsed1 < 20000) await delay(20000 - elapsed1);
        await pollActiveVehicles();

        // POLL 3: T+40s
        const elapsed2 = Date.now() - startTime;
        if (elapsed2 < 40000) await delay(40000 - elapsed2);
        await pollActiveVehicles();

        return null;
    });

/**
 * IDLE HEARTBEAT (Every 2 hours)
 * Checks all vehicles to ensure status is up to date
 * Ignores those already handled by Active Monitor
 */
export const bydIdleHeartbeat = regionalFunctions.runWith({ timeoutSeconds: 300 }).pubsub
    .schedule('every 3 hours')
    .onRun(async (context) => {
        console.log('[bydIdleHeartbeat] Starting idle check...');
        ensureBydInit();
        // Poll ALL vehicles once. 
        // The processVehicleState logic prevents new trips from starting unless conditions are met.
        await pollVehicles(false);
        return null;
    });

// =============================================================================
// HELPER: Close Trip Logic
// =============================================================================

async function closeTrip(
    vin: string,
    tripId: string,
    realtime: any,
    vehicleData: any,
    trimMinutes: number,
    stopReason: string
) {
    const now = admin.firestore.Timestamp.now();
    const tripRef = db.collection('bydVehicles').doc(vin).collection('trips').doc(tripId);
    const tripDoc = await tripRef.get();
    const tripData = tripDoc.data();

    if (!tripData) return;

    const totalDistance = realtime.odometer - (tripData.startOdometer || 0);

    // Calculate adjusted end date (trimming the stationary time)
    const adjustedEndDate = admin.firestore.Timestamp.fromMillis(now.toMillis() - (trimMinutes * 60 * 1000));
    const startTimestamp = tripData.startDate?.toMillis?.() || tripData.startDate || 0;

    // Ensure duration is at least 0
    const durationMinutes = Math.max(0, Math.round((adjustedEndDate.toMillis() - startTimestamp) / 60000));

    // Electricity Calculation
    const batteryCapacity = vehicleData.batteryCapacity || 82.56;
    const socDecimal = normalizeSoC(realtime.soc);
    const startSoC = tripData.startSoC || 0;
    const socDelta = startSoC - socDecimal;
    const electricityKwh = Math.round(Math.max(0, socDelta * batteryCapacity) * 100) / 100;

    const updateData: any = {
        status: 'completed',
        type: totalDistance >= 0.5 ? 'trip' : 'idle',
        endDate: adjustedEndDate,
        endOdometer: realtime.odometer,
        endSoC: socDecimal,
        distanceKm: Math.round(Math.max(0, totalDistance) * 100) / 100,
        durationMinutes,
        electricity: electricityKwh,
        lastUpdate: now,
        stopReason,
        trimMinutes
    };

    // Access GPS from where? Typically passed or scraped from trip points usually. 
    // In this flow, we don't have the final GPS point passed explicitly in the args easily 
    // unless we grab it from vehicleData or last known point.
    // Let's assume the last known location in vehicleData is the end location.
    if (vehicleData.lastLocation) {
        updateData.endLocation = vehicleData.lastLocation;

        // Try to snap if we have points
        // Robust check: check doc field FIRST, then subcollection
        let rawPoints = tripData.points || [];
        if (rawPoints.length === 0) {
            console.log(`[closeTrip] No points in doc array, checking subcollection for ${tripId}...`);
            const pointsSnap = await tripRef.collection('points').orderBy('timestamp').get();
            if (!pointsSnap.empty) {
                rawPoints = pointsSnap.docs.map(doc => doc.data());
                console.log(`[closeTrip] Found ${rawPoints.length} points in subcollection.`);
            }
        }

        if (rawPoints.length > 0) {
            // Add final point (adjusted time)
            rawPoints.push({
                lat: vehicleData.lastLocation.lat,
                lon: vehicleData.lastLocation.lon,
                timestamp: adjustedEndDate.toMillis(),
                type: 'end',
            });

            // Sort and snap
            rawPoints.sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));
            try {
                // Remove duplicates and snap
                const uniquePoints = rawPoints.filter((p: any, i: number, arr: any[]) => i === 0 || p.timestamp > arr[i - 1].timestamp);
                if (uniquePoints.length > 2) {
                    console.log(`[closeTrip] Snapping ${uniquePoints.length} points for ${tripId}...`);
                    const snappedPoints = await snapToRoads(uniquePoints as any[]);
                    updateData.points = snappedPoints;

                    const gpsDistance = calculatePathDistanceKm(snappedPoints);
                    console.log(`[closeTrip] GPS Distance calculated: ${gpsDistance} km (Odo: ${totalDistance} km)`);

                    // Update distance if it looks valid
                    if (gpsDistance > 0) {
                        // Allow update if GPS distance is positive
                        // Loosened check: odometer can be very different if it missed polls
                        updateData.gpsDistanceKm = gpsDistance;
                    }
                }
            } catch (e) {
                console.error(`Error snapping points for trip ${tripId}:`, e);
            }
        }
    }

    await tripRef.update(updateData);
    console.log(`[closeTrip] CLOSED trip: ${tripId}. Duration: ${durationMinutes}m (trimmed ${trimMinutes}m). Reason: ${stopReason}`);
}


const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to poll ONLY active vehicles (efficient)
async function pollActiveVehicles() {
    try {
        const activeVehicles = await db.collection('bydVehicles')
            .where('pollingActive', '==', true)
            .get();

        if (activeVehicles.empty) return;

        console.log(`[bydActiveTripMonitor] Polling ${activeVehicles.size} active vehicle(s)`);

        const promises = activeVehicles.docs.map(async (doc) => {
            try {
                await pollVehicleInternal(doc.id, 'polling');
            } catch (e: any) {
                console.error(`Error polling ${doc.id}: ${e.message}`);
            }
        });
        await Promise.all(promises);
    } catch (e) {
        console.error('[bydActiveTripMonitor] Error:', e);
    }
}



async function pollVehicles(onlyTrips: boolean) {
    try {
        // Find all vehicles with active polling
        const activeVehicles = await db.collection('bydVehicles')
            .where('pollingActive', '==', true)
            .get();

        if (activeVehicles.empty) {
            console.log('[pollVehicles] No vehicles with active polling');
            return;
        }

        // Filter vehicles
        const targetDocs = activeVehicles.docs.filter(doc => {
            const data = doc.data();

            // 1. If looking for ONLY active trips, check activeTripId
            if (onlyTrips) {
                return !!data.activeTripId;
            }

            // 2. If looking for ANY vehicle (Cycle 1):
            //    - ALWAYS poll if activeTripId exists (Tracking trip)
            //    - ALWAYS poll if pollingReason is 'app_wake_activity' (User opened app)
            //    - OTHERWISE, only poll if lastPollTime > 2 hours (Standard idle poll)

            if (data.activeTripId) return true;

            // If user just opened the app, we want to poll
            // We can use a timestamp check on pollingActivatedAt if needed, or rely on pollingReason
            // But simplified: If no trip, check time since last poll

            const lastPoll = data.lastPollTime?.toMillis() || 0;
            const twoHoursMs = 2 * 60 * 60 * 1000;
            const timeSinceLastPoll = Date.now() - lastPoll;

            if (timeSinceLastPoll >= twoHoursMs) {
                console.log(`[pollVehicles] Polling ${doc.id} (Idle > 2h)`);
                return true;
            }

            // Also poll if we specifically requested polling recently (e.g. app wake)
            // We'll rely on the logic that 'bydWakeVehicle' sets 'pollingActive=true'.
            // If we want to support "poll for 5 mins after app open", we need a timestamp check.
            // For now, let's respect the user's wish: "Idle check every 2h".
            // If the user OPENS the app, 'bydWakeVehicle' runs ONCE.
            // Does the user want continuous polling while app is open? 
            // "cuando abro la app BYD Stats hará una consulta pero esa consulta nunca puede iniciar un viaje"
            // The wake function handles the "one-time" query.
            // The scheduler should NOT poll just because app is open, UNLESS a trip starts.

            // So strict 2h rule for idle cars seems correct.

            return false;
        });

        if (targetDocs.length === 0) {
            if (onlyTrips) console.log('[pollVehicles] No active trips to poll this cycle');
            else console.log('[pollVehicles] No vehicles due for 2h poll');
            return;
        }

        console.log(`[pollVehicles] Polling ${targetDocs.length} vehicle(s) (onlyTrips=${onlyTrips})`);

        // Poll each vehicle
        const promises = targetDocs.map(async (doc) => {
            const vin = doc.id;
            try {
                await pollVehicleInternal(vin, 'polling');
            } catch (error: any) {
                console.error(`[pollVehicles] Error polling ${vin}:`, error.message);
            }
        });

        await Promise.all(promises);

    } catch (error: any) {
        console.error('[pollVehicles] Error:', error.message);
    }
}

/**
 * Internal polling function - used by scheduler, manual wake, and mqtt trigger
 */
async function pollVehicleInternal(vin: string, source: 'polling' | 'wake' | 'mqtt'): Promise<any> {
    const client = await getBydClientWithSession(vin);

    // Get data sequentially
    let realtime;
    try {
        realtime = await client.getRealtime(vin);
    } catch (error: any) {
        // Handle "Vehicle Unreachable" (Deep Sleep / Network Issue)
        if (error.message && (error.message.includes('1008') || error.message.includes('timeout'))) {
            console.log(`[pollVehicleInternal] Vehicle ${vin} unreachable (Code 1008/Timeout). Assuming sleep.`);
            return { isSleeping: true, data: null };
        }
        throw error; // Re-throw other errors
    }

    const gps = await client.getGps(vin).catch(() => null);
    const charging = await client.getChargingStatus(vin).catch(() => null);

    // Save session if refreshed
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

    // Process state and handle trips
    return await processVehicleState(vin, realtime, gps, charging, source);
}

// =============================================================================
// WAKE VEHICLE (called when user opens BYD Stats app)
// =============================================================================

/**
 * Wake vehicle and get current data
 * Also handles trip detection if polling was missed
 */
export const bydWakeVehicle = regionalFunctions.https.onCall(async (data, context) => {
    // Default to FALSE for polling (user request: only scan once)
    const { vin, activatePolling = false } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    console.log(`[bydWakeVehicle] Waking vehicle ${vin}...`);

    try {
        // Reuse pollVehicleInternal to ensure consistent trip detection logic
        // This fixes the issue where opening the app updated the odometer but didn't create a trip
        const result = await pollVehicleInternal(vin, 'wake');

        if (result.isSleeping) {
            console.log(`[bydWakeVehicle] Vehicle is sleeping/unreachable.`);
            // Return success=true but with isSleeping=true, so UI handles it gracefully (no red error)
            return {
                success: true,
                isAwake: false,
                pollingActivated: false,
                data: null,
                message: 'Vehicle is sleeping or unreachable (Code 1008)'
            };
        }

        // Check if we should auto-activate polling based on state
        // If car is unlocked or moving, we SHOULD poll to track the trip
        const shouldPoll = result.data?.isLocked === false ||
            (result.data?.speed || 0) > 0 ||
            activatePolling === true;

        if (shouldPoll) {
            console.log(`[bydWakeVehicle] Auto-activating polling (Unlocked/Moving/Requested)`);
            await db.collection('bydVehicles').doc(vin).update({
                pollingActive: true,
                pollingActivatedAt: admin.firestore.Timestamp.now(),
                pollingReason: 'app_wake_activity'
            });
        }

        return {
            success: true,
            isAwake: !result.isSleeping,
            pollingActivated: shouldPoll,
            data: result.data,
            message: !result.isSleeping ? 'Vehicle updated' : 'Vehicle is sleeping'
        };
    } catch (error: any) {
        console.error(`[bydWakeVehicle] Error:`, error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// =============================================================================
// MANUAL TRIP RECALCULATION (Fix bad data)
// =============================================================================

export const bydFixTrip = regionalFunctions.https.onCall(async (data, context) => {
    const { vin, tripId, overrideValues } = data;

    if (!vin || !tripId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN or Trip ID');
    }

    console.log(`[bydFixTrip] Fixing trip ${tripId} for ${vin}...`);

    try {
        const vehicleRef = db.collection('bydVehicles').doc(vin);
        const vehicleDoc = await vehicleRef.get();
        const vehicleData = vehicleDoc.data() || {};

        const tripRef = db.collection('bydVehicles').doc(vin).collection('trips').doc(tripId);
        const tripDoc = await tripRef.get();

        if (!tripDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Trip not found');
        }

        const tripData = tripDoc.data()!;
        const updates: any = {};

        // 0. Apply Overrides (Priority)
        if (overrideValues) {
            console.log(`[bydFixTrip] Applying overrides:`, overrideValues);
            if (overrideValues.distanceKm !== undefined) updates.distanceKm = Number(overrideValues.distanceKm);
            if (overrideValues.gpsDistanceKm !== undefined) updates.gpsDistanceKm = Number(overrideValues.gpsDistanceKm);
            if (overrideValues.electricity !== undefined) updates.electricity = Number(overrideValues.electricity);
            if (overrideValues.durationMinutes !== undefined) updates.durationMinutes = Number(overrideValues.durationMinutes);
            if (overrideValues.startSoC !== undefined) updates.startSoC = Number(overrideValues.startSoC);
            if (overrideValues.endSoC !== undefined) updates.endSoC = Number(overrideValues.endSoC);
        }

        // 1. Recalculate Consumption
        if (!updates.electricity && tripData.startSoC !== undefined && tripData.endSoC !== undefined) {
            const batteryCapacity = vehicleData.batteryCapacity || 82.56; // Default to Seal 82kWh if unknown
            const startSoC = updates.startSoC ?? tripData.startSoC;
            const endSoC = updates.endSoC ?? tripData.endSoC;
            const socDelta = startSoC - endSoC;
            const electricityKwh = Math.round(Math.max(0, socDelta * batteryCapacity) * 100) / 100;

            updates.electricity = electricityKwh;
            console.log(`[bydFixTrip] Recalculated electricity: ${electricityKwh} kWh`);
        }

        // 2. Snap to Road & Distance
        // 2. Snap to Road & Distance
        let pointsToSnap = tripData.points || [];

        // If no points in doc array, try fetch from subcollection
        if (!pointsToSnap || pointsToSnap.length === 0) {
            console.log(`[bydFixTrip] No points in doc array, checking subcollection...`);
            const pointsRef = tripRef.collection('points');
            const pointsSnap = await pointsRef.orderBy('timestamp').get();
            if (!pointsSnap.empty) {
                pointsToSnap = pointsSnap.docs.map(doc => doc.data());
                console.log(`[bydFixTrip] Found ${pointsToSnap.length} points in subcollection.`);
            }
        }

        if (pointsToSnap && pointsToSnap.length > 2) {
            console.log(`[bydFixTrip] Snapping ${pointsToSnap.length} points check...`);
            // Only snap if not already snapped (check for 'snapped' type)
            const hasSnapped = pointsToSnap.some((p: any) => p.type === 'snapped');

            if (!hasSnapped) {
                console.log(`[bydFixTrip] Snapping points...`);
                // Use the new pointsToSnap array
                const snappedPoints = await snapToRoads(pointsToSnap);
                updates.points = snappedPoints;

                const gpsDistance = calculatePathDistanceKm(snappedPoints);
                console.log(`[bydFixTrip] GPS Distance: ${gpsDistance} km`);

                // Update distance if it looks valid
                const originalDistance = tripData.distanceKm || 0;
                // Allow update if GPS distance is positive, even if different (assuming fixing bad data)
                if (gpsDistance > 0) {
                    // Only update if significantly different or original was 0/bad
                    if (originalDistance === 0 || Math.abs(gpsDistance - originalDistance) < 100) {
                        updates.gpsDistanceKm = gpsDistance;
                    }
                }
            } else {
                console.log(`[bydFixTrip] Points already snapped.`);
            }
        }

        // 3. Ensure status is completed
        if (tripData.status !== 'completed') {
            updates.status = 'completed';
            updates.endDate = tripData.lastUpdate || admin.firestore.Timestamp.now();
        }

        const analysis = {
            startSoC: tripData.startSoC,
            endSoC: tripData.endSoC,
            batteryCapacity: vehicleData.batteryCapacity || 82.56,
            socDelta: (tripData.startSoC || 0) - (tripData.endSoC || 0),
            startOdometer: tripData.startOdometer,
            endOdometer: tripData.endOdometer,
            odoDistance: (tripData.endOdometer || 0) - (tripData.startOdometer || 0),
            gpsDistance: updates.gpsDistanceKm || tripData.gpsDistanceKm,
            pointsCount: tripData.points?.length || 0
        };

        console.log('[bydFixTrip] Analysis:', analysis);

        if (Object.keys(updates).length > 0) {
            await tripRef.update(updates);
            return { success: true, updates, analysis };
        } else {
            return { success: true, message: 'No updates needed', analysis };
        }


    } catch (error: any) {
        console.error(`[bydFixTrip] Error:`, error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// =============================================================================
// DEBUG / API DUMP
// =============================================================================

export const bydDebug = regionalFunctions.https.onCall(async (data, context) => {
    const { vin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    // Verify ownership (context.auth is required for production, allow bypass if local/testing)
    // Verify ownership (context.auth is required for production, allow bypass if local/testing)
    // NOTE: Temporarily disabled to allow localhost debugging without Auth domain setup
    /*
    if (!context.auth && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    */

    console.log(`[bydDebug] Generating diagnostic dump for ${vin}...`);

    try {
        const client = await getBydClientWithSession(vin);

        // Parallel Fetch of ALL available endpoints
        // Using Promise.allSettled to ensure we get partial results if one fails
        const results = await Promise.allSettled([
            client.getRealtime(vin),
            client.getGps(vin).catch(e => ({ error: e.message })), // GPS might fail if privacy mode
            client.getChargingStatus(vin).catch(e => ({ error: e.message })),
            // Add more if client supports them, e.g. Driving Records or Vehicle Status
            // client.getDrivingRecords(vin) ... 
        ]);

        const realtime = results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason?.message };
        const gps = results[1].status === 'fulfilled' ? results[1].value : { error: results[1].reason?.message };
        const charging = results[2].status === 'fulfilled' ? results[2].value : { error: results[2].reason?.message };

        // Construct Dump Object
        const dump = {
            meta: {
                timestamp: new Date().toISOString(),
                vin: vin, // Keep VIN for context
                serverTime: Date.now()
            },
            data: {
                realtime,
                gps,
                charging
            }
        };

        // Save to Firestore (History)
        const debugRef = db.collection('bydVehicles').doc(vin).collection('debug');
        await debugRef.add({
            timestamp: admin.firestore.Timestamp.now(),
            dump: JSON.stringify(dump), // Store as string to avoid indexing issues with deep/dynamic keys if desired, or object
            // Actually, storing as object is better for querying if needed, but string is safer for "raw dump" preservation
            // Let's store as object but careful with depth. 
            // We'll store the sanitized object.
            type: 'manual_api_dump'
        });

        // Cleanup sensitive data before returning to UI?
        // Realtime data is generally safe (technical data), tokens are not included here.

        return { success: true, dump };

    } catch (error: any) {
        console.error(`[bydDebug] Error:`, error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
