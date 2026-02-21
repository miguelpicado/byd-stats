import React, { createContext, useContext, useMemo, ReactNode, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useCar } from '@/context/CarContext';
import { useChargesContext } from './ChargesProvider';
import { useFiltersContext } from './FilterProvider';
import { useTrips } from '@hooks/useTrips';
import { useMergedTrips } from '@hooks/useMergedTrips';
import { useProcessedData } from '@hooks/useProcessedData';
import { useLocalStorage } from '@hooks/useLocalStorage';
import { Trip, ProcessedData, Settings, SoHStats } from '@/types';

interface TripsContextValue {
    // Data
    rawTrips: Trip[]; // merged trips (backward compatibility)
    setRawTrips: React.Dispatch<React.SetStateAction<Trip[]>>; // setter for local trips
    tripHistory: Trip[];
    setTripHistory: React.Dispatch<React.SetStateAction<Trip[]>>;

    // Derived
    allTrips: Trip[];
    filteredTrips: Trip[];
    months: string[];
    hasMore: boolean;
    isLoadingMore: boolean;
    loadMore: () => Promise<void>;

    // Stats & AI
    stats: ProcessedData | null;
    isProcessing: boolean;
    isAiTraining: boolean;
    aiScenarios: Array<{ name: string; speed: number; efficiency: number; range: number }>;
    aiLoss: number | null;
    aiSoH: number | null;
    aiSoHStats: SoHStats | null;
    predictDeparture: (startTime: number) => Promise<{ departureTime: number; duration: number } | null>;
    findSmartChargingWindows: (trips: Trip[], settings: Settings) => Promise<{ windows: unknown[]; weeklyKwh: number; requiredHours: number; hoursFound: number; note?: string } | null>;
    forceRecalculate: () => void;
    recalculateSoH: () => Promise<void>;
    recalculateAutonomy: () => Promise<void>;

    // Actions
    clearData: () => boolean;
    saveToHistory: () => { success: boolean; total?: number; added?: number; reason?: string };
    loadFromHistory: () => { success: boolean; count?: number; reason?: string };
    clearHistory: () => boolean;

    // Anomalies
    acknowledgedAnomalies: string[];
    setAcknowledgedAnomalies: (ids: string[]) => void;
    deletedAnomalies: string[];
    setDeletedAnomalies: (ids: string[]) => void;
}

const TripsContext = createContext<TripsContextValue | undefined>(undefined);

export const useTripsContext = () => {
    const context = useContext(TripsContext);
    if (!context) {
        throw new Error('useTripsContext must be used within a TripsProvider');
    }
    return context;
};

export function TripsProvider({ children }: { children: ReactNode }) {
    const { settings } = useApp();
    const { activeCarId, activeCar } = useCar();
    // Use VIN as the vehicle ID for server queries
    const vehicleId = activeCar?.vin || null;
    const { charges } = useChargesContext();
    const { filterType, selMonth, dateFrom, dateTo } = useFiltersContext();

    // 1. Storage & Local Trips
    const {
        rawTrips: localTrips, // Rename to avoid confusion
        setRawTrips,
        tripHistory,
        setTripHistory,
        clearData,
        saveToHistory,
        loadFromHistory,
        clearHistory
    } = useTrips(activeCarId);

    // Compute Date Range for Server-Side Filtering
    const serverDateRange = useMemo(() => {
        if (filterType === 'month' && selMonth) { // selMonth is "YYYY-MM"
            const [yStr, mStr] = selMonth.split('-');
            const year = parseInt(yStr);
            const month = parseInt(mStr);
            // Last day of month
            const lastDay = new Date(year, month, 0).getDate();

            return {
                start: `${yStr}${mStr}01`,
                end: `${yStr}${mStr}${lastDay.toString().padStart(2, '0')}`
            };
        }
        if (filterType === 'range' && dateFrom && dateTo) {
            return {
                start: dateFrom.replace(/-/g, ''),
                end: dateTo.replace(/-/g, '')
            };
        }
        return undefined;
    }, [filterType, selMonth, dateFrom, dateTo]);

    // 2. We need process hook BEFORE we can pass recalculateAutonomy to useMergedTrips, 
    // but useMergedTrips is needed FOR useProcessedData.
    // Let's use a ref to break the dependency cycle.
    const recalculateAutonomyRef = useRef<(() => Promise<void>) | null>(null);

    // Pass vehicleId (VIN) for Firebase queries
    const { allTrips, months, hasMore, isLoadingMore, loadMore } = useMergedTrips(
        localTrips,
        settings,
        vehicleId,
        serverDateRange,
        () => recalculateAutonomyRef.current ? recalculateAutonomyRef.current() : Promise.resolve()
    );

    // 3. Filtering
    const filteredTrips = useMemo(() => {
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

    // 4. Stats & AI Processing
    const processed = useProcessedData(filteredTrips, allTrips, settings, charges, 'es', activeCarId);

    // Bind the recalculateAutonomy function to the ref so useMergedTrips can call it
    useEffect(() => {
        recalculateAutonomyRef.current = processed.recalculateAutonomy;
    }, [processed.recalculateAutonomy]);

    // 5. Anomalies
    const [acknowledgedAnomalies, setAcknowledgedAnomalies] = useLocalStorage<string[]>('acknowledged_anomalies', []);
    const [deletedAnomalies, setDeletedAnomalies] = useLocalStorage<string[]>('deleted_anomalies', []);

    const value = useMemo(() => ({
        rawTrips: allTrips, // Exposing merged trips as "rawTrips" to match legacy API
        setRawTrips,
        tripHistory,
        setTripHistory,

        allTrips,
        filteredTrips,
        months,
        hasMore,
        isLoadingMore,
        loadMore,

        stats: processed.data,
        isProcessing: processed.isProcessing,
        isAiTraining: processed.isAiTraining,
        aiScenarios: processed.aiScenarios,
        aiLoss: processed.aiLoss,
        aiSoH: processed.aiSoH,
        aiSoHStats: processed.aiSoHStats,
        predictDeparture: processed.predictDeparture,
        findSmartChargingWindows: processed.findSmartChargingWindows,
        forceRecalculate: processed.forceRecalculate,
        recalculateSoH: processed.recalculateSoH,
        recalculateAutonomy: processed.recalculateAutonomy,

        clearData,
        saveToHistory,
        loadFromHistory,
        clearHistory,

        acknowledgedAnomalies,
        setAcknowledgedAnomalies,
        deletedAnomalies,
        setDeletedAnomalies
    } as any), [
        allTrips, setRawTrips, tripHistory, setTripHistory,
        filteredTrips, months, hasMore, isLoadingMore, loadMore,
        processed,
        clearData, saveToHistory, loadFromHistory, clearHistory,
        acknowledgedAnomalies, setAcknowledgedAnomalies, deletedAnomalies, setDeletedAnomalies
    ] as any);

    return (
        <TripsContext.Provider value={value}>
            {children}
        </TripsContext.Provider>
    );
}
