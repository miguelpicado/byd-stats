
import { Charge, Settings, Trip } from '../types';

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
        settings?: Settings,
        predictDeparture?: (ts: number) => Promise<{ departureTime: number; duration: number } | null>
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

        if (!predictDeparture) {
            // Fallback: Basic night slots if AI is active but service missing
            console.warn("AI Charging Logic: No prediction service provided. Fallback to basic night slots.");
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
                note: 'ai_missing'
            };
        }

        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const now = new Date();
        const startOfWeek = new Date(now);
        const currentDay = now.getDay();
        const distToMon = (1 + 7 - currentDay) % 7;
        startOfWeek.setDate(now.getDate() + distToMon);
        startOfWeek.setHours(0, 0, 0, 0);

        const isWeekendTariff = (dIndex: number) => dIndex === 0 || dIndex === 6;

        // Analyze historical trips for weekend gaps
        const dayAvailability = new Map<number, { start: number, end: number }[]>();
        if (trips && trips.length > 5) {
            const dayTrips = new Map<number, { start: number, end: number }[]>();
            trips.forEach(t => {
                const ts = t.start_timestamp || t.end_timestamp;
                if (!ts) return;
                const d = new Date(ts * 1000);
                const dIdx = d.getDay();
                const start = d.getHours() * 60 + d.getMinutes();
                const end = start + (t.duration || 30);
                if (!dayTrips.has(dIdx)) dayTrips.set(dIdx, []);
                dayTrips.get(dIdx)!.push({ start, end });
            });

            days.forEach((_, dIdx) => {
                const tList = dayTrips.get(dIdx);
                if (!tList || tList.length < 2) {
                    dayAvailability.set(dIdx, [{ start: 0, end: 1439 }]);
                    return;
                }
                const minS = Math.min(...tList.map(t => t.start));
                const maxE = Math.max(...tList.map(t => t.end));
                if (maxE - minS > 60) {
                    dayAvailability.set(dIdx, [
                        { start: 0, end: Math.max(0, minS - 30) },
                        { start: Math.min(1439, maxE + 30), end: 1439 }
                    ]);
                } else {
                    dayAvailability.set(dIdx, [{ start: 0, end: 1439 }]);
                }
            });
        }

        const candidates: {
            day: string;
            dayIndex: number;
            startMins: number;
            endMins: number;
            duration: number;
            score: number
        }[] = [];

        // 2. Simulation Loop (The "AI Probe")
        // We simulate hour by hour for 7 days
        for (let d = 0; d < 7; d++) {
            const jsDayIndex = (1 + d) % 7; // Mon(1) -> Sun(0)
            const dayName = days[jsDayIndex];

            // Probe every 3 hours to "discover" stay windows
            for (let h = 0; h < 24; h += 3) {
                const simDate = new Date(startOfWeek);
                simDate.setDate(simDate.getDate() + d);
                simDate.setHours(h, 0, 0, 0);

                const prediction = await predictDeparture(simDate.getTime());
                if (!prediction || prediction.duration < 1.5) continue; // Lower threshold to discover more slots

                const naturalStartMins = h * 60;
                const naturalDurationMins = prediction.duration * 60;

                // Intersect with historical availability
                const avail = dayAvailability.get(jsDayIndex) || [{ start: 0, end: 1439 }];
                avail.forEach(slot => {
                    const start = Math.max(naturalStartMins, slot.start);
                    const end = Math.min(naturalStartMins + naturalDurationMins, slot.end);

                    if (end - start > 60) {
                        // Check overlap with current day valley
                        let tStart = 0, tEnd = 8 * 60;
                        if (isWeekendTariff(jsDayIndex)) tEnd = 24 * 60;

                        const wStart = Math.max(start, tStart);
                        const wEnd = Math.min(end, tEnd);

                        if (wEnd > wStart + 30) {
                            candidates.push({
                                day: dayName,
                                dayIndex: jsDayIndex,
                                startMins: wStart,
                                endMins: wEnd,
                                duration: (wEnd - wStart) / 60,
                                score: (wEnd - wStart) / 60 * (isWeekendTariff(jsDayIndex) ? 2.0 : 0.5)
                            });
                        }
                    }
                });
            }
        }

        // 4. Merge & Apply HITL
        candidates.sort((a, b) => b.score - a.score);
        const deduped: typeof candidates = [];
        candidates.forEach(cand => {
            const exists = deduped.find(d => d.dayIndex === cand.dayIndex && Math.abs(d.startMins - cand.startMins) < 60);
            if (!exists) deduped.push(cand);
        });

        if (settings?.smartChargingPreferences && Array.isArray(settings.smartChargingPreferences) && settings.smartChargingPreferences.length > 0) {
            const daysToOverride = new Set(settings.smartChargingPreferences.filter(p => p.active).map(p => p.day));
            daysToOverride.forEach(dayName => {
                const dayIdx = days.indexOf(dayName);
                if (dayIdx === -1) return;
                for (let i = deduped.length - 1; i >= 0; i--) {
                    if (deduped[i].dayIndex === dayIdx) deduped.splice(i, 1);
                }
            });

            settings.smartChargingPreferences.forEach(pref => {
                if (!pref.active) return;
                const dayIdx = days.indexOf(pref.day);
                if (dayIdx === -1) return;
                const [sH, sM] = pref.start.split(':').map(Number);
                const [eH, eM] = pref.end.split(':').map(Number);
                const sMins = sH * 60 + (sM || 0);
                const eMins = eH * 60 + (eM || 0);
                if (eMins > sMins) {
                    deduped.push({
                        day: pref.day,
                        dayIndex: dayIdx,
                        startMins: sMins,
                        endMins: eMins,
                        duration: (eMins - sMins) / 60,
                        score: 9999
                    });
                }
            });
        }

        // Anchored Selection (Build Backwards)
        const selected: typeof candidates = [];
        let gatheredKwh = 0;

        while (gatheredKwh < targetKwh) {
            let bestCand = null;
            let maxEffectiveScore = -1;

            for (const cand of deduped) {
                if (selected.includes(cand)) continue;

                const hasOverlap = selected.some(s =>
                    s.dayIndex === cand.dayIndex &&
                    Math.max(s.startMins, cand.startMins) < Math.min(s.endMins, cand.endMins)
                );
                if (hasOverlap) continue;

                // Contiguity Bonus
                let bonus = 0;
                const connects = selected.some(s => {
                    if (s.dayIndex === cand.dayIndex) {
                        return Math.abs(s.endMins - cand.startMins) < 5 || Math.abs(s.startMins - cand.endMins) < 5;
                    }
                    if ((s.dayIndex + 1) % 7 === cand.dayIndex) {
                        return s.endMins >= 1435 && cand.startMins <= 5;
                    }
                    if ((cand.dayIndex + 1) % 7 === s.dayIndex) {
                        return cand.endMins >= 1435 && s.startMins <= 5;
                    }
                    return false;
                });

                if (connects) bonus = 50;

                const effectiveScore = cand.score + bonus;
                if (effectiveScore > maxEffectiveScore) {
                    maxEffectiveScore = effectiveScore;
                    bestCand = cand;
                }
            }

            if (!bestCand) break;
            selected.push(bestCand);
            gatheredKwh += bestCand.duration * chargePower;
        }

        // 5. Continuity Pass (Bridge small gaps between adjacent days)
        const MAX_CONTINUITY_GAP = 120; // 2 hours
        for (const cand of selected) {
            // Forward Bridge: If this window ends near midnight and next day starts at 00:00
            const nextDayIdx = (cand.dayIndex + 1) % 7;
            const hasNextStart = selected.some(s => s.dayIndex === nextDayIdx && s.startMins === 0);
            if (hasNextStart && cand.endMins < 1439 && (1440 - cand.endMins) <= MAX_CONTINUITY_GAP) {
                cand.endMins = 1439;
                cand.duration = (cand.endMins - cand.startMins) / 60;
            }

            // Backward Bridge: If this window starts near midnight and previous day ended at 23:59
            const prevDayIdx = (cand.dayIndex + 6) % 7;
            const hasPrevEnd = selected.some(s => s.dayIndex === prevDayIdx && s.endMins >= 1439);
            if (hasPrevEnd && cand.startMins > 0 && cand.startMins <= MAX_CONTINUITY_GAP) {
                cand.startMins = 0;
                cand.duration = (cand.endMins - cand.startMins) / 60;
            }
        }

        // 6. Final Formatting
        const getSortIdx = (d: number) => {
            if (d === 6) return 0; // Sat first
            if (d === 0) return 1; // Sun second
            return d + 1; // Mon...
        };

        selected.sort((a, b) => {
            const idxA = getSortIdx(a.dayIndex);
            const idxB = getSortIdx(b.dayIndex);
            if (idxA !== idxB) return idxA - idxB;
            return a.startMins - b.startMins;
        });

        const formatTime = (vals: number) => {
            const h = Math.floor(vals / 60);
            const m = Math.floor(vals % 60);
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        };

        return {
            windows: selected.map(s => ({
                day: s.day,
                start: formatTime(s.startMins),
                end: formatTime(s.endMins),
                tariffLimit: isWeekendTariff(s.dayIndex) ? "23:59" : "08:00",
                startMins: s.startMins,
                endMins: s.endMins
            })),
            weeklyKwh: targetKwh,
            requiredHours,
            hoursFound: selected.reduce((acc, s) => acc + s.duration, 0)
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
            const capacity = typeof settings.batterySize === 'number' ? settings.batterySize : parseFloat(settings.batterySize);
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
        let lastBalancing = lastCalibrationDate ? new Date(lastCalibrationDate) : undefined;
        if (!lastBalancing && lastSlowChargeDate) {
            // Fallback to last slow charge to 100% if explicit calibration date unknown
            lastBalancing = new Date(lastSlowChargeDate);
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
