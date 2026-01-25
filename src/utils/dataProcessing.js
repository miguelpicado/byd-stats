// BYD Stats - Data Processing Utilities

import { BYD_RED } from './constants';
import { formatMonth, formatDate } from './dateUtils';
import { logger } from './logger';

/**
 * @typedef {Object} Trip
 * @property {string} date - Date in YYYYMMDD format
 * @property {number} trip - Distance in km
 * @property {number} electricity - Energy consumed in kWh
 * @property {number} [fuel] - Fuel consumed in liters (hybrid vehicles)
 * @property {number} duration - Duration in minutes
 * @property {number} start_timestamp - Unix timestamp of trip start
 * @property {number} end_timestamp - Unix timestamp of trip end
 * @property {string} [month] - Month string for filtering (YYYYMM)
 * @property {number} [start_soc] - Starting battery percentage
 * @property {number} [end_soc] - Ending battery percentage
 */

/**
 * @typedef {Object} Charge
 * @property {string} id - Unique identifier
 * @property {string} date - Date in YYYYMMDD format
 * @property {string} time - Time in HH:MM format
 * @property {number} kwhCharged - Energy charged in kWh
 * @property {number} totalCost - Total cost in currency
 * @property {number} pricePerKwh - Price per kWh
 * @property {string} chargerTypeId - ID of the charger type used
 * @property {number} [initialPercentage] - Starting battery percentage
 * @property {number} [finalPercentage] - Final battery percentage
 * @property {number} [odometer] - Odometer reading in km
 */

/**
 * @typedef {Object} ChartDataPoint
 * @property {string|number} label - X-axis label
 * @property {number} value - Y-axis value
 */

/**
 * @typedef {Object} MonthlyData
 * @property {string} month - Month label (e.g., "Jan 2024")
 * @property {number} km - Total km for month
 * @property {number} kwh - Total kWh for month
 * @property {number} [fuel] - Total fuel for month (hybrid only)
 * @property {number} trips - Trip count for month
 */

/**
 * @typedef {Object} Summary
 * @property {number} totalKm - Total distance traveled
 * @property {number} totalKwh - Total energy consumed
 * @property {number} [totalFuel] - Total fuel consumed (hybrid only)
 * @property {number} totalDuration - Total time in minutes
 * @property {number} avgEfficiency - Average kWh/100km
 * @property {number} [avgFuelEfficiency] - Average L/100km (hybrid only)
 * @property {number} avgSpeed - Average speed in km/h
 * @property {number} tripCount - Number of trips
 * @property {number} activeDays - Number of unique driving days
 * @property {number} minEfficiency - Minimum efficiency value
 * @property {number} maxEfficiency - Maximum efficiency value
 * @property {boolean} [isHybrid] - Whether the vehicle is a hybrid
 * @property {number} [electricPercentage] - % of km on electricity (hybrid)
 * @property {number} [fuelPercentage] - % of km on fuel (hybrid)
 */

/**
 * @typedef {Object} ProcessedData
 * @property {Summary} summary - Aggregated statistics
 * @property {MonthlyData[]} monthly - Monthly aggregated data
 * @property {Object[]} daily - Daily aggregated data
 * @property {Object[]} hourly - Hourly trip distribution
 * @property {Object[]} weekday - Weekday trip distribution
 * @property {Object[]} tripDist - Trip distance distribution buckets
 * @property {Object[]} effScatter - Efficiency scatter plot data
 * @property {Object} top - Top records (distance, consumption, duration)
 * @property {boolean} isHybrid - Whether the data is from a hybrid vehicle
 */

/**
 * Process raw trip data into statistics and aggregated data
 * @param {Trip[]} rows - Array of raw trip objects
 * @returns {ProcessedData|null} Processed data object or null if invalid
 */
