// BYD Stats - Data Processing Utilities

import { BYD_RED } from './constants';
// @ts-ignore
import { formatMonth, formatDate } from './dateUtils';
import { Trip, Charge, ProcessedData, Summary, MonthlyData, DailyData, Settings } from '../types';
import { calculateAdvancedSoH } from './batteryCalculations.ts';

interface AggregatedStats {
    totalKm: number;
    totalKwh: number;
    drivingKwh: number;
    stationaryKwh: number;
    totalFuel: number;
    totalDuration: number;
    hasAnyFuel: boolean;
    electricOnlyKm: number;
    fuelUsedKm: number;
    electricOnlyTrips: number;
    fuelUsedTrips: number;
    maxKmVal: number;
    minKmVal: number;
    maxKwhVal: number;
    maxDurVal: number;
    maxFuelVal: number;
    maxCostVal: number;
    maxCostDate: string | null;
}

interface PriceStrategies {
    elec: { strategy: string; custom: number; avg: number; processed: Charge[] };
    fuel: { strategy: string; custom: number; avg: number; processed: Charge[] };
}

/**
 * Checks if a trip is considered stationary (distance < 0.5km)
 */
export const isStationaryTrip = (trip: Trip): boolean => (trip.trip || 0) < 0.5;

// Helper to get top N items without full sort - O(N) for small K
function getTopN<T>(arr: T[], compareFn: (a: T, b: T) => number, n: number): T[] {
    if (arr.length <= n) return [...arr].sort(compareFn);

    // Sort first N items
    const result = arr.slice(0, n).sort(compareFn);

    // Process remaining items
    for (let i = n; i < arr.length; i++) {
        const item = arr[i];
        if (compareFn(item, result[n - 1]) < 0) {
            let j = n - 2;
            while (j >= 0 && compareFn(item, result[j]) < 0) {
                result[j + 1] = result[j];
                j--;
            }
            result[j + 1] = item;
        }
    }
    return result;
}

// Helper to determine cost based on strategy
function getPriceForTrip(trip: Trip, strategy: string, customPrice: number, avgPrice: number, processedCharges: Charge[]): number {
    if (strategy === 'custom') return customPrice;

    if (strategy === 'average') {
        return avgPrice > 0 ? avgPrice : customPrice;
    }

    // Dynamic Strategy: Find last charge before trip start
    if (processedCharges && processedCharges.length > 0) {
        const tripStart = trip.start_timestamp || 0;
        let lastCharge: Charge | null = null;

        for (let i = processedCharges.length - 1; i >= 0; i--) {
            const charge = processedCharges[i];
            const chargeTs = charge.timestamp || 0;
            if (chargeTs < tripStart) {
                lastCharge = charge;
                break;
            }
        }

        if (lastCharge && lastCharge.effectivePrice !== undefined) {
            return lastCharge.effectivePrice;
        }
    }

    return customPrice;
}

/**
 * Formats and pre-processes price settings and charges for lookup
 */
function preparePriceStrategies(priceSettings: Settings, charges: Charge[]): PriceStrategies {
    const elecStrategy = priceSettings.electricStrategy || 'custom';
    const fuelStrategy = priceSettings.fuelStrategy || 'custom';
    const elecCustomPrice = typeof priceSettings.electricPrice === 'string' ? parseFloat(priceSettings.electricPrice) : (priceSettings.electricPrice || 0);
    const fuelCustomPrice = typeof priceSettings.fuelPrice === 'string' ? parseFloat(priceSettings.fuelPrice) : (priceSettings.fuelPrice || 0);

    let elecAvgPrice = 0;
    let fuelAvgPrice = 0;
    let processedElectricCharges: Charge[] = [];
    let processedFuelCharges: Charge[] = [];

    if (charges && charges.length > 0) {
        const eCharges = charges.filter(c => !c.type || c.type === 'electric');
        const fCharges = charges.filter(c => c.type === 'fuel');

        const eKwh = eCharges.reduce((s, c) => s + (c.kwhCharged || 0), 0);
        if (eKwh > 0) elecAvgPrice = eCharges.reduce((s, c) => s + (c.totalCost || 0), 0) / eKwh;

        const fLiters = fCharges.reduce((s, c) => s + (c.litersCharged || 0), 0);
        if (fLiters > 0) fuelAvgPrice = fCharges.reduce((s, c) => s + (c.totalCost || 0), 0) / fLiters;

        if (elecStrategy === 'dynamic') {
            processedElectricCharges = eCharges.map(c => {
                const ts = new Date(`${c.date}T${c.time || "00:00"}:00`).getTime() / 1000;
                return { ...c, timestamp: ts, effectivePrice: c.kwhCharged > 0 ? (c.totalCost / c.kwhCharged) : 0 };
            }).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        }

        if (fuelStrategy === 'dynamic') {
            processedFuelCharges = fCharges.map(c => {
                const ts = new Date(`${c.date}T${c.time || "00:00"}:00`).getTime() / 1000;
                return { ...c, timestamp: ts, effectivePrice: (c.litersCharged || 0) > 0 ? (c.totalCost / (c.litersCharged || 1)) : 0 };
            }).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        }
    }

    return {
        elec: { strategy: elecStrategy, custom: elecCustomPrice, avg: elecAvgPrice, processed: processedElectricCharges },
        fuel: { strategy: fuelStrategy, custom: fuelCustomPrice, avg: fuelAvgPrice, processed: processedFuelCharges }
    };
}

