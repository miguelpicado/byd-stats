// BYD Stats - App Data Management Hook (Facade)
// Composes granular hooks into a unified API for backward compatibility

import { useMemo } from 'react';
import { Trip, Charge, Settings, ProcessedData } from '@/types';
import { useFilters } from './useFilters';
import { useTrips } from './useTrips';
import { useProcessedData } from './useProcessedData';

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

    // 3. Computed: Unique Months
    const months = useMemo(() => {
        return [...new Set(rawTrips.map(t => t.month).filter(Boolean) as string[])].sort();
    }, [rawTrips]);

    // 4. Computed: Filtering Logic
    const filtered = useMemo(() => {
        if (!rawTrips || rawTrips.length === 0) return [];

        if (filterType === 'month' && selMonth) {
            return rawTrips.filter(t => {
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

    // 5. Worker Processing (Async Stats)
    const { data, isProcessing, isAiTraining, aiScenarios, aiLoss, aiSoH, aiSoHStats, predictDeparture } = useProcessedData(filtered, settings, charges);

    return useMemo(() => ({
        // Trip Data
        rawTrips,
        setRawTrips,
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
        aiSoHStats
    }), [
        rawTrips, tripHistory,
        filterType, selMonth, dateFrom, dateTo,
        months, filtered, data,
        clearData, saveToHistory, loadFromHistory, clearHistory,
        isProcessing, isAiTraining, aiScenarios, aiLoss, aiSoH, aiSoHStats, predictDeparture
    ]);
};

export default useAppData;
