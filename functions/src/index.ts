import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import smartcar from 'smartcar';

// =============================================================================
// INITIALIZATION
// =============================================================================

admin.initializeApp();
const db = admin.firestore();

// Version: 3.0.0 - Complete rewrite (2026-02-06)
const VERSION = '3.0.0';

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

function encryptToken(token: string): string {
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

function decryptToken(encryptedToken: string): string {
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

async function getValidAccessToken(vehicleId: string): Promise<string> {
    const vehicleRef = db.collection('vehicles').doc(vehicleId);
    const tokensDoc = await vehicleRef.collection('private').doc('tokens').get();
    const tokensData = tokensDoc.data();

    if (!tokensData?.accessToken || !tokensData?.refreshToken) {
        throw new Error('No tokens found for vehicle');
    }

    const accessToken = decryptToken(tokensData.accessToken);
    const refreshToken = decryptToken(tokensData.refreshToken);

    // Try using the current access token first
    try {
        const vehicle = new smartcar.Vehicle(vehicleId, accessToken);
        await vehicle.attributes(); // Quick test
        return accessToken;
    } catch (error: any) {
        // Token might be expired, try to refresh
        if (error.type === 'AUTHENTICATION' || error.statusCode === 401) {
            console.log(`[TokenRefresh] Access token expired for ${vehicleId}, refreshing...`);

            if (!SMARTCAR_CLIENT_ID || !SMARTCAR_CLIENT_SECRET || !SMARTCAR_REDIRECT_URI) {
                throw new Error('Smartcar credentials not configured');
            }

            const client = new smartcar.AuthClient({
                clientId: SMARTCAR_CLIENT_ID,
                clientSecret: SMARTCAR_CLIENT_SECRET,
                redirectUri: SMARTCAR_REDIRECT_URI,
            });

            const newAccess = await client.exchangeRefreshToken(refreshToken);
            const newAccessToken = newAccess.accessToken;
            const newRefreshToken = newAccess.refreshToken;

            // Store the new tokens
            await vehicleRef.collection('private').doc('tokens').update({
                accessToken: encryptToken(newAccessToken),
                refreshToken: encryptToken(newRefreshToken),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(`[TokenRefresh] Tokens refreshed successfully for ${vehicleId}`);
            return newAccessToken;
        }
        throw error;
    }
}

// =============================================================================
// HELPERS - GPS & DISTANCE
// =============================================================================

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function calculateHaversineTotal(points: { lat: number; lon: number }[]): number {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += haversine(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
    }
    return Math.round(total * 100) / 100;
}

async function snapToRoadsDistance(points: { lat: number; lon: number }[]): Promise<number> {
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
        const snappedPoints = data.snappedPoints.map((p: any) => ({
            lat: p.location.latitude,
            lon: p.location.longitude
        }));
        return calculateHaversineTotal(snappedPoints);
    } catch (error) {
        console.error('[snapToRoads] Error:', error);
        return calculateHaversineTotal(points);
    }
}

// =============================================================================
// HELPERS - ADMIN AUTH
// =============================================================================

function isAdminRequest(req: functions.https.Request): boolean {
    const apiKey = req.headers['x-admin-api-key'] || req.query.adminKey;
    if (!ADMIN_API_KEY) return false;
    return apiKey === ADMIN_API_KEY;
}

// =============================================================================
// PING - Health Check
// =============================================================================

export const ping = regionalFunctions.https.onCall((data, context) => {
    return { status: 'PONG', version: VERSION, timestamp: new Date().toISOString(), region: REGION };
});

// =============================================================================
// SMARTCAR WEBHOOK - Complete Rewrite
// =============================================================================

interface SmartcarSignal {
    name: string;
    code?: string;
    group?: string;
    body?: { value: any; unit?: string; latitude?: number; longitude?: number };
    meta?: { oemUpdatedAt?: number; retrievedAt?: number };
    status?: { value: string; error?: { type: string; code?: string } };
}

interface ParsedWebhookData {
    vehicleId: string;
    timestamp: admin.firestore.Timestamp;
    odometer: number | null;
    soc: number | null;
    isLocked: boolean | null;
    isOnline: boolean | null;
    isAsleep: boolean | null;
    isCharging: boolean | null;
    location: { lat: number; lon: number } | null;
}

function parseSmartcarWebhook(body: any): ParsedWebhookData | null {
    // Extract vehicle ID from various possible locations
    const vehicleId = body.vehicleId ||
        body.data?.vehicleId ||
        body.vehicle?.id ||
        body.data?.vehicle?.id;

    if (!vehicleId) {
        console.error('[parseWebhook] No vehicleId found in body');
        return null;
    }

    const result: ParsedWebhookData = {
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
    const signals: SmartcarSignal[] = body.data?.signals || [];

    for (const signal of signals) {
        // Skip failed signals
        if (signal.status?.value !== 'SUCCESS') {
            console.log(`[parseWebhook] Signal ${signal.name} failed: ${signal.status?.error?.type || 'UNKNOWN'}`);
            continue;
        }

        const value = signal.body?.value;
        if (value === undefined) continue;

        // Extract OEM timestamp if available (vehicle's actual time)
        if (signal.meta?.oemUpdatedAt) {
            result.timestamp = admin.firestore.Timestamp.fromMillis(signal.meta.oemUpdatedAt);
        }

        // Map signal names to our data structure
        const name = signal.name?.toLowerCase();
        switch (name) {
            case 'traveleddistance':
            case 'odometer':
                result.odometer = typeof value === 'number' ? value : null;
                break;
            case 'stateofcharge':
            case 'soc':
                result.soc = typeof value === 'number' ? value : null;
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
                if (signal.body?.latitude && signal.body?.longitude) {
                    result.location = { lat: signal.body.latitude, lon: signal.body.longitude };
                }
                break;
        }
    }

    // Also check for location in the signal body directly (alternative format)
    for (const signal of signals) {
        if (signal.name?.toLowerCase() === 'location' && signal.status?.value === 'SUCCESS') {
            if (signal.body?.latitude && signal.body?.longitude) {
                result.location = { lat: signal.body.latitude, lon: signal.body.longitude };
            }
        }
    }

    console.log(`[parseWebhook] Parsed: odo=${result.odometer}, soc=${result.soc}, locked=${result.isLocked}, online=${result.isOnline}, asleep=${result.isAsleep}, charging=${result.isCharging}, hasLocation=${!!result.location}`);

    return result;
}

export const smartcarWebhook = regionalFunctions.https.onRequest(async (req, res) => {
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
        const challenge = req.query.challenge as string;
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
        const challenge = body.challenge || body.data?.challenge;
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
        const prevOdometer = vehicle.lastOdometer ?? null;
        const prevSoC = vehicle.lastSoC ?? null;
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
        const vehicleUpdate: any = {
            lastUpdate: now,
            make: vehicle.make || 'BYD',
        };

        if (data.odometer !== null) vehicleUpdate.lastOdometer = data.odometer;
        if (data.soc !== null) vehicleUpdate.lastSoC = data.soc;
        if (data.isLocked !== null) vehicleUpdate.isLocked = data.isLocked;
        if (data.isOnline !== null) vehicleUpdate.isOnline = data.isOnline;
        if (data.isAsleep !== null) vehicleUpdate.isAsleep = data.isAsleep;
        if (data.isCharging !== null) vehicleUpdate.isCharging = data.isCharging;

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
                    const tripData = tripDoc.data()!;
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
                const sessionData = chargeSessionDoc.data()!;
                const startSoC = sessionData.startSoC || 0;
                const endSoC = currentSoC || startSoC;
                const socGain = Math.max(0, endSoC - startSoC);

                // Calculate duration
                const startMs = sessionData.startDate?.toMillis() || Date.now();
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
                    const smartcarVehicle = new smartcar.Vehicle(vehicleId, accessToken);
                    await smartcarVehicle.stopCharge();
                    console.log(`${logPrefix} AUTO-STOP: Sent STOP command to vehicle`);

                    // Mark that we auto-stopped
                    await chargeSessionRef.update({
                        autoStopped: true,
                        autoStopSoC: currentSoC,
                        autoStopTime: now,
                    });
                } catch (stopError: any) {
                    console.error(`${logPrefix} AUTO-STOP FAILED: ${stopError.message}`);
                }
            }
        }

        // =====================================================================
        // POLLING TRIGGER: Activate polling when car is unlocked
        // =====================================================================
        const prevIsLocked = vehicle.isLocked;
        const currentIsLocked = data.isLocked;

        // If isLocked changed from true to false (car unlocked) -> start polling
        if (prevIsLocked === true && currentIsLocked === false) {
            console.log(`${logPrefix} CAR UNLOCKED - Activating polling mode`);
            vehicleUpdate.pollingActive = true;
            vehicleUpdate.idlePollCount = 0;
        }

        // Also activate polling if there's movement detected
        if (hasMovement && !vehicle.pollingActive) {
            console.log(`${logPrefix} MOVEMENT DETECTED - Activating polling mode`);
            vehicleUpdate.pollingActive = true;
            vehicleUpdate.idlePollCount = 0;
        }

        // FALLBACK: Activate polling if car is awake and online (but we missed unlock)
        // This handles cases where the car didn't have coverage when unlocking
        const isAwakeAndOnline = data.isAsleep === false && data.isOnline === true;
        const wasAsleepOrOffline = vehicle.isAsleep === true || vehicle.isOnline === false;
        if (isAwakeAndOnline && wasAsleepOrOffline && !vehicle.pollingActive) {
            console.log(`${logPrefix} CAR WOKE UP (isAsleep=false, isOnline=true) - Activating polling mode`);
            vehicleUpdate.pollingActive = true;
            vehicleUpdate.idlePollCount = 0;
        }

        // =====================================================================
        // STEP 3: Trip logic
        // If polling is ACTIVE: let polling manage the trip, just add GPS points
        // If polling is NOT active: retroactive detection from odometer jumps
        // =====================================================================

        const isPollingActive = vehicle.pollingActive === true;

        if (isPollingActive && activeTripId) {
            // POLLING IS MANAGING THIS TRIP - just add GPS point if available
            console.log(`${logPrefix} Polling active, adding data to trip: ${activeTripId}`);

            const tripRef = db.collection('trips').doc(activeTripId);

            // Add GPS point if we have location
            if (data.location) {
                await tripRef.collection('points').add({
                    lat: data.location.lat,
                    lon: data.location.lon,
                    timestamp: data.timestamp,
                    odometer: currentOdometer,
                    soc: currentSoC,
                    source: 'webhook',
                    type: 'waypoint'
                });
                console.log(`${logPrefix} Added GPS waypoint to trip ${activeTripId}`);
            }

            // Update trip with latest data
            const tripUpdate: any = {
                lastUpdate: now,
            };
            if (currentOdometer !== null) tripUpdate.endOdometer = currentOdometer;
            if (currentSoC !== null) tripUpdate.endSoC = currentSoC;
            await tripRef.update(tripUpdate);

        } else if (isPollingActive && !activeTripId && hasMovement) {
            // Polling is active but no trip yet - polling will create it
            console.log(`${logPrefix} Movement detected, polling will create trip`);

        } else if (!isPollingActive && activeTripId) {
            // POLLING IS NOT ACTIVE but there's a stale trip - close it
            const tripRef = db.collection('trips').doc(activeTripId);
            const tripDoc = await tripRef.get();

            if (tripDoc.exists) {
                const tripData = tripDoc.data()!;
                console.log(`${logPrefix} Closing stale in_progress trip: ${activeTripId}`);

                // Use the data we have now to close it
                const startOdo = tripData.startOdometer ?? currentOdometer ?? 0;
                const endOdo = currentOdometer ?? startOdo;
                const tripDistance = Math.max(0, endOdo - startOdo);
                const endSoCVal = currentSoC ?? tripData.startSoC ?? 0;

                const startMs = tripData.startDate?.toMillis() || Date.now();
                const durationMinutes = Math.round((Date.now() - startMs) / 60000);

                let tripType = 'idle';
                if (tripDistance >= CONFIG.MIN_TRIP_DISTANCE) tripType = 'trip';
                else if (tripDistance >= CONFIG.MIN_MOVEMENT_DELTA) tripType = 'short_movement';

                // Calculate GPS distance from collected points
                let gpsDistanceKm: number | null = null;
                try {
                    const pointsSnap = await tripRef.collection('points').orderBy('timestamp').get();
                    if (pointsSnap.size >= 2) {
                        const gpsPoints = pointsSnap.docs.map(doc => {
                            const d = doc.data();
                            return { lat: d.lat, lon: d.lon };
                        }).filter(p => p.lat && p.lon);

                        if (gpsPoints.length >= 2) {
                            gpsDistanceKm = await snapToRoadsDistance(gpsPoints);
                            console.log(`${logPrefix} GPS distance: ${gpsDistanceKm?.toFixed(2)} km`);
                        }
                    }
                } catch (e) { /* ignore GPS calc errors */ }

                const tripUpdate: any = {
                    status: 'completed',
                    type: tripType,
                    endDate: now,
                    endOdometer: endOdo,
                    endSoC: endSoCVal,
                    distanceKm: Math.round(tripDistance * 100) / 100,
                    durationMinutes,
                    lastUpdate: now,
                    closedReason: 'stale_cleanup',
                };

                if (gpsDistanceKm !== null && gpsDistanceKm > 0) {
                    tripUpdate.gpsDistanceKm = gpsDistanceKm;
                }

                await tripRef.update(tripUpdate);
                console.log(`${logPrefix} Closed stale trip ${activeTripId}: odo:${tripDistance.toFixed(2)}km, gps:${gpsDistanceKm?.toFixed(2) || 'N/A'}km`);
            }

            vehicleUpdate.activeTripId = admin.firestore.FieldValue.delete();

        } else if (!isPollingActive && !activeTripId && hasPreviousData && hasMovement && odoDelta >= CONFIG.MIN_TRIP_DISTANCE) {
            // RETROACTIVE DETECTION: Polling was not active but we see odometer jump
            // Check if we should EXTEND a recent trip or CREATE a new one

            // Look for a recent completed trip (within last 15 minutes) to extend
            const recentTripQuery = await db.collection('trips')
                .where('vehicleId', '==', vehicleId)
                .where('status', '==', 'completed')
                .orderBy('endDate', 'desc')
                .limit(1)
                .get();

            const recentTrip = recentTripQuery.docs[0];
            const recentTripData = recentTrip?.data();
            const recentTripEndTime = recentTripData?.endDate?.toMillis() || 0;
            const timeSinceLastTrip = Date.now() - recentTripEndTime;
            const MERGE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

            if (recentTrip && timeSinceLastTrip < MERGE_WINDOW_MS) {
                // EXTEND existing trip
                const newDistance = (recentTripData.distanceKm || 0) + odoDelta;
                const newDuration = Math.round((data.timestamp.toMillis() - recentTripData.startDate.toMillis()) / 60000);

                await recentTrip.ref.update({
                    endDate: data.timestamp,
                    endOdometer: currentOdometer!,
                    endSoC: currentSoC ?? recentTripData.endSoC,
                    distanceKm: Math.round(newDistance * 100) / 100,
                    durationMinutes: Math.max(1, newDuration),
                    lastUpdate: now,
                });

                if (data.location) {
                    await recentTrip.ref.collection('points').add({
                        lat: data.location.lat,
                        lon: data.location.lon,
                        timestamp: data.timestamp,
                        source: 'webhook',
                        type: 'waypoint'
                    });
                }

                console.log(`${logPrefix} EXTENDED trip: ${recentTrip.id}, +${odoDelta.toFixed(2)} km = ${newDistance.toFixed(2)} km total`);

            } else {
                // CREATE new retroactive trip
                console.log(`${logPrefix} RETROACTIVE: Detected completed trip: ${odoDelta.toFixed(2)} km`);

                const newTripRef = db.collection('trips').doc();

                // Estimate trip times
                const prevUpdateTime = vehicle.lastUpdate?.toDate() || new Date(Date.now() - 3600000);
                const startDate = admin.firestore.Timestamp.fromDate(prevUpdateTime);
                const endDate = data.timestamp;
                const durationMinutes = Math.round((endDate.toMillis() - startDate.toMillis()) / 60000);

                // NOTE: consumptionKwh is NOT stored - app calculates it from SoC delta * batterySize
                const newTrip = {
                    vehicleId,
                    startDate,
                    startOdometer: prevOdometer!,
                    startSoC: prevSoC ?? 0,  // Decimal format (0.82 = 82%)
                    endDate,
                    endOdometer: currentOdometer!,
                    endSoC: currentSoC ?? 0,  // Decimal format (0.65 = 65%)
                    distanceKm: Math.round(odoDelta * 100) / 100,
                    durationMinutes: Math.max(1, durationMinutes),
                    status: 'completed',
                    type: 'trip',
                    source: 'smartcar_webhook',
                    detectionMethod: 'retroactive',
                    lastUpdate: now,
                };

                await newTripRef.set(newTrip);

                if (data.location) {
                    await newTripRef.collection('points').add({
                        lat: data.location.lat,
                        lon: data.location.lon,
                        timestamp: data.timestamp,
                        source: 'webhook',
                        type: 'end'
                    });
                }

                console.log(`${logPrefix} Created retroactive trip: ${newTripRef.id}, ${odoDelta.toFixed(2)} km, ${durationMinutes} min`);
            }

        } else if (hasMovement) {
            console.log(`${logPrefix} Small movement: ${odoDelta.toFixed(3)} km (below threshold or polling will handle)`);
        } else {
            console.log(`${logPrefix} No movement detected`);
        }

        // =====================================================================
        // STEP 4: Save vehicle state
        // =====================================================================
        await vehicleRef.set(vehicleUpdate, { merge: true });

        console.log(`${logPrefix} SUCCESS - Vehicle state saved`);
        res.status(200).send('OK');

    } catch (error: any) {
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

export const exchangeAuthCode = regionalFunctions.https.onCall(async (data, context) => {
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
        const client = new smartcar.AuthClient({
            clientId: SMARTCAR_CLIENT_ID,
            clientSecret: SMARTCAR_CLIENT_SECRET,
            redirectUri: SMARTCAR_REDIRECT_URI,
        });

        console.log('[exchangeAuthCode] Exchanging code...');
        const access = await client.exchangeCode(code);
        const accessToken = access.accessToken;
        const refreshToken = access.refreshToken;

        console.log('[exchangeAuthCode] Getting vehicle IDs...');
        const vehiclesResponse = await smartcar.getVehicles(accessToken);
        const vehicleIds = vehiclesResponse.vehicles;

        if (vehicleIds.length === 0) {
            throw new functions.https.HttpsError('not-found', 'No vehicles found in Smartcar account');
        }

        const vehicleId = vehicleIds[0];
        console.log(`[exchangeAuthCode] Found vehicle: ${vehicleId}`);

        const vehicle = new smartcar.Vehicle(vehicleId, accessToken);
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
                const subscribeResponse = await fetch(
                    `https://api.smartcar.com/v2.0/vehicles/${vehicleId}/webhooks/${SMARTCAR_WEBHOOK_ID}`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                        },
                    }
                );
                const subscribeResult = await subscribeResponse.json();

                if (subscribeResponse.ok) {
                    console.log(`[exchangeAuthCode] Vehicle subscribed to webhook successfully`);
                    webhookSubscribed = true;

                    // Store webhook subscription info
                    await db.collection('vehicles').doc(vehicleId).update({
                        webhookId: SMARTCAR_WEBHOOK_ID,
                        webhookSubscribedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                } else {
                    console.warn(`[exchangeAuthCode] Webhook subscription failed: ${JSON.stringify(subscribeResult)}`);
                }
            } catch (webhookError: any) {
                console.error(`[exchangeAuthCode] Webhook subscription error: ${webhookError.message}`);
                // Don't fail the whole process if webhook subscription fails
            }
        } else {
            console.warn('[exchangeAuthCode] SMARTCAR_WEBHOOK_ID not configured, skipping webhook subscription');
        }

        console.log('[exchangeAuthCode] SUCCESS');
        return { success: true, vehicleId, make: attributes.make, model: attributes.model, webhookSubscribed };

    } catch (error: any) {
        console.error('[exchangeAuthCode] FAILED:', error.message);
        throw new functions.https.HttpsError('internal', error.message || 'Token exchange failed');
    }
});