/**
 * Calculates the cost for a single trip based on current price strategies
 */
function calculateTripCost(trip: Trip, strategies: PriceStrategies): number {
    const tElec = trip.electricity || 0;
    const tFuel = trip.fuel || 0;

    const ePrice = getPriceForTrip(trip, strategies.elec.strategy, strategies.elec.custom, strategies.elec.avg, strategies.elec.processed);
    const fPrice = getPriceForTrip(trip, strategies.fuel.strategy, strategies.fuel.custom, strategies.fuel.avg, strategies.fuel.processed);

    const tripCost = (tElec * ePrice) + (tFuel * fPrice);

    // Decorate trip object with cost details
    trip.calculatedCost = tripCost;
    trip.electricCost = tElec * ePrice;
    trip.fuelCost = tFuel * fPrice;

    return tripCost;
}

/**
 * Updates aggregators and stats with trip data
 */
function updateAggregators(
    trip: Trip,
    tStats: AggregatedStats,
    monthlyData: Record<string, MonthlyData>,
    dailyData: Record<string, DailyData>,
    uniqueDates: Set<string>,
    hourlyData: { hour: number; trips: number; km: number }[],
    weekdayData: { day: string; trips: number; km: number }[],
    tripDistribution: { range: string; count: number; color: string }[],
    efficiencyScatter: { x: number; y: number; fuel: number }[]
) {
    const tTrip = trip.trip || 0;
    const tElec = trip.electricity || 0;
    const tFuel = trip.fuel || 0;
    const tDur = trip.duration || 0;
    const tripCost = trip.calculatedCost || 0;

    tStats.totalKm += tTrip;
    tStats.drivingKwh += tElec;
    tStats.totalKwh += tElec;
    tStats.totalFuel += tFuel;
    tStats.totalDuration += tDur;

    if (tFuel > 0) {
        tStats.fuelUsedKm += tTrip;
        tStats.fuelUsedTrips++;
        if (tFuel > tStats.maxFuelVal) tStats.maxFuelVal = tFuel;
    } else {
        tStats.electricOnlyKm += tTrip;
        tStats.electricOnlyTrips++;
    }

    if (tripCost > tStats.maxCostVal) { tStats.maxCostVal = tripCost; tStats.maxCostDate = trip.date; }
    if (tTrip > tStats.maxKmVal) tStats.maxKmVal = tTrip;
    if (tTrip < tStats.minKmVal) tStats.minKmVal = tTrip;
    if (tElec > tStats.maxKwhVal) tStats.maxKwhVal = tElec;
    if (tDur > tStats.maxDurVal) tStats.maxDurVal = tDur;

    // Period Aggregation
    const m = trip.month || 'unknown';
    if (!monthlyData[m]) monthlyData[m] = { month: m, trips: 0, km: 0, kwh: 0, fuel: 0 };
    monthlyData[m].trips++; monthlyData[m].km += tTrip; monthlyData[m].kwh += tElec; monthlyData[m].fuel += tFuel;

    const d = trip.date || 'unknown';
    uniqueDates.add(d);
    if (!dailyData[d]) dailyData[d] = { date: d, trips: 0, km: 0, kwh: 0, fuel: 0 };
    dailyData[d].trips++; dailyData[d].km += tTrip; dailyData[d].kwh += tElec; dailyData[d].fuel += tFuel;

    if (trip.start_timestamp) {
        const dt = new Date(trip.start_timestamp * 1000);
        const h = dt.getHours();
        if (!isNaN(h)) { hourlyData[h].trips++; hourlyData[h].km += tTrip; }
        const weekdayIndex = (dt.getDay() + 6) % 7;
        weekdayData[weekdayIndex].trips++; weekdayData[weekdayIndex].km += tTrip;
    }

    if (tTrip <= 5) tripDistribution[0].count++;
    else if (tTrip <= 15) tripDistribution[1].count++;
    else if (tTrip <= 30) tripDistribution[2].count++;
    else if (tTrip <= 50) tripDistribution[3].count++;
    else tripDistribution[4].count++;

    if (tTrip > 0 && tElec > 0) {
        const y = (tElec / tTrip) * 100;
        if (y > 0 && y < 50) efficiencyScatter.push({ x: tTrip, y, fuel: tFuel });
    }
}

