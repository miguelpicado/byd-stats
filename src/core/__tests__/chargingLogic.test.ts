import { describe, it, expect } from 'vitest';
import { ChargingLogic, CostSavingsAnalysis } from '../chargingLogic';
import { Charge, Settings } from '../../types';

describe('ChargingLogic', () => {
    describe('calculateOptimalChargeDay', () => {
        it('should return "Domingo" if no dailyStats are provided', () => {
            const result = ChargingLogic.calculateOptimalChargeDay([]);
            expect(result).toBe('Domingo');
        });

        it('should return the day with the lowest average consumption (no off-peak preference)', () => {
            const dailyStats = [
                { day: 'Lunes', km: 50 },
                { day: 'Martes', km: 20 }, // Lowest
                { day: 'Miércoles', km: 40 }
            ];
            const result = ChargingLogic.calculateOptimalChargeDay(dailyStats);
            expect(result).toBe('Martes');
        });

        it('should prioritize weekends if offPeakEnabled is true (Sábado or Domingo)', () => {
            const dailyStats = [
                { day: 'Lunes', km: 10 },    // Lowest overall, but not weekend
                { day: 'Martes', km: 20 },
                { day: 'Sábado', km: 30 },   // Lowest weekend
                { day: 'Domingo', km: 40 }
            ];
            const settings = { offPeakEnabled: true } as Settings;
            const result = ChargingLogic.calculateOptimalChargeDay(dailyStats, settings);

            // Expected to pick the lowest weekend day
            expect(result).toBe('Sábado');
        });

        it('should fallback to lowest overall day if offPeakEnabled is true but no weekend stats exist', () => {
            const dailyStats = [
                { day: 'Lunes', km: 50 },
                { day: 'Martes', km: 20 }
            ];
            const settings = { offPeakEnabled: true } as Settings;
            const result = ChargingLogic.calculateOptimalChargeDay(dailyStats, settings);
            expect(result).toBe('Martes');
        });
    });

    describe('getChargingRecommendation', () => {
        const defaultSettings = { batterySize: 60, soh: 100 } as Settings;

        it('should recommend "mixed" if weekly usage > usable capacity', () => {
            // Capacity is 60, usage is 70
            const result = ChargingLogic.getChargingRecommendation(undefined, undefined, undefined, 70, defaultSettings);
            expect(result.type).toBe('mixed');
            expect(result.reason).toBe('recommend_mixed');
        });

        it('should recommend "slow" for calibration if no recent calibration/100% slow charge', () => {
            const twoMonthsAgo = new Date();
            twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

            // Capacity 60, usage 20 (no mixed needed). 
            // Last charge was 2 months ago -> needs calibration
            const result = ChargingLogic.getChargingRecommendation(twoMonthsAgo.toISOString(), undefined, undefined, 20, defaultSettings);
            expect(result.type).toBe('slow');
            expect(result.reason).toBe('recommend_calibration');
        });

        it('should recommend "slow" for off-peak savings if feasible and savings > 1', () => {
            const recentDate = new Date().toISOString();
            const costAnalysis: CostSavingsAnalysis = {
                potentialMonthlySavings: 15,
                feasibleInOffPeak: true,
                deficitKwh: 0,
                offPeakWindowHours: 8
            };

            const result = ChargingLogic.getChargingRecommendation(recentDate, undefined, costAnalysis, 20, defaultSettings);
            expect(result.type).toBe('slow');
            expect(result.reason).toBe('recommend_offpeak');
        });

        it('should default to "slow_sufficient" if no other condition is met', () => {
            const recentDate = new Date().toISOString();
            const costAnalysis: CostSavingsAnalysis = {
                potentialMonthlySavings: 0,
                feasibleInOffPeak: true,
                deficitKwh: 0,
                offPeakWindowHours: 8
            };

            const result = ChargingLogic.getChargingRecommendation(recentDate, undefined, costAnalysis, 20, defaultSettings);
            expect(result.type).toBe('slow');
            expect(result.reason).toBe('recommend_slow_sufficient');
        });
    });

    describe('calculateComfortZone', () => {
        it('should return minSoC = 0 and cannot extend if less than 5 charges', () => {
            const charges = [{ initialPercentage: 20 }] as Charge[];
            const result = ChargingLogic.calculateComfortZone(charges);
            expect(result.minSoC).toBe(0);
            expect(result.canExtendInterval).toBe(false);
        });

        it('should calculate the 10th percentile as the conservative minimum', () => {
            // Percentiles calculation (ignoring the absolute lowest to avoid outliers)
            const charges = [
                { initialPercentage: 5 },  // index 0 -> 10% outlier
                { initialPercentage: 15 }, // index 1 -> taking 10th percentile of length 10
                { initialPercentage: 20 },
                { initialPercentage: 25 },
                { initialPercentage: 30 }, // length 5 -> 10th percentile is Math.floor(5 * 0.1) = index 0 (5%)
            ] as Charge[];

            const result = ChargingLogic.calculateComfortZone(charges);
            // With 5 elements, 10th percentile index = Math.floor(5 * 0.1) = 0.
            // Wait, sorted array is [5, 15, 20, 25, 30]. Index 0 is 5.
            expect(result.minSoC).toBe(5);
            expect(result.canExtendInterval).toBe(false);
        });

        it('should return canExtendInterval=true if conservative minimum > 30%', () => {
            const charges = [
                { initialPercentage: 35 },
                { initialPercentage: 38 },
                { initialPercentage: 40 },
                { initialPercentage: 45 },
                { initialPercentage: 50 },
            ] as Charge[];

            const result = ChargingLogic.calculateComfortZone(charges);
            expect(result.minSoC).toBe(35);
            expect(result.canExtendInterval).toBe(true);
        });
    });

    describe('calculateSeasonalFactor', () => {
        // Mock the current Date to have consistent tests
        beforeAll(() => {
            // Force summer (July)
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2024-07-15T12:00:00Z'));
        });

        afterAll(() => {
            vi.useRealTimers();
        });

        it('should return factor 1.0 (neutral) if not enough data', () => {
            const result = ChargingLogic.calculateSeasonalFactor([{ month: '01', efficiency: 15 }]);
            expect(result.factor).toBe(1.0);
            expect(result.season).toBe('neutral');
        });

        it('should calculate summer factor if efficiency is > 1.05 of yearly average', () => {
            // Yearly Avg = (10+10+10+12) / 4 = 10.5
            // Recent (summer) = 12
            // Ratio = 12 / 10.5 = 1.14 (> 1.05)
            const monthlyStats = [
                { month: '01', efficiency: 10 },
                { month: '02', efficiency: 10 },
                { month: '03', efficiency: 10 },
                { month: '07', efficiency: 12 }, // Last item is considered "recent"
            ];
            const result = ChargingLogic.calculateSeasonalFactor(monthlyStats);
            expect(result.factor).toBeGreaterThan(1.05);
            expect(result.season).toBe('summer'); // because system time is set to July
        });

        it('should return factor 1.0 (neutral) if recent efficiency is not significantly higher', () => {
            const monthlyStats = [
                { month: '01', efficiency: 10 },
                { month: '02', efficiency: 10 },
                { month: '07', efficiency: 10.1 }, // Last item is "recent"
            ];
            const result = ChargingLogic.calculateSeasonalFactor(monthlyStats);
            expect(result.factor).toBe(1.0);
            expect(result.season).toBe('neutral');
        });
    });

    describe('calculateCostSavings', () => {
        it('should return 0 savings if off peak is not enabled', () => {
            const settings = { offPeakEnabled: false } as Settings;
            const result = ChargingLogic.calculateCostSavings([], settings, 10);
            expect(result.potentialMonthlySavings).toBe(0);
        });

        it('should calculate savings correctly across multiple months', () => {
            const settings = {
                offPeakEnabled: true,
                offPeakStart: '00:00',
                offPeakEnd: '08:00',
                offPeakPrice: 0.10, // 10 cents
                homeChargerRating: 7
            } as Settings;

            // 8 hours * ~7kW approx max window energy

            // Charges spread over ~2 months
            const charges = [
                { type: 'electric', timestamp: new Date('2024-01-01').getTime(), date: '20240101', kwhCharged: 40, totalCost: 8, costPerKwh: 0.20 }, // Cost: 8. Offpeak: 4. Savings: 4
                { type: 'electric', timestamp: new Date('2024-02-01').getTime(), date: '20240201', kwhCharged: 50, totalCost: 15, costPerKwh: 0.30 }, // Cost 15. Offpeak 5. Savings: 10
            ] as Charge[];

            // 2 months evaluated. Total savings: 14. Monthly: 7.
            const result = ChargingLogic.calculateCostSavings(charges, settings, 5);
            expect(result.potentialMonthlySavings).toBe(7);
            expect(result.feasibleInOffPeak).toBe(true);
        });

        it('should flag as not feasible if deficit is greater than 0', () => {
            const settings = {
                offPeakEnabled: true,
                offPeakStart: '06:00',
                offPeakEnd: '08:00', // Only 2 hours window
                offPeakPrice: 0.10,
                homeChargerRating: 7 // 7kw * 2h = ~14kWh max
            } as Settings;

            // Avg daily consumption is 30 kWh. 
            // Deficit: 30 - 14 = 16 kWh
            const result = ChargingLogic.calculateCostSavings([], settings, 30);
            expect(result.feasibleInOffPeak).toBe(false);
            expect(result.deficitKwh).toBeGreaterThan(10);
            expect(result.offPeakWindowHours).toBe(2);
        });
    });
});
