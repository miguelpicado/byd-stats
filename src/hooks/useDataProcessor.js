import { useMemo } from 'react';
import { processData } from '../utils/dataProcessing';

/**
 * Custom hook to process raw trip data.
 * Wraps processData in useMemo to avoid unnecessary recalculations.
 * 
 * @param {Array} rawTrips - The raw trips data array
 * @param {string} filterType - Current filter type ('all', 'month', 'range')
 * @param {string} selMonth - Selected month for filter
 * @param {string} dateFrom - Start date for filter
 * @param {string} dateTo - End date for filter
 * @returns {Object|null} Processed data object
 */
export function useDataProcessor(rawTrips, filterType, selMonth, dateFrom, dateTo) {
    const filtered = useMemo(() => {
        if (!rawTrips || rawTrips.length === 0) return [];
        if (filterType === 'month' && selMonth) {
            return rawTrips.filter(t => t.month === selMonth);
        }
        if (filterType === 'range') {
            let r = [...rawTrips];
            if (dateFrom) r = r.filter(t => t.date >= dateFrom.replace(/-/g, ''));
            if (dateTo) r = r.filter(t => t.date <= dateTo.replace(/-/g, ''));
            return r;
        }
        return rawTrips;
    }, [rawTrips, filterType, selMonth, dateFrom, dateTo]);

    const data = useMemo(() => {
        return filtered.length > 0 ? processData(filtered) : null;
    }, [filtered]);

    return { filtered, data };
}