/**
 * Generates the final summary object
 */
function finalizeSummary(
    stats: AggregatedStats,
    validTrips: Trip[],
    daysActive: number,
    totalDays: number,
    allTrips: Trip[],
    settings: Settings = {} as Settings,
    charges: Charge[] = [],
    language: string = 'es'
): Summary {
    const firstTrip = allTrips[0];
    const lastTrip = allTrips[allTrips.length - 1];
    const avgEffVal = stats.totalKm > 0 ? (stats.drivingKwh / stats.totalKm * 100) : 0;
    const batterySize = typeof settings.batterySize === 'string' ? parseFloat(settings.batterySize) : (settings.batterySize || 0);
    let soh = typeof settings.soh === 'string' ? parseFloat(settings.soh) : (settings.soh || 100);
    let sohData = null;

    // Advanced SoH Calculation
    if (settings.mfgDate) {
        sohData = calculateAdvancedSoH(charges, settings.mfgDate, batterySize, settings.chargerTypes, settings.thermalStressFactor || 1.0);
        if (settings.sohMode === 'calculated') {
            soh = sohData.estimated_soh;
        }
    }

    // Calculate Estimated Range: (Effective Battery Energy / Efficiency) * 100
    // Effective Battery = batterySize * (SoH / 100)
    const effectiveBattery = batterySize * (soh / 100);
    const estimatedRange = (effectiveBattery > 0 && avgEffVal > 0)
        ? (effectiveBattery / avgEffVal * 100).toFixed(0)
        : '0';

    const estimatedRangeHighway = (effectiveBattery > 0 && avgEffVal > 0)
        ? (effectiveBattery / (avgEffVal * 1.2) * 100).toFixed(0)
        : '0';

    const estimatedRangeCity = (effectiveBattery > 0 && avgEffVal > 0)
        ? (effectiveBattery / (avgEffVal * 0.8) * 100).toFixed(0)
        : '0';

    return {
        totalTrips: validTrips.length,
        totalKm: stats.totalKm.toFixed(1),
        totalKwh: stats.totalKwh.toFixed(1),
        drivingKwh: stats.drivingKwh.toFixed(1),
        stationaryConsumption: stats.stationaryKwh.toFixed(1),
        totalHours: (stats.totalDuration / 3600).toFixed(1),
        avgEff: avgEffVal.toFixed(2),
        estimatedRange,
        estimatedRangeHighway,
        estimatedRangeCity,
        avgKm: validTrips.length > 0 ? (stats.totalKm / validTrips.length).toFixed(1) : '0',
        avgMin: stats.totalDuration > 0 ? (stats.totalDuration / validTrips.length / 60).toFixed(0) : '0',
        avgSpeed: stats.totalDuration > 0 ? (stats.totalKm / (stats.totalDuration / 3600)).toFixed(1) : '0',
        daysActive,
        totalDays,
        dateRange: firstTrip && lastTrip ? `${formatDate(firstTrip.date, language)} - ${formatDate(lastTrip.date, language)}` : '',
        maxKm: stats.maxKmVal > -Infinity ? stats.maxKmVal.toFixed(1) : '0.0',
        minKm: stats.minKmVal < Infinity ? stats.minKmVal.toFixed(1) : '0.0',
        maxKwh: stats.maxKwhVal > -Infinity ? stats.maxKwhVal.toFixed(1) : '0.0',
        maxMin: stats.maxDurVal > -Infinity ? (stats.maxDurVal / 60).toFixed(0) : '0',
        tripsDay: (validTrips.length / daysActive).toFixed(1),
        kmDay: (stats.totalKm / daysActive).toFixed(1),
        isHybrid: stats.hasAnyFuel,
        totalFuel: stats.totalFuel.toFixed(2),
        avgFuelEff: stats.totalKm > 0 ? (stats.totalFuel / stats.totalKm * 100).toFixed(2) : '0',
        electricPercentage: stats.totalKm > 0 ? (stats.electricOnlyKm / stats.totalKm * 100).toFixed(1) : '100',
        fuelPercentage: stats.totalKm > 0 ? (stats.fuelUsedKm / stats.totalKm * 100).toFixed(1) : '0',
        electricOnlyTrips: stats.electricOnlyTrips,
        fuelUsedTrips: stats.fuelUsedTrips,
        evModeUsage: validTrips.length > 0 ? (stats.electricOnlyTrips / validTrips.length * 100).toFixed(1) : '100',
        maxFuel: stats.maxFuelVal.toFixed(2),
        maxCost: stats.maxCostVal > -Infinity ? stats.maxCostVal.toFixed(2) : '0.00',
        maxCostDate: stats.maxCostDate || '',
        soh: soh,
        sohData: sohData
    };
}

