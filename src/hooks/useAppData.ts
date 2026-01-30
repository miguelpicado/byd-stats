// BYD Stats - App Data Management Hook
// Centralized hook for managing trip data, filtering, and history
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '@utils/logger';
import { STORAGE_KEY as BASE_STORAGE_KEY, TRIP_HISTORY_KEY as BASE_TRIP_HISTORY_KEY } from '@utils/constants';
import * as Comlink from 'comlink';
import { Trip, Charge, Settings, ProcessedData } from '@/types';

// Define the worker API interface
interface DataWorkerApi {
    processData(
        trips: Trip[],
        settings: any, // simplified settings object
        charges: Charge[],
        language: string
    ): Promise<ProcessedData>;
}

interface UseAppDataReturn {
    rawTrips: Trip[];
    setRawTrips: React.Dispatch<React.SetStateAction<Trip[]>>;
    tripHistory: Trip[];
    setTripHistory: React.Dispatch<React.SetStateAction<Trip[]>>;
    filterType: string;
    setFilterType: React.Dispatch<React.SetStateAction<string>>;
    selMonth: string;
    setSelMonth: React.Dispatch<React.SetStateAction<string>>;
    dateFrom: string;
    setDateFrom: React.Dispatch<React.SetStateAction<string>>;
    dateTo: string;
    setDateTo: React.Dispatch<React.SetStateAction<string>>;
    months: string[];
    filtered: Trip[];
    data: ProcessedData | null;
    clearData: () => boolean;
    saveToHistory: () => { success: boolean; total?: number; added?: number; reason?: string };
    loadFromHistory: () => { success: boolean; count?: number; reason?: string };
    clearHistory: () => boolean;
    isProcessing: boolean;
}

/**
 * Hook to manage application data: trips, filtering, and history
 * @returns {Object} Data state and management functions
 */
const useAppData = (settings: Settings, charges: Charge[] = [], activeCarId: string | null = null): UseAppDataReturn => {
    const { t, i18n } = useTranslation();

    // Worker Reference
    const workerRef = useRef<Comlink.Remote<DataWorkerApi> | null>(null);

    useEffect(() => {
        // Initialize worker
        if (!workerRef.current) {
            const worker = new Worker(new URL('../workers/dataWorker.js', import.meta.url), { type: 'module' });
            workerRef.current = Comlink.wrap<DataWorkerApi>(worker);
        }
    }, []);

    // specific keys for current car
    const storageKey = activeCarId ? `${BASE_STORAGE_KEY}_${activeCarId}` : null;
    const historyKey = activeCarId ? `${BASE_TRIP_HISTORY_KEY}_${activeCarId}` : null;

    // --- Core Trip Data State ---
    const [rawTrips, setRawTrips] = useState<Trip[]>([]);
    const [tripHistory, setTripHistory] = useState<Trip[]>([]);

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
    const [filterType, setFilterType] = useState<string>('all');
    const [selMonth, setSelMonth] = useState<string>('');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');

    // --- Save trips to localStorage when changed ---
    useEffect(() => {
        if (storageKey && rawTrips.length > 0) {
            try {
                localStorage.setItem(storageKey, JSON.stringify(rawTrips));
            } catch (e) {
                logger.error('Error saving to localStorage:', e);
            }
        } else if (storageKey && rawTrips.length === 0) {
            // Keep existing behavior (do nothing on empty update to avoid accidental wipe if logic fails),
            // but explicit clearData handles removal.
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
        return [...new Set(rawTrips.map(t => t.month).filter(Boolean) as string[])].sort();
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
    const [data, setData] = useState<ProcessedData | null>(null);
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
                    electricStrategy: settings?.electricStrategy || (settings?.electricStrategy === undefined && settings?.electricPrice ? 'custom' : 'average'), // Adapt legacy settings logic if needed, or stick to interface
                    fuelStrategy: settings?.fuelStrategy || 'average',
                    electricPrice: Number(settings?.electricPrice) || 0,
                    fuelPrice: Number(settings?.fuelPrice) || 0,
                    batterySize: Number(settings?.batterySize) || 0,
                    soh: Number(settings?.soh) || 100,
                    sohMode: settings?.sohMode || 'manual',
                    mfgDate: settings?.mfgDate,
                    chargerTypes: settings?.chargerTypes || [],
                    thermalStressFactor: parseFloat(String(settings?.thermalStressFactor)) || 1.0,
                    odometerOffset: 0 // settings.odometerOffset might not be in Settings interface yet?
                };

                // Cast settings to any to access potentially missing properties from legacy JS objects
                const rawSettings: any = settings || {};
                processingSettings.odometerOffset = parseFloat(rawSettings.odometerOffset) || 0;

                // Fallback for price strategy if still using old logic keys in component but not in interface
                if (rawSettings.priceStrategy) processingSettings.electricStrategy = rawSettings.priceStrategy;
                if (rawSettings.useCalculatedPrice) processingSettings.electricStrategy = 'average';

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
        clearHistory,
        isProcessing
    }), [
        rawTrips, tripHistory,
        filterType, selMonth, dateFrom, dateTo,
        months, filtered, data,
        clearData, saveToHistory, loadFromHistory, clearHistory
    ]);
};

export default useAppData;
