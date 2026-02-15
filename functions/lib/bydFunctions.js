"use strict";
/**
 * BYD Direct API Functions
 * Alternative to Smartcar - uses BYD API directly
 *
 * Version: 1.0.0 - Initial BYD direct API integration
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.bydScheduledPoll = exports.bydTriggerMqttRefresh = exports.bydGetMqttCredentials = exports.bydMqttWebhook = exports.bydDiagnostic = exports.bydWakeVehicle = exports.bydPollVehicle = exports.bydBatteryHeat = exports.bydSeatClimate = exports.bydCloseWindows = exports.bydFlashLights = exports.bydStopClimate = exports.bydStartClimate = exports.bydUnlock = exports.bydLock = exports.bydGetCharging = exports.bydGetGps = exports.bydGetRealtime = exports.bydDisconnect = exports.bydConnect = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const byd_1 = require("./byd");
// Initialize Firestore (may already be initialized by main index.ts)
try {
    admin.initializeApp();
}
catch (e) {
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
        (0, byd_1.initBydModule)();
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
exports.bydConnect = regionalFunctions.https.onCall(async (data, context) => {
    const { username, password, countryCode, controlPin, userId } = data;
    if (!username || !password || !countryCode || !userId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: username, password, countryCode, userId');
    }
    ensureBydInit();
    try {
        // Test credentials by logging in
        const config = {
            username,
            password,
            countryCode,
            controlPin,
        };
        const client = new byd_1.BydClient(config);
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
        const encrypt = (text) => {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
            const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
            const authTag = cipher.getAuthTag();
            return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
        };
        const batch = db.batch();
        const connectedVehicles = [];
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
    }
    catch (error) {
        console.error('[bydConnect] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * Disconnect BYD account
 */
