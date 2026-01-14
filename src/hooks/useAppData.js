// BYD Stats - App Data Management Hook
// Centralized hook for managing trip data, filtering, and history
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { processData } from '../utils/dataProcessing';
import { logger } from '../utils/logger';

const STORAGE_KEY = 'byd_stats_data';
const TRIP_HISTORY_KEY = 'byd_trip_history';

/**
 * Hook to manage application data: trips, filtering, and history
 * @returns {Object} Data state and management functions
 */
const useAppData = () => {
    const { t, i18n } = useTranslation();

    // --- Core Trip Data State ---
    const [rawTrips, setRawTrips] = useState([]);
    const [tripHistory, setTripHistory] = useState([]);

    // --- Filter State ---
    const [filterType, setFilterType] = useState('all');
    const [selMonth, setSelMonth] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // --- Load data from localStorage on mount ---
    useEffect(() => {
        try {
            // Load trips
            const s = localStorage.getItem(STORAGE_KEY);
            if (s) {
                const p = JSON.parse(s);
                if (Array.isArray(p) && p.length > 0) {
                    setRawTrips(p);
                }
            }

            // Load trip history
            const h = localStorage.getItem(TRIP_HISTORY_KEY);
            if (h) {
                const history = JSON.parse(h);
                if (Array.isArray(history)) setTripHistory(history);
            }
        } catch (e) {
            logger.error('Error loading from localStorage:', e);
        }
    }, []);

    // --- Save trips to localStorage when changed ---
    useEffect(() => {
        if (rawTrips.length > 0) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(rawTrips));
            } catch (e) {
                logger.error('Error saving to localStorage:', e);
            }
        }
    }, [rawTrips]);

    // --- Save trip history to localStorage when changed ---
    useEffect(() => {
        if (tripHistory.length > 0) {
            try {
                localStorage.setItem(TRIP_HISTORY_KEY, JSON.stringify(tripHistory));
            } catch (e) {
                logger.error('Error saving trip history:', e);
            }
        }
    }, [tripHistory]);

    // --- Computed: Extract unique months from trips ---
    const months = useMemo(() => {
        return [...new Set(rawTrips.map(t => t.month).filter(Boolean))].sort();
    }, [rawTrips]);

    // --- Computed: Filter trips based on current filter settings ---
    const filtered = useMemo(() => {
        if (rawTrips.length === 0) return [];
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

    // --- Computed: Process filtered data for charts and stats ---
    const data = useMemo(() => {
        return filtered.length > 0 ? processData(filtered) : null;
    }, [filtered, i18n.language]);

    // --- Action: Clear all trip data ---
    const clearData = useCallback(() => {
        if (window.confirm(t('confirmations.deleteAllData'))) {
            setRawTrips([]);
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [t]);

    // --- Action: Save current trips to history ---
    const saveToHistory = useCallback(() => {
        if (rawTrips.length === 0) {
            alert(t('confirmations.noTripsToSave'));
            return;
        }

        // Merge current trips with existing history using unique key
        const map = new Map();

        // Add existing history
        tripHistory.forEach(t => map.set(t.date + '-' + t.start_timestamp, t));

        // Add current trips
        rawTrips.forEach(t => map.set(t.date + '-' + t.start_timestamp, t));

        const newHistory = Array.from(map.values()).sort((a, b) =>
            (a.date || '').localeCompare(b.date || '')
        );

        setTripHistory(newHistory);
        alert(t('confirmations.historySaved', { total: newHistory.length, new: newHistory.length - tripHistory.length }));
    }, [rawTrips, tripHistory, t]);

    // --- Action: Load history as current trips ---
    const loadFromHistory = useCallback(() => {
        if (tripHistory.length === 0) {
            alert(t('confirmations.noHistory'));
            return;
        }

        if (window.confirm(t('confirmations.loadHistory', { count: tripHistory.length }))) {
            setRawTrips(tripHistory);
        }
    }, [tripHistory, t]);

    // --- Action: Clear trip history ---
    const clearHistory = useCallback(() => {
        if (window.confirm(t('confirmations.clearHistory'))) {
            setTripHistory([]);
            localStorage.removeItem(TRIP_HISTORY_KEY);
            alert(t('confirmations.historyCleared'));
        }
    }, [t]);

    return {
        // Trip data
        rawTrips,
        setRawTrips,
        tripHistory,
        setTripHistory,

        // Filter state
        filterType,
        setFilterType,
        selMonth,
        setSelMonth,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,

        // Computed data
        months,
        filtered,
        data,

        // Actions
        clearData,
        saveToHistory,
        loadFromHistory,
        clearHistory
    };
};

export default useAppData;