// =============================================================================
// OAUTH - Disconnect SmartCar
// =============================================================================

export const disconnectSmartcar = regionalFunctions.https.onCall(async (data, context) => {
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
            if (tokensData?.accessToken) {
                const accessToken = decryptToken(tokensData.accessToken);
                const vehicle = new smartcar.Vehicle(vehicleId, accessToken);
                await vehicle.disconnect();
                console.log('[disconnectSmartcar] Revoked SmartCar access');
            }
        } catch (e) {
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

    } catch (error: any) {
        console.error('[disconnectSmartcar] FAILED:', error.message);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// =============================================================================
// RESET POLLING STATE (for debugging/manual control)
// =============================================================================

export const resetPollingState = regionalFunctions.https.onCall(async (data, context) => {
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

    } catch (error: any) {
        console.error('[resetPollingState] FAILED:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// =============================================================================
// CHARGE CONTROL - Start/Stop charging remotely
// =============================================================================

export const stopCharge = regionalFunctions.https.onCall(async (data, context) => {
    console.log('[stopCharge] Start');

    const { vehicleId } = data;
    if (!vehicleId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId');
    }

    try {
        const accessToken = await getValidAccessToken(vehicleId);
        const vehicle = new smartcar.Vehicle(vehicleId, accessToken);

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

    } catch (error: any) {
        console.error('[stopCharge] FAILED:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

export const startCharge = regionalFunctions.https.onCall(async (data, context) => {
    console.log('[startCharge] Start');

    const { vehicleId } = data;
    if (!vehicleId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId');
    }

    try {
        const accessToken = await getValidAccessToken(vehicleId);
        const vehicle = new smartcar.Vehicle(vehicleId, accessToken);

        // Send START command to vehicle
        await vehicle.startCharge();
        console.log(`[startCharge] Sent START command to ${vehicleId}`);

        // Update vehicle state
        await db.collection('vehicles').doc(vehicleId).update({
            lastChargeCommand: 'START',
            lastChargeCommandTime: admin.firestore.Timestamp.now(),
        });

        return { success: true, command: 'START' };

    } catch (error: any) {
        console.error('[startCharge] FAILED:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

export const setTargetChargeSoC = regionalFunctions.https.onCall(async (data, context) => {
    console.log('[setTargetChargeSoC] Start');

    const { vehicleId, targetSoC } = data;
    if (!vehicleId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId');
    }

    // targetSoC should be decimal (0.8 = 80%) or null to disable
    const validTarget = targetSoC === null ? null :
        (typeof targetSoC === 'number' && targetSoC > 0 && targetSoC <= 1) ? targetSoC : null;

    try {
        const update: any = {
            updatedAt: admin.firestore.Timestamp.now(),
        };

        if (validTarget === null) {
            update.targetChargeSoC = admin.firestore.FieldValue.delete();
        } else {
            update.targetChargeSoC = validTarget;
        }

        await db.collection('vehicles').doc(vehicleId).update(update);
        console.log(`[setTargetChargeSoC] Set target to ${validTarget ? (validTarget * 100).toFixed(0) + '%' : 'disabled'} for ${vehicleId}`);

        return { success: true, targetSoC: validTarget };

    } catch (error: any) {
        console.error('[setTargetChargeSoC] FAILED:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// =============================================================================
// MERGE TRIPS (combine fragmented trips into one)
// =============================================================================

export const mergeTrips = regionalFunctions.https.onCall(async (data, context) => {
    console.log('[mergeTrips] Start');

    const { tripIds } = data;
    if (!tripIds || !Array.isArray(tripIds) || tripIds.length < 2) {
        throw new functions.https.HttpsError('invalid-argument', 'Need at least 2 trip IDs to merge');
    }

    try {
        // Get all trips
        const trips: any[] = [];
        for (const id of tripIds) {
            const doc = await db.collection('trips').doc(id).get();
            if (doc.exists) {
                trips.push({ id: doc.id, ...doc.data() });
            }
        }

        if (trips.length < 2) {
            throw new functions.https.HttpsError('not-found', 'Could not find enough trips to merge');
        }

        // Sort by startDate
        trips.sort((a, b) => (a.startDate?.toMillis() || 0) - (b.startDate?.toMillis() || 0));

        const first = trips[0];
        const last = trips[trips.length - 1];

        // Calculate merged values
        const totalDistance = last.endOdometer - first.startOdometer;
        const durationMs = (last.endDate?.toMillis() || Date.now()) - (first.startDate?.toMillis() || Date.now());
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

    } catch (error: any) {
        console.error('[mergeTrips] FAILED:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// =============================================================================
// TEST CONNECTION
// =============================================================================

export const testSmartcarConnection = regionalFunctions.https.onCall(async (data, context) => {
    console.log('[testConnection] Start');

    const { vehicleId } = data;
    if (!vehicleId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId');
    }

    try {
        // Get valid access token (with auto-refresh)
        const accessToken = await getValidAccessToken(vehicleId);
        const vehicle = new smartcar.Vehicle(vehicleId, accessToken);

        const results: any = {
            vehicleId,
            timestamp: new Date().toISOString(),
            permissions: {},
            errors: []
        };

        // Test each endpoint
        const tests = [
            { name: 'odometer', fn: () => vehicle.odometer() },
            { name: 'location', fn: () => vehicle.location() },
            { name: 'battery', fn: () => vehicle.battery() },
            { name: 'attributes', fn: () => vehicle.attributes() },
        ];

        for (const test of tests) {
            try {
                const result = await test.fn();
                results.permissions[test.name] = { status: 'SUCCESS', data: result };
            } catch (error: any) {
                results.permissions[test.name] = { status: 'ERROR', error: error.message };
                results.errors.push(`${test.name}: ${error.message}`);
            }
        }

        console.log(`[testConnection] Done, errors: ${results.errors.length}`);
        return results;

    } catch (error: any) {
        console.error('[testConnection] FAILED:', error.message);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// =============================================================================
// DIAGNOSTICS
// =============================================================================

export const getDiagnostics = regionalFunctions.https.onCall(async (data, context) => {
    try {
        const vehiclesSnap = await db.collection('vehicles').get();
        const tripsSnap = await db.collection('trips').orderBy('startDate', 'desc').limit(10).get();

        return {
            version: VERSION,
            vehicleCount: vehiclesSnap.size,
            tripCount: tripsSnap.size,
            vehicles: vehiclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
            trips: tripsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        };
    } catch (error: any) {
        return { error: error.message };
    }
});

export const diag = regionalFunctions.https.onRequest(async (req, res) => {
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
            return { id: d.id, ...data };
        });

        const trips = tripsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Get webhook info from SmartCar
        let webhookInfo = null;
        if (SMARTCAR_CLIENT_ID && SMARTCAR_CLIENT_SECRET) {
            try {
                const auth = Buffer.from(`${SMARTCAR_CLIENT_ID}:${SMARTCAR_CLIENT_SECRET}`).toString('base64');
                const response = await fetch('https://api.smartcar.com/v2.0/webhooks', {
                    headers: { 'Authorization': `Basic ${auth}` }
                });
                webhookInfo = await response.json();
            } catch (e: any) {
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
    } catch (e: any) {
        res.status(500).json({ error: e.message, stack: e.stack });
    }
});

// =============================================================================
// TRIP GPS DISTANCE CALCULATOR (Firestore Trigger)
// =============================================================================

export const calculateTripGpsDistance = regionalFunctions.firestore
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
        } catch (error) {
            console.error(`[GPS] Error for trip ${tripId}:`, error);
        }

        return null;
    });

// =============================================================================
// SIMULATE WEBHOOK - Fetch current data and process it
// =============================================================================

export const simulateWebhook = regionalFunctions.https.onCall(async (data, context) => {
    const { vehicleId } = data;
    console.log(`[simulateWebhook] Start for vehicle: ${vehicleId}`);

    if (!vehicleId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId');
    }

    try {
        // Get valid access token (with auto-refresh)
        const accessToken = await getValidAccessToken(vehicleId);
        const vehicle = new smartcar.Vehicle(vehicleId, accessToken);

        // Fetch all data from the vehicle
        console.log('[simulateWebhook] Fetching vehicle data...');

        const results: any = {
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
        } catch (e: any) {
            results.errors.push(`odometer: ${e.message}`);
        }

        // Fetch battery/SoC
        try {
            const battery = await vehicle.battery();
            results.data.soc = battery.percentRemaining;
            console.log(`[simulateWebhook] SoC: ${battery.percentRemaining}%`);
        } catch (e: any) {
            results.errors.push(`battery: ${e.message}`);
        }

        // Fetch location
        try {
            const loc = await vehicle.location();
            results.data.location = { lat: loc.latitude, lon: loc.longitude };
            console.log(`[simulateWebhook] Location: ${loc.latitude}, ${loc.longitude}`);
        } catch (e: any) {
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
        const vehicleUpdate: any = {
            lastUpdate: now,
            simulatedAt: now,
        };

        if (results.data.odometer) vehicleUpdate.lastOdometer = results.data.odometer;
        if (results.data.soc) vehicleUpdate.lastSoC = results.data.soc;
        if (hasMovement) vehicleUpdate.lastMoveTime = now;

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
        } else if (activeTripId && hasMovement) {
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
        } else {
            results.action = 'NO ACTION - no movement detected';
            console.log(`[simulateWebhook] ${results.action}`);
        }

        console.log('[simulateWebhook] SUCCESS');
        return results;

    } catch (error: any) {
        console.error('[simulateWebhook] FAILED:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// =============================================================================
// POLL VEHICLE - Active polling for GPS tracking
// Can be called by Cloud Scheduler every 2-5 minutes
// =============================================================================

export const pollVehicle = regionalFunctions.https.onRequest(async (req, res) => {
    // Allow Cloud Scheduler or admin requests
    const isScheduler = req.headers['x-cloudscheduler'] === 'true';
    const isAdmin = isAdminRequest(req);

    if (!isScheduler && !isAdmin) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const vehicleId = req.query.vehicleId as string || '557430f4-6dbe-464e-833d-5b419a0e4eca';
    console.log(`[pollVehicle] Polling vehicle: ${vehicleId}`);

    try {
        const accessToken = await getValidAccessToken(vehicleId);
        const vehicle = new smartcar.Vehicle(vehicleId, accessToken);

        // Fetch current data
        const [odoResult, batteryResult, locationResult] = await Promise.allSettled([
            vehicle.odometer(),
            vehicle.battery(),
            vehicle.location()
        ]);

        const odometer = odoResult.status === 'fulfilled' ? odoResult.value.distance : null;
        const soc = batteryResult.status === 'fulfilled' ? batteryResult.value.percentRemaining : null;
        const location = locationResult.status === 'fulfilled'
            ? { lat: locationResult.value.latitude, lon: locationResult.value.longitude }
            : null;

        console.log(`[pollVehicle] Odo: ${odometer}, SoC: ${soc}, Location: ${location?.lat}, ${location?.lon}`);

        // Get previous state
        const now = admin.firestore.Timestamp.now();
        const vehicleRef = db.collection('vehicles').doc(vehicleId);
        const vehicleDoc = await vehicleRef.get();
        const vehicleData = vehicleDoc.data() || {};

        const prevOdometer = vehicleData.lastOdometer || 0;
        const prevSoC = vehicleData.lastSoC || 0;
        const activeTripId = vehicleData.activeTripId || null;

        const currentOdometer = odometer ?? prevOdometer;
        const currentSoC = soc ?? prevSoC;
        const odoDelta = currentOdometer - prevOdometer;
        const hasMovement = odoDelta > CONFIG.MIN_MOVEMENT_DELTA;

        console.log(`[pollVehicle] Delta: ${odoDelta.toFixed(3)} km, Movement: ${hasMovement}, ActiveTrip: ${activeTripId}`);

        // Update vehicle state
        const vehicleUpdate: any = {
            lastUpdate: now,
            lastPollTime: now,
        };
        if (odometer !== null) vehicleUpdate.lastOdometer = odometer;
        if (soc !== null) vehicleUpdate.lastSoC = soc;
        if (hasMovement) vehicleUpdate.lastMoveTime = now;

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

        } else if (activeTripId && hasMovement) {
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

        } else if (activeTripId && !hasMovement) {
            // No movement - check if trip should be closed
            const lastMoveTime = vehicleData.lastMoveTime?.toDate() || new Date(0);
            const idleMs = Date.now() - lastMoveTime.getTime();

            if (idleMs > CONFIG.IDLE_TIMEOUT_MS) {
                // Close the trip
                const tripRef = db.collection('trips').doc(activeTripId);
                const tripDoc = await tripRef.get();
                const tripData = tripDoc.data();

                if (tripData) {
                    const startOdo = tripData.startOdometer || prevOdometer;
                    const totalDistance = currentOdometer - startOdo;
                    const startMs = tripData.startDate?.toMillis() || Date.now();
                    const durationMinutes = Math.round((Date.now() - startMs) / 60000);

                    let tripType = 'idle';
                    if (totalDistance >= CONFIG.MIN_TRIP_DISTANCE) tripType = 'trip';

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
            } else {
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

    } catch (error: any) {
        console.error(`[pollVehicle] ERROR: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// =============================================================================
// SCHEDULED POLLING - Runs every 2 minutes
// =============================================================================

export const scheduledPoll = regionalFunctions.pubsub
    .schedule('every 2 minutes')
    .timeZone('Europe/Madrid')
    .onRun(async (context) => {
        console.log('[scheduledPoll] Starting scheduled poll...');

        // Get all vehicles with tokens (connected to Smartcar)
        const vehiclesSnap = await db.collection('vehicles').get();

        for (const vehicleDoc of vehiclesSnap.docs) {
            const vehicleId = vehicleDoc.id;
            const vehicleData = vehicleDoc.data() || {};

            // Check if vehicle has tokens (is connected)
            const tokensDoc = await db.collection('vehicles').doc(vehicleId)
                .collection('private').doc('tokens').get();

            if (!tokensDoc.exists || !tokensDoc.data()?.accessToken) {
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
                    const vehicle = new smartcar.Vehicle(vehicleId, accessToken);
                    const now = admin.firestore.Timestamp.now();

                    // Only fetch battery level during charging
                    const batteryResult = await vehicle.battery().catch(() => null);
                    const currentSoC = batteryResult?.percentRemaining ?? null;

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
                        const targetSoC = vehicleData.targetChargeSoC ?? null;
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
                            } catch (stopErr: any) {
                                console.error(`[scheduledPoll] Failed to stop charge: ${stopErr.message}`);
                            }
                        }
                    } else {
                        console.log(`[scheduledPoll] CHARGING: Could not fetch SoC`);
                    }
                } catch (chargeErr: any) {
                    console.error(`[scheduledPoll] Charging poll error: ${chargeErr.message}`);
                }

                // Don't continue with trip polling during charging
                continue;
            }

            // =================================================================
            // TRIP-ONLY POLLING: Only poll if there's an active trip
            // Webhooks handle: trip start (unlock), trip end (lock), all data updates
            // Polling ONLY adds GPS waypoints during active trips
            // =================================================================
            const activeTripId = vehicleData.activeTripId || null;

            if (!activeTripId) {
                // NO ACTIVE TRIP = NO POLLING
                // Webhooks will start a trip when car unlocks and moves
                console.log(`[scheduledPoll] Skipping ${vehicleId} - no active trip (webhooks handle trip detection)`);
                continue;
            }

            try {
                const now = admin.firestore.Timestamp.now();
                const vehicleRef = db.collection('vehicles').doc(vehicleId);
                const prevLocation = vehicleData.lastLocation || null;
                const errorPollCount = vehicleData.errorPollCount || 0;
                const isLocked = vehicleData.isLocked ?? null;

                // ============================================================
                // TRIP ACTIVE: Only fetch GPS location
                // All other data (odo, soc, lock) comes from webhooks
                // ============================================================
                console.log(`[scheduledPoll] Trip ${activeTripId} active - fetching GPS only`);

                const accessToken = await getValidAccessToken(vehicleId);
                const vehicle = new smartcar.Vehicle(vehicleId, accessToken);

                let location: { lat: number; lon: number } | null = null;
                const locationResult = await vehicle.location().catch(() => null);
                if (locationResult) {
                    location = { lat: locationResult.latitude, lon: locationResult.longitude };
                }

                // Check if location changed significantly (>50 meters)
                let locationChanged = false;
                if (location && prevLocation) {
                    const distMoved = haversine(prevLocation.lat, prevLocation.lon, location.lat, location.lon);
                    locationChanged = distMoved > 0.05; // 50 meters
                }

                console.log(`[scheduledPoll] Location: ${location ? `${location.lat.toFixed(4)},${location.lon.toFixed(4)}` : 'N/A'}, changed: ${locationChanged}, locked: ${isLocked}`);

                // Update vehicle location if we got it
                const vehicleUpdate: any = {
                    lastPollTime: now,
                };
                if (location) {
                    vehicleUpdate.lastLocation = location;
                    vehicleUpdate.errorPollCount = 0;
                } else {
                    // No location - increment error count
                    const newErrorCount = errorPollCount + 1;
                    vehicleUpdate.errorPollCount = newErrorCount;

                    // After 5 failed location fetches, close trip (car might be in parking garage)
                    if (newErrorCount >= 5) {
                        console.log(`[scheduledPoll] 5 failed location polls - closing trip ${activeTripId}`);
                        vehicleUpdate.activeTripId = admin.firestore.FieldValue.delete();
                        vehicleUpdate.errorPollCount = 0;

                        const tripRef = db.collection('trips').doc(activeTripId);
                        await tripRef.update({
                            status: 'completed',
                            endDate: now,
                            lastUpdate: now,
                            closedReason: 'no_location_5_polls',
                        });
                    }
                }

                // If car is locked (from webhook), close the trip
                if (isLocked === true) {
                    console.log(`[scheduledPoll] Car locked - closing trip ${activeTripId}`);
                    vehicleUpdate.activeTripId = admin.firestore.FieldValue.delete();
                    vehicleUpdate.errorPollCount = 0;

                    const tripRef = db.collection('trips').doc(activeTripId);
                    const tripDoc = await tripRef.get();
                    const tripData = tripDoc.data();

                    if (tripData) {
                        const currentOdometer = vehicleData.lastOdometer || 0;
                        const currentSoC = vehicleData.lastSoC || 0;
                        const totalDistance = currentOdometer - (tripData.startOdometer || 0);
                        const durationMinutes = Math.round((Date.now() - (tripData.startDate?.toMillis() || Date.now())) / 60000);

                        // Add final GPS point if available
                        if (location) {
                            await tripRef.collection('points').add({
                                lat: location.lat, lon: location.lon,
                                timestamp: now, source: 'poll', type: 'end'
                            });
                        }

                        // Calculate GPS distance
                        let gpsDistanceKm: number | null = null;
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
                        } catch (e) { /* ignore */ }

                        const tripUpdate: any = {
                            status: 'completed',
                            type: totalDistance >= CONFIG.MIN_TRIP_DISTANCE ? 'trip' : 'idle',
                            endDate: now,
                            endOdometer: currentOdometer,
                            endSoC: currentSoC,
                            distanceKm: Math.round(totalDistance * 100) / 100,
                            durationMinutes,
                            lastUpdate: now,
                            closedReason: 'locked_via_poll',
                        };
                        if (gpsDistanceKm) tripUpdate.gpsDistanceKm = gpsDistanceKm;

                        await tripRef.update(tripUpdate);
                        console.log(`[scheduledPoll] CLOSED trip: ${activeTripId}, ${totalDistance.toFixed(2)}km`);
                    }

                    await vehicleRef.set(vehicleUpdate, { merge: true });
                    continue;
                }

                // Add GPS waypoint to trip if location changed
                if (location && locationChanged) {
                    const tripRef = db.collection('trips').doc(activeTripId);
                    await tripRef.collection('points').add({
                        lat: location.lat,
                        lon: location.lon,
                        timestamp: now,
                        source: 'poll',
                        type: 'waypoint'
                    });
                    console.log(`[scheduledPoll] Added GPS waypoint to trip ${activeTripId}`);
                }

                await vehicleRef.set(vehicleUpdate, { merge: true });

            } catch (error: any) {
                // Track errors at vehicle level too
                const vehicleRef = db.collection('vehicles').doc(vehicleId);
                const currentData = (await vehicleRef.get()).data() || {};
                const newErrorCount = (currentData.errorPollCount || 0) + 1;

                if (newErrorCount >= 3) {
                    console.log(`[scheduledPoll] 3 consecutive errors for ${vehicleId} - stopping polling`);
                    await vehicleRef.update({
                        pollingActive: false,
                        errorPollCount: 0,
                        idlePollCount: 0,
                    });
                } else {
                    await vehicleRef.update({ errorPollCount: newErrorCount });
                }
                console.error(`[scheduledPoll] Error polling ${vehicleId}: ${error.message}`);
            }
        }

        console.log('[scheduledPoll] Done');
        return null;
    });

// =============================================================================
// SUBSCRIBE VEHICLE TO WEBHOOK (Admin utility)
// =============================================================================

export const subscribeVehicleToWebhook = regionalFunctions.https.onCall(async (data, context) => {
    const { vehicleId, webhookId } = data;

    if (!vehicleId || !webhookId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing vehicleId or webhookId');
    }

    try {
        const tokensDoc = await db.collection('vehicles').doc(vehicleId).collection('private').doc('tokens').get();
        const tokensData = tokensDoc.data();

        if (!tokensData?.accessToken) {
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

    } catch (error: any) {
        console.error('[subscribeWebhook] FAILED:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// =============================================================================
// CLEANUP DUPLICATE TRIPS (Admin utility)
// =============================================================================

export const cleanupDuplicateTrips = regionalFunctions.https.onCall(async (data, context) => {
    const { dryRun = true } = data;

    console.log(`[cleanupTrips] Starting cleanup (dryRun: ${dryRun})...`);

    // Get all trips from today ordered by startDate
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tripsSnapshot = await db.collection('trips')
        .where('startDate', '>=', admin.firestore.Timestamp.fromDate(today))
        .orderBy('startDate', 'asc')
        .get();

    const trips = tripsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    console.log(`[cleanupTrips] Found ${trips.length} trips from today`);

    // Find duplicates: trips that overlap in time or have very similar start times
    const toDelete: string[] = [];
    const toKeep: string[] = [];

    for (let i = 0; i < trips.length; i++) {
        const trip = trips[i] as any;

        // Skip if already marked for deletion
        if (toDelete.includes(trip.id)) continue;

        // Check for duplicates (trips starting within 5 minutes of each other)
        for (let j = i + 1; j < trips.length; j++) {
            const other = trips[j] as any;
            if (toDelete.includes(other.id)) continue;

            const tripStart = trip.startDate?.toMillis() || 0;
            const otherStart = other.startDate?.toMillis() || 0;
            const timeDiff = Math.abs(tripStart - otherStart);

            // If trips start within 5 minutes of each other, they're likely duplicates
            if (timeDiff < 5 * 60 * 1000) {
                // Keep the one with more GPS points or more data
                const tripPoints = trip.gpsPointCount || 0;
                const otherPoints = other.gpsPointCount || 0;
                const tripHasGps = trip.gpsDistance > 0;
                const otherHasGps = other.gpsDistance > 0;

                // Prefer: has GPS distance > more points > scheduled_poll source > longer duration
                // Determine which trip to delete (the "worse" one)
                let deleteTrip = other;

                if (otherHasGps && !tripHasGps) {
                    deleteTrip = trip;
                } else if (otherPoints > tripPoints) {
                    deleteTrip = trip;
                } else if (other.source === 'scheduled_poll' && trip.source !== 'scheduled_poll') {
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
    for (const trip of trips as any[]) {
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

export const updateVehicleSettings = regionalFunctions.https.onCall(async (data, context) => {
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

    const updates: any = {
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
