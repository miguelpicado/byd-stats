// BYD Stats - Data Processing Worker (v21 - TensorFlow Isolated)
import * as Comlink from 'comlink';
import { processData } from '../core/dataProcessing';
import type { TensorFlowWorkerApi } from './tensorflowWorker';
import type { Trip, Settings, Charge } from '../types';

// TensorFlow Worker (lazy loaded, isolated in its own worker)
let tfWorker: Comlink.Remote<TensorFlowWorkerApi> | null = null;

async function getTfWorker() {
    if (!tfWorker) {
        const worker = new Worker(
            new URL('./tensorflowWorker.ts', import.meta.url),
            { type: 'module' }
        );
        tfWorker = Comlink.wrap<TensorFlowWorkerApi>(worker);
    }
    return tfWorker;
}

/**
 * AI-DRIVEN Smart Charging Logic (Worker Implementation)
 * Moved here to offload the O(n^3) simulation loop from the main thread.
 */
async function findSmartChargingWindows(
    trips: Trip[],
    settings: Settings
): Promise<{
    windows: { day: string; start: string; end: string; tariffLimit: string; startMins: number; endMins: number }[];
    weeklyKwh: number;
    requiredHours: number;
    hoursFound: number;
    note?: string;
}> {
    const tf = await getTfWorker();

    // 1. Calculate Needs (Volume-Based)
    let totalKwh = 0;
    let daysActive = 30; // Default

    if (trips && trips.length > 0) {
        // Calculate electricity from SoC if not directly available
        const tripsWithElectricity = trips.map(t => {
            if (t.electricity) return t;

            // Try to calculate from SoC difference
            if (t.start_soc && t.end_soc && settings?.batterySize) {
                const batterySize = typeof settings.batterySize === 'number'
                    ? settings.batterySize
                    : parseFloat(settings.batterySize as string);
                const socDiff = t.start_soc - t.end_soc;
                const calculatedKwh = (socDiff / 100) * batterySize;
                return { ...t, electricity: calculatedKwh };
            }

            return t;
        });

        const valid = tripsWithElectricity.filter(t => t.start_timestamp && t.electricity);

        totalKwh = valid.reduce((sum, t) => sum + (t.electricity || 0), 0);

        if (valid.length > 0) {
            // Sort by start_timestamp to get proper date range
            const sorted = [...valid].sort((a, b) => (a.start_timestamp || 0) - (b.start_timestamp || 0));
            const first = sorted[0].start_timestamp! * 1000;
            // Use end_timestamp if available, otherwise fall back to start_timestamp
            const lastTrip = sorted[sorted.length - 1];
            const last = (lastTrip.end_timestamp || lastTrip.start_timestamp!) * 1000;
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
    // Check if model is trained by probing current time
    const probe = await tf.predictDeparture(Date.now());
    if (!probe && trips.length > 5) {
        // Auto-train if missing
        await tf.trainParking(trips);
    }

    // We simulate hour by hour for 7 days
    for (let d = 0; d < 7; d++) {
        const jsDayIndex = (1 + d) % 7; // Mon(1) -> Sun(0)
        const dayName = days[jsDayIndex];

        // Probe every 3 hours to "discover" stay windows
        for (let h = 0; h < 24; h += 3) {
            const simDate = new Date(startOfWeek);
            simDate.setDate(simDate.getDate() + d);
            simDate.setHours(h, 0, 0, 0);

            // Delegate to TF worker
            const prediction = await tf.predictDeparture(simDate.getTime());
            if (!prediction || prediction.duration < 1.5) continue;

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

    type ChargingPref = { day: string; start: string; end: string; active: boolean };
    if (settings?.smartChargingPreferences && Array.isArray(settings.smartChargingPreferences) && settings.smartChargingPreferences.length > 0) {
        const prefs = settings.smartChargingPreferences as ChargingPref[];
        const daysToOverride = new Set(prefs.filter((p) => p.active).map((p) => p.day));
        daysToOverride.forEach(dayName => {
            const dayIdx = days.indexOf(dayName);
            if (dayIdx === -1) return;
            for (let i = deduped.length - 1; i >= 0; i--) {
                if (deduped[i].dayIndex === dayIdx) deduped.splice(i, 1);
            }
        });

        prefs.forEach((pref) => {
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
}

const api = {
    processData,

    // AI Methods - delegated to TensorFlow worker
    async trainModel(trips: Trip[]) {
        const tf = await getTfWorker();
        return tf.trainEfficiency(trips);
    },

    async getRangeScenarios(batteryCapacity: number, soh: number) {
        const tf = await getTfWorker();
        return tf.getRangeScenarios(batteryCapacity, soh);
    },

    async trainSoH(charges: Charge[], capacity: number) {
        const tf = await getTfWorker();
        return tf.trainSoH(charges, capacity);
    },

    async getSoHStats(charges: Charge[], capacity: number) {
        const tf = await getTfWorker();
        return tf.getSoHStats(charges, capacity);
    },

    async trainParking(trips: Trip[]) {
        const tf = await getTfWorker();
        return tf.trainParking(trips);
    },

    async predictDeparture(startTime: number) {
        const tf = await getTfWorker();
        return tf.predictDeparture(startTime);
    },

    findSmartChargingWindows,

    async exportParkingModel() {
        const tf = await getTfWorker();
        return tf.exportParkingModel();
    },

    async importParkingModel(weights: { data: number[]; shape: number[] }[]) {
        const tf = await getTfWorker();
        return tf.importParkingModel(weights);
    },

    async dispose() {
        if (tfWorker) {
            await tfWorker.dispose();
        }
    }
};

// Expose the API to the main thread
Comlink.expose(api);

export type DataWorkerApi = typeof api;
