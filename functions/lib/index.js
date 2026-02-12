"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateVehicleSettings = exports.cleanupDuplicateTrips = exports.subscribeVehicleToWebhook = exports.scheduledPoll = exports.pollVehicle = exports.simulateWebhook = exports.calculateTripGpsDistance = exports.diag = exports.getDiagnostics = exports.fullSmartcarDiagnostic = exports.testSmartcarConnection = exports.mergeTrips = exports.setTargetChargeSoC = exports.refreshVehicleData = exports.closeTrunk = exports.openTrunk = exports.stopClimate = exports.startClimate = exports.unlockVehicle = exports.lockVehicle = exports.startCharge = exports.stopCharge = exports.resetPollingState = exports.disconnectSmartcar = exports.exchangeAuthCode = exports.smartcarWebhook = exports.ping = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const smartcar_1 = __importDefault(require("smartcar"));
// =============================================================================
// INITIALIZATION
// =============================================================================
admin.initializeApp();
const db = admin.firestore();
// Version: 3.6.0 - Hybrid: webhook activates polling, polling creates trips (2026-02-12)
const VERSION = '3.6.0';
// Region: Europe (Belgium) - closest to Spain and matches Firestore eur3 location
const REGION = 'europe-west1';
const regionalFunctions = functions.region(REGION);
// =============================================================================
// CONFIGURATION
// =============================================================================
const SMARTCAR_AMT = process.env.SMARTCAR_AMT || '';
const SMARTCAR_CLIENT_ID = process.env.SMARTCAR_CLIENT_ID;
const SMARTCAR_CLIENT_SECRET = process.env.SMARTCAR_CLIENT_SECRET;
const SMARTCAR_REDIRECT_URI = process.env.SMARTCAR_REDIRECT_URI;
const SMARTCAR_WEBHOOK_ID = process.env.SMARTCAR_WEBHOOK_ID; // Webhook ID from Smartcar Dashboard
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;
// Trip detection thresholds
const CONFIG = {
    // Minimum distance (km) to classify as a real trip
    MIN_TRIP_DISTANCE: 0.5,
    // Minimum distance (km) to detect movement
    MIN_MOVEMENT_DELTA: 0.03, // 30 meters
    // Idle timeout to close trip (ms) - 10 minutes
    IDLE_TIMEOUT_MS: 10 * 60 * 1000,
};
// NOTE: Battery capacity NOT used here - app calculates consumption from SoC delta * user's batterySize
// =============================================================================
// HELPERS - ENCRYPTION
// =============================================================================
function encryptToken(token) {
    if (!TOKEN_ENCRYPTION_KEY) {
        console.warn('[WARN] TOKEN_ENCRYPTION_KEY not set, storing token unencrypted');
        return token;
    }
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(TOKEN_ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}
function decryptToken(encryptedToken) {
    if (!TOKEN_ENCRYPTION_KEY || !encryptedToken.includes(':')) {
        return encryptedToken;
    }
    const [ivHex, encrypted] = encryptedToken.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(TOKEN_ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
// =============================================================================
// HELPERS - TOKEN MANAGEMENT
// =============================================================================
// =============================================================================
// HELPERS - TOKEN MANAGEMENT
// =============================================================================
// In-memory cache for access tokens to reduce Firestore reads
// Map<vehicleId, { token: string, expiry: number }>
const tokenCache = new Map();
/**
 * Normalize SoC to percentage (0-100)
 * @param value SoC value (0-1 or 0-100)
 * @returns SoC as percentage (0-100)
 */
function normalizeSoC(value) {
    if (value === null || value === undefined)
        return null;
    // If <= 1, assume it's a decimal (e.g. 0.55) and convert to 55
    // If > 1, assume it's already percentage (e.g. 55)
    return value <= 1 ? Math.round(value * 100) : Math.round(value);
}
async function getValidAccessToken(vehicleId) {
    var _a, _b, _c, _d;
    const now = Date.now();
    // 1. Check in-memory cache first
    const cached = tokenCache.get(vehicleId);
    if (cached && cached.expiry > now + 60000) { // Buffer 1 min
        console.log(`[TokenCache] Hit for ${vehicleId}`);
        return cached.token;
    }
    console.log(`[TokenCache] Miss for ${vehicleId}, fetching from Firestore...`);
    const vehicleRef = db.collection('vehicles').doc(vehicleId);
    const tokensDoc = await vehicleRef.collection('private').doc('tokens').get();
    const tokensData = tokensDoc.data();
    if (!(tokensData === null || tokensData === void 0 ? void 0 : tokensData.accessToken) || !(tokensData === null || tokensData === void 0 ? void 0 : tokensData.refreshToken)) {
        throw new Error('No tokens found for vehicle');
    }
    const accessToken = decryptToken(tokensData.accessToken);
    const refreshToken = decryptToken(tokensData.refreshToken);
    // Check if token is likely expired (stored expiry time or >90 min since update)
    // Smartcar access tokens last 2 hours (7200 seconds)
    const expiresAt = ((_b = (_a = tokensData.expiresAt) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) || 0;
    const updatedAt = ((_d = (_c = tokensData.updatedAt) === null || _c === void 0 ? void 0 : _c.toMillis) === null || _d === void 0 ? void 0 : _d.call(_c)) || 0;
    // const now = Date.now(); // Already defined at top of function
    const TOKEN_LIFETIME_MS = 90 * 60 * 1000; // Refresh 30 min before expiry (90 min)
    const tokenExpired = expiresAt > 0
        ? now >= expiresAt
        : (updatedAt > 0 && now - updatedAt >= TOKEN_LIFETIME_MS);
    if (!tokenExpired) {
        // Token should still be valid, return it without API call
        // Update cache since we just read from Firestore
        const expiry = expiresAt > 0 ? expiresAt : (Date.now() + 3600000); // Fallback 1h
        tokenCache.set(vehicleId, {
            token: accessToken,
            expiry: expiry
        });
        return accessToken;
    }
    // Token likely expired, refresh it
    console.log(`[TokenRefresh] Token likely expired for ${vehicleId}, refreshing...`);
    if (!SMARTCAR_CLIENT_ID || !SMARTCAR_CLIENT_SECRET || !SMARTCAR_REDIRECT_URI) {
        throw new Error('Smartcar credentials not configured');
    }
    try {
        const client = new smartcar_1.default.AuthClient({
            clientId: SMARTCAR_CLIENT_ID,
            clientSecret: SMARTCAR_CLIENT_SECRET,
            redirectUri: SMARTCAR_REDIRECT_URI,
        });
        const newAccess = await client.exchangeRefreshToken(refreshToken);
        const newAccessToken = newAccess.accessToken;
        const newRefreshToken = newAccess.refreshToken;
        // Calculate expiry time (2 hours from now)
        const expiresAtMs = Date.now() + (2 * 60 * 60 * 1000);
        // Store the new tokens with expiry
        await vehicleRef.collection('private').doc('tokens').update({
            accessToken: encryptToken(newAccessToken),
            refreshToken: encryptToken(newRefreshToken),
            expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[TokenRefresh] Tokens refreshed successfully for ${vehicleId}`);
        // Update cache
        tokenCache.set(vehicleId, {
            token: newAccessToken,
            expiry: expiresAtMs
        });
        return newAccessToken;
    }
    catch (error) {
        // If refresh fails, return current token - it might still work
        console.warn(`[TokenRefresh] Refresh failed for ${vehicleId}: ${error.message}, using existing token`);
        // Cache existing token for a short time (5 min) to avoid hammering Firestore on retry
        tokenCache.set(vehicleId, {
            token: accessToken,
            expiry: Date.now() + 5 * 60 * 1000
        });
        return accessToken;
    }
}
// =============================================================================
// HELPERS - GPS & DISTANCE
// =============================================================================
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function calculateHaversineTotal(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += haversine(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
    }
    return Math.round(total * 100) / 100;
}
async function snapToRoadsDistance(points) {
    if (!GOOGLE_MAPS_API_KEY) {
        return calculateHaversineTotal(points);
    }
    try {
        const path = points.map(p => `${p.lat},${p.lon}`).join('|');
        const url = `https://roads.googleapis.com/v1/snapToRoads?path=${path}&interpolate=true&key=${GOOGLE_MAPS_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        if (!data.snappedPoints || data.snappedPoints.length === 0) {
            return calculateHaversineTotal(points);
        }
        const snappedPoints = data.snappedPoints.map((p) => ({
            lat: p.location.latitude,
            lon: p.location.longitude
        }));
        return calculateHaversineTotal(snappedPoints);
    }
    catch (error) {
        console.error('[snapToRoads] Error:', error);
        return calculateHaversineTotal(points);
    }
}
// =============================================================================
// HELPERS - ADMIN AUTH
// =============================================================================
function isAdminRequest(req) {
    const apiKey = req.headers['x-admin-api-key'] || req.query.adminKey;
    if (!ADMIN_API_KEY)
        return false;
    return apiKey === ADMIN_API_KEY;
}
// =============================================================================
// PING - Health Check
// =============================================================================
exports.ping = regionalFunctions.https.onCall((data, context) => {
    return { status: 'PONG', version: VERSION, timestamp: new Date().toISOString(), region: REGION };
});
function parseSmartcarWebhook(body) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    // Extract vehicle ID from various possible locations
    const vehicleId = body.vehicleId ||
        ((_a = body.data) === null || _a === void 0 ? void 0 : _a.vehicleId) ||
        ((_b = body.vehicle) === null || _b === void 0 ? void 0 : _b.id) ||
        ((_d = (_c = body.data) === null || _c === void 0 ? void 0 : _c.vehicle) === null || _d === void 0 ? void 0 : _d.id);
    if (!vehicleId) {
        console.error('[parseWebhook] No vehicleId found in body');
        return null;
    }
    const result = {
        vehicleId,
        timestamp: admin.firestore.Timestamp.now(),
        odometer: null,
        soc: null,
        isLocked: null,
        isOnline: null,
        isAsleep: null,
        isCharging: null,
        location: null,
    };
    // Parse signals array (SmartCar v4 format)
    const signals = ((_e = body.data) === null || _e === void 0 ? void 0 : _e.signals) || [];
    for (const signal of signals) {
        // Skip failed signals
        if (((_f = signal.status) === null || _f === void 0 ? void 0 : _f.value) !== 'SUCCESS') {
            console.log(`[parseWebhook] Signal ${signal.name} failed: ${((_h = (_g = signal.status) === null || _g === void 0 ? void 0 : _g.error) === null || _h === void 0 ? void 0 : _h.type) || 'UNKNOWN'}`);
            continue;
        }
        const value = (_j = signal.body) === null || _j === void 0 ? void 0 : _j.value;
        if (value === undefined)
            continue;
        // Extract OEM timestamp if available (vehicle's actual time)
        if ((_k = signal.meta) === null || _k === void 0 ? void 0 : _k.oemUpdatedAt) {
            result.timestamp = admin.firestore.Timestamp.fromMillis(signal.meta.oemUpdatedAt);
        }
        // Map signal names to our data structure
        const name = (_l = signal.name) === null || _l === void 0 ? void 0 : _l.toLowerCase();
        switch (name) {
            case 'traveleddistance':
            case 'odometer':
                result.odometer = typeof value === 'number' ? value : null;
                break;
            case 'stateofcharge':
            case 'soc':
                result.soc = normalizeSoC(typeof value === 'number' ? value : null);
                break;
            case 'islocked':
                result.isLocked = typeof value === 'boolean' ? value : null;
                break;
            case 'isonline':
                result.isOnline = typeof value === 'boolean' ? value : null;
                break;
            case 'isasleep':
                result.isAsleep = typeof value === 'boolean' ? value : null;
                break;
            case 'ischarging':
            case 'charging':
            case 'chargestate':
                result.isCharging = typeof value === 'boolean' ? value : (value === 'CHARGING');
                break;
            case 'location':
                if (((_m = signal.body) === null || _m === void 0 ? void 0 : _m.latitude) && ((_o = signal.body) === null || _o === void 0 ? void 0 : _o.longitude)) {
                    result.location = { lat: signal.body.latitude, lon: signal.body.longitude };
                }
                break;
        }
    }
    console.log(`[parseWebhook] Parsed: odo=${result.odometer}, soc=${result.soc}, locked=${result.isLocked}, online=${result.isOnline}, asleep=${result.isAsleep}, charging=${result.isCharging}, hasLocation=${!!result.location}`);
    return result;
}
exports.smartcarWebhook = regionalFunctions.https.onRequest(async (req, res) => {
    var _a, _b, _c, _d, _e;
    const logPrefix = `[Webhook v${VERSION}]`;
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET, POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type, sc-signature');
        res.status(204).send('');
        return;
    }
    // =========================================================================
    // CHALLENGE VERIFICATION (GET or POST)
    // =========================================================================
    // GET challenge (SmartCar v2)
    if (req.method === 'GET' && req.query.challenge) {
        const challenge = req.query.challenge;
        console.log(`${logPrefix} GET Challenge received`);
        if (!SMARTCAR_AMT) {
            console.error(`${logPrefix} SMARTCAR_AMT not configured!`);
            res.status(500).json({ error: 'Webhook secret not configured' });
            return;
        }
        const hmac = crypto.createHmac('sha256', SMARTCAR_AMT).update(challenge).digest('hex');
        console.log(`${logPrefix} Challenge verified, responding with HMAC`);
        res.status(200).json({ challenge: hmac });
        return;
    }
    // POST challenge (SmartCar v1 or VERIFY event)
    const body = req.body || {};
    if (body.eventType === 'VERIFY' || body.challenge) {
        const challenge = body.challenge || ((_a = body.data) === null || _a === void 0 ? void 0 : _a.challenge);
        if (challenge) {
            console.log(`${logPrefix} POST Challenge/VERIFY received`);
            if (!SMARTCAR_AMT) {
                console.error(`${logPrefix} SMARTCAR_AMT not configured!`);
                res.status(500).json({ error: 'Webhook secret not configured' });
                return;
            }
            const hmac = crypto.createHmac('sha256', SMARTCAR_AMT).update(challenge).digest('hex');
            res.status(200).json({ challenge: hmac });
            return;
        }
    }
    // =========================================================================
    // DATA EVENT PROCESSING
    // =========================================================================
    const eventType = body.eventType;
    console.log(`${logPrefix} Event: ${eventType || 'unknown'}`);
    // Ignore non-data events
    if (eventType === 'VEHICLE_ERROR') {
        console.log(`${logPrefix} Ignoring VEHICLE_ERROR event`);
        res.status(200).send('OK');
        return;
    }
    // Parse webhook data
    const data = parseSmartcarWebhook(body);
    if (!data) {
        console.error(`${logPrefix} Failed to parse webhook - no vehicleId`);
        res.status(400).send('Missing vehicleId');
        return;
    }
    const { vehicleId } = data;
    console.log(`${logPrefix} Processing vehicle: ${vehicleId}`);
    try {
        const now = admin.firestore.Timestamp.now();
        const vehicleRef = db.collection('vehicles').doc(vehicleId);
        // =====================================================================
        // STEP 1: Read current vehicle state
        // =====================================================================
        const vehicleDoc = await vehicleRef.get();
        const vehicle = vehicleDoc.data() || {};
        // Get previous values - use null if not set (to detect first-time setup)
        const prevOdometer = (_b = vehicle.lastOdometer) !== null && _b !== void 0 ? _b : null;
        const prevSoC = (_c = vehicle.lastSoC) !== null && _c !== void 0 ? _c : null;
        const activeTripId = vehicle.activeTripId || null;
        // Current values from webhook
        const currentOdometer = data.odometer;
        const currentSoC = data.soc;
        // Calculate odometer delta ONLY if we have valid previous data
        // If prevOdometer is null, this is first data - don't create trips
        const hasPreviousData = prevOdometer !== null && prevOdometer > 0;
        const odoDelta = hasPreviousData && currentOdometer !== null
            ? currentOdometer - prevOdometer
            : 0;
        const hasMovement = hasPreviousData && odoDelta > CONFIG.MIN_MOVEMENT_DELTA;
        console.log(`${logPrefix} Odo: ${prevOdometer} -> ${currentOdometer} (delta: ${odoDelta.toFixed(3)} km), Movement: ${hasMovement}, HasPrevData: ${hasPreviousData}`);
        // =====================================================================
        // STEP 2: Update vehicle state
        // =====================================================================
        const vehicleUpdate = {
            lastUpdate: now,
            make: vehicle.make || 'BYD',
        };
        if (data.odometer !== null)
            vehicleUpdate.lastOdometer = data.odometer;
        if (data.soc !== null)
            vehicleUpdate.lastSoC = data.soc;
        if (data.isLocked !== null)
            vehicleUpdate.isLocked = data.isLocked;
        if (data.isOnline !== null)
            vehicleUpdate.isOnline = data.isOnline;
        if (data.isAsleep !== null)
            vehicleUpdate.isAsleep = data.isAsleep;
        if (data.isCharging !== null)
            vehicleUpdate.isCharging = data.isCharging;
        if (hasMovement) {
            vehicleUpdate.lastMoveTime = now;
        }
        // =====================================================================
        // CHARGING DETECTION: Detect charge start/end
        // =====================================================================
        const prevIsCharging = vehicle.isCharging === true;
        const currentIsCharging = data.isCharging === true;
        const activeChargeSessionId = vehicle.activeChargeSessionId || null;
        // CHARGING STARTED
        if (!prevIsCharging && currentIsCharging) {
            console.log(`${logPrefix} CHARGING STARTED - Creating charge session`);
            // Close any active trip first
            if (activeTripId) {
                console.log(`${logPrefix} Closing active trip ${activeTripId} because charging started`);
                const tripRef = db.collection('trips').doc(activeTripId);
                const tripDoc = await tripRef.get();
                if (tripDoc.exists) {
                    const tripData = tripDoc.data();
                    const tripDistance = (currentOdometer || 0) - (tripData.startOdometer || 0);
                    await tripRef.update({
                        status: 'completed',
                        type: tripDistance >= CONFIG.MIN_TRIP_DISTANCE ? 'trip' : 'idle',
                        endDate: now,
                        endOdometer: currentOdometer,
                        endSoC: currentSoC,
                        distanceKm: Math.round(tripDistance * 100) / 100,
                        closedReason: 'charging_started',
                        lastUpdate: now,
                    });
                }
                vehicleUpdate.activeTripId = admin.firestore.FieldValue.delete();
                vehicleUpdate.pollingActive = false;
            }
            // Create new charge session
            const chargeSessionRef = db.collection('chargeSessions').doc();
            await chargeSessionRef.set({
                vehicleId,
                status: 'in_progress',
                startDate: now,
                startSoC: currentSoC,
                currentSoC: currentSoC,
                startOdometer: currentOdometer,
                location: data.location || null,
                lastUpdate: now,
            });
            vehicleUpdate.activeChargeSessionId = chargeSessionRef.id;
            vehicleUpdate.chargingActive = true;
            console.log(`${logPrefix} Created charge session: ${chargeSessionRef.id}`);
        }
        // CHARGING ENDED
        if (prevIsCharging && !currentIsCharging && activeChargeSessionId) {
            console.log(`${logPrefix} CHARGING ENDED - Finalizing charge session ${activeChargeSessionId}`);
            const chargeSessionRef = db.collection('chargeSessions').doc(activeChargeSessionId);
            const chargeSessionDoc = await chargeSessionRef.get();
            if (chargeSessionDoc.exists) {
                const sessionData = chargeSessionDoc.data();
                const startSoC = sessionData.startSoC || 0;
                const endSoC = currentSoC || startSoC;
                const socGain = Math.max(0, endSoC - startSoC);
                // Calculate duration
                const startMs = ((_d = sessionData.startDate) === null || _d === void 0 ? void 0 : _d.toMillis()) || Date.now();
                const durationMinutes = Math.round((Date.now() - startMs) / 60000);
                await chargeSessionRef.update({
                    status: 'completed',
                    endDate: now,
                    endSoC: endSoC,
                    socGain: Math.round(socGain * 1000) / 1000, // e.g., 0.25 = 25%
                    durationMinutes,
                    lastUpdate: now,
                    // Note: kWh and cost will be calculated/added by user in frontend
                });
                console.log(`${logPrefix} Finalized charge session: ${activeChargeSessionId}, +${(socGain * 100).toFixed(1)}% SoC, ${durationMinutes} min`);
                // TODO: Send push notification to user
            }
            vehicleUpdate.activeChargeSessionId = admin.firestore.FieldValue.delete();
            vehicleUpdate.chargingActive = false;
        }
        // UPDATE CHARGE SESSION if charging is active
        if (currentIsCharging && activeChargeSessionId) {
            const chargeSessionRef = db.collection('chargeSessions').doc(activeChargeSessionId);
            await chargeSessionRef.update({
                currentSoC: currentSoC,
                lastUpdate: now,
            });
            // Check for auto-stop (target SoC)
            const targetSoC = vehicle.targetChargeSoC || null;
            if (targetSoC && currentSoC && currentSoC >= targetSoC) {
                console.log(`${logPrefix} TARGET SOC REACHED (${(currentSoC * 100).toFixed(0)}% >= ${(targetSoC * 100).toFixed(0)}%) - Auto-stopping charge`);
                try {
                    const accessToken = await getValidAccessToken(vehicleId);
                    const smartcarVehicle = new smartcar_1.default.Vehicle(vehicleId, accessToken);
                    await smartcarVehicle.stopCharge();
                    console.log(`${logPrefix} AUTO-STOP: Sent STOP command to vehicle`);
                    // Mark that we auto-stopped
                    await chargeSessionRef.update({
                        autoStopped: true,
                        autoStopSoC: currentSoC,
                        autoStopTime: now,
                    });
                }
                catch (stopError) {
                    console.error(`${logPrefix} AUTO-STOP FAILED: ${stopError.message}`);
                }
            }
        }
        // =====================================================================
        // POLLING ACTIVATION (v3.6.0 - Hybrid approach)
        // Activate polling when car is unlocked so we can detect movement
        // =====================================================================
        const prevIsLocked = vehicle.isLocked;
        const currentIsLocked = data.isLocked;
        // Car UNLOCKED → activate polling to detect movement
        if (prevIsLocked === true && currentIsLocked === false) {
            console.log(`${logPrefix} CAR UNLOCKED - Activating polling`);
            vehicleUpdate.pollingActive = true;
            vehicleUpdate.stationaryPollCount = 0;
        }
        // =====================================================================
        // STEP 3: TRIP LOGIC (v3.6.0 - Hybrid: polling creates trips)
        // - Movement + LOCKED + no trip → Create RETROACTIVE completed trip
        // - Movement + UNLOCKED + no trip → START new active trip
        // - Trip active → UPDATE with latest data
        // - Trip creation/GPS handled by scheduledPoll when pollingActive
        // =====================================================================
        // CASE 1: RETROACTIVE TRIP - Movement detected but car is LOCKED (no active trip)
        // This means the car moved between webhook events and is now parked
        // Create a completed trip directly instead of starting a live one
        if (data.isLocked === true && hasMovement && !activeTripId && !currentIsCharging) {
            console.log(`${logPrefix} MOVEMENT WHILE LOCKED - Creating retroactive completed trip`);
            const retroTripRef = db.collection('trips').doc();
            const retroDistance = Math.round(odoDelta * 100) / 100;
            await retroTripRef.set({
                vehicleId,
                startDate: vehicle.lastMoveTime || now,
                endDate: now,
                startOdometer: prevOdometer,
                endOdometer: currentOdometer,
                startSoC: prevSoC !== null && prevSoC !== void 0 ? prevSoC : 0,
                endSoC: currentSoC !== null && currentSoC !== void 0 ? currentSoC : 0,
                distanceKm: retroDistance,
                status: 'completed',
                type: retroDistance >= CONFIG.MIN_TRIP_DISTANCE ? 'trip' : 'idle',
                source: 'webhook',
                closedReason: 'retroactive_locked',
                lastUpdate: now,
            });
            console.log(`${logPrefix} CREATED retroactive trip: ${retroTripRef.id}, ${retroDistance.toFixed(2)}km`);
            // Do NOT set activeTripId - trip is already completed
            // CASE 2: START TRIP if movement detected, car is UNLOCKED, and no active trip
        }
        else if (hasMovement && !activeTripId && !currentIsCharging && data.isLocked === false) {
            console.log(`${logPrefix} MOVEMENT + UNLOCKED - Starting new active trip`);
            const newTripRef = db.collection('trips').doc();
            await newTripRef.set({
                vehicleId,
                startDate: now,
                startOdometer: prevOdometer,
                startSoC: prevSoC !== null && prevSoC !== void 0 ? prevSoC : 0,
                endOdometer: currentOdometer,
                endSoC: currentSoC !== null && currentSoC !== void 0 ? currentSoC : 0,
                distanceKm: Math.round(odoDelta * 100) / 100,
                status: 'in_progress',
                type: 'unknown',
                source: 'webhook',
                lastUpdate: now,
            });
            // Add start GPS point (only if location is available)
            if (data.location && data.location.lat && data.location.lon) {
                await newTripRef.collection('points').add({
                    lat: data.location.lat, lon: data.location.lon,
                    timestamp: now, source: 'webhook', type: 'start'
                });
            }
            vehicleUpdate.activeTripId = newTripRef.id;
            console.log(`${logPrefix} STARTED trip: ${newTripRef.id}, initial ${odoDelta.toFixed(2)}km`);
            // CASE 3: UPDATE TRIP if active and has new data
            // FIX: Calculate total distance from startOdometer instead of incrementing
        }
        else if (activeTripId) {
            const tripRef = db.collection('trips').doc(activeTripId);
            const tripDoc = await tripRef.get();
            if (tripDoc.exists) {
                const tripData = tripDoc.data();
                const tripUpdate = { lastUpdate: now };
                if (currentOdometer !== null) {
                    tripUpdate.endOdometer = currentOdometer;
                    // FIX Bug 3: Calculate total distance from start instead of increment
                    const totalDistance = currentOdometer - (tripData.startOdometer || 0);
                    tripUpdate.distanceKm = Math.round(Math.max(0, totalDistance) * 100) / 100;
                }
                if (currentSoC !== null)
                    tripUpdate.endSoC = currentSoC;
                await tripRef.update(tripUpdate);
                // Add GPS waypoint (only if location is available)
                if (data.location && data.location.lat && data.location.lon) {
                    await tripRef.collection('points').add({
                        lat: data.location.lat, lon: data.location.lon,
                        timestamp: now, odometer: currentOdometer, source: 'webhook', type: 'waypoint'
                    });
                }
                console.log(`${logPrefix} UPDATED trip: ${activeTripId}, total ${((_e = tripUpdate.distanceKm) === null || _e === void 0 ? void 0 : _e.toFixed(2)) || 'N/A'}km`);
            }
        }
        else {
            console.log(`${logPrefix} No trip action needed (locked=${data.isLocked}, movement=${hasMovement}, charging=${currentIsCharging})`);
        }
        // =====================================================================
        // STEP 4: Save vehicle state
        // =====================================================================
        await vehicleRef.set(vehicleUpdate, { merge: true });
        console.log(`${logPrefix} SUCCESS - Vehicle state saved`);
        res.status(200).send('OK');
    }
    catch (error) {
        console.error(`${logPrefix} ERROR:`, error.message);
        console.error(error.stack);
        // Return 200 to prevent SmartCar from retrying indefinitely
        // The error is logged for debugging
        res.status(200).send('Error logged');
    }
});
// =============================================================================
// OAUTH - Exchange Auth Code
// =============================================================================
exports.exchangeAuthCode = regionalFunctions.https.onCall(async (data, context) => {
    console.log('[exchangeAuthCode] Start');
    const code = data.code;
    const batteryCapacity = data.batteryCapacity || 82.56; // Default BYD SEAL battery capacity
    if (!code) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing authorization code');
    }
    console.log(`[exchangeAuthCode] Battery capacity: ${batteryCapacity} kWh`);
    if (!SMARTCAR_CLIENT_ID || !SMARTCAR_CLIENT_SECRET || !SMARTCAR_REDIRECT_URI) {
        console.error('[exchangeAuthCode] Missing environment variables');
        throw new functions.https.HttpsError('failed-precondition', 'Smartcar credentials missing');
    }
    try {
        const client = new smartcar_1.default.AuthClient({
            clientId: SMARTCAR_CLIENT_ID,
            clientSecret: SMARTCAR_CLIENT_SECRET,
            redirectUri: SMARTCAR_REDIRECT_URI,
        });
        console.log('[exchangeAuthCode] Exchanging code...');
        const access = await client.exchangeCode(code);
        const accessToken = access.accessToken;
        const refreshToken = access.refreshToken;
        console.log('[exchangeAuthCode] Getting vehicle IDs...');
        const vehiclesResponse = await smartcar_1.default.getVehicles(accessToken);
        const vehicleIds = vehiclesResponse.vehicles;
        if (vehicleIds.length === 0) {
            throw new functions.https.HttpsError('not-found', 'No vehicles found in Smartcar account');
        }
        const vehicleId = vehicleIds[0];
        console.log(`[exchangeAuthCode] Found vehicle: ${vehicleId}`);
        const vehicle = new smartcar_1.default.Vehicle(vehicleId, accessToken);
        const attributes = await vehicle.attributes();
        // Store vehicle info (including battery capacity for consumption calculations)
        // NOTE: pollingActive=false - polling only starts when webhook detects unlock/movement
        await db.collection('vehicles').doc(vehicleId).set({
            id: vehicleId,
            make: attributes.make,
            model: attributes.model,
            year: attributes.year,
            batteryCapacity: batteryCapacity, // From user settings, for consumption calculations
            pollingActive: false, // Don't start polling automatically
            idlePollCount: 0,
            errorPollCount: 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        // Store tokens (encrypted)
        await db.collection('vehicles').doc(vehicleId).collection('private').doc('tokens').set({
            accessToken: encryptToken(accessToken),
            refreshToken: encryptToken(refreshToken),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            encrypted: !!TOKEN_ENCRYPTION_KEY,
        });
        // Auto-subscribe vehicle to webhook for automatic data updates
        let webhookSubscribed = false;
        if (SMARTCAR_WEBHOOK_ID) {
            try {
                console.log(`[exchangeAuthCode] Subscribing vehicle ${vehicleId} to webhook ${SMARTCAR_WEBHOOK_ID}...`);
                const subscribeResponse = await fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}/webhooks/${SMARTCAR_WEBHOOK_ID}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                });
                const subscribeResult = await subscribeResponse.json();
                if (subscribeResponse.ok) {
                    console.log(`[exchangeAuthCode] Vehicle subscribed to webhook successfully`);
                    webhookSubscribed = true;
                    // Store webhook subscription info
                    await db.collection('vehicles').doc(vehicleId).update({
                        webhookId: SMARTCAR_WEBHOOK_ID,
                        webhookSubscribedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
                else {
                    console.warn(`[exchangeAuthCode] Webhook subscription failed: ${JSON.stringify(subscribeResult)}`);
                }
            }
            catch (webhookError) {
                console.error(`[exchangeAuthCode] Webhook subscription error: ${webhookError.message}`);
                // Don't fail the whole process if webhook subscription fails
            }
        }
        else {
            console.warn('[exchangeAuthCode] SMARTCAR_WEBHOOK_ID not configured, skipping webhook subscription');
        }
        console.log('[exchangeAuthCode] SUCCESS');
        return { success: true, vehicleId, make: attributes.make, model: attributes.model, webhookSubscribed };
    }
    catch (error) {
        console.error('[exchangeAuthCode] FAILED:', error.message);
        throw new functions.https.HttpsError('internal', error.message || 'Token exchange failed');
    }
});
// =============================================================================
// OAUTH - Disconnect SmartCar
// =============================================================================
exports.disconnectSmartcar = regionalFunctions.https.onCall(async (data, context) => {
    console.log('[disconnectSmartcar] Start');
    const { vehicleId } = data;
    if (!vehicleId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId');
    }
    try {
        const vehicleRef = db.collection('vehicles').doc(vehicleId);
        const vehicleDoc = await vehicleRef.get();
        if (!vehicleDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Vehicle not found');
        }
        // Try to revoke access on SmartCar side
        try {
            const tokensDoc = await vehicleRef.collection('private').doc('tokens').get();
            const tokensData = tokensDoc.data();
            if (tokensData === null || tokensData === void 0 ? void 0 : tokensData.accessToken) {
                const accessToken = decryptToken(tokensData.accessToken);
                const vehicle = new smartcar_1.default.Vehicle(vehicleId, accessToken);
                await vehicle.disconnect();
                console.log('[disconnectSmartcar] Revoked SmartCar access');
            }
        }
        catch (e) {
            console.warn('[disconnectSmartcar] Failed to revoke (token may be expired)');
        }
        // Delete tokens
        await vehicleRef.collection('private').doc('tokens').delete();
        // Clear SmartCar-related fields
        await vehicleRef.update({
            lastOdometer: admin.firestore.FieldValue.delete(),
            lastSoC: admin.firestore.FieldValue.delete(),
            lastMoveTime: admin.firestore.FieldValue.delete(),
            isLocked: admin.firestore.FieldValue.delete(),
            isAsleep: admin.firestore.FieldValue.delete(),
            isOnline: admin.firestore.FieldValue.delete(),
            activeTripId: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('[disconnectSmartcar] SUCCESS');
        return { success: true };
    }
    catch (error) {
        console.error('[disconnectSmartcar] FAILED:', error.message);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message);
    }
});
// =============================================================================
// RESET POLLING STATE (for debugging/manual control)
// =============================================================================
exports.resetPollingState = regionalFunctions.https.onCall(async (data, context) => {
    console.log('[resetPollingState] Start');
    const { vehicleId, activate } = data;
    if (!vehicleId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId');
    }
    try {
        const vehicleRef = db.collection('vehicles').doc(vehicleId);
        const newState = activate === true;
        await vehicleRef.update({
            pollingActive: newState,
            idlePollCount: 0,
            errorPollCount: 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[resetPollingState] Set pollingActive=${newState} for ${vehicleId}`);
        return { success: true, pollingActive: newState };
    }
    catch (error) {
        console.error('[resetPollingState] FAILED:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
// =============================================================================
// CHARGE CONTROL - Start/Stop charging remotely
// =============================================================================
exports.stopCharge = regionalFunctions.https.onCall(async (data, context) => {
    console.log('[stopCharge] Start');
    const { vehicleId } = data;
    if (!vehicleId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId');
    }
    try {
        const accessToken = await getValidAccessToken(vehicleId);
        const vehicle = new smartcar_1.default.Vehicle(vehicleId, accessToken);
        // Send STOP command to vehicle
        await vehicle.stopCharge();
        console.log(`[stopCharge] Sent STOP command to ${vehicleId}`);
        // Update vehicle state
        await db.collection('vehicles').doc(vehicleId).update({
            isCharging: false,
            lastChargeCommand: 'STOP',
            lastChargeCommandTime: admin.firestore.Timestamp.now(),
        });
        return { success: true, command: 'STOP' };
    }
    catch (error) {
        console.error('[stopCharge] FAILED:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
exports.startCharge = regionalFunctions.https.onCall(async (data, context) => {
    console.log('[startCharge] Start');
    const { vehicleId } = data;
    if (!vehicleId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId');
    }
    try {
        const accessToken = await getValidAccessToken(vehicleId);
        const vehicle = new smartcar_1.default.Vehicle(vehicleId, accessToken);
        // Send START command to vehicle
        await vehicle.startCharge();
        console.log(`[startCharge] Sent START command to ${vehicleId}`);
        // Update vehicle state
        await db.collection('vehicles').doc(vehicleId).update({
            lastChargeCommand: 'START',
            lastChargeCommandTime: admin.firestore.Timestamp.now(),
        });
        return { success: true, command: 'START' };
    }
    catch (error) {
        console.error('[startCharge] FAILED:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
exports.lockVehicle = regionalFunctions.https.onCall(async (data, context) => {
    console.log('[lockVehicle] Start');
    const { vehicleId } = data;
    if (!vehicleId)
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId');
    try {
        const accessToken = await getValidAccessToken(vehicleId);
        const vehicle = new smartcar_1.default.Vehicle(vehicleId, accessToken);
        await vehicle.lock();
        console.log(`[lockVehicle] Sent LOCK command to ${vehicleId}`);
        await db.collection('vehicles').doc(vehicleId).update({
            isLocked: true,
            lastSecurityCommand: 'LOCK',
            lastSecurityCommandTime: admin.firestore.Timestamp.now(),
        });
        return { success: true, command: 'LOCK' };
    }
    catch (error) {
        console.error('[lockVehicle] FAILED:', error.message, error.code);
        const errorCode = error.code || error.statusCode || '';
        const errorMsg = error.message || 'Unknown error';
        if (errorMsg.includes('RATE_LIMIT') || errorCode === 'RATE_LIMIT') {
            throw new functions.https.HttpsError('resource-exhausted', 'El vehículo está limitando las peticiones. Cierra la app de BYD y espera unos minutos.');
        }
        if (errorMsg.includes('VEHICLE_STATE') || errorCode === 'VEHICLE_STATE') {
            throw new functions.https.HttpsError('failed-precondition', 'El vehículo no está disponible. Puede estar en movimiento o sin conexión.');
        }
        throw new functions.https.HttpsError('internal', errorMsg);
    }
});
exports.unlockVehicle = regionalFunctions.https.onCall(async (data, context) => {
    console.log('[unlockVehicle] Start');
    const { vehicleId } = data;
    if (!vehicleId)
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId');
    try {
        const accessToken = await getValidAccessToken(vehicleId);
        const vehicle = new smartcar_1.default.Vehicle(vehicleId, accessToken);
        await vehicle.unlock();
        console.log(`[unlockVehicle] Sent UNLOCK command to ${vehicleId}`);
        await db.collection('vehicles').doc(vehicleId).update({
            isLocked: false,
            lastSecurityCommand: 'UNLOCK',
            lastSecurityCommandTime: admin.firestore.Timestamp.now(),
        });
        return { success: true, command: 'UNLOCK' };
    }
    catch (error) {
        console.error('[unlockVehicle] FAILED:', error.message, error.code);
        const errorCode = error.code || error.statusCode || '';
        const errorMsg = error.message || 'Unknown error';
        if (errorMsg.includes('RATE_LIMIT') || errorCode === 'RATE_LIMIT') {
            throw new functions.https.HttpsError('resource-exhausted', 'El vehículo está limitando las peticiones. Cierra la app de BYD y espera unos minutos.');
        }
        if (errorMsg.includes('VEHICLE_STATE') || errorCode === 'VEHICLE_STATE') {
            throw new functions.https.HttpsError('failed-precondition', 'El vehículo no está disponible. Puede estar en movimiento o sin conexión.');
        }
        throw new functions.https.HttpsError('internal', errorMsg);
    }
});
exports.startClimate = regionalFunctions.https.onCall(async (data, context) => {
    console.log('[startClimate] Start');
    const { vehicleId } = data;
    if (!vehicleId)
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId');
    try {
        const accessToken = await getValidAccessToken(vehicleId);
        const vehicle = new smartcar_1.default.Vehicle(vehicleId, accessToken);
        // Use make-specific endpoint: /vehicles/{id}/byd/climate/cabin
        await vehicle.service.request('post', 'byd/climate/cabin', { action: 'START' });
        console.log(`[startClimate] Sent START command to ${vehicleId}`);
        await db.collection('vehicles').doc(vehicleId).update({
            climateActive: true,
            lastClimateCommand: 'START',
            lastClimateCommandTime: admin.firestore.Timestamp.now(),
        });
        return { success: true, command: 'START' };
    }
    catch (error) {
        console.error('[startClimate] FAILED:', error.message, error.code);
        const errorCode = error.code || error.statusCode || '';
        const errorMsg = error.message || 'Unknown error';
        // Handle specific error types
        if (errorMsg.includes('RATE_LIMIT') || errorCode === 'RATE_LIMIT') {
            throw new functions.https.HttpsError('resource-exhausted', 'El vehículo está limitando las peticiones. Cierra la app de BYD y espera unos minutos.');
        }
        if (errorMsg.includes('PERMISSION') || errorCode === 'PERMISSION') {
            throw new functions.https.HttpsError('permission-denied', 'Permiso control_climate no concedido. Re-vincula el vehículo en Ajustes.');
        }
        throw new functions.https.HttpsError('internal', errorMsg);
    }
});
exports.stopClimate = regionalFunctions.https.onCall(async (data, context) => {
    console.log('[stopClimate] Start');
    const { vehicleId } = data;
    if (!vehicleId)
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId');
    try {
        const accessToken = await getValidAccessToken(vehicleId);
        const vehicle = new smartcar_1.default.Vehicle(vehicleId, accessToken);
        // Use make-specific endpoint: /vehicles/{id}/byd/climate/cabin
        await vehicle.service.request('post', 'byd/climate/cabin', { action: 'STOP' });
        console.log(`[stopClimate] Sent STOP command to ${vehicleId}`);
        await db.collection('vehicles').doc(vehicleId).update({
            climateActive: false,
            lastClimateCommand: 'STOP',
            lastClimateCommandTime: admin.firestore.Timestamp.now(),
        });
        return { success: true, command: 'STOP' };
    }
    catch (error) {
        console.error('[stopClimate] FAILED:', error.message, error.code);
        const errorCode = error.code || error.statusCode || '';
        const errorMsg = error.message || 'Unknown error';
        // Handle specific error types
        if (errorMsg.includes('RATE_LIMIT') || errorCode === 'RATE_LIMIT') {
            throw new functions.https.HttpsError('resource-exhausted', 'El vehículo está limitando las peticiones. Cierra la app de BYD y espera unos minutos.');
        }
        if (errorMsg.includes('PERMISSION') || errorCode === 'PERMISSION') {
            throw new functions.https.HttpsError('permission-denied', 'Permiso control_climate no concedido. Re-vincula el vehículo en Ajustes.');
        }
        throw new functions.https.HttpsError('internal', errorMsg);
    }
});
exports.openTrunk = regionalFunctions.https.onCall(async (data, context) => {
    console.log('[openTrunk] Start');
    const { vehicleId } = data;
    if (!vehicleId)
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId');
    try {
        const accessToken = await getValidAccessToken(vehicleId);
        const vehicle = new smartcar_1.default.Vehicle(vehicleId, accessToken);
        // Use make-specific endpoint: /vehicles/{id}/byd/security/trunk
        await vehicle.service.request('post', 'byd/security/trunk', { action: 'OPEN' });
        console.log(`[openTrunk] Sent OPEN command to ${vehicleId}`);
        await db.collection('vehicles').doc(vehicleId).update({
            trunkOpen: true,
            lastTrunkCommand: 'OPEN',
            lastTrunkCommandTime: admin.firestore.Timestamp.now(),
        });
        return { success: true, command: 'OPEN' };
    }
    catch (error) {
        console.error('[openTrunk] FAILED:', error.message, error.code);
        const errorCode = error.code || error.statusCode || '';
        const errorMsg = error.message || 'Unknown error';
        if (errorMsg.includes('RATE_LIMIT') || errorCode === 'RATE_LIMIT') {
            throw new functions.https.HttpsError('resource-exhausted', 'El vehículo está limitando las peticiones. Cierra la app de BYD y espera unos minutos.');
        }
        if (errorMsg.includes('PERMISSION') || errorCode === 'PERMISSION') {
            throw new functions.https.HttpsError('permission-denied', 'Permiso control_trunk no concedido. Re-vincula el vehículo en Ajustes.');
        }
        throw new functions.https.HttpsError('internal', errorMsg);
    }
});
exports.closeTrunk = regionalFunctions.https.onCall(async (data, context) => {
    console.log('[closeTrunk] Start');
    const { vehicleId } = data;
    if (!vehicleId)
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId');
    try {
        const accessToken = await getValidAccessToken(vehicleId);
        const vehicle = new smartcar_1.default.Vehicle(vehicleId, accessToken);
        // Use make-specific endpoint: /vehicles/{id}/byd/security/trunk
        await vehicle.service.request('post', 'byd/security/trunk', { action: 'CLOSE' });
        console.log(`[closeTrunk] Sent CLOSE command to ${vehicleId}`);
        await db.collection('vehicles').doc(vehicleId).update({
            trunkOpen: false,
            lastTrunkCommand: 'CLOSE',
            lastTrunkCommandTime: admin.firestore.Timestamp.now(),
        });
        return { success: true, command: 'CLOSE' };
    }
    catch (error) {
        console.error('[closeTrunk] FAILED:', error.message, error.code);
        const errorCode = error.code || error.statusCode || '';
        const errorMsg = error.message || 'Unknown error';
        if (errorMsg.includes('RATE_LIMIT') || errorCode === 'RATE_LIMIT') {
            throw new functions.https.HttpsError('resource-exhausted', 'El vehículo está limitando las peticiones. Cierra la app de BYD y espera unos minutos.');
        }
        if (errorMsg.includes('PERMISSION') || errorCode === 'PERMISSION') {
            throw new functions.https.HttpsError('permission-denied', 'Permiso control_trunk no concedido. Re-vincula el vehículo en Ajustes.');
        }
        throw new functions.https.HttpsError('internal', errorMsg);
    }
});
// Callable function to refresh vehicle data (only lockStatus and tires - battery/location/odometer come from webhooks)
exports.refreshVehicleData = regionalFunctions.https.onCall(async (data, context) => {
    console.log('[refreshVehicleData] Start - Using batch for lockStatus + tires + batteryCapacity tracking');
    const { vehicleId } = data;
    if (!vehicleId)
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId');
    try {
        const accessToken = await getValidAccessToken(vehicleId);
        const vehicle = new smartcar_1.default.Vehicle(vehicleId, accessToken);
        // Single batch request for lockStatus, tires, and batteryCapacity (for tracking)
        const batchResponse = await vehicle.batch(['/tires/pressure', '/security', '/battery/capacity']);
        console.log('[refreshVehicleData] Batch response received');
        // Extract tires data
        let tires = null;
        try {
            const tiresData = batchResponse.tirePressure();
            tires = tiresData;
            console.log('[refreshVehicleData] Tires OK:', JSON.stringify(tiresData));
        }
        catch (e) {
            console.error('[refreshVehicleData] Tires FAILED:', e.message);
        }
        // Extract lock status
        let isLocked = null;
        try {
            const lockData = batchResponse.lockStatus();
            isLocked = lockData.isLocked;
            console.log('[refreshVehicleData] Lock OK:', JSON.stringify(lockData));
        }
        catch (e) {
            console.error('[refreshVehicleData] Lock FAILED:', e.message);
        }
        // Extract batteryCapacity for tracking (hidden from user, logs only)
        let batteryCapacity = null;
        try {
            const capacityData = batchResponse.batteryCapacity();
            batteryCapacity = capacityData.capacity;
            console.log(`[refreshVehicleData] [CAPACITY_TRACKING] batteryCapacity: ${batteryCapacity} kWh - Full response:`, JSON.stringify(capacityData));
        }
        catch (e) {
            console.error('[refreshVehicleData] batteryCapacity FAILED:', e.message);
        }
        console.log(`[refreshVehicleData] Tires: ${tires ? 'OK' : 'FAIL'}, Locked: ${isLocked}, Capacity: ${batteryCapacity} kWh`);
        // Update Firestore
        const vehicleUpdate = {
            lastUpdate: admin.firestore.Timestamp.now(),
        };
        if (tires !== null)
            vehicleUpdate.tires = tires;
        if (isLocked !== null)
            vehicleUpdate.isLocked = isLocked;
        // Track batteryCapacity over time (store with timestamp for analysis)
        if (batteryCapacity !== null) {
            vehicleUpdate.lastBatteryCapacity = batteryCapacity;
            vehicleUpdate.lastBatteryCapacityDate = admin.firestore.Timestamp.now();
            // Also append to history array for trend analysis
            await db.collection('vehicles').doc(vehicleId).collection('capacityHistory').add({
                capacity: batteryCapacity,
                timestamp: admin.firestore.Timestamp.now(),
            });
            console.log(`[refreshVehicleData] [CAPACITY_TRACKING] Saved capacity ${batteryCapacity} kWh to history`);
        }
        await db.collection('vehicles').doc(vehicleId).update(vehicleUpdate);
        return {
            success: true,
            data: {
                tires: tires ? {
                    frontLeft: Math.round(tires.frontLeft),
                    frontRight: Math.round(tires.frontRight),
                    backLeft: Math.round(tires.backLeft),
                    backRight: Math.round(tires.backRight),
                } : null,
                isLocked,
            }
        };
    }
    catch (error) {
        console.error('[refreshVehicleData] FAILED:', error.message, error.code);
        const errorCode = error.code || error.statusCode || '';
        const errorMsg = error.message || 'Unknown error';
        if (errorMsg.includes('RATE_LIMIT') || errorCode === 'RATE_LIMIT') {
            throw new functions.https.HttpsError('resource-exhausted', 'El vehículo está limitando las peticiones. Cierra la app de BYD y espera unos minutos.');
        }
        throw new functions.https.HttpsError('internal', errorMsg);
    }
});
exports.setTargetChargeSoC = regionalFunctions.https.onCall(async (data, context) => {
    console.log('[setTargetChargeSoC] Start');
    const { vehicleId, targetSoC } = data;
    if (!vehicleId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId');
    }
    // targetSoC should be decimal (0.8 = 80%) or null to disable
    const validTarget = targetSoC === null ? null :
        (typeof targetSoC === 'number' && targetSoC > 0 && targetSoC <= 1) ? targetSoC : null;
    try {
        const update = {
            updatedAt: admin.firestore.Timestamp.now(),
        };
        if (validTarget === null) {
            update.targetChargeSoC = admin.firestore.FieldValue.delete();
        }
        else {
            update.targetChargeSoC = validTarget;
        }
        await db.collection('vehicles').doc(vehicleId).update(update);
        console.log(`[setTargetChargeSoC] Set target to ${validTarget ? (validTarget * 100).toFixed(0) + '%' : 'disabled'} for ${vehicleId}`);
        return { success: true, targetSoC: validTarget };
    }
    catch (error) {
        console.error('[setTargetChargeSoC] FAILED:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
// =============================================================================
// MERGE TRIPS (combine fragmented trips into one)
// =============================================================================
exports.mergeTrips = regionalFunctions.https.onCall(async (data, context) => {
    var _a, _b;
    console.log('[mergeTrips] Start');
    const { tripIds } = data;
    if (!tripIds || !Array.isArray(tripIds) || tripIds.length < 2) {
        throw new functions.https.HttpsError('invalid-argument', 'Need at least 2 trip IDs to merge');
    }
    try {
        // Get all trips
        const trips = [];
        for (const id of tripIds) {
            const doc = await db.collection('trips').doc(id).get();
            if (doc.exists) {
                trips.push(Object.assign({ id: doc.id }, doc.data()));
            }
        }
        if (trips.length < 2) {
            throw new functions.https.HttpsError('not-found', 'Could not find enough trips to merge');
        }
        // Sort by startDate
        trips.sort((a, b) => { var _a, _b; return (((_a = a.startDate) === null || _a === void 0 ? void 0 : _a.toMillis()) || 0) - (((_b = b.startDate) === null || _b === void 0 ? void 0 : _b.toMillis()) || 0); });
        const first = trips[0];
        const last = trips[trips.length - 1];
        // Calculate merged values
        const totalDistance = last.endOdometer - first.startOdometer;
        const durationMs = (((_a = last.endDate) === null || _a === void 0 ? void 0 : _a.toMillis()) || Date.now()) - (((_b = first.startDate) === null || _b === void 0 ? void 0 : _b.toMillis()) || Date.now());
        const durationMinutes = Math.round(durationMs / 60000);
        // Update first trip with merged data
        await db.collection('trips').doc(first.id).update({
            endDate: last.endDate,
            endOdometer: last.endOdometer,
            endSoC: last.endSoC,
            distanceKm: Math.round(totalDistance * 100) / 100,
            durationMinutes: Math.max(1, durationMinutes),
            lastUpdate: admin.firestore.Timestamp.now(),
            mergedFrom: tripIds,
        });
        // Delete the other trips
        for (let i = 1; i < trips.length; i++) {
            await db.collection('trips').doc(trips[i].id).delete();
        }
        console.log(`[mergeTrips] Merged ${trips.length} trips into ${first.id}: ${totalDistance.toFixed(2)} km`);
        return {
            success: true,
            mergedTripId: first.id,
            totalDistance: Math.round(totalDistance * 100) / 100,
            durationMinutes,
            deletedTrips: tripIds.slice(1)
        };
    }
    catch (error) {
        console.error('[mergeTrips] FAILED:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
// =============================================================================
// TEST CONNECTION
// =============================================================================
exports.testSmartcarConnection = regionalFunctions.https.onCall(async (data, context) => {
    console.log('[testConnection] Start');
    const { vehicleId } = data;
    if (!vehicleId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId');
    }
    try {
        const accessToken = await getValidAccessToken(vehicleId);
        const vehicle = new smartcar_1.default.Vehicle(vehicleId, accessToken);
        const results = {
            vehicleId,
            timestamp: new Date().toISOString(),
            permissions: {},
            errors: [],
            planLevel: 'unknown'
        };
        // Check permissions explicitly
        try {
            const permissionsObject = await vehicle.permissions();
            results.permissionsList = permissionsObject;
            // Check if advanced scopes are present
            const advancedScopes = ['control_security', 'control_climate', 'control_trunk', 'read_tires'];
            const grantedScopes = permissionsObject.permissions || [];
            results.grantedAdvanced = advancedScopes.filter((p) => grantedScopes.includes(p));
            results.missingAdvanced = advancedScopes.filter((p) => !grantedScopes.includes(p));
            console.log(`[testConnection] Granted advanced: ${results.grantedAdvanced.join(', ')}`);
            if (results.missingAdvanced.length > 0) {
                console.warn(`[testConnection] MISSING advanced scopes: ${results.missingAdvanced.join(', ')}`);
            }
        }
        catch (e) {
            results.errors.push(`permissions_fetch_error: ${e.message}`);
        }
        // Test each endpoint
        const tests = [
            { name: 'odometer', fn: () => vehicle.odometer() },
            { name: 'location', fn: () => vehicle.location() },
            { name: 'battery', fn: () => vehicle.battery() },
            { name: 'attributes', fn: () => vehicle.attributes() },
            { name: 'tires', fn: () => vehicle.tirePressure() },
        ];
        for (const test of tests) {
            try {
                const result = await test.fn();
                results.permissions[test.name] = { status: 'SUCCESS', data: result };
            }
            catch (error) {
                const message = error.message || 'Unknown error';
                const code = error.code || error.type || 'UNKNOWN';
                results.permissions[test.name] = {
                    status: 'ERROR',
                    error: message,
                    code: code
                };
                results.errors.push(`${test.name}: [${code}] ${message}`);
                // If we get PERMISSION error on tires, it's a strong sign of "Build" plan limitation
                if (test.name === 'tires' && (code === 'PERMISSION' || message.includes('permission'))) {
                    results.planLevel = 'BUILD (Free) - Upgrade to Build Advanced required';
                }
            }
        }
        console.log(`[testConnection] Done for ${vehicleId}, errors: ${results.errors.length}`);
        return results;
    }
    catch (error) {
        console.error('[testConnection] FATAL FAILED:', error.message);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message);
    }
});
// =============================================================================
// FULL SMARTCAR DIAGNOSTIC - Tests ALL available endpoints
// =============================================================================
exports.fullSmartcarDiagnostic = regionalFunctions.https.onCall(async (data, context) => {
    console.log('[fullDiagnostic] Start - Testing ALL Smartcar endpoints');
    const { vehicleId } = data;
    if (!vehicleId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId');
    }
    try {
        const accessToken = await getValidAccessToken(vehicleId);
        const vehicle = new smartcar_1.default.Vehicle(vehicleId, accessToken);
        const results = {
            vehicleId,
            timestamp: new Date().toISOString(),
            endpoints: {},
            summary: {
                available: [],
                unavailable: [],
                rateLimited: [],
            }
        };
        // All possible Smartcar endpoints to test
        const endpoints = [
            // Basic info
            { name: 'attributes', fn: () => vehicle.attributes(), scope: 'read_vehicle_info' },
            { name: 'vin', fn: () => vehicle.vin(), scope: 'read_vin' },
            // Location & movement
            { name: 'location', fn: () => vehicle.location(), scope: 'read_location' },
            { name: 'odometer', fn: () => vehicle.odometer(), scope: 'read_odometer' },
            // Battery & charging
            { name: 'battery', fn: () => vehicle.battery(), scope: 'read_battery' },
            { name: 'charge', fn: () => vehicle.charge(), scope: 'read_charge' },
            { name: 'batteryCapacity', fn: () => vehicle.batteryCapacity(), scope: 'read_battery' },
            // Security
            { name: 'lockStatus', fn: () => vehicle.lockStatus(), scope: 'read_security' },
            // Tires
            { name: 'tirePressure', fn: () => vehicle.tirePressure(), scope: 'read_tires' },
            // Climate/Temperature
            { name: 'interiorTemperature', fn: () => vehicle.service.request('get', 'thermometer/interior'), scope: 'read_thermometer' },
            { name: 'exteriorTemperature', fn: () => vehicle.service.request('get', 'thermometer/exterior'), scope: 'read_thermometer' },
            // Diagnostics
            { name: 'diagnostics', fn: () => vehicle.service.request('get', 'diagnostics/system_status'), scope: 'read_diagnostics' },
            // Charge records (OEM charging history)
            { name: 'chargeRecords', fn: () => vehicle.service.request('get', 'charge/records'), scope: 'read_charge_records' },
            // Permissions (always available)
            { name: 'permissions', fn: () => vehicle.permissions(), scope: 'n/a' },
        ];
        // Test each endpoint
        for (const endpoint of endpoints) {
            try {
                console.log(`[fullDiagnostic] Testing ${endpoint.name}...`);
                const result = await endpoint.fn();
                results.endpoints[endpoint.name] = {
                    status: 'AVAILABLE',
                    scope: endpoint.scope,
                    data: result,
                };
                results.summary.available.push(endpoint.name);
                console.log(`[fullDiagnostic] ${endpoint.name}: SUCCESS`);
            }
            catch (error) {
                const message = error.message || 'Unknown error';
                const code = error.code || error.type || 'UNKNOWN';
                let status = 'UNAVAILABLE';
                if (message.includes('RATE_LIMIT') || code === 'RATE_LIMIT') {
                    status = 'RATE_LIMITED';
                    results.summary.rateLimited.push(endpoint.name);
                }
                else {
                    results.summary.unavailable.push(endpoint.name);
                }
                results.endpoints[endpoint.name] = {
                    status,
                    scope: endpoint.scope,
                    error: message,
                    code,
                };
                console.log(`[fullDiagnostic] ${endpoint.name}: ${status} - ${code}: ${message}`);
            }
        }
        // Summary
        console.log(`[fullDiagnostic] Complete!`);
        console.log(`[fullDiagnostic] Available: ${results.summary.available.join(', ')}`);
        console.log(`[fullDiagnostic] Unavailable: ${results.summary.unavailable.join(', ')}`);
        console.log(`[fullDiagnostic] Rate Limited: ${results.summary.rateLimited.join(', ')}`);
        return results;
    }
    catch (error) {
        console.error('[fullDiagnostic] FATAL:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
// =============================================================================
// DIAGNOSTICS
// =============================================================================
exports.getDiagnostics = regionalFunctions.https.onCall(async (data, context) => {
    try {
        const vehiclesSnap = await db.collection('vehicles').get();
        const tripsSnap = await db.collection('trips').orderBy('startDate', 'desc').limit(10).get();
        return {
            version: VERSION,
            vehicleCount: vehiclesSnap.size,
            tripCount: tripsSnap.size,
            vehicles: vehiclesSnap.docs.map(doc => (Object.assign({ id: doc.id }, doc.data()))),
            trips: tripsSnap.docs.map(doc => (Object.assign({ id: doc.id }, doc.data()))),
        };
    }
    catch (error) {
        return { error: error.message };
    }
});
exports.diag = regionalFunctions.https.onRequest(async (req, res) => {
    if (!isAdminRequest(req)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    try {
        const vehiclesSnap = await db.collection('vehicles').get();
        const tripsSnap = await db.collection('trips').orderBy('startDate', 'desc').limit(20).get();
        const vehicles = vehiclesSnap.docs.map(d => {
            const data = d.data();
            // Remove sensitive data
            return Object.assign({ id: d.id }, data);
        });
        const trips = tripsSnap.docs.map(d => (Object.assign({ id: d.id }, d.data())));
        // Get webhook info from SmartCar
        let webhookInfo = null;
        if (SMARTCAR_CLIENT_ID && SMARTCAR_CLIENT_SECRET) {
            try {
                const auth = Buffer.from(`${SMARTCAR_CLIENT_ID}:${SMARTCAR_CLIENT_SECRET}`).toString('base64');
                const response = await fetch('https://api.smartcar.com/v2.0/webhooks', {
                    headers: { 'Authorization': `Basic ${auth}` }
                });
                webhookInfo = await response.json();
            }
            catch (e) {
                webhookInfo = { error: e.message };
            }
        }
        res.status(200).json({
            version: VERSION,
            serverTime: new Date().toISOString(),
            vehicleCount: vehiclesSnap.size,
            tripCount: tripsSnap.size,
            vehicles,
            trips,
            webhookInfo,
            config: {
                hasSmartcarAmt: !!SMARTCAR_AMT,
                hasClientId: !!SMARTCAR_CLIENT_ID,
                hasClientSecret: !!SMARTCAR_CLIENT_SECRET,
                hasRedirectUri: !!SMARTCAR_REDIRECT_URI,
                hasEncryptionKey: !!TOKEN_ENCRYPTION_KEY,
                hasGoogleMapsKey: !!GOOGLE_MAPS_API_KEY,
            }
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message, stack: e.stack });
    }
});
// =============================================================================
// TRIP GPS DISTANCE CALCULATOR (Firestore Trigger)
// =============================================================================
exports.calculateTripGpsDistance = regionalFunctions.firestore
    .document('trips/{tripId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const tripId = context.params.tripId;
    // Only process when status changes to 'completed'
    if (before.status === 'completed' || after.status !== 'completed') {
        return null;
    }
    console.log(`[GPS] Calculating distance for trip ${tripId}`);
    try {
        const pointsSnap = await db.collection('trips').doc(tripId)
            .collection('points')
            .orderBy('timestamp')
            .get();
        if (pointsSnap.size < 2) {
            console.log(`[GPS] Trip ${tripId} has ${pointsSnap.size} points, skipping`);
            return null;
        }
        const points = pointsSnap.docs.map(doc => ({
            lat: doc.data().lat,
            lon: doc.data().lon
        }));
        const gpsDistance = await snapToRoadsDistance(points);
        await db.collection('trips').doc(tripId).update({
            gpsDistanceKm: gpsDistance,
            startLocation: new admin.firestore.GeoPoint(points[0].lat, points[0].lon),
            endLocation: new admin.firestore.GeoPoint(points[points.length - 1].lat, points[points.length - 1].lon)
        });
        console.log(`[GPS] Trip ${tripId}: ${gpsDistance} km from ${points.length} points`);
    }
    catch (error) {
        console.error(`[GPS] Error for trip ${tripId}:`, error);
    }
    return null;
});
// =============================================================================
// SIMULATE WEBHOOK - Fetch current data and process it
// =============================================================================
exports.simulateWebhook = regionalFunctions.https.onCall(async (data, context) => {
    const { vehicleId } = data;
    console.log(`[simulateWebhook] Start for vehicle: ${vehicleId}`);
    if (!vehicleId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId');
    }
    try {
        // Get valid access token (with auto-refresh)
        const accessToken = await getValidAccessToken(vehicleId);
        const vehicle = new smartcar_1.default.Vehicle(vehicleId, accessToken);
        // Fetch all data from the vehicle
        console.log('[simulateWebhook] Fetching vehicle data...');
        const results = {
            vehicleId,
            fetchedAt: new Date().toISOString(),
            data: {},
            errors: []
        };
        // Fetch odometer
        try {
            const odo = await vehicle.odometer();
            results.data.odometer = odo.distance;
            console.log(`[simulateWebhook] Odometer: ${odo.distance} km`);
        }
        catch (e) {
            results.errors.push(`odometer: ${e.message}`);
        }
        // Fetch battery/SoC
        try {
            const battery = await vehicle.battery();
            results.data.soc = battery.percentRemaining;
            console.log(`[simulateWebhook] SoC: ${battery.percentRemaining}%`);
        }
        catch (e) {
            results.errors.push(`battery: ${e.message}`);
        }
        // Fetch location
        try {
            const loc = await vehicle.location();
            results.data.location = { lat: loc.latitude, lon: loc.longitude };
            console.log(`[simulateWebhook] Location: ${loc.latitude}, ${loc.longitude}`);
        }
        catch (e) {
            results.errors.push(`location: ${e.message}`);
        }
        // Now process this data through webhook logic
        const now = admin.firestore.Timestamp.now();
        const vehicleRef = db.collection('vehicles').doc(vehicleId);
        const vehicleDoc = await vehicleRef.get();
        const vehicleData = vehicleDoc.data() || {};
        const prevOdometer = vehicleData.lastOdometer || 0;
        const currentOdometer = results.data.odometer || prevOdometer;
        const odoDelta = currentOdometer - prevOdometer;
        const hasMovement = odoDelta > CONFIG.MIN_MOVEMENT_DELTA;
        results.analysis = {
            prevOdometer,
            currentOdometer,
            odoDelta: Math.round(odoDelta * 1000) / 1000,
            hasMovement,
            activeTripId: vehicleData.activeTripId || null,
        };
        // Update vehicle state (same as webhook would)
        const vehicleUpdate = {
            lastUpdate: now,
            simulatedAt: now,
        };
        if (results.data.odometer)
            vehicleUpdate.lastOdometer = results.data.odometer;
        if (results.data.soc)
            vehicleUpdate.lastSoC = results.data.soc;
        if (hasMovement)
            vehicleUpdate.lastMoveTime = now;
        await vehicleRef.set(vehicleUpdate, { merge: true });
        // Handle trip logic
        const activeTripId = vehicleData.activeTripId;
        if (!activeTripId && hasMovement) {
            // Start a new trip
            const newTripRef = db.collection('trips').doc();
            const newTrip = {
                vehicleId,
                startDate: now,
                startOdometer: currentOdometer,
                startSoC: results.data.soc || 0,
                endOdometer: currentOdometer,
                endSoC: results.data.soc || 0,
                distanceKm: 0,
                status: 'in_progress',
                type: 'unknown',
                source: 'simulated_webhook',
                lastUpdate: now,
            };
            await newTripRef.set(newTrip);
            await vehicleRef.update({ activeTripId: newTripRef.id });
            // Store GPS point if available
            if (results.data.location) {
                await newTripRef.collection('points').add({
                    lat: results.data.location.lat,
                    lon: results.data.location.lon,
                    timestamp: now,
                    source: 'simulated'
                });
            }
            results.action = `STARTED new trip: ${newTripRef.id}`;
            console.log(`[simulateWebhook] ${results.action}`);
        }
        else if (activeTripId && hasMovement) {
            // Update existing trip
            const tripRef = db.collection('trips').doc(activeTripId);
            await tripRef.update({
                endOdometer: currentOdometer,
                endSoC: results.data.soc || 0,
                distanceKm: admin.firestore.FieldValue.increment(odoDelta),
                lastUpdate: now,
            });
            if (results.data.location) {
                await tripRef.collection('points').add({
                    lat: results.data.location.lat,
                    lon: results.data.location.lon,
                    timestamp: now,
                    source: 'simulated'
                });
            }
            results.action = `UPDATED trip: ${activeTripId}, +${odoDelta.toFixed(3)} km`;
            console.log(`[simulateWebhook] ${results.action}`);
        }
        else {
            results.action = 'NO ACTION - no movement detected';
            console.log(`[simulateWebhook] ${results.action}`);
        }
        console.log('[simulateWebhook] SUCCESS');
        return results;
    }
    catch (error) {
        console.error('[simulateWebhook] FAILED:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
// =============================================================================
// POLL VEHICLE - Active polling for GPS tracking
// Can be called by Cloud Scheduler every 2-5 minutes
// =============================================================================
exports.pollVehicle = regionalFunctions.https.onRequest(async (req, res) => {
    var _a, _b;
    // Allow Cloud Scheduler or admin requests
    const isScheduler = req.headers['x-cloudscheduler'] === 'true';
    const isAdmin = isAdminRequest(req);
    if (!isScheduler && !isAdmin) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const vehicleId = req.query.vehicleId || '557430f4-6dbe-464e-833d-5b419a0e4eca';
    console.log(`[pollVehicle] Polling vehicle: ${vehicleId}`);
    try {
        const accessToken = await getValidAccessToken(vehicleId);
        const vehicle = new smartcar_1.default.Vehicle(vehicleId, accessToken);
        // Fetch current data
        const [odoResult, batteryResult, locationResult, tiresResult] = await Promise.allSettled([
            vehicle.odometer(),
            vehicle.battery(),
            vehicle.location(),
            vehicle.tirePressure()
        ]);
        const odometer = odoResult.status === 'fulfilled' ? odoResult.value.distance : null;
        const soc = normalizeSoC(batteryResult.status === 'fulfilled' ? batteryResult.value.percentRemaining : null);
        const location = locationResult.status === 'fulfilled'
            ? { lat: locationResult.value.latitude, lon: locationResult.value.longitude }
            : null;
        const tires = tiresResult.status === 'fulfilled' ? tiresResult.value : null;
        console.log(`[pollVehicle] Odo: ${odometer}, SoC: ${soc}, Location: ${location === null || location === void 0 ? void 0 : location.lat}, ${location === null || location === void 0 ? void 0 : location.lon}, Tires: ${tires ? 'OK' : 'FAIL'}`);
        // Get previous state
        const now = admin.firestore.Timestamp.now();
        const vehicleRef = db.collection('vehicles').doc(vehicleId);
        const vehicleDoc = await vehicleRef.get();
        const vehicleData = vehicleDoc.data() || {};
        const prevOdometer = vehicleData.lastOdometer || 0;
        const prevSoC = vehicleData.lastSoC || 0;
        const activeTripId = vehicleData.activeTripId || null;
        const currentOdometer = odometer !== null && odometer !== void 0 ? odometer : prevOdometer;
        const currentSoC = soc !== null && soc !== void 0 ? soc : prevSoC;
        const odoDelta = currentOdometer - prevOdometer;
        const hasMovement = odoDelta > CONFIG.MIN_MOVEMENT_DELTA;
        console.log(`[pollVehicle] Delta: ${odoDelta.toFixed(3)} km, Movement: ${hasMovement}, ActiveTrip: ${activeTripId}`);
        // Update vehicle state
        const vehicleUpdate = {
            lastUpdate: now,
            lastPollTime: now,
        };
        if (odometer !== null)
            vehicleUpdate.lastOdometer = odometer;
        if (soc !== null)
            vehicleUpdate.lastSoC = soc;
        if (tires !== null)
            vehicleUpdate.tires = tires;
        if (hasMovement)
            vehicleUpdate.lastMoveTime = now;
        let action = 'NO_CHANGE';
        // Trip logic
        if (!activeTripId && hasMovement) {
            // START new trip
            const newTripRef = db.collection('trips').doc();
            const newTrip = {
                vehicleId,
                startDate: now,
                startOdometer: prevOdometer, // Use PREVIOUS odometer as start
                startSoC: prevSoC,
                endOdometer: currentOdometer,
                endSoC: currentSoC,
                distanceKm: odoDelta,
                status: 'in_progress',
                type: 'unknown',
                source: 'polling',
                lastUpdate: now,
            };
            await newTripRef.set(newTrip);
            vehicleUpdate.activeTripId = newTripRef.id;
            // Store start location
            if (location) {
                await newTripRef.collection('points').add({
                    lat: location.lat,
                    lon: location.lon,
                    timestamp: now,
                    odometer: currentOdometer,
                    source: 'poll',
                    type: 'start'
                });
            }
            action = `STARTED trip: ${newTripRef.id}`;
            console.log(`[pollVehicle] ${action}`);
        }
        else if (activeTripId && hasMovement) {
            // UPDATE trip - add GPS point
            const tripRef = db.collection('trips').doc(activeTripId);
            await tripRef.update({
                endOdometer: currentOdometer,
                endSoC: currentSoC,
                distanceKm: admin.firestore.FieldValue.increment(odoDelta),
                lastUpdate: now,
            });
            // Store GPS point for route tracking!
            if (location) {
                await tripRef.collection('points').add({
                    lat: location.lat,
                    lon: location.lon,
                    timestamp: now,
                    odometer: currentOdometer,
                    source: 'poll',
                    type: 'waypoint'
                });
            }
            action = `UPDATED trip: ${activeTripId}, +${odoDelta.toFixed(3)} km, added GPS point`;
            console.log(`[pollVehicle] ${action}`);
        }
        else if (activeTripId && !hasMovement) {
            // No movement - check if trip should be closed
            const lastMoveTime = ((_a = vehicleData.lastMoveTime) === null || _a === void 0 ? void 0 : _a.toDate()) || new Date(0);
            const idleMs = Date.now() - lastMoveTime.getTime();
            if (idleMs > CONFIG.IDLE_TIMEOUT_MS) {
                // Close the trip
                const tripRef = db.collection('trips').doc(activeTripId);
                const tripDoc = await tripRef.get();
                const tripData = tripDoc.data();
                if (tripData) {
                    const startOdo = tripData.startOdometer || prevOdometer;
                    const totalDistance = currentOdometer - startOdo;
                    const startMs = ((_b = tripData.startDate) === null || _b === void 0 ? void 0 : _b.toMillis()) || Date.now();
                    const durationMinutes = Math.round((Date.now() - startMs) / 60000);
                    let tripType = 'idle';
                    if (totalDistance >= CONFIG.MIN_TRIP_DISTANCE)
                        tripType = 'trip';
                    // NOTE: consumptionKwh NOT stored - app calculates from SoC delta * batterySize
                    await tripRef.update({
                        status: 'completed',
                        type: tripType,
                        endDate: now,
                        endOdometer: currentOdometer,
                        endSoC: currentSoC,
                        distanceKm: Math.round(totalDistance * 100) / 100,
                        durationMinutes,
                        lastUpdate: now,
                    });
                    // Store final GPS point
                    if (location) {
                        await tripRef.collection('points').add({
                            lat: location.lat,
                            lon: location.lon,
                            timestamp: now,
                            odometer: currentOdometer,
                            source: 'poll',
                            type: 'end'
                        });
                    }
                    action = `CLOSED trip: ${activeTripId}, ${totalDistance.toFixed(2)} km`;
                    console.log(`[pollVehicle] ${action}`);
                }
                vehicleUpdate.activeTripId = admin.firestore.FieldValue.delete();
            }
            else {
                action = `IDLE - trip ${activeTripId} still open, idle ${Math.round(idleMs / 1000)}s`;
            }
        }
        await vehicleRef.set(vehicleUpdate, { merge: true });
        res.status(200).json({
            success: true,
            vehicleId,
            odometer,
            soc,
            location,
            odoDelta: Math.round(odoDelta * 1000) / 1000,
            hasMovement,
            action,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error(`[pollVehicle] ERROR: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});
// =============================================================================
// SCHEDULED POLLING - Runs every 1 minute for better GPS tracking
// =============================================================================
exports.scheduledPoll = regionalFunctions.pubsub
    .schedule('every 1 minutes')
    .timeZone('Europe/Madrid')
    .onRun(async (context) => {
    var _a, _b, _c, _d, _e;
    console.log('[scheduledPoll] Starting scheduled poll...');
    // Get all vehicles with tokens (connected to Smartcar)
    const vehiclesSnap = await db.collection('vehicles').get();
    for (const vehicleDoc of vehiclesSnap.docs) {
        const vehicleId = vehicleDoc.id;
        const vehicleData = vehicleDoc.data() || {};
        // Check if vehicle has tokens (is connected)
        const tokensDoc = await db.collection('vehicles').doc(vehicleId)
            .collection('private').doc('tokens').get();
        if (!tokensDoc.exists || !((_a = tokensDoc.data()) === null || _a === void 0 ? void 0 : _a.accessToken)) {
            continue; // Skip vehicles without Smartcar connection
        }
        // =================================================================
        // CHARGING MODE: If car is charging, only poll SoC (no location/odo)
        // This runs independently of pollingActive
        // =================================================================
        const chargingActive = vehicleData.chargingActive === true;
        const activeChargeSessionId = vehicleData.activeChargeSessionId || null;
        if (chargingActive && activeChargeSessionId) {
            console.log(`[scheduledPoll] CHARGING MODE - fetching SoC only for ${vehicleId}`);
            try {
                const accessToken = await getValidAccessToken(vehicleId);
                const vehicle = new smartcar_1.default.Vehicle(vehicleId, accessToken);
                const now = admin.firestore.Timestamp.now();
                // Only fetch battery level during charging
                const batteryResult = await vehicle.battery().catch(() => null);
                const currentSoC = normalizeSoC(batteryResult === null || batteryResult === void 0 ? void 0 : batteryResult.percentRemaining);
                if (currentSoC !== null) {
                    // Update vehicle state
                    const vehicleRef = db.collection('vehicles').doc(vehicleId);
                    await vehicleRef.update({
                        lastSoC: currentSoC,
                        lastUpdate: now,
                        lastPollTime: now,
                    });
                    // Update charge session
                    const chargeSessionRef = db.collection('chargeSessions').doc(activeChargeSessionId);
                    await chargeSessionRef.update({
                        currentSoC: currentSoC,
                        lastUpdate: now,
                    });
                    console.log(`[scheduledPoll] CHARGING: SoC = ${(currentSoC * 100).toFixed(1)}%`);
                    // Check for auto-stop at targetSoC
                    const targetSoC = (_b = vehicleData.targetChargeSoC) !== null && _b !== void 0 ? _b : null;
                    if (targetSoC && currentSoC >= targetSoC) {
                        console.log(`[scheduledPoll] TARGET SOC REACHED (${(currentSoC * 100).toFixed(1)}% >= ${(targetSoC * 100).toFixed(1)}%) - STOPPING CHARGE`);
                        try {
                            await vehicle.stopCharge();
                            await chargeSessionRef.update({
                                autoStopped: true,
                                autoStopSoC: currentSoC,
                                autoStopTime: now,
                            });
                            console.log(`[scheduledPoll] Charge STOPPED via API`);
                        }
                        catch (stopErr) {
                            console.error(`[scheduledPoll] Failed to stop charge: ${stopErr.message}`);
                        }
                    }
                }
                else {
                    console.log(`[scheduledPoll] CHARGING: Could not fetch SoC`);
                }
            }
            catch (chargeErr) {
                console.error(`[scheduledPoll] Charging poll error: ${chargeErr.message}`);
            }
            // Don't continue with trip polling during charging
            continue;
        }
        // =================================================================
        // TRIP POLLING v3.6: Hybrid approach
        // - Poll when pollingActive=true OR activeTripId exists
        // - Create trips when movement detected
        // - Close trips: isLocked=true + 5 polls stationary → subtract 5 min
        // - Stop polling: isLocked=true + no trip + 5 polls idle
        // =================================================================
        const pollingActive = vehicleData.pollingActive === true;
        const activeTripId = vehicleData.activeTripId || null;
        // Poll if: pollingActive (unlocked) OR has active trip
        const shouldPoll = pollingActive || activeTripId;
        if (!shouldPoll) {
            // Car locked and no active trip = no polling needed (saves API costs)
            continue;
        }
        try {
            const now = admin.firestore.Timestamp.now();
            const vehicleRef = db.collection('vehicles').doc(vehicleId);
            const prevLocation = vehicleData.lastLocation || null;
            const prevOdometer = vehicleData.lastOdometer || 0;
            const prevSoC = vehicleData.lastSoC || 0;
            const isLocked = (_c = vehicleData.isLocked) !== null && _c !== void 0 ? _c : null;
            const stationaryPollCount = vehicleData.stationaryPollCount || 0;
            const idlePollCount = vehicleData.idlePollCount || 0;
            console.log(`[scheduledPoll] Polling ${vehicleId} - pollingActive: ${pollingActive}, activeTripId: ${activeTripId}, isLocked: ${isLocked}`);
            // ============================================================
            // FETCH DATA: Odometer + Location + Battery
            // ============================================================
            const accessToken = await getValidAccessToken(vehicleId);
            const vehicle = new smartcar_1.default.Vehicle(vehicleId, accessToken);
            const [odoResult, locationResult, batteryResult] = await Promise.allSettled([
                vehicle.odometer(),
                vehicle.location(),
                vehicle.battery()
            ]);
            const currentOdometer = odoResult.status === 'fulfilled' ? odoResult.value.distance : null;
            const currentSoC = normalizeSoC(batteryResult.status === 'fulfilled' ? batteryResult.value.percentRemaining : null);
            let location = null;
            if (locationResult.status === 'fulfilled') {
                location = { lat: locationResult.value.latitude, lon: locationResult.value.longitude };
            }
            // Calculate movement
            const odoDelta = currentOdometer !== null && prevOdometer > 0
                ? currentOdometer - prevOdometer
                : 0;
            const hasMovement = odoDelta > CONFIG.MIN_MOVEMENT_DELTA;
            // Calculate if location changed significantly (> 50 meters = 0.05 km)
            const locationChanged = location && prevLocation
                ? haversine(prevLocation.lat, prevLocation.lon, location.lat, location.lon) > 0.05
                : true; // If no prev location, consider it changed
            console.log(`[scheduledPoll] Data: odo=${currentOdometer === null || currentOdometer === void 0 ? void 0 : currentOdometer.toFixed(2)}, soc=${currentSoC}, loc=${location ? `${location.lat.toFixed(4)},${location.lon.toFixed(4)}` : 'N/A'}, odoDelta=${odoDelta.toFixed(3)}, hasMovement=${hasMovement}, locChanged=${locationChanged}`);
            // ============================================================
            // UPDATE VEHICLE STATE
            // ============================================================
            const vehicleUpdate = {
                lastPollTime: now,
            };
            if (currentOdometer !== null)
                vehicleUpdate.lastOdometer = currentOdometer;
            if (currentSoC !== null)
                vehicleUpdate.lastSoC = currentSoC;
            if (location) {
                vehicleUpdate.lastLocation = location;
            }
            if (hasMovement) {
                vehicleUpdate.lastMoveTime = now;
                vehicleUpdate.stationaryPollCount = 0;
                vehicleUpdate.idlePollCount = 0;
            }
            // ============================================================
            // TRIP LOGIC (v3.6.0 - Polling creates and tracks trips)
            // ============================================================
            // STATIONARY DETECTION
            const odoStationary = !hasMovement;
            const gpsStationary = location && prevLocation ? !locationChanged : null;
            const isStationary = odoStationary && (gpsStationary === null || gpsStationary === true);
            // ============================================================
            // CASE 1: No active trip + movement → CREATE NEW TRIP
            // ============================================================
            if (!activeTripId && hasMovement) {
                console.log(`[scheduledPoll] MOVEMENT DETECTED - Creating new trip`);
                const newTripRef = db.collection('trips').doc();
                await newTripRef.set({
                    vehicleId,
                    startDate: now,
                    startOdometer: prevOdometer,
                    startSoC: prevSoC,
                    endOdometer: currentOdometer,
                    endSoC: currentSoC !== null && currentSoC !== void 0 ? currentSoC : prevSoC,
                    distanceKm: Math.round(odoDelta * 100) / 100,
                    status: 'in_progress',
                    type: 'unknown',
                    source: 'polling',
                    lastUpdate: now,
                });
                // Add start GPS point
                if (location) {
                    await newTripRef.collection('points').add({
                        lat: location.lat, lon: location.lon,
                        timestamp: now, source: 'poll', type: 'start'
                    });
                    console.log(`[scheduledPoll] Added GPS start point`);
                }
                vehicleUpdate.activeTripId = newTripRef.id;
                vehicleUpdate.idlePollCount = 0;
                console.log(`[scheduledPoll] STARTED trip: ${newTripRef.id}`);
                // ============================================================
                // CASE 2: Active trip + locked + 5 stationary polls → CLOSE TRIP
                // ============================================================
            }
            else if (activeTripId && isLocked === true && isStationary && stationaryPollCount >= 4) {
                console.log(`[scheduledPoll] CLOSING TRIP - locked + 5 polls stationary`);
                const tripRef = db.collection('trips').doc(activeTripId);
                const tripDoc = await tripRef.get();
                const tripData = tripDoc.data();
                if (tripData) {
                    const endOdo = currentOdometer !== null && currentOdometer !== void 0 ? currentOdometer : prevOdometer;
                    const totalDistance = endOdo - (tripData.startOdometer || 0);
                    // Subtract 5 minutes from endDate (5 stationary polls were after arrival)
                    const adjustedEndDate = admin.firestore.Timestamp.fromMillis(now.toMillis() - (5 * 60 * 1000));
                    const durationMinutes = Math.round((adjustedEndDate.toMillis() - (((_d = tripData.startDate) === null || _d === void 0 ? void 0 : _d.toMillis()) || Date.now())) / 60000);
                    // Add final GPS point
                    if (location) {
                        await tripRef.collection('points').add({
                            lat: location.lat, lon: location.lon,
                            timestamp: adjustedEndDate, source: 'poll', type: 'end'
                        });
                    }
                    // Calculate GPS distance
                    let gpsDistanceKm = null;
                    try {
                        const pointsSnap = await tripRef.collection('points').orderBy('timestamp').get();
                        if (pointsSnap.size >= 2) {
                            const gpsPoints = pointsSnap.docs.map(doc => {
                                const d = doc.data();
                                return { lat: d.lat, lon: d.lon };
                            }).filter(p => p.lat && p.lon);
                            if (gpsPoints.length >= 2) {
                                gpsDistanceKm = await snapToRoadsDistance(gpsPoints);
                            }
                        }
                    }
                    catch (e) { /* ignore */ }
                    const tripUpdate = {
                        status: 'completed',
                        type: totalDistance >= CONFIG.MIN_TRIP_DISTANCE ? 'trip' : 'idle',
                        endDate: adjustedEndDate,
                        endOdometer: endOdo,
                        endSoC: (_e = currentSoC !== null && currentSoC !== void 0 ? currentSoC : tripData.endSoC) !== null && _e !== void 0 ? _e : prevSoC,
                        distanceKm: Math.round(Math.max(0, totalDistance) * 100) / 100,
                        durationMinutes: Math.max(0, durationMinutes),
                        lastUpdate: now,
                        closedReason: 'locked_5_polls_stationary',
                    };
                    if (gpsDistanceKm)
                        tripUpdate.gpsDistanceKm = gpsDistanceKm;
                    await tripRef.update(tripUpdate);
                    console.log(`[scheduledPoll] CLOSED trip: ${activeTripId}, ${totalDistance.toFixed(2)}km`);
                }
                vehicleUpdate.activeTripId = admin.firestore.FieldValue.delete();
                vehicleUpdate.stationaryPollCount = 0;
                vehicleUpdate.pollingActive = false; // Stop polling after trip ends
                // ============================================================
                // CASE 3: Active trip + locked + stationary → increment counter
                // ============================================================
            }
            else if (activeTripId && isLocked === true && isStationary) {
                const newStationaryCount = stationaryPollCount + 1;
                vehicleUpdate.stationaryPollCount = newStationaryCount;
                console.log(`[scheduledPoll] Locked + stationary: poll ${newStationaryCount}/5`);
                // Update trip data
                const tripRef = db.collection('trips').doc(activeTripId);
                const tripDoc = await tripRef.get();
                if (tripDoc.exists) {
                    const tripData = tripDoc.data();
                    const tripUpdate = { lastUpdate: now };
                    if (currentOdometer !== null) {
                        tripUpdate.endOdometer = currentOdometer;
                        const totalDistance = currentOdometer - (tripData.startOdometer || 0);
                        tripUpdate.distanceKm = Math.round(Math.max(0, totalDistance) * 100) / 100;
                    }
                    if (currentSoC !== null)
                        tripUpdate.endSoC = currentSoC;
                    await tripRef.update(tripUpdate);
                }
                // Add GPS point
                if (location) {
                    await tripRef.collection('points').add({
                        lat: location.lat, lon: location.lon,
                        timestamp: now, source: 'poll', type: 'waypoint'
                    });
                }
                // ============================================================
                // CASE 4: Active trip + moving → update trip, add GPS
                // ============================================================
            }
            else if (activeTripId) {
                vehicleUpdate.stationaryPollCount = 0;
                const tripRef = db.collection('trips').doc(activeTripId);
                const tripDoc = await tripRef.get();
                if (tripDoc.exists) {
                    const tripData = tripDoc.data();
                    const tripUpdate = { lastUpdate: now };
                    if (currentOdometer !== null) {
                        tripUpdate.endOdometer = currentOdometer;
                        const totalDistance = currentOdometer - (tripData.startOdometer || 0);
                        tripUpdate.distanceKm = Math.round(Math.max(0, totalDistance) * 100) / 100;
                    }
                    if (currentSoC !== null)
                        tripUpdate.endSoC = currentSoC;
                    await tripRef.update(tripUpdate);
                }
                // Add GPS waypoint
                if (location) {
                    await tripRef.collection('points').add({
                        lat: location.lat, lon: location.lon,
                        timestamp: now, source: 'poll', type: 'waypoint'
                    });
                    console.log(`[scheduledPoll] Added GPS waypoint to trip ${activeTripId}`);
                }
                // ============================================================
                // CASE 5: No trip + locked + 5 idle polls → stop polling
                // ============================================================
            }
            else if (!activeTripId && isLocked === true) {
                const newIdleCount = idlePollCount + 1;
                vehicleUpdate.idlePollCount = newIdleCount;
                console.log(`[scheduledPoll] No trip, locked, idle: poll ${newIdleCount}/5`);
                if (newIdleCount >= 5) {
                    console.log(`[scheduledPoll] Stopping polling - locked + no activity for 5 polls`);
                    vehicleUpdate.pollingActive = false;
                    vehicleUpdate.idlePollCount = 0;
                }
                // ============================================================
                // CASE 6: No trip + unlocked + no movement → just waiting
                // ============================================================
            }
            else {
                vehicleUpdate.idlePollCount = 0;
                console.log(`[scheduledPoll] Waiting for movement...`);
            }
            await vehicleRef.set(vehicleUpdate, { merge: true });
        }
        catch (error) {
            console.error(`[scheduledPoll] Error polling ${vehicleId}: ${error.message}`);
            // On error, just log - trip will eventually close via webhook when car is unlocked again
        }
    }
    console.log('[scheduledPoll] Done');
    return null;
});
// =============================================================================
// SUBSCRIBE VEHICLE TO WEBHOOK (Admin utility)
// =============================================================================
exports.subscribeVehicleToWebhook = regionalFunctions.https.onCall(async (data, context) => {
    const { vehicleId, webhookId } = data;
    if (!vehicleId || !webhookId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId or webhookId');
    }
    try {
        const tokensDoc = await db.collection('vehicles').doc(vehicleId).collection('private').doc('tokens').get();
        const tokensData = tokensDoc.data();
        if (!(tokensData === null || tokensData === void 0 ? void 0 : tokensData.accessToken)) {
            throw new functions.https.HttpsError('failed-precondition', 'No access token found');
        }
        const accessToken = decryptToken(tokensData.accessToken);
        const response = await fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}/webhooks/${webhookId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const result = await response.json();
        console.log(`[subscribeWebhook] Vehicle ${vehicleId} to webhook ${webhookId}: ${response.status}`);
        return {
            success: response.status === 200 || response.status === 201,
            status: response.status,
            result
        };
    }
    catch (error) {
        console.error('[subscribeWebhook] FAILED:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
// =============================================================================
// CLEANUP DUPLICATE TRIPS (Admin utility)
// =============================================================================
exports.cleanupDuplicateTrips = regionalFunctions.https.onCall(async (data, context) => {
    var _a, _b;
    const { dryRun = true } = data;
    console.log(`[cleanupTrips] Starting cleanup (dryRun: ${dryRun})...`);
    // Get all trips from today ordered by startDate
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tripsSnapshot = await db.collection('trips')
        .where('startDate', '>=', admin.firestore.Timestamp.fromDate(today))
        .orderBy('startDate', 'asc')
        .get();
    const trips = tripsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
    console.log(`[cleanupTrips] Found ${trips.length} trips from today`);
    // Find duplicates: trips that overlap in time or have very similar start times
    const toDelete = [];
    const toKeep = [];
    for (let i = 0; i < trips.length; i++) {
        const trip = trips[i];
        // Skip if already marked for deletion
        if (toDelete.includes(trip.id))
            continue;
        // Check for duplicates (trips starting within 5 minutes of each other)
        for (let j = i + 1; j < trips.length; j++) {
            const other = trips[j];
            if (toDelete.includes(other.id))
                continue;
            const tripStart = ((_a = trip.startDate) === null || _a === void 0 ? void 0 : _a.toMillis()) || 0;
            const otherStart = ((_b = other.startDate) === null || _b === void 0 ? void 0 : _b.toMillis()) || 0;
            const timeDiff = Math.abs(tripStart - otherStart);
            // If trips start within 5 minutes of each other, they're likely duplicates
            if (timeDiff < 5 * 60 * 1000) {
                // Keep the one with more GPS points or more data
                const tripPoints = trip.gpsPointCount || 0;
                const otherPoints = other.gpsPointCount || 0;
                const tripHasGps = trip.gpsDistanceKm > 0;
                const otherHasGps = other.gpsDistanceKm > 0;
                // Prefer: has GPS distance > more points > scheduled_poll source > longer duration
                // Determine which trip to delete (the "worse" one)
                let deleteTrip = other;
                if (otherHasGps && !tripHasGps) {
                    deleteTrip = trip;
                }
                else if (otherPoints > tripPoints) {
                    deleteTrip = trip;
                }
                else if (other.source === 'scheduled_poll' && trip.source !== 'scheduled_poll') {
                    deleteTrip = trip;
                }
                toDelete.push(deleteTrip.id);
                console.log(`[cleanupTrips] Marking duplicate: ${deleteTrip.id} (dist: ${deleteTrip.distanceKm}km, source: ${deleteTrip.source})`);
            }
        }
        if (!toDelete.includes(trip.id)) {
            toKeep.push(trip.id);
        }
    }
    // Also delete any trips with 0 distance and status='completed' (false trips)
    for (const trip of trips) {
        if (!toDelete.includes(trip.id) && trip.status === 'completed' && trip.distanceKm === 0) {
            toDelete.push(trip.id);
            console.log(`[cleanupTrips] Marking zero-distance trip: ${trip.id}`);
        }
    }
    // Delete the duplicates
    if (!dryRun && toDelete.length > 0) {
        const batch = db.batch();
        for (const tripId of toDelete) {
            // Delete points subcollection first
            const pointsSnapshot = await db.collection('trips').doc(tripId).collection('points').get();
            pointsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
            // Delete trip
            batch.delete(db.collection('trips').doc(tripId));
        }
        await batch.commit();
        console.log(`[cleanupTrips] Deleted ${toDelete.length} duplicate trips`);
    }
    return {
        found: trips.length,
        toDelete: toDelete.length,
        toKeep: toKeep.length,
        deletedIds: toDelete,
        keptIds: toKeep,
        dryRun
    };
});
// =============================================================================
// UPDATE VEHICLE SETTINGS (Battery capacity, etc.)
// =============================================================================
exports.updateVehicleSettings = regionalFunctions.https.onCall(async (data, context) => {
    const { vehicleId, batteryCapacity, targetChargeSoC } = data;
    if (!vehicleId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId');
    }
    console.log(`[updateVehicleSettings] Updating vehicle ${vehicleId} - batteryCapacity: ${batteryCapacity}, targetChargeSoC: ${targetChargeSoC}`);
    const vehicleRef = db.collection('vehicles').doc(vehicleId);
    const vehicleDoc = await vehicleRef.get();
    if (!vehicleDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Vehicle not found');
    }
    const updates = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (batteryCapacity !== undefined && batteryCapacity > 0) {
        updates.batteryCapacity = batteryCapacity;
    }
    if (targetChargeSoC !== undefined && targetChargeSoC >= 0.5 && targetChargeSoC <= 1.0) {
        updates.targetChargeSoC = targetChargeSoC;
    }
    await vehicleRef.update(updates);
    console.log(`[updateVehicleSettings] Updated vehicle ${vehicleId}`);
    return { success: true, vehicleId, batteryCapacity, targetChargeSoC };
});
//# sourceMappingURL=index.js.map