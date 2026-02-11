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
exports.bydScheduledPoll = exports.bydGetMqttCredentials = exports.bydMqttWebhook = exports.bydDiagnostic = exports.bydPollVehicle = exports.bydFlashLights = exports.bydStopClimate = exports.bydStartClimate = exports.bydUnlock = exports.bydLock = exports.bydGetCharging = exports.bydGetGps = exports.bydGetRealtime = exports.bydDisconnect = exports.bydConnect = void 0;
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
async function getBydClientForVehicle(vin) {
    ensureBydInit();
    const credentialsRef = db.collection('bydVehicles').doc(vin).collection('private').doc('credentials');
    const credentialsDoc = await credentialsRef.get();
    if (!credentialsDoc.exists) {
        throw new Error('Vehicle not connected to BYD');
    }
    const creds = credentialsDoc.data();
    const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;
    if (!ENCRYPTION_KEY) {
        throw new Error('Encryption key not configured');
    }
    const crypto = require('crypto');
    const decrypt = (encrypted) => {
        const [ivHex, authTagHex, dataHex] = encrypted.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const data = Buffer.from(dataHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
        decipher.setAuthTag(authTag);
        return decipher.update(data, undefined, 'utf8') + decipher.final('utf8');
    };
    const config = {
        username: decrypt(creds.username),
        password: decrypt(creds.password),
        countryCode: creds.countryCode,
        controlPin: creds.controlPin ? decrypt(creds.controlPin) : undefined,
    };
    return new byd_1.BydClient(config);
}
// =============================================================================
// VEHICLE DATA
// =============================================================================
/**
 * Get realtime vehicle data (battery, range, odometer, etc.)
 */
exports.bydGetRealtime = regionalFunctions.https.onCall(async (data, context) => {
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
        const client = await getBydClientForVehicle(vin);
        await client.login();
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
        const client = await getBydClientForVehicle(vin);
        await client.login();
        const success = await client.startClimate(vin, temperature || 22, pin);
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
        const client = await getBydClientForVehicle(vin);
        await client.login();
        const success = await client.stopClimate(vin, pin);
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
        const client = await getBydClientForVehicle(vin);
        await client.login();
        const success = await client.flashLights(vin, pin);
        console.log(`[bydFlashLights] ${vin}: ${success ? 'SUCCESS' : 'FAILED'}`);
        return { success };
    }
    catch (error) {
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
exports.bydPollVehicle = regionalFunctions.https.onCall(async (data, context) => {
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
        const vehicleUpdate = {
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
        }
        else if (activeTripId && realtime.isLocked && isStationary && stationaryPollCount >= 4) {
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
        }
        else if (activeTripId && realtime.isLocked && isStationary) {
            // Increment stationary counter
            vehicleUpdate.stationaryPollCount = stationaryPollCount + 1;
            console.log(`[bydPollVehicle] Locked + stationary: ${stationaryPollCount + 1}/5`);
            // Update trip
            const tripRef = db.collection('bydTrips').doc(activeTripId);
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
            const tripRef = db.collection('bydTrips').doc(activeTripId);
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
    // Parse new state
    const newState = {
        lastSoC: (data.elecPercent || 0) / 100,
        lastRange: data.evEndurance || 0,
        lastOdometer: data.odo || data.mileage || 0,
        isCharging: data.chargeState === 1,
        isOnline: true, // If we received MQTT event, car is online
        lastMqttUpdate: admin.firestore.Timestamp.now(),
    };
    // Update vehicle state
    await vehicleRef.update(newState);
    // Trip detection: check if odometer increased
    if (prevState && prevState.lastOdometer && newState.lastOdometer > prevState.lastOdometer) {
        const distance = newState.lastOdometer - prevState.lastOdometer;
        // Only create trip if distance > 0.5 km (avoid noise)
        if (distance > 0.5) {
            await createTripFromMqtt(vin, prevState, newState, distance);
        }
    }
    console.log(`[processVehicleInfoEvent] Updated ${vin}: SOC=${newState.lastSoC * 100}%, odo=${newState.lastOdometer}km`);
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
        source: 'byd-mqtt',
        startTime: prevState.lastMqttUpdate || prevState.lastUpdate,
        endTime: admin.firestore.Timestamp.now(),
        distance,
        startOdometer: prevState.lastOdometer,
        endOdometer: newState.lastOdometer,
        startSoC: prevState.lastSoC,
        endSoC: newState.lastSoC,
        energyUsed: (prevState.lastSoC - newState.lastSoC) * 100, // Approximate kWh based on SOC diff
        createdAt: admin.firestore.Timestamp.now(),
    };
    // Store in bydTrips collection
    const tripRef = await db.collection('bydTrips').add(tripData);
    console.log(`[createTripFromMqtt] Created trip ${tripRef.id}: ${distance.toFixed(1)}km, SOC ${(prevState.lastSoC * 100).toFixed(0)}% → ${(newState.lastSoC * 100).toFixed(0)}%`);
}
/**
 * Get MQTT credentials for a vehicle
 * Used by Raspberry Pi to get the tokens needed for MQTT connection
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
    console.log(`[pollVehicleInternal] ${vin}: odo=${realtime.odometer}, delta=${odoDelta.toFixed(3)}, movement=${hasMovement}, locked=${realtime.isLocked}`);
    const vehicleUpdate = {
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
    // Trip logic
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
            points: gps ? [{
                    lat: gps.latitude,
                    lon: gps.longitude,
                    timestamp: now.toMillis(),
                    type: 'start',
                }] : [],
        });
        vehicleUpdate.activeTripId = tripRef.id;
        console.log(`[pollVehicleInternal] STARTED trip: ${tripRef.id}`);
    }
    else if (activeTripId && realtime.isLocked && isStationary && stationaryPollCount >= 4) {
        // Close trip after 5 stationary polls while locked
        const tripRef = db.collection('bydTrips').doc(activeTripId);
        const tripDoc = await tripRef.get();
        const tripData = tripDoc.data();
        if (tripData) {
            const totalDistance = realtime.odometer - (tripData.startOdometer || 0);
            // Adjust end time backwards by 5 minutes (since we've been stationary)
            const adjustedEndDate = admin.firestore.Timestamp.fromMillis(now.toMillis() - 5 * 60 * 1000);
            const updateData = {
                status: 'completed',
                endDate: adjustedEndDate,
                endOdometer: realtime.odometer,
                endSoC: realtime.soc / 100,
                distanceKm: Math.round(Math.max(0, totalDistance) * 100) / 100,
                lastUpdate: now,
            };
            // Add end point if we have GPS
            if (gps && tripData.points) {
                updateData.points = [...tripData.points, {
                        lat: gps.latitude,
                        lon: gps.longitude,
                        timestamp: adjustedEndDate.toMillis(),
                        type: 'end',
                    }];
            }
            await tripRef.update(updateData);
            console.log(`[pollVehicleInternal] CLOSED trip: ${activeTripId}, ${totalDistance.toFixed(2)}km`);
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
        const tripRef = db.collection('bydTrips').doc(activeTripId);
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
        const tripRef = db.collection('bydTrips').doc(activeTripId);
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