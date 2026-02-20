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

export const pingV2 = onCall({ region: REGION }, () => {
    return { status: 'PONG', version: VERSION, timestamp: new Date().toISOString(), region: REGION };
});

// =============================================================================
// BYD API FUNCTIONS
// =============================================================================

export {
    bydConnectV2,
    bydDisconnectV2,
    bydGetRealtimeV2,
    bydGetGpsV2,
    bydGetChargingV2,
    bydLockV2,
    bydUnlockV2,
    bydStartClimateV2,
    bydStopClimateV2,
    bydFlashLightsV2,
    bydCloseWindowsV2,
    bydSeatClimateV2,
    bydBatteryHeatV2,
    bydWakeVehicleV2,
    bydDiagnosticV2,
    bydGetMqttCredentialsV2,
    bydActiveTripMonitorV2,
    bydIdleHeartbeatV2,
    bydFixTripV2,
    bydDebugV2,
} from './bydFunctions';
