// BYD Stats - Data Processing Utilities

import { BYD_RED } from './constants';
import { formatMonth, formatDate } from './dateUtils';

/**
 * Process raw trip data into statistics and aggregated data
 * @param {Array} rows - Array of raw trip objects
 * @returns {Object|null} Processed data object or null if invalid
 */
export function processData(rows) {
    if (!rows || rows.length === 0) return null;
    const trips = rows.filter(r => r && typeof r.trip === 'number' && r.trip > 0);
    if (trips.length === 0) return null;

    const totalKm = trips.reduce((s, r) => s + (r.trip || 0), 0);
    const totalKwh = trips.reduce((s, r) => s + (r.electricity || 0), 0);
    const totalDuration = trips.reduce((s, r) => s + (r.duration || 0), 0);
    if (totalKm === 0) return null;

    const monthlyData = {};
    const dailyData = {};
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({ hour: i, trips: 0, km: 0 }));
    const weekdayData = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => ({ day: d, trips: 0, km: 0 }));

    trips.forEach(trip => {
        const m = trip.month || 'unknown';
        if (!monthlyData[m]) monthlyData[m] = { month: m, trips: 0, km: 0, kwh: 0 };
        monthlyData[m].trips++;
        monthlyData[m].km += trip.trip || 0;
        monthlyData[m].kwh += trip.electricity || 0;

        const d = trip.date || 'unknown';
        if (!dailyData[d]) dailyData[d] = { date: d, trips: 0, km: 0, kwh: 0 };
        dailyData[d].trips++;
        dailyData[d].km += trip.trip || 0;
        dailyData[d].kwh += trip.electricity || 0;

        if (trip.start_timestamp) {
            try {
                const dt = new Date(trip.start_timestamp * 1000);
                const h = dt.getHours();
                const w = dt.getDay();
                hourlyData[h].trips++;
                hourlyData[h].km += trip.trip || 0;
                // Reorder weekday index: 0 (Sun) -> 6, 1 (Mon) -> 0, etc.
                const weekdayIndex = (w + 6) % 7;
                weekdayData[weekdayIndex].trips++;
                weekdayData[weekdayIndex].km += trip.trip || 0;
            } catch (e) {
                console.error('Error processing timestamp:', e);
            }
        }
    });

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

    const tripDistribution = [
        { range: '0-5', count: 0, color: '#06b6d4' },
        { range: '5-15', count: 0, color: '#10b981' },
        { range: '15-30', count: 0, color: '#f59e0b' },
        { range: '30-50', count: 0, color: BYD_RED },
        { range: '50+', count: 0, color: '#8b5cf6' }
    ];
    trips.forEach(t => {
        const km = t.trip || 0;
        if (km <= 5) tripDistribution[0].count++;
        else if (km <= 15) tripDistribution[1].count++;
        else if (km <= 30) tripDistribution[2].count++;
        else if (km <= 50) tripDistribution[3].count++;
        else tripDistribution[4].count++;
    });

    const efficiencyScatter = trips
        .filter(t => t.trip > 0 && t.electricity > 0)
        .map(t => ({ km: t.trip, eff: (t.electricity / t.trip) * 100 }))
        .filter(t => t.eff > 0 && t.eff < 50)
        .sort((a, b) => a.km - b.km);

    const sortedByKm = [...trips].sort((a, b) => (b.trip || 0) - (a.trip || 0));
    const sortedByKwh = [...trips].sort((a, b) => (b.electricity || 0) - (a.electricity || 0));
    const sortedByDur = [...trips].sort((a, b) => (b.duration || 0) - (a.duration || 0));
    const daysActive = new Set(trips.map(t => t.date).filter(Boolean)).size || 1;
    const sorted = [...trips].sort((a, b) => (a.start_timestamp || 0) - (b.start_timestamp || 0));

    // Calculate total span of days in the database using timestamps
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
            maxKm: sortedByKm[0]?.trip?.toFixed(1) || '0',
            minKm: sortedByKm[sortedByKm.length - 1]?.trip?.toFixed(1) || '0',
            maxKwh: sortedByKwh[0]?.electricity?.toFixed(1) || '0',
            maxMin: ((sortedByDur[0]?.duration || 0) / 60).toFixed(0),
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
