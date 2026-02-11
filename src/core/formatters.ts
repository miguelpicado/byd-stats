// BYD Stats - Formatting Utilities

/** Minimal trip interface for percentile calculation */
interface TripForPercentile {
    trip: number;
    electricity: number;
}

/**
 * Calculate efficiency score (0-10) based on consumption
 * @param {number} efficiency - kWh/100km consumption
 * @param {number} minEff - Minimum (best) efficiency in dataset
 * @param {number} maxEff - Maximum (worst) efficiency in dataset
 * @returns {number} Score from 0 (worst) to 10 (best)
 */
export const calculateScore = (efficiency: number, minEff: number, maxEff: number): number => {
    if (!efficiency || maxEff === minEff) return 5;
    // minEff is the best (lowest consumption), maxEff is the worst
    // Score should be 10 when efficiency equals minEff (best)
    // Score should be 0 when efficiency equals maxEff (worst)
    const normalized = (maxEff - efficiency) / (maxEff - minEff);
    return Math.max(0, Math.min(10, normalized * 10));
};

/**
 * Get color based on score (0=red, 5=orange, 10=green)
 * @param {number} score - Score from 0 to 10
 * @returns {string} RGB color string
 */
export const getScoreColor = (score: number): string => {
    if (score >= 5) {
        // Green to orange (score 5-10)
        const ratio = (score - 5) / 5;
        const r = Math.round(255 - ratio * 155);
        const g = Math.round(165 + ratio * 90);
        return `rgb(${r}, ${g}, 0)`;
    } else {
        // Red to orange (score 0-5)
        const ratio = score / 5;
        const r = Math.round(234 + ratio * 21);
        const g = Math.round(ratio * 165);
        return `rgb(${r}, ${g}, 41)`;
    }
};

/**
 * Format duration in minutes/hours
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
export const formatDuration = (seconds: number): string => {
    if (!seconds) return '0 min';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
        return `${hours}h ${minutes}min`;
    }
    return `${minutes} min`;
};

/**
 * Calculate trip percentile compared to all trips
 * @param {TripForPercentile} trip - Trip object with trip and electricity properties
 * @param {TripForPercentile[]} allTrips - Array of all trips
 * @returns {number} Percentile (0-100)
 */
export const calculatePercentile = (trip: TripForPercentile, allTrips: TripForPercentile[]): number => {
    if (!trip || !allTrips || allTrips.length === 0) return 50;
    const tripEfficiency = trip.trip > 0 ? (trip.electricity / trip.trip) * 100 : 999;
    const validTrips = allTrips.filter(t => t.trip >= 1 && t.electricity !== 0);
    const efficiencies = validTrips.map(t => (t.electricity / t.trip) * 100);
    const betterCount = efficiencies.filter(e => e < tripEfficiency).length;
    return Math.round((betterCount / efficiencies.length) * 100);
};

/**
 * Format number with fixed decimals
 * @param {number} num - Number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number string
 */
export const formatNumber = (num: number, decimals: number = 1): string => {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toFixed(decimals);
};

/**
 * Format duration in minutes/hours from minutes
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted duration string
 */
export const formatDurationMinutes = (minutes: number): string => {
    if (!minutes) return '0 min';
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    if (hours > 0) {
        return `${hours}h ${mins}min`;
    }
    return `${mins} min`;
};

export const formatDistance = (km: number): string => {
    if (km === null || km === undefined) return '-- km';
    return `${Number(km).toFixed(1)} km`;
};

export const formatEnergy = (kwh: number): string => {
    if (kwh === null || kwh === undefined) return '-- kWh';
    return `${Number(kwh).toFixed(2)} kWh`;
};

export const formatEfficiency = (cons: number): string => {
    if (cons === null || cons === undefined) return '-- kWh/100km';
    return `${Number(cons).toFixed(1)} kWh/100km`;
};

export const formatCurrency = (amount: number, currency: string = 'EUR'): string => {
    try {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(amount);
    } catch (e) {
        return `${amount.toFixed(2)} ${currency}`;
    }
};

export const formatPercentage = (val: number): string => {
    return `${Number(val).toFixed(1)}%`;
};

export const formatDate = (dateStr: string | number | Date): string => {
    if (!dateStr) return '';
    try {
        return new Date(dateStr).toLocaleDateString();
    } catch (e) {
        return String(dateStr);
    }
};

export const formatTime = (dateStr: string | number | Date): string => {
    if (!dateStr) return '';
    try {
        return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '';
    }
};
