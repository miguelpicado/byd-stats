// BYD Stats - App Data Management Hook (Facade)
// Composes granular hooks into a unified API for backward compatibility

import { useMemo } from 'react';
import { Trip, Charge, Settings, ProcessedData } from '@/types';
import { useFilters } from './useFilters';
import { useTrips } from './useTrips';
import { useProcessedData } from './useProcessedData';
import { useLocalStorage } from './useLocalStorage';
import { subscribeToTrips } from '@/services/firebase';
import { useState, useEffect } from 'react';

export interface UseAppDataReturn {
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
    isAiTraining: boolean;
    aiScenarios: Array<{ name: string; speed: number; efficiency: number; range: number }>;
    aiLoss: number | null;
    aiSoH: number | null;
    aiSoHStats: { points: any[]; trend: any[] } | null;
    predictDeparture: (startTime: number) => Promise<{ departureTime: number; duration: number } | null>;
    acknowledgedAnomalies: string[];
    setAcknowledgedAnomalies: (ids: string[]) => void;
    deletedAnomalies: string[];
    setDeletedAnomalies: (ids: string[]) => void;
    forceRecalculate: () => void;
}

const useAppData = (settings: Settings, charges: Charge[] = [], activeCarId: string | null = null): UseAppDataReturn => {
    // 1. Manage Trips (Storage & History)
    const {
        rawTrips,
        setRawTrips,
        tripHistory,
        setTripHistory,
        clearData,
        saveToHistory,
        loadFromHistory,
        clearHistory
    } = useTrips(activeCarId);

    // 2. Manage Filters
    const {
        filterType,
        setFilterType,
        selMonth,
        setSelMonth,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo
    } = useFilters();

    // 3.0 Firebase Integration (Hybrid Mode) with debouncing
    // Note: batterySize NOT in dependencies - consumption calculated in merge step
    const [firebaseTrips, setFirebaseTrips] = useState<Trip[]>([]);

    useEffect(() => {
        if (!activeCarId) {
            setFirebaseTrips([]);
            return;
        }

        let debounceTimer: NodeJS.Timeout;

        // Subscribe with activeCarId as userId
        const unsubscribe = subscribeToTrips((trips) => {
            // Debounce updates to prevent excessive re-renders
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                setFirebaseTrips(trips);
            }, 300); // 300ms debounce
        }, activeCarId, 500);

        return () => {
            clearTimeout(debounceTimer);
            unsubscribe();
        };
    }, [activeCarId]); // Depend on activeCarId

    // 3.1 Computed: Merged Trips (Local + Remote)
    // Also calculates consumption from SoC if not provided
    const val = settings?.batterySize as unknown;
    const batterySize = typeof val === 'string'
        ? parseFloat(val)
        : (typeof val === 'number' ? val : 82.56);

    const allTrips = useMemo(() => {
        // Get deleted trip IDs from localStorage
        const deletedTrips = JSON.parse(localStorage.getItem('byd_deleted_trips') || '[]');

        // Helper: Calculate consumption if not provided
        const withConsumption = (t: Trip): Trip => {
            if (t.electricity > 0) return t; // Already has consumption

            // Calculate from SoC delta
            if (t.start_soc && t.end_soc) {
                const socDelta = t.start_soc - t.end_soc;
                if (socDelta > 0) {
                    return { ...t, electricity: (socDelta / 100) * batterySize };
                }
            }
            return t;
        };

        // Create a map by timestamp to deduplicate
        // Priority: Firebase > Local
        const tripMap = new Map<string, Trip>();

        // 1. Add Local Trips (excluding deleted)
        rawTrips.forEach(t => {
            if (t.id && deletedTrips.includes(t.id)) return; // Skip deleted trips

            // Use start_timestamp or date as key base. Fallback to index if needed but timestamp should exist.
            const key = `${t.start_timestamp || t.date}-${t.trip}`;
            tripMap.set(key, withConsumption({ ...t, source: 'local' }));
        });

        // 2. Add/Overwrite with Firebase Trips (excluding deleted)
        firebaseTrips.forEach(t => {
            if (t.id && deletedTrips.includes(t.id)) return; // Skip deleted trips

            const key = `${t.start_timestamp || t.date}-${t.trip}`;
            tripMap.set(key, withConsumption(t));
        });

        // Convert back to array and sort
        const merged = Array.from(tripMap.values());
        merged.sort((a, b) => (b.start_timestamp || 0) - (a.start_timestamp || 0));

        return merged;
    }, [rawTrips, firebaseTrips, batterySize]);

    // 3. Computed: Unique Months
    const months = useMemo(() => {
        return [...new Set(allTrips.map(t => t.month).filter(Boolean) as string[])].sort();
    }, [allTrips]);

    // 4. Computed: Filtering Logic
    const filtered = useMemo(() => {
        if (!allTrips || allTrips.length === 0) return [];

        if (filterType === 'month' && selMonth) {
            return allTrips.filter(t => {
                const m = t.month || (t.date ? t.date.substring(0, 6) : '');
                return m === selMonth;
            });
        }

        if (filterType === 'range') {
            let r = [...allTrips];
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

        return allTrips;
    }, [allTrips, filterType, selMonth, dateFrom, dateTo]);

    // 5. Worker Processing (Async Stats)
    const { data, isProcessing, isAiTraining, aiScenarios, aiLoss, aiSoH, aiSoHStats, predictDeparture, forceRecalculate } = useProcessedData(filtered, allTrips, settings, charges);

    // 6. Anomalies State
    const [acknowledgedAnomalies, setAcknowledgedAnomalies] = useLocalStorage<string[]>('acknowledged_anomalies', []);
    const [deletedAnomalies, setDeletedAnomalies] = useLocalStorage<string[]>('deleted_anomalies', []);

    return useMemo(() => ({
        // Trip Data
        rawTrips: allTrips, // Expose Merged List as the "Source of Truth"
        setRawTrips, // Expose setter for Local trips only
        tripHistory,
        setTripHistory,

        // Filters
        filterType,
        setFilterType,
        selMonth,
        setSelMonth,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,

        // Computed
        months,
        filtered,
        data,

        // Actions
        clearData,
        saveToHistory,
        loadFromHistory,
        clearHistory,
        isProcessing,
        isAiTraining,

        // AI Data
        aiScenarios,
        aiLoss,
        aiSoH,
        aiSoHStats,
        predictDeparture, // Added explicitly

        // Anomalies
        acknowledgedAnomalies,
        setAcknowledgedAnomalies,
        deletedAnomalies,
        setDeletedAnomalies,
        forceRecalculate

    }), [
        allTrips, rawTrips, tripHistory,
        filterType, selMonth, dateFrom, dateTo,
        months, filtered, data,
        clearData, saveToHistory, loadFromHistory, clearHistory,
        isProcessing, isAiTraining, aiScenarios, aiLoss, aiSoH, aiSoHStats, predictDeparture, forceRecalculate,
        acknowledgedAnomalies, deletedAnomalies
    ]);
};

export default useAppData;
