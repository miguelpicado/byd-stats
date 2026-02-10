// BYD Stats - Normalization Utilities
// Centralizes data normalization to avoid code duplication

/**
 * Normalize State of Charge to percentage (0-100)
 * Handles both decimal (0-1) and percentage (0-100) inputs
 * @param value - SoC value in either format
 * @returns SoC as percentage (0-100) or null if invalid
 */
export function normalizeSoCToPercent(value: number | null | undefined): number | null {
    if (value == null) return null;
    // If value is between 0 and 1 (exclusive of 1.01+), treat as decimal
    return value > 1 ? Math.round(value) : Math.round(value * 100);
}

/**
 * Normalize State of Charge to decimal (0-1)
 * Handles both decimal (0-1) and percentage (0-100) inputs
 * @param value - SoC value in either format
 * @returns SoC as decimal (0-1) or null if invalid
 */
export function normalizeSoCToDecimal(value: number | null | undefined): number | null {
    if (value == null) return null;
    // If value is greater than 1, treat as percentage
    return value > 1 ? value / 100 : value;
}

/**
 * Convert battery size to number
 * Settings can store batterySize as string or number
 * @param value - Battery size as string or number
 * @returns Battery size as number
 */
export function getNumericBatterySize(value: string | number | undefined): number {
    if (value === undefined) return 60; // Default fallback
    return typeof value === 'string' ? parseFloat(value) : value;
}




