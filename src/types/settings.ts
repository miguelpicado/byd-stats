import { z } from 'zod';

// =============================================================================
// SUB-SCHEMAS
// =============================================================================

export const ChargerTypeSchema = z.object({
    id: z.string(),
    name: z.string(),
    speedKw: z.number().min(0),
    efficiency: z.number().min(0).max(100).default(90),
});

export const ChargingPreferenceSchema = z.object({
    id: z.string(),
    day: z.string(),
    start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
    end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
    active: z.boolean().default(true),
});

// =============================================================================
// MAIN SETTINGS SCHEMA
// =============================================================================

export const SettingsSchema = z.object({
    // Car Specific
    carModel: z.string().optional(),
    licensePlate: z.string().optional(),
    insurancePolicy: z.string().optional(),

    // Battery & Calculations
    batterySize: z.union([z.string(), z.number()]).transform((val) => Number(val) || 60),
    soh: z.union([z.string(), z.number()]).transform((val) => Number(val) || 100),
    mfgDate: z.string().optional(), // YYYY-MM-DD
    mfgDateDisplay: z.string().optional(),
    sohMode: z.enum(['manual', 'calculated', 'ai']).default('manual').optional(),
    odometerOffset: z.union([z.number(), z.string()]).optional(),

    // Prices & Strategies
    chargerTypes: z.array(ChargerTypeSchema).optional(),
    thermalStressFactor: z.number().min(0).max(2).default(1.0).optional(),
    electricStrategy: z.enum(['custom', 'average', 'dynamic']).default('average').optional(),
    fuelStrategy: z.enum(['custom', 'average', 'dynamic']).default('average').optional(),
    electricPrice: z.union([z.string(), z.number()]).optional(),
    fuelPrice: z.union([z.string(), z.number()]).optional(),
    useCalculatedPrice: z.boolean().default(true).optional(),
    useCalculatedFuelPrice: z.boolean().default(true).optional(),

    // Legacy fields (optional, for backward compatibility)
    priceStrategy: z.string().optional(),
    fuelPriceStrategy: z.string().optional(),

    // Home Charging
    homeChargerRating: z.number().default(8).optional(),
    offPeakEnabled: z.boolean().default(false).optional(),
    offPeakStart: z.string().optional(),
    offPeakEnd: z.string().optional(),
    offPeakStartWeekend: z.string().optional(),
    offPeakEndWeekend: z.string().optional(),
    offPeakPrice: z.number().optional(),

    // AI / Smart Charging
    smartChargingPreferences: z.array(ChargingPreferenceSchema).optional(),

    // Charging Integration (PyBYD)
    targetChargeSoC: z.number().min(20).max(100).optional(),
    autoImportCharges: z.boolean().default(false).optional(),

    // UI
    theme: z.enum(['auto', 'dark', 'light', 'system']).default('system').optional(),
    hiddenTabs: z.array(z.string()).optional(),
});

// =============================================================================
// INFERRED TYPES
// =============================================================================

export type Settings = z.infer<typeof SettingsSchema>;
export type ChargerType = z.infer<typeof ChargerTypeSchema>;
export type ChargingPreference = z.infer<typeof ChargingPreferenceSchema>;
