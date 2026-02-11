import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Trip, Settings } from '@/types';
import { subscribeToTrips, fetchTripsPage } from '@/services/firebase';
import { DocumentSnapshot, DocumentData } from 'firebase/firestore';
import { logger } from '@core/logger';

/**
 * Hook to manage trips from Firebase and merge them with local storage
 * Handles subscription, pagination, and consumption calculation
 */
export const useMergedTrips = (
    rawTrips: Trip[],
    settings: Settings,
    activeCarId: string | null,
    dateRange?: { start?: string; end?: string }
) => {
    // Firebase Trips State (Cumulative)
    const [latestTrips, setLatestTrips] = useState<Trip[]>([]); // Real-time updates
    const [historicalTrips, setHistoricalTrips] = useState<Trip[]>([]); // Paginating history

    // Pagination State
    const [lastDoc, setLastDoc] = useState<DocumentSnapshot<DocumentData> | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const isFirstLoad = useRef(true);

    // 1. Initial Load & Real-time Updates (Latest 20)
    useEffect(() => {
        if (!activeCarId) {
            setLatestTrips([]);
            setHistoricalTrips([]);
            setHasMore(false);
            return;
        }

        let debounceTimer: NodeJS.Timeout;

        // Subscribe to latest 20 trips for real-time updates
        const unsubscribe = subscribeToTrips((trips) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                setLatestTrips(trips);

                // If first load, we need to handle the initial historical fetch to set the cursor
                if (isFirstLoad.current) {
                    isFirstLoad.current = false;
                    // Trigger first history fetch to set up lastDoc and hasMore properly
                    loadMore();
                }
            }, 300);
        }, activeCarId, 20, dateRange);

        return () => {
            clearTimeout(debounceTimer);
            unsubscribe();
            // Reset state when car/filter changes
            setLatestTrips([]);
            setHistoricalTrips([]);
            setLastDoc(null);
            setHasMore(true);
            isFirstLoad.current = true;
        };
    }, [activeCarId, dateRange?.start, dateRange?.end]);

    // 2. Load More (Pagination)
    const loadMore = useCallback(async () => {
        if (!activeCarId || !hasMore || isLoadingMore) return;

        setIsLoadingMore(true);
        try {
            const result = await fetchTripsPage(activeCarId, lastDoc, 20, dateRange);

            if (result.trips.length > 0) {
                // Determine if we need to replace or append (first historical load vs subsequent)
                setHistoricalTrips(prev => {
                    // Avoid duplicating trips that might already be in latestTrips
                    const existingIds = new Set(latestTrips.map(t => t.id));
                    const newTrips = result.trips.filter(t => !existingIds.has(t.id));

                    if (lastDoc === null) {
                        return newTrips; // First historical page
                    }
                    return [...prev, ...newTrips];
                });

                setLastDoc(result.lastDoc);
                setHasMore(result.hasMore);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            logger.error('Error loading more trips:', error);
        } finally {
            setIsLoadingMore(false);
        }
    }, [activeCarId, hasMore, isLoadingMore, lastDoc, latestTrips]);

    // Computed: Merged Trips (Local + Latest + Historical)
    const batterySize = typeof settings?.batterySize === 'string'
        ? parseFloat(settings.batterySize)
        : (settings?.batterySize || 82.56);

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
        // Priority: Real-time (Latest) > Historical (Pagination) > Local
        const tripMap = new Map<string, Trip>();

        // 1. Add Local Trips
        rawTrips.forEach(t => {
            if (t.id && deletedTrips.includes(t.id)) return;
            const key = `${t.start_timestamp || t.date}-${t.trip}`;
            tripMap.set(key, withConsumption({ ...t, source: 'local' }));
        });

        // 2. Add Historical Trips
        historicalTrips.forEach(t => {
            if (t.id && deletedTrips.includes(t.id)) return;
            const key = `${t.start_timestamp || t.date}-${t.trip}`;
            tripMap.set(key, withConsumption(t));
        });

        // 3. Add Latest Trips (Highest Priority)
        latestTrips.forEach(t => {
            if (t.id && deletedTrips.includes(t.id)) return;
            const key = `${t.start_timestamp || t.date}-${t.trip}`;
            tripMap.set(key, withConsumption(t));
        });

        // Convert back to array and sort
        const merged = Array.from(tripMap.values());
        merged.sort((a, b) => (b.start_timestamp || 0) - (a.start_timestamp || 0));

        return merged;
    }, [rawTrips, latestTrips, historicalTrips, batterySize]);

    // Computed: Unique Months
    const months = useMemo(() => {
        return [...new Set(allTrips.map(t => t.month).filter(Boolean) as string[])].sort();
    }, [allTrips]);

    return {
        allTrips,
        months,
        hasMore,
        isLoadingMore,
        loadMore
    };
};
