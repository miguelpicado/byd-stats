// BYD Stats - Data Processing Utilities

import { BYD_RED } from './constants';
import { formatMonth, formatDate } from './dateUtils';
import { logger } from './logger';

/**
 * Process raw trip data into statistics and aggregated data
 * @param {Array} rows - Array of raw trip objects
 * @returns {Object|null} Processed data object or null if invalid
 */
export function processData(rows) {
    if (!rows || rows.length === 0) return null;
    const trips = rows.filter(r => r && typeof r.trip === 'number' && r.trip > 0);
    if (trips.length === 0) return null;

    // Initialize structures
    let totalKm = 0;
    let totalKwh = 0;
    let totalDuration = 0;

    // Tracking min/max without sorting
    let maxKmVal = -Infinity;
    let minKmVal = Infinity;
    let maxKwhVal = -Infinity;
    let maxDurVal = -Infinity;

    const monthlyData = {};
    const dailyData = {};
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({ hour: i, trips: 0, km: 0 }));
    // 0=Mon...6=Sun logic matching the original
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

    // Single pass for all aggregations
    // Using for...of loop for better performance/readability over reduce/forEach
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

        // Hourly & Weekday
        if (trip.start_timestamp) {
            const dt = new Date(trip.start_timestamp * 1000);
            const h = dt.getHours();
            const w = dt.getDay(); // 0=Sun

            if (!isNaN(h) && hourlyData[h]) {
                hourlyData[h].trips++;
                hourlyData[h].km += tTrip;
            }

            // Weekday: 0(Sun)->6, 1(Mon)->0, etc.
            const weekdayIndex = (w + 6) % 7;
            if (weekdayData[weekdayIndex]) {
                weekdayData[weekdayIndex].trips++;
                weekdayData[weekdayIndex].km += tTrip;
            }
        }

        // Trip Distribution
        if (tTrip <= 5) tripDistribution[0].count++;
        else if (tTrip <= 15) tripDistribution[1].count++;
        else if (tTrip <= 30) tripDistribution[2].count++;
        else if (tTrip <= 50) tripDistribution[3].count++;
        else tripDistribution[4].count++;

        // Scatter Data
        if (tTrip > 0 && tElec > 0) {
            const y = (tElec / tTrip) * 100;
            if (y > 0 && y < 50) {
                efficiencyScatter.push({ x: tTrip, y });
            }
        }
    }

    if (totalKm === 0) return null;

    // Post-process aggregations
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

    // Sort scatter
    efficiencyScatter.sort((a, b) => a.x - b.x);

    // Sorts for Top/Charts (Unavoidable for "Top 10" and Charts usually)
    // We do these specifically.
    const sortedByKm = [...trips].sort((a, b) => (b.trip || 0) - (a.trip || 0));
    const sortedByKwh = [...trips].sort((a, b) => (b.electricity || 0) - (a.electricity || 0));
    const sortedByDur = [...trips].sort((a, b) => (b.duration || 0) - (a.duration || 0));
    const sorted = [...trips].sort((a, b) => (a.start_timestamp || 0) - (b.start_timestamp || 0));

    const daysActive = uniqueDates.size || 1;

    // Calculate total span
    const firstTs = sorted[0]?.start_timestamp;
    const lastTs = sorted[sorted.length - 1]?.start_timestamp;
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
            dateRange: formatDate(sorted[0]?.date) + ' - ' + formatDate(sorted[sorted.length - 1]?.date),
            maxKm: maxKmVal.toFixed(1), // Uses tracked val
            minKm: minKmVal.toFixed(1), // Uses tracked val
            maxKwh: maxKwhVal.toFixed(1), // Uses tracked val
            maxMin: (maxDurVal / 60).toFixed(0), // Uses tracked val
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
            km: sortedByKm.slice(0, 10),
            kwh: sortedByKwh.slice(0, 10),
            dur: sortedByDur.slice(0, 10)
        }
    };
}
