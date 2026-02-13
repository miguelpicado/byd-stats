
// src/utils/typeGuards.ts

import type { Settings, Trip, Charge } from '@/types';

/**
 * Type guard para verificar si un valor es un numero valido
 */
export function isValidNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Type guard para verificar si un valor es un string no vacio
 */
export function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Parsea un valor que puede ser string o number a number
 * Util para Settings donde batterySize puede venir como string de forms
 */
export function parseNumericSetting(value: unknown, defaultValue: number): number {
    if (isValidNumber(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        if (isValidNumber(parsed)) {
            return parsed;
        }
    }
    return defaultValue;
}

/**
 * Type guard para Trip
 */
export function isTrip(obj: unknown): obj is Trip {
    if (typeof obj !== 'object' || obj === null) return false;
    const trip = obj as Record<string, unknown>;
    return (
        typeof trip.date === 'string' &&
        (typeof trip.trip === 'number' || typeof trip.trip === 'undefined')
    );
}

/**
 * Type guard para Charge
 */
export function isCharge(obj: unknown): obj is Charge {
    if (typeof obj !== 'object' || obj === null) return false;
    const charge = obj as Record<string, unknown>;
    return (
        typeof charge.date === 'string' &&
        (typeof charge.kwh === 'number' || typeof charge.kwhCharged === 'number')
    );
}

/**
 * Type guard para array de Trips
 */
export function isTripsArray(arr: unknown): arr is Trip[] {
    return Array.isArray(arr) && arr.every(isTrip);
}

/**
 * Type guard para array de Charges
 */
export function isChargesArray(arr: unknown): arr is Charge[] {
    return Array.isArray(arr) && arr.every(isCharge);
}

/**
 * Filtra un array eliminando valores null/undefined con tipo correcto
 */
export function filterNonNull<T>(arr: (T | null | undefined)[]): T[] {
    return arr.filter((item): item is T => item != null);
}

/**
 * Safe access para propiedades opcionales con default
 */
export function getSettingValue<T>(
    settings: Partial<Settings> | undefined,
    key: keyof Settings,
    defaultValue: T
): T {
    if (!settings || !(key in settings)) {
        return defaultValue;
    }
    const value = settings[key];
    if (value === undefined || value === null) {
        return defaultValue;
    }
    return value as T;
}
