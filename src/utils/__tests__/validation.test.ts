
import { describe, it, expect } from 'vitest';
import { ChargeCsvRowSchema, parseChargeCsvLine } from '../validation';

describe('Import Validation Logic', () => {
    it('should validate a correct CSV row', () => {
        const raw = ["2024-01-30 14:30", "15000", "50.5", "12.50", "", "SuperCharger", "0.25", "80"];
        const parsed = parseChargeCsvLine(raw);
        expect(parsed).not.toBeNull();

        const validation = ChargeCsvRowSchema.safeParse(parsed);
        expect(validation.success).toBe(true);
        if (validation.success) {
            expect(validation.data.chargerType).toBe("SuperCharger");
            expect(validation.data.totalCost).toBe(12.50);
        }
    });

    it('should fail invalid date format', () => {
        const raw = ["INVALID-DATE", "15000", "50.5", "12.50", "", "SuperCharger", "0.25", "80"];
        const parsed = parseChargeCsvLine(raw);
        // parser itself is strict on regex, so it might return null
        expect(parsed).toBeNull();
    });

    it('should fail negative values', () => {
        // Manually constructing object to bypass parser regex for this test
        const invalidData = {
            date: "2024-01-30",
            time: "14:30",
            odometer: -100, // Invalid
            kwhCharged: 50.5,
            totalCost: 12.50,
            chargerType: "Home",
            pricePerKwh: 0.25,
            finalPercentage: 80
        };
        const validation = ChargeCsvRowSchema.safeParse(invalidData);
        expect(validation.success).toBe(false);
    });
});
