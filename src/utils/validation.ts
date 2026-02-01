import { z } from 'zod';

/**
 * Schema for a single row in the Charges CSV import
 * Format: Date, Odometer, kWh, Cost, (Ignored), ChargerType, Price/kWh, Final%
 */
export const ChargeCsvRowSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
    odometer: z.number().min(0, "Odometer cannot be negative"),
    kwhCharged: z.number().min(0, "kWh cannot be negative"),
    totalCost: z.number().min(0, "Cost cannot be negative"),
    chargerType: z.string().min(1, "Charger type is required"),
    pricePerKwh: z.number().min(0, "Price per kWh cannot be negative"),
    initialPercentage: z.number().min(0).max(100).optional().default(0),
    finalPercentage: z.number().min(0).max(100, "Percentage must be between 0 and 100").optional().default(0),
    isSOCEstimated: z.boolean().optional(),
});

export type ChargeCsvRow = z.infer<typeof ChargeCsvRowSchema>;

/**
 * Helper to parse a raw CSV line into a typed object before validation
 */
export const parseChargeCsvLine = (values: string[]) => {
    if (values.length < 8) return null;

    const [fechaHora, kmTotales, kwhFacturados, precioTotal, socInicial, tipoCargador, precioKw, porcentajeFinal] = values;

    // Basic regex check to unify date parsing logic
    const dateMatch = fechaHora?.match(/(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2})/);
    if (!dateMatch) return null;

    return {
        date: dateMatch[1],
        time: dateMatch[2],
        odometer: parseFloat(kmTotales) || 0,
        kwhCharged: parseFloat(kwhFacturados) || 0,
        totalCost: parseFloat(precioTotal) || 0,
        initialPercentage: parseFloat(socInicial) || 0, // Now captured
        chargerType: tipoCargador?.trim() || 'Unknown',
        pricePerKwh: parseFloat(precioKw) || 0,
        finalPercentage: parseFloat(porcentajeFinal) || 0,
        // isSOCEstimated will be calculated in importer
    };
};
