import { describe, it, expect } from 'vitest';
import { calculateAdvancedSoH } from '../batteryCalculations';

describe('batteryCalculations - calculateAdvancedSoH', () => {
    const mockCharges = [
        { kwhCharged: 500, speedKw: 7.4, finalPercentage: 100, type: 'electric' },
        { kwh: 500, speedKw: 150, finalPercentage: 80, type: 'electric' }
    ];
    const mfgDate = '2024-01-01';

    it('should calculate SoH correctly with default thermal factor', () => {
        const result = calculateAdvancedSoH(mockCharges, mfgDate, 100);
        expect(result.estimated_soh).toBeLessThan(100);
        expect(result.thermal_stress).toBe(1.0);
    });

    it('should handle kwh alias in charges', () => {
        const result = calculateAdvancedSoH([{ kwh: 100, speedKw: 7, finalPercentage: 100 }], mfgDate, 100);
        expect(result.real_cycles_count).toBeGreaterThan(0);
    });

    it('should apply thermalStressFactor correctly', () => {
        const res1 = calculateAdvancedSoH(mockCharges, mfgDate, 100, [], 1.0);
        const res2 = calculateAdvancedSoH(mockCharges, mfgDate, 100, [], 1.5);

        expect(res2.estimated_soh).toBeLessThan(res1.estimated_soh);
        expect(res2.thermal_stress).toBe(1.5);
    });

    it('should handle missing or invalid mfgDate gracefully', () => {
        const result = calculateAdvancedSoH(mockCharges, null, 100);
        expect(result.estimated_soh).toBe(100);
    });

    it('should handle zero battery capacity gracefully', () => {
        const result = calculateAdvancedSoH(mockCharges, mfgDate, 0);
        expect(result.real_cycles_count).toBeGreaterThan(0); // Uses fallback
    });
});
