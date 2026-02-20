import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

// =============================================================================
// INITIALIZATION
// =============================================================================

admin.initializeApp();

const VERSION = '5.0.0';
const REGION = 'europe-west1';

// =============================================================================
// PING - Health Check
// =============================================================================

export const ping = onCall({ region: REGION }, () => {
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