/**
 * Core data processing function
 * Processes raw trip data into statistics and aggregated data
 */
export function processData(rows: Trip[], priceSettings: Settings = {} as Settings, charges: Charge[] = [], language: string = 'es'): ProcessedData | null {
    if (!rows || rows.length === 0) return null;

    const strategies = preparePriceStrategies(priceSettings, charges);
    const allTrips = rows.filter(r => r && typeof r.trip === 'number' && r.trip >= 0);
    if (allTrips.length === 0) return null;

    // Aggregators & Stats
    const stats: AggregatedStats = {
        totalKm: 0, totalKwh: 0, drivingKwh: 0, stationaryKwh: 0, totalFuel: 0, totalDuration: 0,
        hasAnyFuel: false, electricOnlyKm: 0, fuelUsedKm: 0, electricOnlyTrips: 0, fuelUsedTrips: 0,
        maxKmVal: -Infinity, minKmVal: Infinity, maxKwhVal: -Infinity, maxDurVal: -Infinity, maxFuelVal: 0,
        maxCostVal: -Infinity, maxCostDate: null
    };

    const monthlyData: Record<string, MonthlyData> = {};
    const dailyData: Record<string, DailyData> = {};
    const uniqueDates = new Set<string>();
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({ hour: i, trips: 0, km: 0 }));
    const weekdayData = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => ({ day: d, trips: 0, km: 0 }));
    const tripDistribution = [
        { range: '0-5', count: 0, color: '#06b6d4' }, { range: '5-15', count: 0, color: '#10b981' },
        { range: '15-30', count: 0, color: '#f59e0b' }, { range: '30-50', count: 0, color: BYD_RED },
        { range: '50+', count: 0, color: '#8b5cf6' }
    ];
    const efficiencyScatter: { x: number; y: number; fuel: number }[] = [];
    const validTrips: Trip[] = [];

    // Main Processing Loop
    for (const trip of allTrips) {
        const tripCost = calculateTripCost(trip, strategies);

        if ((trip.fuel || 0) > 0) stats.hasAnyFuel = true;

        if (isStationaryTrip(trip)) {
            stats.stationaryKwh += (trip.electricity || 0);
            stats.totalKwh += (trip.electricity || 0);
            stats.totalFuel += (trip.fuel || 0);
            if (tripCost > stats.maxCostVal) { stats.maxCostVal = tripCost; stats.maxCostDate = trip.date; }
            continue;
        }

        // Process active trip
        validTrips.push(trip);
        updateAggregators(trip, stats, monthlyData, dailyData, uniqueDates, hourlyData, weekdayData, tripDistribution, efficiencyScatter);
    }

    // Post-Processing & Finalization
    const monthlyArray = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    monthlyArray.forEach(m => {
        m.efficiency = m.km > 0 ? (m.kwh / m.km * 100) : 0;
        m.fuelEfficiency = m.km > 0 ? (m.fuel / m.km * 100) : 0;
        m.monthLabel = formatMonth(m.month, language);
    });

    const dailyArray = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
    dailyArray.forEach(d => {
        d.efficiency = d.km > 0 ? (d.kwh / d.km * 100) : 0;
        d.fuelEfficiency = d.km > 0 ? (d.fuel / d.km * 100) : 0;
        d.dateLabel = formatDate(d.date, language);
    });

    allTrips.sort((a, b) => (a.start_timestamp || 0) - (b.start_timestamp || 0));
    validTrips.sort((a, b) => (a.start_timestamp || 0) - (b.start_timestamp || 0));

    const topRecords = {
        km: getTopN(validTrips, (a, b) => (b.trip || 0) - (a.trip || 0), 10),
        kwh: getTopN(validTrips, (a, b) => (b.electricity || 0) - (a.electricity || 0), 10),
        dur: getTopN(validTrips, (a, b) => (b.duration || 0) - (a.duration || 0), 10),
        fuel: stats.hasAnyFuel ? getTopN(validTrips.filter(t => (t.fuel || 0) > 0), (a, b) => (b.fuel || 0) - (a.fuel || 0), 10) : []
    };

    const daysActive = uniqueDates.size || 1;
    const firstTs = allTrips[0]?.start_timestamp;
    const lastTs = allTrips[allTrips.length - 1]?.start_timestamp;
    const totalDays = (firstTs && lastTs) ? Math.max(1, Math.ceil((lastTs - firstTs) / (24 * 3600)) + 1) : daysActive;

    const summary = finalizeSummary(stats, validTrips, daysActive, totalDays, allTrips, priceSettings, charges, language);

    return {
        summary,
        monthly: monthlyArray,
        daily: dailyArray,
        hourly: hourlyData,
        weekday: weekdayData,
        tripDist: tripDistribution,
        effScatter: efficiencyScatter,
        top: topRecords,
        isHybrid: stats.hasAnyFuel
    };
}
