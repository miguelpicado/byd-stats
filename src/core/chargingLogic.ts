
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
     * Determines optimal charging windows based on weekly consumption volume and off-peak validation
     * Returns a list of multiple windows if one is not enough to cover the energy needs.
     */
    /**
     * Determines optimal charging windows based on weekly consumption volume and off-peak validation
     * V5: Volume-Based Scheduling
     */
    findSmartChargingWindows: (trips: Trip[], settings?: Settings): { windows: { day: string; start: string; end: string }[]; weeklyKwh: number; note?: string; requiredHours: number; hoursFound: number } | null => {
        if (!trips || trips.length < 3) return null;

        // 1. Calculate Weekly Consumption (Avg last 30 days)
        const ONE_DAY = 24 * 60 * 60 * 1000;
        const now = new Date().getTime();
        const thirtyDaysAgo = now - (30 * ONE_DAY);

        const validTrips = trips
            .filter(t => t.start_timestamp && t.end_timestamp)
            .map(t => ({
                ...t,
                start_ms: (t.start_timestamp || 0) * 1000,
                end_ms: (t.end_timestamp || 0) * 1000
            }))
            .sort((a, b) => a.start_ms - b.start_ms);

        if (validTrips.length === 0) return null;

        const recentTrips = validTrips.filter(t => t.start_ms > thirtyDaysAgo);
        const dataToUse = recentTrips.length > 5 ? recentTrips : validTrips;

        let totalKwh = 0;
        let minTime = now;
        let maxTime = 0;

        dataToUse.forEach(t => {
            totalKwh += (t.electricity || 0);
            if (t.start_ms < minTime) minTime = t.start_ms;
            if (t.start_ms > maxTime) maxTime = t.start_ms;
        });

        const spanMs = Math.max(ONE_DAY, maxTime - minTime);
        const spanDays = spanMs / ONE_DAY;
        const dailyKwh = totalKwh / spanDays;
        const weeklyKwh = dailyKwh * 7;

        // 2. Calculate Required Charging Hours (Volume-Based)
        const amps = settings?.homeChargerRating || 16; // Default to 16A if unknown
        const powerKw = (amps * 230) / 1000;
        const requiredHours = (weeklyKwh / powerKw) * 1.05; // 5% buffer

        // 3. Gap Analysis (Find Parking Windows)
        // We find gaps > 2h
        const gaps: { start: number; end: number; durationH: number }[] = [];
        for (let i = 0; i < validTrips.length - 1; i++) {
            const currentTrip = validTrips[i];
            const nextTrip = validTrips[i + 1];
            const gapMs = nextTrip.start_ms - currentTrip.end_ms;

            if (gapMs > 2 * 60 * 60 * 1000) {
                gaps.push({
                    start: currentTrip.end_ms,
                    end: nextTrip.start_ms,
                    durationH: gapMs / (1000 * 60 * 60)
                });
            }
        }

        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const dayShorts = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

        // Helper to format time "HH:MM"
        const formatTime = (date: Date) => {
            const h = date.getHours().toString().padStart(2, '0');
            const m = date.getMinutes().toString().padStart(2, '0');
            return `${h}:${m}`;
        };

        // 4. Detailed Off-Peak Intersection (Bucket Candidates)
        interface WindowCandidate {
            day: string;
            start: string;
            end: string;
            duration: number; // Duration OF THE CHARGING SESSION (intersection with off-peak)
            gapDuration: number; // Duration of the full parking event
            dayIndex: number;
            uniqueId: string;
        }

        let candidates: WindowCandidate[] = [];

        // Off-Peak check function
        const getOffPeakSchedule = (dayIdx: number) => {
            const isWeekend = dayIdx === 0 || dayIdx === 6;

            // Resolve Start/End independently
            // If weekend specific value is set, use it. Otherwise fallback to general off-peak setting.
            // "00:00" is truthy, only "" or undefined/null are falsy.

            const startStr = (isWeekend && settings?.offPeakStartWeekend)
                ? settings.offPeakStartWeekend
                : (settings?.offPeakStart || "00:00");

            const endStr = (isWeekend && settings?.offPeakEndWeekend)
                ? settings.offPeakEndWeekend
                : (settings?.offPeakEnd || "08:00");

            return { start: startStr, end: endStr };
        };

        if (settings?.offPeakEnabled) {

            // Limit analysis to recently seen gaps to imply "current habits"
            // Or use ALL gaps but then average them?
            // V5: Use recent gaps (last 4 weeks) to simulate "Next Week" availability
            const recentGaps = gaps.slice(-14); // APPROX last 2 weeks of trips

            recentGaps.forEach(g => {
                let current = new Date(g.start);
                const gapEnd = new Date(g.end);

                // Safety loop
                let loopCount = 0;
                while (current < gapEnd && loopCount < 14) {
                    loopCount++;
                    const currentDayStart = new Date(current);
                    currentDayStart.setHours(0, 0, 0, 0);
                    const dayIndex = currentDayStart.getDay();

                    const schedule = getOffPeakSchedule(dayIndex);
                    const [startH, startM] = schedule.start.split(':').map(Number);
                    const [endH, endM] = schedule.end.split(':').map(Number);

                    let wStart = new Date(currentDayStart);
                    wStart.setHours(startH, startM, 0, 0);

                    let wEnd = new Date(currentDayStart);

                    // Special Case: "00:00 to 00:00" means "All Day" (24h)
                    if (startH === 0 && startM === 0 && endH === 0 && endM === 0) {
                        wEnd.setDate(wEnd.getDate() + 1); // Full 24h (Ends 00:00 next day)
                        wEnd.setHours(0, 0, 0, 0);
                    } else {
                        wEnd.setHours(endH, endM, 0, 0);

                        // Handle midnight crossing
                        // Logic: "23:00 - 07:00" -> Starts today 23:00, Ends tomorrow 07:00
                        // Logic: "00:00 - 23:59" -> Starts today 00:00, Ends today 23:59 (Normal)
                        if (wEnd <= wStart) {
                            wEnd.setDate(wEnd.getDate() + 1);
                        }
                    }

                    // Strict Intersection: Gap vs Window
                    const iStart = new Date(Math.max(g.start, wStart.getTime()));
                    const iEnd = new Date(Math.min(g.end, wEnd.getTime()));

                    if (iStart < iEnd) {
                        const durH = (iEnd.getTime() - iStart.getTime()) / (1000 * 60 * 60);
                        if (durH > 0.5) {
                            candidates.push({
                                day: days[iStart.getDay()],
                                dayIndex: iStart.getDay(),
                                start: formatTime(iStart),
                                end: formatTime(iEnd),
                                duration: durH,
                                gapDuration: g.durationH,
                                uniqueId: `${days[iStart.getDay()]}-${formatTime(iStart)}-${formatTime(iEnd)}`
                            });
                        }
                    }

                    // Move to next day relative to START of window
                    current = new Date(wStart);
                    current.setDate(current.getDate() + 1);
                    current.setHours(0, 0, 0, 0); // Reset to midnight next day
                }
            });
        } else {
            // NON-OFF-PEAK Mode (Just assume night charging is preferred 00-08)
            // ... legacy logic, or effectively same logic with fixed 00-08 window
            // For V5 we will skip non-off-peak refinement for now and fallback to simplisitc
            // This branch covers the user request specifically for off-peak constraints.
        }

        // 5. Bucket Filling Algorithm (Consolidated)

        interface ConsolidatedSlot {
            totalDur: number;
            count: number;
            startMins: number; // Avg start time in minutes
            endMins: number; // Avg end time in minutes (can be > 1440 if next day)
            day: string;
            dayIndex: number;
            dayKey: string;
        }

        const consolidated: Record<string, ConsolidatedSlot> = {};

        candidates.forEach(c => {
            const dayKey = c.day;
            const [sH, sM] = c.start.split(':').map(Number);
            const startMins = sH * 60 + sM;

            // Re-calculate End from Duration to be consistent (End = Start + Dur)
            // This handles "+1d" logic naturally via min count
            const endMins = startMins + (c.duration * 60);

            // Fuzzy Merge: Check if we have an existing slot for this day that starts within 2h
            let foundKey: string | null = null;

            Object.keys(consolidated).forEach(k => {
                if (k.startsWith(dayKey)) {
                    const existing = consolidated[k];
                    // Check overlap or proximity (2 hours = 120 mins)
                    if (Math.abs(existing.startMins - startMins) < 120) {
                        foundKey = k;
                    }
                }
            });

            if (foundKey) {
                // Merge
                consolidated[foundKey].totalDur += c.duration;
                // Update Weighted Avg Start/End
                const n = consolidated[foundKey].count;
                consolidated[foundKey].startMins = (consolidated[foundKey].startMins * n + startMins) / (n + 1);
                consolidated[foundKey].endMins = (consolidated[foundKey].endMins * n + endMins) / (n + 1);
                consolidated[foundKey].count++;
            } else {
                // New Slot
                const newKey = `${dayKey}-${startMins}`; // Unique enough
                consolidated[newKey] = {
                    totalDur: c.duration,
                    count: 1,
                    startMins: startMins,
                    endMins: endMins,
                    day: c.day,
                    dayIndex: c.dayIndex,
                    dayKey: dayKey
                };
            }
        });

        // Convert to average available hours per slot
        let availableSlots = Object.values(consolidated).map(c => {
            const avgDur = c.totalDur / c.count;

            // Format Start
            const sH = Math.floor(c.startMins / 60);
            const sM = Math.floor(c.startMins % 60);
            const startStr = `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`;

            // Format End
            // Re-derive End from Start + AvgDuration to ensure it matches the duration shown
            const finalEndMins = c.startMins + (avgDur * 60);
            const eH = Math.floor((finalEndMins % 1440) / 60); // Wrap 24h for time
            const eM = Math.floor((finalEndMins % 1440) % 60);

            let endStr = `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`;

            // Check for day crossing
            if (finalEndMins >= 1440) {
                if (avgDur > 24) {
                    // Find End Day
                    const daysToAdd = Math.floor(finalEndMins / 1440);
                    const endDayIdx = (c.dayIndex + daysToAdd) % 7;
                    endStr = `${days[endDayIdx].substring(0, 3)} ${endStr}`;
                } else if (finalEndMins > 1440) {
                    // Crossed midnight once, < 24h
                    // endStr = `${endStr} (+1d)`; // Optional, user might infer it
                }

                // Fix specific "00:00" alignment if close
                if (eH === 0 && eM === 0) endStr = "00:00";
            }

            return {
                day: c.day,
                start: startStr,
                end: endStr,
                avgDuration: avgDur,
                score: avgDur
            };
        });

        // B. Sort by "Yield" (Longest charging windows first)
        availableSlots.sort((a, b) => b.score - a.score);

        // C. Fill the bucket
        const recommendedWindows: { day: string; start: string; end: string }[] = [];
        let accumulatedHours = 0;

        for (const slot of availableSlots) {
            // Stop if we have enough, BUFFERED by 10% to ensure coverage
            if (accumulatedHours >= requiredHours) break;

            recommendedWindows.push({
                day: slot.day,
                start: slot.start,
                end: slot.end
            });

            accumulatedHours += slot.avgDuration;
        }

        // D. Sort output chronologically
        const dayOrder = (d: string) => days.indexOf(d);
        recommendedWindows.sort((a, b) => dayOrder(a.day) - dayOrder(b.day));

        return {
            windows: recommendedWindows,
            weeklyKwh,
            requiredHours,
            hoursFound: accumulatedHours,
            note: accumulatedHours < requiredHours ? 'insufficient_time' : undefined
        };
    },

    /**
     * Legacy function kept for compatibility if needed, but redirects to smart logic wrapper
     * @deprecated Use findSmartChargingWindows
     */
    findOptimalChargingWindow: (trips: Trip[], settings?: Settings): { day: string; start: string; end: string; confidence: number } | null => {
        const smart = ChargingLogic.findSmartChargingWindows(trips, settings);
        if (smart && smart.windows.length > 0) {
            return {
                day: smart.windows[0].day, // Return primary day
                start: smart.windows[0].start,
                end: smart.windows[0].end,
                confidence: 0.9
            };
        }
        return null;
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
