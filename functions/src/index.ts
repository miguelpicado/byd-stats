import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// =============================================================================
// INITIALIZATION
// =============================================================================

admin.initializeApp();

const VERSION = '4.0.0';
const REGION = 'europe-west1';
const regionalFunctions = functions.region(REGION);

// =============================================================================
// PING - Health Check
// =============================================================================

export const ping = regionalFunctions.https.onCall(() => {
    return { status: 'PONG', version: VERSION, timestamp: new Date().toISOString(), region: REGION };
});

// =============================================================================
// BYD API FUNCTIONS
// =============================================================================

export {
    bydConnect,
    bydDisconnect,
    bydGetRealtime,
    bydGetGps,
    bydGetCharging,
    bydLock,
    bydUnlock,
    bydStartClimate,
    bydStopClimate,
    bydFlashLights,
    bydCloseWindows,
    bydSeatClimate,
    bydBatteryHeat,
    bydWakeVehicle,
    bydDiagnostic,
    bydGetMqttCredentials,
    bydActiveTripMonitor,
    bydIdleHeartbeat,
    bydFixTrip,
    bydDebug,
} from './bydFunctions';
