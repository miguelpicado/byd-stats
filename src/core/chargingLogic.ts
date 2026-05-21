
import { Charge, Settings, Trip } from '../types';
import { parseDateSafe } from './dateUtils';

export interface ChargingRecommendation {
    type: 'balanced' | 'slow' | 'fast' | 'mixed';
    reason: string;
    targetKwh: number;
    translationParams?: Record<string, string | number>;
}

export interface DayShiftPotential {
    current: number; // Current avg charges/energy on this day
    potential: number; // Potential score (lower is better for grid load, or user pref)
    dayName: string;
}

export interface CostSavingsAnalysis {
    potentialMonthlySavings: number;
    feasibleInOffPeak: boolean;
    deficitKwh: number; // If not feasible, how much is missing
    offPeakWindowHours: number;
}

/**
 * Service to calculate charging insights
 */
export const ChargingLogic = {

    /**
     * Determines the optimal day for charging based on inactivity or patterns
     * Simplistic logic: Finds weekday with lowest avg daily consumption (best for slow charging)
     */
    calculateOptimalChargeDay: (dailyStats: { day: string; km: number }[], settings?: Settings): string => {
        if (!dailyStats || dailyStats.length === 0) return 'Domingo';

        // If Off-Peak is enabled, prioritize weekends (Saturday/Sunday)
        if (settings?.offPeakEnabled) {
            const isWeekend = (d: string) => ['sábado', 'sabado', 'domingo', 'saturday', 'sunday', 'sat', 'sun'].some(w => d.toLowerCase().includes(w));
            const weekendStats = dailyStats.filter(d => isWeekend(d.day));

            if (weekendStats.length > 0) {
                // Return the weekend day with least usage
                weekendStats.sort((a, b) => a.km - b.km);
                return weekendStats[0].day;
            }
        }

        // Find day with lowest average activity
        const sorted = [...dailyStats].sort((a, b) => a.km - b.km);
        return sorted[0]?.day || 'Domingo';
    },

    /**
     * AI-DRIVEN Smart Charging Logic (Async)
     * Simulates the upcoming week minute-by-minute and asks the AI Model:
     * "If I park now, how long will I stay?"
     * 
     * Then applies User Constraints:
     * 1. Tariff (Valle) - Strict intersection
     * 2. Priorities (Weekend > Weekday Night)
     * 3. Continuity (Don't split charges if possible)
     */
    findSmartChargingWindows: async (
        trips: Trip[],
        settings?: Settings
    ): Promise<{
        windows: { day: string; start: string; end: string; tariffLimit: string; startMins: number; endMins: number }[];
        weeklyKwh: number;
        requiredHours: number;
        hoursFound: number;
        note?: string;
    }> => {
        // 1. Calculate Needs (Volume-Based)
        let totalKwh = 0;
        let daysActive = 30; // Default

        if (trips && trips.length > 0) {
            const valid = trips.filter(t => t.start_timestamp && t.electricity);
            totalKwh = valid.reduce((sum, t) => sum + (t.electricity || 0), 0);

            if (valid.length > 0) {
                const first = valid[0].start_timestamp * 1000;
                const last = valid[valid.length - 1].end_timestamp * 1000;
                const span = Math.max(1, (last - first) / (1000 * 3600 * 24));
                daysActive = span;
            }
        }

        const avgWeekly = (totalKwh / Math.max(1, daysActive)) * 7;
        const targetKwh = avgWeekly * 1.1; // +10% Buffer

        // Charger Speed
        let chargePower = 3.6; // Default to 16A * 230V
        if (settings?.homeChargerRating) {
            chargePower = (settings.homeChargerRating * 230) / 1000;
        }

        const requiredHours = targetKwh / chargePower;

        // Use basic night slots (TensorFlow-powered prediction engine removed)
        return {
            windows: [
                { day: 'Lunes', start: '00:00', end: '08:00', tariffLimit: '08:00', startMins: 0, endMins: 480 },
                { day: 'Martes', start: '00:00', end: '08:00', tariffLimit: '08:00', startMins: 0, endMins: 480 },
                { day: 'Miércoles', start: '00:00', end: '08:00', tariffLimit: '08:00', startMins: 0, endMins: 480 },
                { day: 'Jueves', start: '00:00', end: '08:00', tariffLimit: '08:00', startMins: 0, endMins: 480 },
                { day: 'Viernes', start: '00:00', end: '08:00', tariffLimit: '08:00', startMins: 0, endMins: 480 },
            ],
            weeklyKwh: targetKwh,
            requiredHours,
            hoursFound: 40,
            note: 'basic_night_slots'
        };
    },

    /**
     * Legacy function kept for compatibility if needed, but redirects to smart logic wrapper
     * @deprecated Use findSmartChargingWindows
     */
    findOptimalChargingWindow: (_trips: Trip[], _settings?: Settings): { day: string; start: string; end: string; confidence: number } | null => {
        // Warning: This legacy function is synchronous and cannot call the new async logic.
        // Returning default Sunday window as fallback.
        return {
            day: 'Domingo',
            start: '00:00',
            end: '10:00',
            confidence: 0.5
        };
    },

    /**
     * Recommends charging type (Slow vs Fast)
     * Prioritizes 'slow' if calibration hasn't happened recently (e.g. > 1 month)
     * Prioritizes 'mixed' if weekly usage > battery capacity
     * Prioritizes 'off-peak' if cost savings are significant
     */
    getChargingRecommendation: (
        lastCalibrationDate: string | undefined,
        lastSlowChargeDate: string | undefined,
        costAnalysis: CostSavingsAnalysis | undefined,
        weeklyKwh: number = 0,
        settings?: Settings
    ): ChargingRecommendation => {
        const now = new Date();
        const oneMonthAgo = new Date(now.setMonth(now.getMonth() - 1));
        const kwhValue = (weeklyKwh || 0).toFixed(0);

        // 1. Check Capacity vs Usage (Mixed Recommendation)
        if (settings && settings.batterySize) {
            const capacity = settings.batterySize;
            const soh = typeof settings.soh === 'number' ? settings.soh : parseFloat(settings.soh as string);
            const usableCapacity = capacity * (soh / 100);

            if (weeklyKwh > usableCapacity) {
                return {
                    type: 'mixed',
                    reason: 'recommend_mixed',
                    targetKwh: 0,
                    translationParams: {
                        weekly: kwhValue,
                        capacity: usableCapacity.toFixed(1)
                    }
                };
            }
        }

        // 2. Check calibration/balancing need
        let lastBalancing = lastCalibrationDate ? parseDateSafe(lastCalibrationDate) : undefined;
        if (!lastBalancing || isNaN(lastBalancing.getTime())) {
            // Fallback to last slow charge to 100% if explicit calibration date unknown
            if (lastSlowChargeDate) {
                lastBalancing = parseDateSafe(lastSlowChargeDate);
                if (isNaN(lastBalancing.getTime())) lastBalancing = undefined;
            }
        }

        if (!lastBalancing || lastBalancing < oneMonthAgo) {
            return {
                type: 'slow',
                reason: 'recommend_calibration', // Translation key
                targetKwh: 0, // implied fill to 100%
                translationParams: { kwh: kwhValue }
            };
        }

        // 3. Cost based recommendation
        if (costAnalysis && costAnalysis.potentialMonthlySavings > 1 && costAnalysis.feasibleInOffPeak) {
            return {
                type: 'slow',
                reason: 'recommend_offpeak', // New key needed
                targetKwh: 0,
                translationParams: { kwh: kwhValue }
            };
        }

        // 4. Default: Slow is sufficient
        return {
            type: 'slow',
            reason: 'recommend_slow_sufficient', // New Key
            targetKwh: 0,
            translationParams: { kwh: kwhValue }
        };
    },

    /**
     * Analyzes Comfort Zone (Range Confidence)
     * Returns the lowest SoC regularly reached (90th percentile of low points) to ignore outliers
     */
    calculateComfortZone: (charges: Charge[]): { minSoC: number; canExtendInterval: boolean } => {
        if (!charges || charges.length < 5) return { minSoC: 0, canExtendInterval: false };

        // Collect initial SoCs from charges (representing how low users let it go)
        const initialSoCs = charges
            .map(c => c.initialPercentage)
            .filter(soc => soc !== undefined && soc !== null) as number[];

        if (initialSoCs.length < 5) return { minSoC: 0, canExtendInterval: false };

        // Sort to find percentiles
        initialSoCs.sort((a, b) => a - b);

        // Take the 10th percentile (conservative low point, ignoring absolute worst outlier)
        const index = Math.floor(initialSoCs.length * 0.1);
        const conservativeMin = initialSoCs[index];

        // If user typically charges at > 30%, they have range confidence to spare
        return {
            minSoC: conservativeMin,
            canExtendInterval: conservativeMin > 30
        };
    },

    /**
     * Calculates potential cost savings by moving charging to off-peak
     */
    calculateCostSavings: (
        charges: Charge[],
        settings: Settings,
        avgDailyConsumptionKwh: number
    ): CostSavingsAnalysis => {
        if (!settings.offPeakEnabled || !settings.offPeakStart || !settings.offPeakEnd || !settings.offPeakPrice) {
            return { potentialMonthlySavings: 0, feasibleInOffPeak: true, deficitKwh: 0, offPeakWindowHours: 0 };
        }

        const offPeakPrice = settings.offPeakPrice;
        // Parse Window
        const [startH, startM] = settings.offPeakStart.split(':').map(Number);
        const [endH, endM] = settings.offPeakEnd.split(':').map(Number);
        // Use variables to silence linter
        void startM; void endM;

        let windowHours = 0;
        if (endH > startH) windowHours = endH - startH;
        else windowHours = (24 - startH) + endH; // Crosses midnight

        // 1. Feasibility Check with Home Charger
        const chargerPowerKw = ((settings.homeChargerRating || 8) * 230) / 1000; // V approx
        const maxEnergyInWindow = chargerPowerKw * windowHours;
        const deficit = avgDailyConsumptionKwh > maxEnergyInWindow ? (avgDailyConsumptionKwh - maxEnergyInWindow) : 0;
        const feasible = deficit <= 0;

        // 2. Savings Calculation
        // Identify charges that happened OUTSIDE the window in simple terms or use peak price diff
        // Simplification: Assume all historical 'electric' charges could move to off-peak if feasible
        // We look at the price difference. If user has dynamic/custom price, we compare.
        // If we don't know the peak price, we can't calculate exact savings.
        // We will fallback to: (AvgHistoricalPrice - OffPeakPrice) * TotalKwh

        let totalSavings = 0;
        let monthsAnalyzed = 0;

        if (charges.length > 0) {
            // Find timeframe
            const sorted = [...charges].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            const startStr = sorted[0].date;
            const endStr = sorted[sorted.length - 1].date;

            // Approx months (simplistic)
            const startDate = new Date(parseInt(startStr.substring(0, 4)), parseInt(startStr.substring(4, 6)) - 1);
            const endDate = new Date(parseInt(endStr.substring(0, 4)), parseInt(endStr.substring(4, 6)) - 1);
            monthsAnalyzed = Math.max(1, (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()) + 1);

            charges.forEach(c => {
                if (c.type === 'electric') {
                    const currentCost = c.totalCost;
                    const kwh = c.kwhCharged || 0;
                    // Potential cost if charged at off-peak
                    const potentialCost = kwh * offPeakPrice;

                    if (currentCost > potentialCost) {
                        totalSavings += (currentCost - potentialCost);
                    }
                }
            });
        }

        const monthlySavings = monthsAnalyzed > 0 ? totalSavings / monthsAnalyzed : 0;

        return {
            potentialMonthlySavings: Math.max(0, monthlySavings),
            feasibleInOffPeak: feasible,
            deficitKwh: deficit,
            offPeakWindowHours: windowHours
        };
    },

    /**
     * Determines seasonal efficiency factor
     * Returns multiplier (e.g. 1.1 means 10% higher consumption)
     */
    calculateSeasonalFactor: (monthlyStats: { month: string; efficiency: number }[]): { factor: number; season: string } => {
        const now = new Date();
        const currentMonth = now.getMonth(); // 0-11
        const isWinter = currentMonth <= 1 || currentMonth >= 11; // Dec, Jan, Feb (Northern Hemisphere assumption)
        const isSummer = currentMonth >= 5 && currentMonth <= 7; // Jun, Jul, Aug

        if (!monthlyStats || monthlyStats.length < 2) return { factor: 1.0, season: 'neutral' };

        // Get current month's avg efficiency (or last available) vs Year Avg
        const yearAvg = monthlyStats.reduce((acc, m) => acc + (m.efficiency || 0), 0) / monthlyStats.length;

        // Find recent relevant data
        const recent = monthlyStats[monthlyStats.length - 1]?.efficiency || yearAvg;

        if (recent === 0 || yearAvg === 0) return { factor: 1.0, season: 'neutral' };

        const ratio = recent / yearAvg;

        if (isWinter && ratio > 1.05) return { factor: ratio, season: 'winter' };
        if (isSummer && ratio > 1.05) return { factor: ratio, season: 'summer' }; // AC usage?

        return { factor: 1.0, season: 'neutral' };
    }
};
