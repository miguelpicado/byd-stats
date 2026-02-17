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
    const callable = httpsCallable<any, BydConnectResult>(functions, 'bydConnect');
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
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydDisconnect');
    const result = await callable({ vin });
    return result.data;
}

/**
 * Get realtime vehicle data
 */
export async function bydGetRealtime(vin: string): Promise<{ success: boolean; data: BydRealtime }> {
    const callable = httpsCallable<any, { success: boolean; data: BydRealtime }>(functions, 'bydGetRealtime');
    const result = await callable({ vin });
    return result.data;
}

/**
 * Get GPS location
 */
export async function bydGetGps(vin: string): Promise<{ success: boolean; data: BydGps }> {
    const callable = httpsCallable<any, { success: boolean; data: BydGps }>(functions, 'bydGetGps');
    const result = await callable({ vin });
    return result.data;
}

/**
 * Get charging status
 */
export async function bydGetCharging(vin: string): Promise<{ success: boolean; data: BydCharging }> {
    const callable = httpsCallable<any, { success: boolean; data: BydCharging }>(functions, 'bydGetCharging');
    const result = await callable({ vin });
    return result.data;
}

/**
 * Lock vehicle
 */
export async function bydLock(vin: string, pin?: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydLock');
    const result = await callable({ vin, pin });
    return result.data;
}

/**
 * Unlock vehicle
 */
export async function bydUnlock(vin: string, pin?: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydUnlock');
    const result = await callable({ vin, pin });
    return result.data;
}

/**
 * Start climate
 */
export async function bydStartClimate(
    vin: string,
    temperature?: number,
    pin?: string
): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydStartClimate');
    const result = await callable({ vin, temperature, pin });
    return result.data;
}

/**
 * Stop climate
 */
export async function bydStopClimate(vin: string, pin?: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydStopClimate');
    const result = await callable({ vin, pin });
    return result.data;
}

/**
 * Flash lights
 */
export async function bydFlashLights(vin: string, pin?: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydFlashLights');
    const result = await callable({ vin, pin });
    return result.data;
}

/**
 * Close windows
 */
export async function bydCloseWindows(vin: string, pin?: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydCloseWindows');
    const result = await callable({ vin, pin });
    return result.data;
}

/**
 * Control seat climate/heating
 * @param seat 0=driver, 1=passenger
 * @param mode 0=off, 1=low, 2=medium, 3=high
 */
export async function bydSeatClimate(
    vin: string,
    seat: number,
    mode: number,
    pin?: string
): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydSeatClimate');
    const result = await callable({ vin, seat, mode, pin });
    return result.data;
}

/**
 * Control battery heating
 */
export async function bydBatteryHeat(vin: string, pin?: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydBatteryHeat');
    const result = await callable({ vin, pin });
    return result.data;
}

/**
 * Poll vehicle for trip data
 */
export async function bydPollVehicle(vin: string): Promise<{
    success: boolean;
    data: {
        soc: number;
        range: number;
        odometer: number;
        isCharging: boolean;
        isLocked: boolean;
        location: { lat: number; lon: number } | null;
        hasMovement: boolean;
        activeTripId: string | null;
    };
}> {
    const callable = httpsCallable(functions, 'bydPollVehicle');
    const result = await callable({ vin });
    return result.data as any;
}

/**
 * Get full diagnostic
 */
/**
 * Get full diagnostic
 */
export async function bydDiagnostic(vin: string): Promise<BydDiagnostic> {
    const callable = httpsCallable<any, BydDiagnostic>(functions, 'bydDiagnostic');
    const result = await callable({ vin });
    return result.data;
}

/**
 * Get API Mapping Dump (Raw)
 */
export async function bydDebugDump(vin: string): Promise<{ success: boolean; dump: any }> {
    const callable = httpsCallable<any, { success: boolean; dump: any }>(functions, 'bydDebug');
    const result = await callable({ vin });
    return result.data;
}

export interface BydWakeResult {
    success: boolean;
    isAwake: boolean;
    attempts: number;
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
    };
    message: string;
}

/**
 * Wake vehicle and get current data
 * Called when user opens the app to refresh vehicle state
 * Retries up to 3 times if car is sleeping
 */
export async function bydWakeVehicle(vin: string, activatePolling = false): Promise<BydWakeResult> {
    const callable = httpsCallable<any, BydWakeResult>(functions, 'bydWakeVehicle');
    const result = await callable({ vin, activatePolling });
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
    const callable = httpsCallable<any, any>(functions, 'bydFixTrip');
    const result = await callable({ vin, tripId, overrideValues });
    return result.data;
}
