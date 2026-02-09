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

/**
 * Convert tire pressure from kPa to bar
 * Smartcar returns pressure in kPa (e.g., 250 kPa = 2.5 bar)
 * @param kPa - Pressure in kPa
 * @returns Pressure in bar, formatted to 1 decimal
 */
export function kPaToBar(kPa: number): number {
    // Values > 10 are likely kPa, values <= 10 might already be bar
    const bar = kPa > 10 ? kPa / 100 : kPa;
    return Math.round(bar * 10) / 10; // Round to 1 decimal
}

/**
 * Format pressure for display
 * @param kPa - Pressure in kPa
 * @returns Formatted string with bar unit
 */
export function formatPressure(kPa: number): string {
    return `${kPaToBar(kPa).toFixed(1)} bar`;
}

/**
 * Parse numeric value from potentially string input
 * Common pattern for settings that might be string or number
 * @param value - Value to parse
 * @param defaultValue - Default if parsing fails
 * @returns Parsed number or default
 */
export function parseNumeric(value: string | number | undefined, defaultValue: number): number {
    if (value === undefined) return defaultValue;
    const parsed = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(parsed) ? defaultValue : parsed;
}
