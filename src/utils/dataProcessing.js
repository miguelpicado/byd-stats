// BYD Stats - Data Processing Utilities

import { BYD_RED } from './constants';
import { formatMonth, formatDate } from './dateUtils';
import { logger } from './logger';

/**
 * @typedef {Object} Trip
 * @property {string} date - Date in YYYYMMDD format
 * @property {number} trip - Distance in km
 * @property {number} electricity - Energy consumed in kWh
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
 * @property {number} trips - Trip count for month
 */

/**
 * @typedef {Object} Summary
 * @property {number} totalKm - Total distance traveled
 * @property {number} totalKwh - Total energy consumed
 * @property {number} totalDuration - Total time in minutes
 * @property {number} avgEfficiency - Average kWh/100km
 * @property {number} avgSpeed - Average speed in km/h
 * @property {number} tripCount - Number of trips
 * @property {number} activeDays - Number of unique driving days
 * @property {number} minEfficiency - Minimum efficiency value
 * @property {number} maxEfficiency - Maximum efficiency value
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

export function processData(rows) {
    if (!rows || rows.length === 0) return null;

    // Filter valid trips
    // Optimization: Pre-allocate? JS arrays are dynamic.
    const trips = rows.filter(r => r && typeof r.trip === 'number' && r.trip > 0);
    if (trips.length === 0) return null;

    // Initialize structures
    let totalKm = 0;
    let totalKwh = 0;
    let totalDuration = 0;

    // Tracking min/max
    let maxKmVal = -Infinity;
    let minKmVal = Infinity;
    let maxKwhVal = -Infinity;
    let maxDurVal = -Infinity;

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
        const tDur = trip.duration || 0;

        // Totals
        totalKm += tTrip;
        totalKwh += tElec;
        totalDuration += tDur;

        // Min/Max tracking
        if (tTrip > maxKmVal) maxKmVal = tTrip;
        if (tTrip < minKmVal) minKmVal = tTrip;
        if (tElec > maxKwhVal) maxKwhVal = tElec;
        if (tDur > maxDurVal) maxDurVal = tDur;

        // Monthly
        const m = trip.month || 'unknown';
        if (!monthlyData[m]) monthlyData[m] = { month: m, trips: 0, km: 0, kwh: 0 };
        monthlyData[m].trips++;
        monthlyData[m].km += tTrip;
        monthlyData[m].kwh += tElec;

        // Daily
        const d = trip.date || 'unknown';
        uniqueDates.add(d);
        if (!dailyData[d]) dailyData[d] = { date: d, trips: 0, km: 0, kwh: 0 };
        dailyData[d].trips++;
        dailyData[d].km += tTrip;
        dailyData[d].kwh += tElec;

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
                efficiencyScatter.push({ x: tTrip, y });
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
        m.monthLabel = formatMonth(m.month);
    });

    const dailyArray = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
    dailyArray.forEach(d => {
        d.efficiency = d.km > 0 ? (d.kwh / d.km * 100) : 0;
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

    const daysActive = uniqueDates.size || 1;

    // Calculate total span from sorted trips
    const firstTs = trips[0]?.start_timestamp;
    const lastTs = trips[trips.length - 1]?.start_timestamp;
    const totalDays = (firstTs && lastTs)
        ? Math.max(1, Math.ceil((lastTs - firstTs) / (24 * 3600)) + 1)
        : daysActive;

    return {
        summary: {
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
            kmDay: (totalKm / daysActive).toFixed(1)
        },
        monthly: monthlyArray,
        daily: dailyArray,
        hourly: hourlyData,
        weekday: weekdayData,
        tripDist: tripDistribution,
        effScatter: efficiencyScatter,
        top: {
            km: topKm,
            kwh: topKwh,
            dur: topDur
        }
    };
}
