/**
 * BYD Direct API Service
 * Client-side interface for BYD Firebase Functions
 */

import { getFunctions, httpsCallable } from 'firebase/functions';

// Get Firebase Functions instance for europe-west1 region
const functions = getFunctions(undefined, 'europe-west1');

// =============================================================================
// TYPES
// =============================================================================

export interface BydVehicle {
    vin: string;
    name: string;
    model: string;
}

export interface BydConnectResult {
    success: boolean;
    vehicles: BydVehicle[];
}

export interface BydRealtime {
    soc: number;
    range: number;
    odometer: number;
    speed?: number;
    isCharging: boolean;
    isLocked: boolean;
    isOnline: boolean;
    exteriorTemp?: number;
    interiorTemp?: number;
    doors?: {
        frontLeft: boolean;
        frontRight: boolean;
        rearLeft: boolean;
        rearRight: boolean;
        trunk: boolean;
        hood: boolean;
    };
    windows?: {
        frontLeft: boolean;
        frontRight: boolean;
        rearLeft: boolean;
        rearRight: boolean;
    };
    raw?: any;
}

export interface BydGps {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    timestamp?: number;
}

export interface BydCharging {
    soc: number;
    isCharging: boolean;
    chargeType?: string;
    remainingMinutes?: number;
    targetSoc?: number;
    scheduledCharging?: boolean;
}

export interface BydDiagnostic {
    success: boolean;
    vin: string;
    realtime: BydRealtime | { error: string };
    gps: BydGps | { error: string };
    charging: BydCharging | { error: string };
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Connect BYD account
 */
export async function bydConnect(
    username: string,
    password: string,
    countryCode: string,
    controlPin?: string,
    userId?: string
): Promise<BydConnectResult> {
    const callable = httpsCallable<any, BydConnectResult>(functions, 'bydConnectV2');
    const result = await callable({
        username,
        password,
        countryCode,
        controlPin,
        userId: userId || 'anonymous',
    });
    return result.data;
}

/**
 * Disconnect BYD account
 */
export async function bydDisconnect(vin: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydDisconnectV2');
    const result = await callable({ vin });
    return result.data;
}

/**
 * Save encrypted ABRP token
 */
export async function bydSaveAbrpToken(vin: string, token: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydSaveAbrpToken');
    const result = await callable({ vin, token });
    return result.data;
}

/**
 * Get realtime vehicle data
 */
export async function bydGetRealtime(vin: string): Promise<{ success: boolean; data: BydRealtime }> {
    const callable = httpsCallable<any, { success: boolean; data: BydRealtime }>(functions, 'bydGetRealtimeV2');
    const result = await callable({ vin });
    return result.data;
}

/**
 * Get GPS location
 */
export async function bydGetGps(vin: string): Promise<{ success: boolean; data: BydGps }> {
    const callable = httpsCallable<any, { success: boolean; data: BydGps }>(functions, 'bydGetGpsV2');
    const result = await callable({ vin });
    return result.data;
}

/**
 * Get charging status
 */
export async function bydGetCharging(vin: string): Promise<{ success: boolean; data: BydCharging }> {
    const callable = httpsCallable<any, { success: boolean; data: BydCharging }>(functions, 'bydGetChargingV2');
    const result = await callable({ vin });
    return result.data;
}

/**
 * Lock vehicle
 */
export async function bydLock(vin: string, pin?: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydLockV2');
    const result = await callable({ vin, pin });
    return result.data;
}

/**
 * Unlock vehicle
 */
export async function bydUnlock(vin: string, pin?: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydUnlockV2');
    const result = await callable({ vin, pin });
    return result.data;
}

/**
 * Start climate
 */
export async function bydStartClimate(
    vin: string,
    temperature?: number,
    pin?: string,
    timeSpan?: number,
    cycleMode?: number
): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydStartClimateV2');
    const result = await callable({ vin, temperature, pin, timeSpan, cycleMode });
    return result.data;
}

/**
 * Stop climate
 */
export async function bydStopClimate(vin: string, pin?: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydStopClimateV2');
    const result = await callable({ vin, pin });
    return result.data;
}

/**
 * Flash lights
 */
export async function bydFlashLights(vin: string, pin?: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydFlashLightsV2');
    const result = await callable({ vin, pin });
    return result.data;
}

/**
 * Honk horn (find car with sound)
 */
export async function bydHonkHorn(vin: string, pin?: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydHonkHornV2');
    const result = await callable({ vin, pin });
    return result.data;
}

/**
 * Close windows
 */
export async function bydCloseWindows(vin: string, pin?: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydCloseWindowsV2');
    const result = await callable({ vin, pin });
    return result.data;
}

/**
 * Control seat heating and ventilation
 * Values: 1=off, 2=low, 3=high
 */
export async function bydSeatClimate(
    vin: string,
    options: {
        mainHeat?: number;
        mainVentilation?: number;
        copilotHeat?: number;
        copilotVentilation?: number;
    },
    pin?: string
): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydSeatClimateV2');
    const result = await callable({
        vin,
        mainHeat: options.mainHeat,
        mainVentilation: options.mainVentilation,
        copilotHeat: options.copilotHeat,
        copilotVentilation: options.copilotVentilation,
        pin
    });
    return result.data;
}

/**
 * Control battery heating
 */
export async function bydBatteryHeat(vin: string, pin?: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydBatteryHeatV2');
    const result = await callable({ vin, pin });
    return result.data;
}



/**
 * Get full diagnostic
 */
/**
 * Get full diagnostic
 */
export async function bydDiagnostic(vin: string): Promise<BydDiagnostic> {
    const callable = httpsCallable<any, BydDiagnostic>(functions, 'bydDiagnosticV2');
    const result = await callable({ vin });
    return result.data;
}

/**
 * Get API Mapping Dump (Raw)
 */
export async function bydDebugDump(vin: string): Promise<{ success: boolean; dump: any }> {
    const callable = httpsCallable<any, { success: boolean; dump: any }>(functions, 'bydDebugV2');
    const result = await callable({ vin });
    return result.data;
}

export interface BydWakeResult {
    success: boolean;
    isAwake: boolean;
    pollingActivated: boolean;
    data: {
        soc: number;
        socPercent: number;
        range: number;
        odometer: number;
        isCharging: boolean;
        isLocked: boolean;
        isOnline: boolean;
        location: { lat: number; lon: number; heading?: number } | null;
        tirePressure?: {
            frontLeft: number;
            frontRight: number;
            rearLeft: number;
            rearRight: number;
            lastTireUpdate?: any;
        } | null;
    };
    message: string;
}

/**
 * Get cached vehicle data (does not wake the T-Box)
 * Called when user opens the app to display latest known state
 */
export async function bydWakeVehicle(vin: string): Promise<BydWakeResult> {
    const callable = httpsCallable<any, BydWakeResult>(functions, 'bydWakeVehicleV2');
    const result = await callable({ vin });
    return result.data;
}
/**
 * Fix and recalculate trip data
 */
export async function bydFixTrip(vin: string, tripId: string, overrideValues?: any): Promise<{
    success: boolean;
    updates?: any;
    analysis?: any;
    message?: string;
}> {
    const callable = httpsCallable<any, any>(functions, 'bydFixTripV2');
    const result = await callable({ vin, tripId, overrideValues });
    return result.data;
}
