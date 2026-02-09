// BYD Stats - Paginated Trips Hook
// Implements cursor-based pagination for efficient loading of large trip datasets

import { useState, useCallback, useEffect } from 'react';
import { DocumentSnapshot, DocumentData } from 'firebase/firestore';
import { Trip } from '@/types';
import { fetchTripsPage } from '@/services/firebase';
import { logger } from '@core/logger';

interface UsePaginatedTripsOptions {
    /** Number of trips to load per page */
    pageSize?: number;
    /** Battery size for consumption calculation */
    batterySize?: number;
    /** Enable automatic first page load */
    autoLoad?: boolean;
}

interface UsePaginatedTripsReturn {
    /** All loaded trips (accumulated across pages) */
    trips: Trip[];
    /** Whether data is currently being fetched */
    loading: boolean;
    /** Error if the last fetch failed */
    error: Error | null;
    /** Whether there are more trips to load */
    hasMore: boolean;
    /** Load the next page of trips */
    loadMore: () => Promise<void>;
    /** Reset and reload from the beginning */
    refresh: () => Promise<void>;
    /** Total number of trips loaded */
    totalLoaded: number;
}

/**
 * Hook for paginated trip loading with infinite scroll support
 * Uses cursor-based pagination for efficient Firestore queries
 *
 * @example
 * ```tsx
 * const { trips, loading, hasMore, loadMore } = usePaginatedTrips({ pageSize: 50 });
 *
 * return (
 *   <div onScroll={handleScroll}>
 *     {trips.map(trip => <TripCard key={trip.id} trip={trip} />)}
 *     {hasMore && <button onClick={loadMore}>Load More</button>}
 *   </div>
 * );
 * ```
 */
export function usePaginatedTrips(options: UsePaginatedTripsOptions = {}): UsePaginatedTripsReturn {
    const { pageSize = 50, batterySize = 82.56, autoLoad = true } = options;

    const [trips, setTrips] = useState<Trip[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [cursor, setCursor] = useState<DocumentSnapshot<DocumentData> | null>(null);
    const [initialized, setInitialized] = useState(false);

    // Calculate consumption for trips that don't have it
    const enrichTrips = useCallback((rawTrips: Trip[]): Trip[] => {
        return rawTrips.map(t => {
            if (t.electricity > 0) return t;

            if (t.start_soc && t.end_soc) {
                const socDelta = t.start_soc - t.end_soc;
                if (socDelta > 0) {
                    return { ...t, electricity: (socDelta / 100) * batterySize };
                }
            }
            return t;
        });
    }, [batterySize]);

    const loadMore = useCallback(async () => {
        if (loading || !hasMore) return;

        setLoading(true);
        setError(null);

        try {
            logger.debug('[usePaginatedTrips] Loading page, cursor:', cursor ? 'yes' : 'no');
            const result = await fetchTripsPage(cursor, pageSize);

            const enrichedTrips = enrichTrips(result.trips);

            setTrips(prev => [...prev, ...enrichedTrips]);
            setCursor(result.lastDoc);
            setHasMore(result.hasMore);

            logger.debug('[usePaginatedTrips] Loaded:', result.trips.length, 'hasMore:', result.hasMore);
        } catch (err) {
            logger.error('[usePaginatedTrips] Error loading page:', err);
            setError(err instanceof Error ? err : new Error('Failed to load trips'));
        } finally {
            setLoading(false);
        }
    }, [loading, hasMore, cursor, pageSize, enrichTrips]);

    const refresh = useCallback(async () => {
        logger.debug('[usePaginatedTrips] Refreshing...');
        setTrips([]);
        setCursor(null);
        setHasMore(true);
        setError(null);
        setInitialized(false);
    }, []);

    // Auto-load first page if enabled
    useEffect(() => {
        if (autoLoad && !initialized && !loading) {
            setInitialized(true);
            loadMore();
        }
    }, [autoLoad, initialized, loading, loadMore]);

    return {
        trips,
        loading,
        error,
        hasMore,
        loadMore,
        refresh,
        totalLoaded: trips.length
    };
}

export default usePaginatedTrips;