// Helper to get top N items without full sort - O(N) for small K
function getTopN(arr, compareFn, n) {
    if (arr.length <= n) return [...arr].sort(compareFn);

    // Sort first N items
    const result = arr.slice(0, n).sort(compareFn);

    // Process remaining items
    for (let i = n; i < arr.length; i++) {
        const item = arr[i];
        // If item belongs in top N (compare with last/smallest in result)
        // compareFn(a, b) > 0 means a comes before b. 
        // We want descending order usually, so if compareFn(item, last) < 0, item is "larger/better"
        if (compareFn(item, result[n - 1]) < 0) {
            // Find insertion point
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
function getPriceForTrip(trip, strategy, customPrice, avgPrice, processedCharges) {
    if (strategy === 'custom') return customPrice;
    if (strategy === 'average') return avgPrice;

    // Dynamic Strategy: Find last charge before trip start
    if (processedCharges && processedCharges.length > 0) {
        // Linear search backwards or filter? 
        // Charges are sorted by timestamp asc. We want the last one where charge.ts < trip.start_timestamp
        // Optimization: Could use binary search, but N is small.
        // Or since trips are looped chronologically, we could keep a pointer.

        // Simple finding for now:
        const tripStart = trip.start_timestamp || 0;
        let lastCharge = null;

        for (let i = processedCharges.length - 1; i >= 0; i--) {
            const charge = processedCharges[i];
            const chargeTs = charge.timestamp || 0;
            if (chargeTs < tripStart) {
                lastCharge = charge;
                break;
            }
        }

        if (lastCharge) {
            return lastCharge.effectivePrice;
        }
    }

    // Fallback if no prior charge found (e.g. first trip)
    return customPrice > 0 ? customPrice : avgPrice;
}

export function processData(rows, priceSettings = {}, charges = []) {
    if (!rows || rows.length === 0) return null;

    // Parse Price Settings
    // Strategy: 'custom' | 'average' | 'dynamic'
    const elecStrategy = priceSettings.electricStrategy || 'custom';
    const fuelStrategy = priceSettings.fuelStrategy || 'custom';

    const elecCustomPrice = parseFloat(priceSettings.electricPrice) || 0;
    const fuelCustomPrice = parseFloat(priceSettings.fuelPrice) || 0;

    // Calculate Averages if needed (or passed in?)
    // Re-calculating here ensures consistency if not passed
    let elecAvgPrice = 0;
    let fuelAvgPrice = 0;

    // Pre-process charges for Dynamic Strategy
    let processedElectricCharges = [];
    let processedFuelCharges = [];

    if (charges && charges.length > 0) {
        // Calculate Global Averages
        const eCharges = charges.filter(c => !c.type || c.type === 'electric');
        const fCharges = charges.filter(c => c.type === 'fuel');

        const eCost = eCharges.reduce((s, c) => s + (c.totalCost || 0), 0);
        const eKwh = eCharges.reduce((s, c) => s + (c.kwhCharged || 0), 0);
        elecAvgPrice = eKwh > 0 ? eCost / eKwh : 0;

        const fCost = fCharges.reduce((s, c) => s + (c.totalCost || 0), 0);
        const fLiters = fCharges.reduce((s, c) => s + (c.litersCharged || 0), 0);
        fuelAvgPrice = fLiters > 0 ? fCost / fLiters : 0;

        // Process for lookup (add timestamps if missing, calculate effective price)
        if (elecStrategy === 'dynamic') {
            processedElectricCharges = eCharges.map(c => {
                // date "YYYY-MM-DD", time "HH:mm" -> timestamp
                const dStr = c.date; // 2024-01-01
                const tStr = c.time || "00:00";
                const ts = new Date(`${dStr}T${tStr}:00`).getTime() / 1000;
                const price = (c.kwhCharged > 0) ? (c.totalCost / c.kwhCharged) : 0;
                return { ...c, timestamp: ts, effectivePrice: price };
            }).sort((a, b) => a.timestamp - b.timestamp);
        }

        if (fuelStrategy === 'dynamic') {
            processedFuelCharges = fCharges.map(c => {
                const dStr = c.date;
                const tStr = c.time || "00:00";
                const ts = new Date(`${dStr}T${tStr}:00`).getTime() / 1000;
                const price = (c.litersCharged > 0) ? (c.totalCost / c.litersCharged) : 0;
                return { ...c, timestamp: ts, effectivePrice: price };
            }).sort((a, b) => a.timestamp - b.timestamp);
        }
    }

    // Filter valid trips
    // Optimization: Pre-allocate? JS arrays are dynamic.
    const trips = rows.filter(r => r && typeof r.trip === 'number' && r.trip > 0);
    if (trips.length === 0) return null;

    // Initialize structures
    let totalKm = 0;
    let totalKwh = 0;
    let totalFuel = 0;
    let totalDuration = 0;

    // Hybrid detection - any trip with fuel > 0 means hybrid vehicle
    let hasAnyFuel = false;
    let electricOnlyKm = 0;  // km traveled with electricity only (fuel = 0)
    let fuelUsedKm = 0;      // km traveled using fuel (fuel > 0)
    let electricOnlyTrips = 0;
    let fuelUsedTrips = 0;

    // Tracking min/max
    let maxKmVal = -Infinity;
    let minKmVal = Infinity;
    let maxKwhVal = -Infinity;
    let maxDurVal = -Infinity;
    let maxFuelVal = 0;

    // Cost tracking
    let maxCostVal = -Infinity;
    let maxCostDate = null;

    // Sort trips chronologically FIRST to help with dynamic pricing correctness?
    // The main sort happens at the end, but for dynamic pricing, processing in order might be cleaner conceptually,
    // though the 'find last charge' logic works regardless of trip iteration order.
    // Let's stick to existing iteration order (likely source order) for now.

    const monthlyData = {};
    const dailyData = {};
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({ hour: i, trips: 0, km: 0 }));
    // 0=Sun... but we want Mon=0...Sun=6. 
    // Data says: 0=Mon...6=Sun logic matching the original
    const weekdayData = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => ({ day: d, trips: 0, km: 0 }));

    const tripDistribution = [
        { range: '0-5', count: 0, color: '#06b6d4' },
        { range: '5-15', count: 0, color: '#10b981' },
        { range: '15-30', count: 0, color: '#f59e0b' },
        { range: '30-50', count: 0, color: BYD_RED },
        { range: '50+', count: 0, color: '#8b5cf6' }
    ];

    const uniqueDates = new Set();
    const efficiencyScatter = [];

    // Single pass for all simple aggregations
    for (const trip of trips) {
        const tTrip = trip.trip || 0;
        const tElec = trip.electricity || 0;
        const tFuel = trip.fuel || 0;
        const tDur = trip.duration || 0;

        // Totals
        totalKm += tTrip;
        totalKwh += tElec;
        totalFuel += tFuel;
        totalDuration += tDur;

        // Calculate Cost
        // Dynamic Pricing Logic
        const ePrice = getPriceForTrip(trip, elecStrategy, elecCustomPrice, elecAvgPrice, processedElectricCharges);
        const fPrice = getPriceForTrip(trip, fuelStrategy, fuelCustomPrice, fuelAvgPrice, processedFuelCharges);

        const tripCost = (tElec * ePrice) + (tFuel * fPrice);

        // Attach calculated cost to trip object for potential future use (e.g. detail view)
        trip.calculatedCost = tripCost;

        if (tripCost > maxCostVal) {
            maxCostVal = tripCost;
            maxCostDate = trip.date;
        }

        // Hybrid detection and tracking
        if (tFuel > 0) {
            hasAnyFuel = true;
            fuelUsedKm += tTrip;
            fuelUsedTrips++;
            if (tFuel > maxFuelVal) maxFuelVal = tFuel;
        } else {
            electricOnlyKm += tTrip;
            electricOnlyTrips++;
        }

        // Min/Max tracking
        if (tTrip > maxKmVal) maxKmVal = tTrip;
        if (tTrip < minKmVal) minKmVal = tTrip;
        if (tElec > maxKwhVal) maxKwhVal = tElec;
        if (tDur > maxDurVal) maxDurVal = tDur;

        // Monthly
        const m = trip.month || 'unknown';
        if (!monthlyData[m]) monthlyData[m] = { month: m, trips: 0, km: 0, kwh: 0, fuel: 0 };
        monthlyData[m].trips++;
        monthlyData[m].km += tTrip;
        monthlyData[m].kwh += tElec;
        monthlyData[m].fuel += tFuel;

        // Daily
        const d = trip.date || 'unknown';
        uniqueDates.add(d);
        if (!dailyData[d]) dailyData[d] = { date: d, trips: 0, km: 0, kwh: 0, fuel: 0 };
        dailyData[d].trips++;
        dailyData[d].km += tTrip;
        dailyData[d].kwh += tElec;
        dailyData[d].fuel += tFuel;

        // Hourly
        if (trip.start_timestamp) {
            const dt = new Date(trip.start_timestamp * 1000);
            const h = dt.getHours();
            const w = dt.getDay(); // 0=Sun

            if (!isNaN(h) && hourlyData[h]) {
                hourlyData[h].trips++;
                hourlyData[h].km += tTrip;
            }

            // Weekday: we want 0=Mon, 6=Sun. JS getDay returns 0=Sun.
            // (0 + 6) % 7 = 6 (Sun)
            // (1 + 6) % 7 = 0 (Mon)
            const weekdayIndex = (w + 6) % 7;
            if (weekdayData[weekdayIndex]) {
                weekdayData[weekdayIndex].trips++;
                weekdayData[weekdayIndex].km += tTrip;
            }
        }

        // Trip Distribution buckets
        if (tTrip <= 5) tripDistribution[0].count++;
        else if (tTrip <= 15) tripDistribution[1].count++;
        else if (tTrip <= 30) tripDistribution[2].count++;
        else if (tTrip <= 50) tripDistribution[3].count++;
        else tripDistribution[4].count++;

        // Scatter Data (Top efficiency outliers filtered out usually? keeping simple)
        if (tTrip > 0 && tElec > 0) {
            const y = (tElec / tTrip) * 100;
            if (y > 0 && y < 50) {
                efficiencyScatter.push({ x: tTrip, y, fuel: tFuel });
            }
        }
    }

    if (totalKm === 0) return null;

    // --- SORTING OPTIMIZATIONS ---

    // 1. Sort Scatter (needed for chart plotting usually, or maybe not strictly but good for order)
    efficiencyScatter.sort((a, b) => a.x - b.x);

    // 2. Sort Aggregates by Key (Date string 'YYYYMM' and 'YYYYMMDD' allows lexicographical sort)
    // Object.values is O(N), sort is O(K log K) where K is months/days (small)
    const monthlyArray = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    monthlyArray.forEach(m => {
        m.efficiency = m.km > 0 ? (m.kwh / m.km * 100) : 0;
        m.fuelEfficiency = m.km > 0 ? (m.fuel / m.km * 100) : 0;
        m.monthLabel = formatMonth(m.month);
    });

    const dailyArray = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
    dailyArray.forEach(d => {
        d.efficiency = d.km > 0 ? (d.kwh / d.km * 100) : 0;
        d.fuelEfficiency = d.km > 0 ? (d.fuel / d.km * 100) : 0;
        d.dateLabel = formatDate(d.date);
    });

    // 3. Chronological Sort (The BIG one)
    // We sort the trips array in-place (conceptually, we made a filter copy earlier)
    // Used for range calculation and potentially other timestamp-dependent logic in UI
    trips.sort((a, b) => (a.start_timestamp || 0) - (b.start_timestamp || 0));

    // 4. Top lists
    // precise desc comparisons (b - a)
    // Instead of sorting WHOLE array 3 more times, get top 10 efficiently
    const topKm = getTopN(trips, (a, b) => (b.trip || 0) - (a.trip || 0), 10);
    const topKwh = getTopN(trips, (a, b) => (b.electricity || 0) - (a.electricity || 0), 10);
    const topDur = getTopN(trips, (a, b) => (b.duration || 0) - (a.duration || 0), 10);
    const topFuel = hasAnyFuel ? getTopN(trips.filter(t => (t.fuel || 0) > 0), (a, b) => (b.fuel || 0) - (a.fuel || 0), 10) : [];

    const daysActive = uniqueDates.size || 1;

    // Calculate total span from sorted trips
    const firstTs = trips[0]?.start_timestamp;
    const lastTs = trips[trips.length - 1]?.start_timestamp;
    const totalDays = (firstTs && lastTs)
        ? Math.max(1, Math.ceil((lastTs - firstTs) / (24 * 3600)) + 1)
        : daysActive;

    // Calculate hybrid-specific metrics
    const electricPercentage = totalKm > 0 ? (electricOnlyKm / totalKm * 100) : 100;
    const fuelPercentage = totalKm > 0 ? (fuelUsedKm / totalKm * 100) : 0;
    const avgFuelEfficiency = totalKm > 0 ? (totalFuel / totalKm * 100) : 0;
    const evModeUsage = trips.length > 0 ? (electricOnlyTrips / trips.length * 100) : 100;

    // Build summary object
    const summary = {
        totalTrips: trips.length,
        totalKm: totalKm.toFixed(1),
        totalKwh: totalKwh.toFixed(1),
        totalHours: (totalDuration / 3600).toFixed(1),
        avgEff: totalKm > 0 ? (totalKwh / totalKm * 100).toFixed(2) : '0',
        avgKm: (totalKm / trips.length).toFixed(1),
        avgMin: totalDuration > 0 ? (totalDuration / trips.length / 60).toFixed(0) : '0',
        avgSpeed: totalDuration > 0 ? (totalKm / (totalDuration / 3600)).toFixed(1) : '0',
        daysActive,
        totalDays,
        dateRange: formatDate(trips[0]?.date) + ' - ' + formatDate(trips[trips.length - 1]?.date),
        maxKm: maxKmVal.toFixed(1),
        minKm: minKmVal.toFixed(1),
        maxKwh: maxKwhVal.toFixed(1),
        maxMin: (maxDurVal / 60).toFixed(0),
        tripsDay: (trips.length / daysActive).toFixed(1),
        kmDay: (totalKm / daysActive).toFixed(1),
        // Hybrid-specific fields (always present but meaningful only for hybrids)
        isHybrid: hasAnyFuel,
        totalFuel: totalFuel.toFixed(2),
        avgFuelEff: avgFuelEfficiency.toFixed(2),
        electricPercentage: electricPercentage.toFixed(1),
        fuelPercentage: fuelPercentage.toFixed(1),
        electricOnlyTrips,
        fuelUsedTrips,
        evModeUsage: evModeUsage.toFixed(1),
        maxFuel: maxFuelVal.toFixed(2),
        // Most Expensive Trip
        maxCost: maxCostVal > 0 ? maxCostVal.toFixed(2) : '0.00',
        maxCostDate: maxCostDate || ''
    };

    return {
        summary,
        monthly: monthlyArray,
        daily: dailyArray,
        hourly: hourlyData,
        weekday: weekdayData,
        tripDist: tripDistribution,
        effScatter: efficiencyScatter,
        top: {
            km: topKm,
            kwh: topKwh,
            dur: topDur,
            fuel: topFuel
        },
        isHybrid: hasAnyFuel
    };
}

