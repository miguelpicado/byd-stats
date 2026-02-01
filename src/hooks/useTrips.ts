import { useState, useEffect, useCallback } from 'react';
import { Trip } from '@/types';
import { StorageService } from '@/services/StorageService';
import { STORAGE_KEY as BASE_STORAGE_KEY, TRIP_HISTORY_KEY as BASE_TRIP_HISTORY_KEY } from '@core/constants';

export interface UseTripsReturn {
    rawTrips: Trip[];
    setRawTrips: React.Dispatch<React.SetStateAction<Trip[]>>;
    tripHistory: Trip[];
    setTripHistory: React.Dispatch<React.SetStateAction<Trip[]>>;
    clearData: () => boolean;
    saveToHistory: () => { success: boolean; total?: number; added?: number; reason?: string };
    loadFromHistory: () => { success: boolean; count?: number; reason?: string };
    clearHistory: () => boolean;
}

export const useTrips = (activeCarId: string | null = null): UseTripsReturn => {
    const storageKey = activeCarId ? `${BASE_STORAGE_KEY}_${activeCarId}` : null;
    const historyKey = activeCarId ? `${BASE_TRIP_HISTORY_KEY}_${activeCarId}` : null;

    const [rawTrips, setRawTrips] = useState<Trip[]>([]);
    const [tripHistory, setTripHistory] = useState<Trip[]>([]);

    // Load initial data
    useEffect(() => {
        if (!storageKey) {
            setRawTrips([]);
            return;
        }
        const trips = StorageService.get<Trip[]>(storageKey, []);
        setRawTrips(Array.isArray(trips) ? trips : []);
    }, [storageKey]);

    useEffect(() => {
        if (!historyKey) {
            setTripHistory([]);
            return;
        }
        const history = StorageService.get<Trip[]>(historyKey, []);
        setTripHistory(Array.isArray(history) ? history : []);
    }, [historyKey]);

    // Persistence effects
    useEffect(() => {
        if (storageKey) {
            if (rawTrips.length > 0) {
                StorageService.save(storageKey, rawTrips);
            }
            // Note: We don't auto-clear on empty array to prevent accidental data loss
            // explicit clearData() handles the removal
        }
    }, [rawTrips, storageKey]);

    useEffect(() => {
        if (historyKey && tripHistory.length > 0) {
            StorageService.save(historyKey, tripHistory);
        }
    }, [tripHistory, historyKey]);

    // Actions
    const clearData = useCallback(() => {
        setRawTrips([]);
        if (storageKey) StorageService.remove(storageKey);
        return true;
    }, [storageKey]);

    const saveToHistory = useCallback(() => {
        if (rawTrips.length === 0) {
            return { success: false, reason: 'no_trips' };
        }

        const map = new Map();
        tripHistory.forEach(t => map.set(t.date + '-' + t.start_timestamp, t));
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

    const loadFromHistory = useCallback(() => {
        if (tripHistory.length === 0) {
            return { success: false, reason: 'no_history' };
        }
        setRawTrips(tripHistory);
        return { success: true, count: tripHistory.length };
    }, [tripHistory]);

    const clearHistory = useCallback(() => {
        setTripHistory([]);
        if (historyKey) StorageService.remove(historyKey);
        return true;
    }, [historyKey]);

    return {
        rawTrips,
        setRawTrips,
        tripHistory,
        setTripHistory,
        clearData,
        saveToHistory,
        loadFromHistory,
        clearHistory
    };
};