exports.bydDisconnect = regionalFunctions.https.onCall(async (data, context) => {
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
    }
    catch (error) {
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
    return (encrypted) => {
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
async function getStoredControlPin(vin) {
    const credentialsRef = db.collection('bydVehicles').doc(vin).collection('private').doc('credentials');
    const credentialsDoc = await credentialsRef.get();
    if (!credentialsDoc.exists) {
        return undefined;
    }
    const creds = credentialsDoc.data();
    if (!creds.controlPin) {
        return undefined;
    }
    const decrypt = getDecryptor();
    return decrypt(creds.controlPin);
}
async function getBydClientForVehicle(vin) {
    ensureBydInit();
    const credentialsRef = db.collection('bydVehicles').doc(vin).collection('private').doc('credentials');
    const credentialsDoc = await credentialsRef.get();
    if (!credentialsDoc.exists) {
        throw new Error('Vehicle not connected to BYD');
    }
    const creds = credentialsDoc.data();
    const decrypt = getDecryptor();
    const config = {
        username: decrypt(creds.username),
        password: decrypt(creds.password),
        countryCode: creds.countryCode,
        controlPin: creds.controlPin ? decrypt(creds.controlPin) : undefined,
    };
    return new byd_1.BydClient(config);
}
/**
 * Get BYD client with RESTORED session (doesn't create new tokens)
 * This is crucial for MQTT decryption - all functions must use the SAME session
 *
 * If no stored session exists, falls back to login() and stores the new session
 */
async function getBydClientWithSession(vin) {
    var _a, _b;
    const client = await getBydClientForVehicle(vin);
    // Try to restore existing session from Firestore
    const sessionDoc = await db.collection('bydVehicles').doc(vin).collection('private').doc('mqttSession').get();
    if (sessionDoc.exists) {
        const sessionData = sessionDoc.data();
        // Check if session is recent (less than 12 hours old)
        const updatedAt = ((_b = (_a = sessionData.updatedAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(0);
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
    }
    else {
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
function removeUndefined(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
}
/**
 * Get realtime vehicle data (battery, range, odometer, etc.)
 */
exports.bydGetRealtime = regionalFunctions.https.onCall(async (data, context) => {
    var _a;
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
            lastSpeed: (_a = realtime.speed) !== null && _a !== void 0 ? _a : 0,
            // State indicators
            isCharging: realtime.isCharging,
            isLocked: realtime.isLocked,
            isOnline: realtime.isOnline,
            // Temperatures (may be undefined when car is asleep)
            exteriorTemp: realtime.exteriorTemp,
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
    }
    catch (error) {
        console.error('[bydGetRealtime] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * Get GPS location
 */
exports.bydGetGps = regionalFunctions.https.onCall(async (data, context) => {
    const { vin } = data;
    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }
    try {
        const client = await getBydClientWithSession(vin);
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
    }
    catch (error) {
        console.error('[bydGetGps] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * Get charging status
 */
exports.bydGetCharging = regionalFunctions.https.onCall(async (data, context) => {
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
    }
    catch (error) {
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
exports.bydLock = regionalFunctions.https.onCall(async (data, context) => {
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
    }
    catch (error) {
        console.error('[bydLock] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * Unlock vehicle
 */
exports.bydUnlock = regionalFunctions.https.onCall(async (data, context) => {
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
    }
    catch (error) {
        console.error('[bydUnlock] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * Start climate
 */
exports.bydStartClimate = regionalFunctions.https.onCall(async (data, context) => {
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
    }
    catch (error) {
        console.error('[bydStartClimate] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * Stop climate
 */
exports.bydStopClimate = regionalFunctions.https.onCall(async (data, context) => {
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
    }
    catch (error) {
        console.error('[bydStopClimate] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * Flash lights / Find car
 */
exports.bydFlashLights = regionalFunctions.https.onCall(async (data, context) => {
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
    }
    catch (error) {
        console.error('[bydFlashLights] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * Close windows
 */
exports.bydCloseWindows = regionalFunctions.https.onCall(async (data, context) => {
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
    }
    catch (error) {
        console.error('[bydCloseWindows] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * Control seat climate/heating
 * @param seat 0=driver, 1=passenger
 * @param mode 0=off, 1=low, 2=medium, 3=high
 */
exports.bydSeatClimate = regionalFunctions.https.onCall(async (data, context) => {
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
    }
    catch (error) {
        console.error('[bydSeatClimate] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * Control battery heating
 */
exports.bydBatteryHeat = regionalFunctions.https.onCall(async (data, context) => {
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
    }
    catch (error) {
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
exports.bydPollVehicle = regionalFunctions.https.onCall(async (data, context) => {
    var _a, _b, _c, _d;
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
        // GPS changes < 1km, Odometer reports in 1km increments
        // Use odometer as primary: > 1km = definite movement
        // Also check GPS if available for smaller movements
        const odoDelta = realtime.odometer - prevOdometer;
        const hasOdoMovement = odoDelta >= 1; // 1km or more (odometer increments)
        // GPS-based detection if available
        let hasGpsMovement = false;
        if (gps) {
            const prevLat = ((_a = vehicleData.lastLocation) === null || _a === void 0 ? void 0 : _a.lat) || gps.latitude;
            const prevLon = ((_b = vehicleData.lastLocation) === null || _b === void 0 ? void 0 : _b.lon) || gps.longitude;
            // Simple distance check (Haversine would be more accurate but this is sufficient)
            const latDelta = Math.abs(gps.latitude - prevLat);
            const lonDelta = Math.abs(gps.longitude - prevLon);
            hasGpsMovement = (latDelta + lonDelta) > 0.0005; // ~50 meters at equator
        }
        const hasMovement = hasOdoMovement || hasGpsMovement;
        const isStationary = !hasMovement;
        console.log(`[bydPollVehicle] ${vin}: odo=${realtime.odometer} (delta=${odoDelta.toFixed(2)}km, odo_move=${hasOdoMovement}), gps_move=${hasGpsMovement}, movement=${hasMovement}, locked=${realtime.isLocked}`);
        const vehicleUpdate = {
            lastSpeed: realtime.speed || 0,
            // State indicators
            isCharging: realtime.isCharging,
            isLocked: realtime.isLocked,
            isOnline: realtime.isOnline,
            lastPollTime: now,
            lastUpdate: now,
        };
        // Primary metrics - only update if > 0 to preserve last known values
        if (realtime.soc > 0)
            vehicleUpdate.lastSoC = realtime.soc / 100;
        if (realtime.range > 0)
            vehicleUpdate.lastRange = realtime.range;
        if (realtime.odometer > 0)
            vehicleUpdate.lastOdometer = realtime.odometer;
        // Temperatures (may be undefined when car is asleep)
        if (realtime.exteriorTemp !== undefined)
            vehicleUpdate.exteriorTemp = realtime.exteriorTemp;
        if (realtime.interiorTemp !== undefined)
            vehicleUpdate.interiorTemp = realtime.interiorTemp;
        // Door and window status (may be undefined)
        if (realtime.doors !== undefined)
            vehicleUpdate.doors = realtime.doors;
        if (realtime.windows !== undefined)
            vehicleUpdate.windows = realtime.windows;
        // Tire pressure (may be undefined)
        if (realtime.tirePressure !== undefined)
            vehicleUpdate.tirePressure = realtime.tirePressure;
        if (gps) {
            const location = { lat: gps.latitude, lon: gps.longitude };
            if (gps.heading !== undefined)
                location.heading = gps.heading;
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
        }
        else if (activeTripId && realtime.isLocked && isStationary && stationaryPollCount >= 4) {
            // Close trip after 5 stationary polls while locked
            const tripRef = db.collection('bydVehicles').doc(vin).collection('trips').doc(activeTripId);
            const tripDoc = await tripRef.get();
            const tripData = tripDoc.data();
            if (tripData) {
                const totalDistance = realtime.odometer - (tripData.startOdometer || 0);
                const adjustedEndDate = admin.firestore.Timestamp.fromMillis(now.toMillis() - 5 * 60 * 1000);
                // Calculate duration in minutes
                const startTimestamp = ((_d = (_c = tripData.startDate) === null || _c === void 0 ? void 0 : _c.toMillis) === null || _d === void 0 ? void 0 : _d.call(_c)) || tripData.startDate || 0;
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
                const updateData = {
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
        }
        else if (activeTripId && realtime.isLocked && isStationary) {
            // Increment stationary counter
            vehicleUpdate.stationaryPollCount = stationaryPollCount + 1;
            console.log(`[bydPollVehicle] Locked + stationary: ${stationaryPollCount + 1}/5`);
            // Update trip
            const tripRef = db.collection('bydVehicles').doc(vin).collection('trips').doc(activeTripId);
            const tripDoc = await tripRef.get();
            if (tripDoc.exists) {
                const tripData = tripDoc.data();
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
        }
        else if (activeTripId) {
            // Trip in progress, moving
            vehicleUpdate.stationaryPollCount = 0;
            const tripRef = db.collection('bydVehicles').doc(vin).collection('trips').doc(activeTripId);
            const tripDoc = await tripRef.get();
            if (tripDoc.exists) {
                const tripData = tripDoc.data();
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
    }
    catch (error) {
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
exports.bydWakeVehicle = regionalFunctions.https.onCall(async (data, context) => {
    const { vin, activatePolling = true } = data;
    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }
    console.log(`[bydWakeVehicle] Waking vehicle ${vin}...`);
    try {
        const client = await getBydClientWithSession(vin);
        // Helper to check if car is awake (has real data)
        const isCarAwake = (rt) => rt && (rt.soc > 0 || rt.odometer > 0 || rt.isOnline);
        // Helper to fetch all data
        const fetchData = async () => {
            const [realtimeResult, gpsResult] = await Promise.allSettled([
                client.getRealtime(vin),
                client.getGps(vin),
            ]);
            return {
                realtime: realtimeResult.status === 'fulfilled' ? realtimeResult.value : null,
                gps: gpsResult.status === 'fulfilled' ? gpsResult.value : null,
            };
        };
        // First attempt - this also wakes the car
        console.log(`[bydWakeVehicle] ${vin}: First request (wake)...`);
        let { realtime, gps } = await fetchData();
        let attempt = 1;
        // If car is sleeping, wait and retry up to 2 more times
        while (!isCarAwake(realtime) && attempt < 3) {
            const waitTime = attempt === 1 ? 3000 : 2000; // 3s first retry, 2s second
            console.log(`[bydWakeVehicle] ${vin}: Car sleeping, waiting ${waitTime}ms before retry ${attempt + 1}...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            const freshData = await fetchData();
            realtime = freshData.realtime;
            gps = freshData.gps;
            attempt++;
        }
        const isAwake = isCarAwake(realtime);
        console.log(`[bydWakeVehicle] ${vin}: After ${attempt} attempt(s): SOC=${(realtime === null || realtime === void 0 ? void 0 : realtime.soc) || 0}%, awake=${isAwake}`);
        // Prepare Firestore update
        const vehicleRef = db.collection('bydVehicles').doc(vin);
        const updateData = {
            lastWake: admin.firestore.Timestamp.now(),
        };
        if (realtime) {
            // Primary metrics - only update if we have real values (car is awake)
            // This preserves the last known good values when car is sleeping
            if (realtime.soc > 0) {
                updateData.lastSoC = realtime.soc / 100;
            }
            if (realtime.range > 0) {
                updateData.lastRange = realtime.range;
            }
            if (realtime.odometer > 0) {
                updateData.lastOdometer = realtime.odometer;
            }
            updateData.lastSpeed = realtime.speed || 0;
            // State indicators
            updateData.isCharging = realtime.isCharging;
            updateData.isLocked = realtime.isLocked;
            updateData.isOnline = realtime.isOnline;
            // Temperatures (may be undefined when car is asleep)
            if (realtime.exteriorTemp !== undefined)
                updateData.exteriorTemp = realtime.exteriorTemp;
            if (realtime.interiorTemp !== undefined)
                updateData.interiorTemp = realtime.interiorTemp;
            // Door and window status (may be undefined when car is asleep)
            if (realtime.doors !== undefined)
                updateData.doors = realtime.doors;
            if (realtime.windows !== undefined)
                updateData.windows = realtime.windows;
            // Tire pressure (may be undefined when car is asleep)
            if (realtime.tirePressure !== undefined)
                updateData.tirePressure = realtime.tirePressure;
            updateData.lastUpdate = admin.firestore.Timestamp.now();
        }
        if (gps) {
            const location = {
                lat: gps.latitude,
                lon: gps.longitude,
            };
            if (gps.heading !== undefined)
                location.heading = gps.heading;
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
            attempts: attempt,
            pollingActivated: activatePolling,
            data: {
                soc: (realtime === null || realtime === void 0 ? void 0 : realtime.soc) || 0,
                socPercent: realtime ? realtime.soc / 100 : 0,
                range: (realtime === null || realtime === void 0 ? void 0 : realtime.range) || 0,
                odometer: (realtime === null || realtime === void 0 ? void 0 : realtime.odometer) || 0,
                isCharging: (realtime === null || realtime === void 0 ? void 0 : realtime.isCharging) || false,
                isLocked: (realtime === null || realtime === void 0 ? void 0 : realtime.isLocked) || false,
                isOnline: (realtime === null || realtime === void 0 ? void 0 : realtime.isOnline) || false,
                location: gps ? { lat: gps.latitude, lon: gps.longitude, heading: gps.heading } : null,
            },
            message: isAwake
                ? 'Vehicle is awake - data is current'
                : 'Vehicle is in deep sleep - polling activated, data will update when car wakes.',
        };
    }
    catch (error) {
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
exports.bydDiagnostic = regionalFunctions.https.onCall(async (data, context) => {
    var _a, _b, _c;
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
            realtime: realtime.status === 'fulfilled' ? realtime.value : { error: (_a = realtime.reason) === null || _a === void 0 ? void 0 : _a.message },
            gps: gps.status === 'fulfilled' ? gps.value : { error: (_b = gps.reason) === null || _b === void 0 ? void 0 : _b.message },
            charging: charging.status === 'fulfilled' ? charging.value : { error: (_c = charging.reason) === null || _c === void 0 ? void 0 : _c.message },
        };
    }
    catch (error) {
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
exports.bydMqttWebhook = regionalFunctions.https.onRequest(async (req, res) => {
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
    }
    catch (error) {
        console.error('[bydMqttWebhook] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Process vehicleInfo MQTT event
 * Updates vehicle state and detects trips
 */
async function processVehicleInfoEvent(event) {
    var _a;
    const vin = event.vin;
    if (!vin) {
        console.log('[processVehicleInfoEvent] No VIN in event');
        return;
    }
    const data = ((_a = event.data) === null || _a === void 0 ? void 0 : _a.respondData) || event.data || {};
    const vehicleRef = db.collection('bydVehicles').doc(vin);
    // Get previous state for trip detection
    const prevDoc = await vehicleRef.get();
    const prevState = prevDoc.exists ? prevDoc.data() : null;
    // Parse new state - only include values > 0 to preserve last known values
    const newState = {
        isCharging: data.chargeState === 1,
        isOnline: true, // If we received MQTT event, car is online
        lastMqttUpdate: admin.firestore.Timestamp.now(),
    };
    // Only update primary metrics if we have real values
    const soc = data.elecPercent || 0;
    const range = data.evEndurance || 0;
    const odometer = data.odo || data.mileage || 0;
    if (soc > 0)
        newState.lastSoC = soc / 100;
    if (range > 0)
        newState.lastRange = range;
    if (odometer > 0)
        newState.lastOdometer = odometer;
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
async function processRemoteControlEvent(event) {
    var _a, _b;
    const vin = event.vin;
    if (!vin)
        return;
    console.log(`[processRemoteControlEvent] Control event for ${vin}:`, event.data);
    // Log the control event
    const vehicleRef = db.collection('bydVehicles').doc(vin);
    await vehicleRef.update({
        lastControlEvent: {
            type: (_a = event.data) === null || _a === void 0 ? void 0 : _a.controlType,
            status: (_b = event.data) === null || _b === void 0 ? void 0 : _b.controlState,
            timestamp: admin.firestore.Timestamp.now(),
        },
    });
}
/**
 * Create a trip record from MQTT state changes
 */
async function createTripFromMqtt(vin, prevState, newState, distance) {
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
exports.bydGetMqttCredentials = regionalFunctions.https.onCall(async (data, context) => {
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
        const session = client.session;
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
            brokerHost: (brokerInfo === null || brokerInfo === void 0 ? void 0 : brokerInfo.host) || 'emqoversea-eu.byd.auto',
            brokerPort: (brokerInfo === null || brokerInfo === void 0 ? void 0 : brokerInfo.port) || 8883,
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
    }
    catch (error) {
        console.error('[bydGetMqttCredentials] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * Trigger a data refresh using stored MQTT session
 * Called by Raspberry Pi AFTER it connects to MQTT
 * This should generate a response that arrives via MQTT
 */
exports.bydTriggerMqttRefresh = regionalFunctions.https.onCall(async (data, context) => {
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
        const sessionData = sessionDoc.data();
        console.log('[bydTriggerMqttRefresh] Using stored session for userId:', sessionData.userId);
        // Create a client using the stored session
        const client = await getBydClientForVehicle(vin);
        // Override the session with the stored one to use same credentials as MQTT
        client.session = {
            token: {
                userId: sessionData.userId,
                signToken: sessionData.signToken,
                encryToken: sessionData.encryToken,
            },
            cookies: JSON.parse(sessionData.cookies || '{}'),
        };
        let result;
        const command = data.command || 'refresh';
        const pin = data.pin;
        // Execute command using the MQTT session
        if (command === 'flashLights') {
            console.log('[bydTriggerMqttRefresh] Sending flashLights command...');
            result = await client.flashLights(vin, pin);
            console.log('[bydTriggerMqttRefresh] flashLights result:', result);
        }
        else {
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
    }
    catch (error) {
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
exports.bydScheduledPoll = regionalFunctions.pubsub
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
            }
            catch (error) {
                console.error(`[bydScheduledPoll] Error polling ${vin}:`, error.message);
            }
        });
        await Promise.all(promises);
        console.log('[bydScheduledPoll] Scheduled poll complete');
        return null;
    }
    catch (error) {
        console.error('[bydScheduledPoll] Error:', error.message);
        return null;
    }
});
/**
 * Internal polling function - used by both scheduler and manual calls
 */
async function pollVehicleInternal(vin) {
    var _a, _b, _c, _d;
    const client = await getBydClientWithSession(vin);
    // Get data sequentially - if session expired (1002), the first call
    // will auto-relogin and subsequent calls will use the new session
    const realtime = await client.getRealtime(vin);
    const gps = await client.getGps(vin).catch(() => null); // GPS might fail
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
    const prevOdometer = vehicleData.lastOdometer || 0;
    const activeTripId = vehicleData.activeTripId || null;
    const stationaryPollCount = vehicleData.stationaryPollCount || 0;
    // Calculate movement using odometer
    // GPS changes < 1km, Odometer reports in 1km increments
    // Use odometer as primary: >= 1km = definite movement
    // Also check GPS if available for smaller movements
    const odoDelta = realtime.odometer - prevOdometer;
    const hasOdoMovement = odoDelta >= 1; // 1km or more (odometer increments)
    // GPS-based detection if available
    let hasGpsMovement = false;
    if (gps) {
        const prevLat = ((_a = vehicleData.lastLocation) === null || _a === void 0 ? void 0 : _a.lat) || gps.latitude;
        const prevLon = ((_b = vehicleData.lastLocation) === null || _b === void 0 ? void 0 : _b.lon) || gps.longitude;
        // Simple distance check (Haversine would be more accurate but this is sufficient)
        const latDelta = Math.abs(gps.latitude - prevLat);
        const lonDelta = Math.abs(gps.longitude - prevLon);
        hasGpsMovement = (latDelta + lonDelta) > 0.0005; // ~50 meters at equator
    }
    const hasMovement = hasOdoMovement || hasGpsMovement;
    const isStationary = !hasMovement;
    // Detect if car is sleeping (all zeros response)
    const isCarSleeping = realtime.soc === 0 && realtime.range === 0 && realtime.odometer === 0;
    console.log(`[pollVehicleInternal] ${vin}: odo=${realtime.odometer} (delta=${odoDelta.toFixed(2)}km, odo_move=${hasOdoMovement}), gps_move=${hasGpsMovement}, movement=${hasMovement}, locked=${realtime.isLocked}, sleeping=${isCarSleeping}`);
    // If car is sleeping, don't overwrite good data with zeros
    if (isCarSleeping) {
        console.log(`[pollVehicleInternal] ${vin}: Car sleeping (all zeros), preserving last known values`);
        await vehicleRef.update({
            lastPollTime: now,
            isOnline: false,
        });
        return;
    }
    const vehicleUpdate = {
        lastPollTime: now,
        lastUpdate: now,
        // State indicators
        isCharging: realtime.isCharging,
        isLocked: realtime.isLocked,
        isOnline: realtime.isOnline,
        lastSpeed: realtime.speed || 0,
    };
    // Only update metrics if they have real values (preserve last known good values)
    if (realtime.soc > 0)
        vehicleUpdate.lastSoC = realtime.soc / 100;
    if (realtime.range > 0)
        vehicleUpdate.lastRange = realtime.range;
    if (realtime.odometer > 0)
        vehicleUpdate.lastOdometer = realtime.odometer;
    // Only update optional fields if defined (avoid Firestore undefined error)
    if (realtime.exteriorTemp !== undefined)
        vehicleUpdate.exteriorTemp = realtime.exteriorTemp;
    if (realtime.interiorTemp !== undefined)
        vehicleUpdate.interiorTemp = realtime.interiorTemp;
    if (realtime.doors !== undefined)
        vehicleUpdate.doors = realtime.doors;
    if (realtime.windows !== undefined)
        vehicleUpdate.windows = realtime.windows;
    if (realtime.tirePressure !== undefined)
        vehicleUpdate.tirePressure = realtime.tirePressure;
    if (gps) {
        const location = { lat: gps.latitude, lon: gps.longitude };
        if (gps.heading !== undefined)
            location.heading = gps.heading;
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
            startSoC: vehicleData.lastSoC || realtime.soc / 100,
            endOdometer: realtime.odometer,
            endSoC: realtime.soc / 100,
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
    }
    else if (activeTripId && realtime.isLocked && isStationary && stationaryPollCount >= 4) {
        // Close trip after 5 stationary polls while locked
        const tripRef = db.collection('bydVehicles').doc(vin).collection('trips').doc(activeTripId);
        const tripDoc = await tripRef.get();
        const tripData = tripDoc.data();
        if (tripData) {
            const totalDistance = realtime.odometer - (tripData.startOdometer || 0);
            // Adjust end time backwards by 5 minutes (since we've been stationary)
            const adjustedEndDate = admin.firestore.Timestamp.fromMillis(now.toMillis() - 5 * 60 * 1000);
            // Calculate duration in minutes
            const startTimestamp = ((_d = (_c = tripData.startDate) === null || _c === void 0 ? void 0 : _c.toMillis) === null || _d === void 0 ? void 0 : _d.call(_c)) || tripData.startDate || 0;
            const durationMinutes = Math.round((adjustedEndDate.toMillis() - startTimestamp) / 60000);
            // Calculate electricity (kWh) from SoC delta
            // Default BYD SEAL battery: 82.56 kWh (can be customized per vehicle)
            const batteryCapacity = vehicleData.batteryCapacity || 82.56;
            const socDelta = (tripData.startSoC || 0) - (realtime.soc / 100);
            const electricityKwh = Math.round(Math.max(0, socDelta * batteryCapacity) * 100) / 100;
            const updateData = {
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
    }
    else if (activeTripId && realtime.isLocked && isStationary) {
        // Increment stationary counter
        vehicleUpdate.stationaryPollCount = stationaryPollCount + 1;
        console.log(`[pollVehicleInternal] Locked + stationary: ${stationaryPollCount + 1}/5`);
        // Update trip with current data
        const tripRef = db.collection('bydVehicles').doc(vin).collection('trips').doc(activeTripId);
        const tripDoc = await tripRef.get();
        if (tripDoc.exists) {
            const tripData = tripDoc.data();
            const updateData = {
                endOdometer: realtime.odometer,
                endSoC: realtime.soc / 100,
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
    }
    else if (activeTripId && hasMovement) {
        // Trip ongoing with movement - add tracking point
        vehicleUpdate.stationaryPollCount = 0;
        const tripRef = db.collection('bydVehicles').doc(vin).collection('trips').doc(activeTripId);
        const tripDoc = await tripRef.get();
        if (tripDoc.exists) {
            const tripData = tripDoc.data();
            const updateData = {
                endOdometer: realtime.odometer,
                endSoC: realtime.soc / 100,
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
//# sourceMappingURL=bydFunctions.js.map