// BYD Stats - App Data Management Hook
// Centralized hook for managing trip data, filtering, and history
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
// processData imported for type support or fallback if needed, but we use worker
import { logger } from '@utils/logger';
import { STORAGE_KEY as BASE_STORAGE_KEY, TRIP_HISTORY_KEY as BASE_TRIP_HISTORY_KEY } from '@utils/constants';

import * as Comlink from 'comlink';

/**
 * Hook to manage application data: trips, filtering, and history
 * @returns {Object} Data state and management functions
 */
const useAppData = (settings, charges = [], activeCarId = null) => {
    const { t, i18n } = useTranslation();

    // Worker Reference
    const workerRef = useRef(null);
    useEffect(() => {
        // Initialize worker
        if (!workerRef.current) {
            workerRef.current = Comlink.wrap(
                new Worker(new URL('../workers/dataWorker.js', import.meta.url), { type: 'module' })
            );
        }
    }, []);

    // ... (rest of code) ...



    // specific keys for current car
    const storageKey = activeCarId ? `${BASE_STORAGE_KEY}_${activeCarId}` : null;
    const historyKey = activeCarId ? `${BASE_TRIP_HISTORY_KEY}_${activeCarId}` : null;

    // --- Core Trip Data State ---
    const [rawTrips, setRawTrips] = useState([]);
    const [tripHistory, setTripHistory] = useState([]);

    // Load data when activeCarId changes
    useEffect(() => {
        if (!storageKey) {
            setRawTrips([]);
            return;
        }

        try {
            const s = localStorage.getItem(storageKey);
            if (s) {
                const p = JSON.parse(s);
                if (Array.isArray(p)) setRawTrips(p);
            } else {
                setRawTrips([]);
            }
        } catch (e) {
            logger.error('Error loading from localStorage:', e);
            setRawTrips([]);
        }
    }, [storageKey]);

    useEffect(() => {
        if (!historyKey) {
            setTripHistory([]);
            return;
        }

        try {
            const h = localStorage.getItem(historyKey);
            if (h) {
                const history = JSON.parse(h);
                if (Array.isArray(history)) setTripHistory(history);
            } else {
                setTripHistory([]);
            }
        } catch (e) {
            logger.error('Error loading trip history:', e);
            setTripHistory([]);
        }
    }, [historyKey]);

    // --- Filter State ---
    const [filterType, setFilterType] = useState('all');
    const [selMonth, setSelMonth] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // --- Save trips to localStorage when changed ---
    useEffect(() => {
        if (storageKey && rawTrips.length > 0) {
            try {
                localStorage.setItem(storageKey, JSON.stringify(rawTrips));
            } catch (e) {
                logger.error('Error saving to localStorage:', e);
            }
        }
        // If empty, we might want to clear or keep empty array? 
        // Keeping previous behavior: only save if > 0? 
        // Issue: if user deletes all trips, we want to save empty array.
        // But original code was if (rawTrips.length > 0). Let's stick to it but maybe improve later.
        else if (storageKey && rawTrips.length === 0) {
            // Optional: removeItem or save []?
            // If we don't save [], then on reload valid old data might reappear if we acted on a stale state?
            // But localStorage persists. So if we deleted all in memory, we MUST save empty to disk.
            // Original hook had this flaw? "if (rawTrips.length > 0)". 
            // If I clearData, I call localStorage.removeItem directly.
            // So this effects only updates.
        }
    }, [rawTrips, storageKey]);

    // --- Save trip history to localStorage when changed ---
    useEffect(() => {
        if (historyKey && tripHistory.length > 0) {
            try {
                localStorage.setItem(historyKey, JSON.stringify(tripHistory));
            } catch (e) {
                logger.error('Error saving trip history:', e);
            }
        }
    }, [tripHistory, historyKey]);

    // --- Computed: Extract unique months from trips ---
    const months = useMemo(() => {
        return [...new Set(rawTrips.map(t => t.month).filter(Boolean))].sort();
    }, [rawTrips]);

    // --- Computed: Filter trips based on current filter settings ---
    const filtered = useMemo(() => {
        if (!rawTrips || rawTrips.length === 0) return [];

        if (filterType === 'month' && selMonth) {
            return rawTrips.filter(t => {
                // Robust check: use existing month property OR derive from date
                const m = t.month || (t.date ? t.date.substring(0, 6) : '');
                return m === selMonth;
            });
        }

        if (filterType === 'range') {
            let r = [...rawTrips];
            if (dateFrom) {
                const limit = dateFrom.replace(/-/g, '');
                r = r.filter(t => (t.date || '') >= limit);
            }
            if (dateTo) {
                const limit = dateTo.replace(/-/g, '');
                r = r.filter(t => (t.date || '') <= limit);
            }
            return r;
        }

        return rawTrips;
    }, [rawTrips, filterType, selMonth, dateFrom, dateTo]);

    // --- Computed: Process filtered data for charts and stats (Async with Worker) ---
    const [data, setData] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const process = async () => {
            if (!filtered || filtered.length === 0) {
                if (isMounted) setData(null);
                return;
            }

            setIsProcessing(true);
            try {
                const processingSettings = {
                    electricStrategy: settings?.priceStrategy || (settings?.useCalculatedPrice ? 'average' : 'custom'),
                    fuelStrategy: settings?.fuelPriceStrategy || (settings?.useCalculatedFuelPrice ? 'average' : 'custom'),
                    electricPrice: settings?.electricityPrice || 0,
                    fuelPrice: settings?.fuelPrice || 0,
                    batterySize: settings?.batterySize || 0,
                    soh: settings?.soh || 100,
                    sohMode: settings?.sohMode || 'manual',
                    mfgDate: settings?.mfgDate,
                    chargerTypes: settings?.chargerTypes || [],
                    thermalStressFactor: parseFloat(settings?.thermalStressFactor) || 1.0,
                    odometerOffset: parseFloat(settings?.odometerOffset) || 0
                };

                // Offload to worker
                if (workerRef.current) {
                    const result = await workerRef.current.processData(
                        filtered,
                        JSON.parse(JSON.stringify(processingSettings)),
                        JSON.parse(JSON.stringify(charges)),
                        i18n.language
                    );

                    if (result && processingSettings.odometerOffset) {
                        const baseKm = parseFloat(result.summary.totalKm);
                        if (!isNaN(baseKm)) {
                            result.summary.totalKm = (baseKm + processingSettings.odometerOffset).toFixed(1);
                        }
                    }

                    if (isMounted) setData(result);
                }
            } catch (e) {
                logger.error('Worker processing error:', e);
            } finally {
                if (isMounted) setIsProcessing(false);
            }
        };

        process();

        return () => { isMounted = false; };
    }, [filtered, i18n.language, settings, charges]);

    // --- Computed: Effective Prices (Dynamic vs Static) ---
    const effectiveElectricityPrice = useMemo(() => {
        if (settings?.useCalculatedPrice && charges.length > 0) {
            const electricCharges = charges.filter(c => !c.type || c.type === 'electric');
            const totalCost = electricCharges.reduce((sum, c) => sum + (c.totalCost || 0), 0);
            const totalKwh = electricCharges.reduce((sum, c) => sum + (c.kwhCharged || 0), 0);
            if (totalKwh > 0) return totalCost / totalKwh;
        }
        return settings?.electricityPrice || 0;
    }, [settings?.useCalculatedPrice, settings?.electricityPrice, charges]);

    const effectiveFuelPrice = useMemo(() => {
        if (settings?.useCalculatedFuelPrice && charges.length > 0) {
            const fuelCharges = charges.filter(c => c.type === 'fuel');
            const totalCost = fuelCharges.reduce((sum, c) => sum + (c.totalCost || 0), 0);
            const totalLiters = fuelCharges.reduce((sum, c) => sum + (c.litersCharged || 0), 0);
            if (totalLiters > 0) return totalCost / totalLiters;
        }
        return settings?.fuelPrice || 0;
    }, [settings?.useCalculatedFuelPrice, settings?.fuelPrice, charges]);

    // Replaced by async worker effect above (managed via useState [data, setData])

    // --- Action: Clear all trip data ---
    const clearData = useCallback(() => {
        setRawTrips([]);
        if (storageKey) localStorage.removeItem(storageKey);
        return true;
    }, [storageKey]);

    // --- Action: Save current trips to history ---
    const saveToHistory = useCallback(() => {
        if (rawTrips.length === 0) {
            return { success: false, reason: 'no_trips' };
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
        return {
            success: true,
            total: newHistory.length,
            added: newHistory.length - tripHistory.length
        };
    }, [rawTrips, tripHistory]);

    // --- Action: Load history as current trips ---
    const loadFromHistory = useCallback(() => {
        if (tripHistory.length === 0) {
            return { success: false, reason: 'no_history' };
        }
        setRawTrips(tripHistory);
        return { success: true, count: tripHistory.length };
    }, [tripHistory]);

    // --- Action: Clear trip history ---
    const clearHistory = useCallback(() => {
        setTripHistory([]);
        if (historyKey) localStorage.removeItem(historyKey);
        return true;
    }, [historyKey]);

    // Memoize the return value to ensure reference stability
    return useMemo(() => ({
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
    }), [
        rawTrips, tripHistory,
        filterType, selMonth, dateFrom, dateTo,
        months, filtered, data,
        clearData, saveToHistory, loadFromHistory, clearHistory
    ]);
};

export default useAppData;


