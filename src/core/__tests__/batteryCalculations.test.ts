
// BYD Stats - Battery Calculations Tests
import { describe, it, expect } from 'vitest';
import {
    calculateAdvancedSoH,
    estimateInitialSoC,
    calculateConsumption,
    calculateSoH,
    estimateSoCFromKwh,
    getEfficiencyRating
} from '../batteryCalculations';
import { Charge } from '@/types';

describe('batteryCalculations', () => {
    describe('calculateAdvancedSoH', () => {
        const mockCharges = [
            { kwhCharged: 50, speedKw: 7.4, finalPercentage: 100, type: 'electric' },
            { kwh: 50, speedKw: 150, finalPercentage: 80, type: 'electric' }
        ] as Charge[];
        const mfgDate = '2024-01-01';

        it('should calculate SoH correctly with default thermal factor', () => {
            const result = calculateAdvancedSoH(mockCharges, mfgDate, 100);
            expect(result.estimated_soh).toBeLessThan(100);
            expect(result.thermal_stress).toBe(1.0);
        });

        it('should handle kwh alias in charges', () => {
            // @ts-ignore
            const result = calculateAdvancedSoH([{ kwh: 10, speedKw: 7, finalPercentage: 100 }], mfgDate, 100);
            expect(result.real_cycles_count).toBeGreaterThan(0);
        });

        it('should apply thermalStressFactor correctly', () => {
            // Increase kWh to make cycle aging visible
            const highUsageCharges = [
                { kwhCharged: 10000, speedKw: 7.4, finalPercentage: 100, type: 'electric' },
            ] as Charge[];
            const res1 = calculateAdvancedSoH(highUsageCharges, mfgDate, 100, [], 1.0);
            const res2 = calculateAdvancedSoH(highUsageCharges, mfgDate, 100, [], 1.5);

            expect(res2.estimated_soh).toBeLessThan(res1.estimated_soh);
            expect(res2.thermal_stress).toBe(1.5);
        });

        it('should handle missing or invalid mfgDate gracefully', () => {
            // @ts-ignore
            const result = calculateAdvancedSoH(mockCharges, null, 100);
            expect(result.estimated_soh).toBe(100);
        });

        it('should handle zero battery capacity gracefully', () => {
            const result = calculateAdvancedSoH(mockCharges, mfgDate, 0);
            expect(result.real_cycles_count).toBeGreaterThan(0); // Uses fallback
        });
    });

    describe('estimateInitialSoC', () => {
        it('should return null if previous charge is missing data', () => {
            // @ts-ignore
            expect(estimateInitialSoC({}, 1000, 15, 60)).toBeNull();
        });

        it('should calculate initial SoC correctly', () => {
            const prevCharge = { odometer: 1000, finalPercentage: 80 };
            const currentOdometer = 1100; // 100km driven
            const avgEfficiency = 15; // 15 kWh/100km
            const batterySize = 60;

            // Consumption: 100 * 15 / 100 = 15 kWh
            // SoC Consumed: 15 / 60 * 100 = 25%
            // Initial: 80 - 25 = 55%

            const result = estimateInitialSoC(prevCharge, currentOdometer, avgEfficiency, batterySize);
            expect(result).toBe(55);
        });

        it('should return 0 if consumed more than available (implied)', () => {
            const prevCharge = { odometer: 1000, finalPercentage: 10 };
            const currentOdometer = 1200; // 200km -> 30kWh -> 50%
            // 10 - 50 = -40 -> 0

            const result = estimateInitialSoC(prevCharge, currentOdometer, 15, 60);
            expect(result).toBe(0); // Math.max(0, ...)
        });
    });

    describe('calculateConsumption', () => {
        it('returns 0 for zero distance', () => {
            expect(calculateConsumption(10, 0)).toBe(0);
        });

        it('calculates kWh/100km correctly', () => {
            // 15 kWh for 100km = 15 kWh/100km
            expect(calculateConsumption(15, 100)).toBe(15);
        });

        it('handles decimal values', () => {
            // 7.5 kWh for 50km = 15 kWh/100km
            expect(calculateConsumption(7.5, 50)).toBe(15);
        });

        it('handles negative values gracefully', () => {
            expect(calculateConsumption(-5, 100)).toBe(0);
            expect(calculateConsumption(5, -100)).toBe(0);
        });
    });

    describe('calculateSoH', () => {
        it('returns 100% for new battery', () => {
            expect(calculateSoH(82.56, 82.56)).toBe(100);
        });

        it('calculates percentage correctly', () => {
            // 80 kWh actual vs 82.56 nominal = ~96.9%
            expect(calculateSoH(80, 82.56)).toBeCloseTo(96.9, 1);
        });

        it('caps at 100% for overperforming batteries', () => {
            expect(calculateSoH(85, 82.56)).toBe(100);
        });

        it('handles zero nominal capacity', () => {
            expect(calculateSoH(80, 0)).toBe(0);
        });
    });

    describe('estimateSoCFromKwh', () => {
        it('estimates SoC percentage from kWh charged', () => {
            // 41.28 kWh = 50% of 82.56 kWh battery
            expect(estimateSoCFromKwh(41.28, 82.56)).toBe(50);
        });

        it('caps at 100%', () => {
            // 41.28 kWh charged but if battery is small or result > 100
            expect(estimateSoCFromKwh(100, 82.56)).toBe(100);
        });

        it('handles zero battery size', () => {
            expect(estimateSoCFromKwh(10, 0)).toBe(0);
        });
    });

    describe('getEfficiencyRating', () => {
        it('returns "excellent" for < 14 kWh/100km', () => {
            expect(getEfficiencyRating(13)).toBe('excellent');
        });

        it('returns "good" for 14-17 kWh/100km', () => {
            expect(getEfficiencyRating(15)).toBe('good');
        });

        it('returns "average" for 17-20 kWh/100km', () => {
            expect(getEfficiencyRating(18)).toBe('average');
        });

        it('returns "poor" for > 20 kWh/100km', () => {
            expect(getEfficiencyRating(22)).toBe('poor');
        });
    });

    describe('Edge Cases', () => {
        it('should flag calibration warning if no charges reach 100%', () => {
            const charges = [
                { kwhCharged: 10, finalPercentage: 80, type: 'electric' },
                { kwhCharged: 10, finalPercentage: 80, type: 'electric' },
                { kwhCharged: 10, finalPercentage: 80, type: 'electric' },
                { kwhCharged: 10, finalPercentage: 80, type: 'electric' },
                { kwhCharged: 10, finalPercentage: 80, type: 'electric' },
                { kwhCharged: 10, finalPercentage: 90, type: 'electric' }
            ] as Charge[];
            const mfgDate = '2024-01-01';

            const result = calculateAdvancedSoH(charges, mfgDate, 60);
            expect(result.calibration_warning).toBe(true);
        });

        it('should not flag warning if enough charges reach 100%', () => {
            const charges = [
                { kwhCharged: 10, finalPercentage: 100, type: 'electric' },
                { kwhCharged: 10, finalPercentage: 90, type: 'electric' }
            ] as Charge[];
            const mfgDate = '2024-01-01';
            // 1 out of 2 is 50% > 10% threshold
            const result = calculateAdvancedSoH(charges, mfgDate, 60);
            expect(result.calibration_warning).toBe(false);
        });

        it('should handle invalid string date for mfgDate', () => {
            const charges = [] as Charge[];
            const result = calculateAdvancedSoH(charges, 'invalid-date', 60);
            // Should not crash, degradation.calendar should be 0
            expect(result.degradation.calendar).toBe(0);
        });
    });
});
