import { initializeApp } from 'firebase/app';
import {
    initializeFirestore,
    collection,
    query,
    orderBy,
    limit,
    where,
    onSnapshot,
    QuerySnapshot,
    DocumentData,
    DocumentSnapshot,
    startAfter,
    getDocs,
    persistentLocalCache,
    persistentMultipleTabManager
} from 'firebase/firestore';
import { Trip } from '../types';
import { logger } from '@core/logger';

// Firebase configuration loaded from environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with modern persistence configuration
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

/**
 * Maps a Firestore document to a Trip object
 * Does NOT calculate consumption - that's done at component level with batterySize
 */
const mapDocToTrip = (doc: DocumentSnapshot<DocumentData>): Trip | null => {
    const data = doc.data();
    if (!data) return null;

    const startTsMs = data.startDate ? (data.startDate.seconds * 1000) : Date.now();
    const startTsSec = Math.floor(startTsMs / 1000);

    const durationSec = (data.durationMinutes || 0) * 60;
    const endTsSec = data.endDate ? data.endDate.seconds : (startTsSec + durationSec);

    const dateObj = new Date(startTsMs);
    const dateStr = dateObj.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
    const monthStr = dateStr.substring(0, 6); // YYYYMM

    return {
        id: doc.id,
        date: dateStr,
        month: monthStr,
        start_timestamp: startTsSec,
        end_timestamp: endTsSec,
        trip: data.distanceKm || (data.endOdometer - data.startOdometer) || 0,
        electricity: data.consumptionKwh || 0, // Raw value, calculated later if 0
        duration: durationSec,
        start_soc: data.startSoC || 0,
        end_soc: data.endSoC || 0,
        source: 'smartcar',
        gpsDistanceKm: data.gpsDistanceKm
    };
};

/**
 * Subscribe to completed trips with server-side filtering
 * Falls back to client-side filtering if index is still building
 * batterySize removed - consumption calculation moved to useAppData
 */
export const subscribeToTrips = (onUpdate: (trips: Trip[]) => void, maxTrips = 500) => {
    logger.info('[Firebase] Subscribe init:', firebaseConfig.projectId, `(limit: ${maxTrips})`);

    // Try optimized query first (requires composite index)
    const optimizedQuery = query(
        collection(db, 'trips'),
        where('status', '==', 'completed'),
        orderBy('startDate', 'desc'),
        limit(maxTrips)
    );

    // Fallback query (no index required, filters client-side)
    const fallbackQuery = query(
        collection(db, 'trips'),
        orderBy('startDate', 'desc'),
        limit(maxTrips)
    );

    let usingFallback = false;
    let unsubscribe: (() => void) | null = null;

    const handleSnapshot = (snapshot: QuerySnapshot<DocumentData>) => {
        const trips: Trip[] = [];
        let skippedInProgress = 0;
        logger.debug('[Firebase] Snapshot received:', snapshot.size, snapshot.metadata.fromCache ? '(CACHED)' : '(SERVER)', usingFallback ? '(FALLBACK)' : '');

        snapshot.forEach((doc) => {
            const data = doc.data();

            // Client-side filter when using fallback query
            if (usingFallback && data.status === 'in_progress') {
                skippedInProgress++;
                return;
            }

            const trip = mapDocToTrip(doc as DocumentSnapshot<DocumentData>);
            if (trip) trips.push(trip);
        });

        logger.debug('[Firebase] Mapped trips:', trips.length, skippedInProgress > 0 ? `(skipped ${skippedInProgress} in_progress)` : '');
        onUpdate(trips);
    };

    const handleError = (error: Error) => {
        // Check if this is an index-building error
        if (error.message?.includes('index') && !usingFallback) {
            logger.warn('[Firebase] Index not ready, falling back to client-side filtering');
            usingFallback = true;

            // Unsubscribe from failed query and use fallback
            if (unsubscribe) unsubscribe();
            unsubscribe = onSnapshot(fallbackQuery, handleSnapshot, (fallbackError) => {
                logger.error('[Firebase] Fallback subscribe error:', fallbackError);
            });
        } else {
            logger.error('[Firebase] Subscribe error:', error);
        }
    };

    // Start with optimized query
    unsubscribe = onSnapshot(optimizedQuery, handleSnapshot, handleError);

    return () => {
        if (unsubscribe) unsubscribe();
    };
};

/**
 * Fetch trips with cursor pagination for infinite scroll
 * @param cursor - Last document from previous page (null for first page)
 * @param pageSize - Number of trips per page
 * @returns Object with trips array and last document for next page
 */
export const fetchTripsPage = async (
    cursor: DocumentSnapshot<DocumentData> | null = null,
    pageSize = 50
): Promise<{ trips: Trip[]; lastDoc: DocumentSnapshot<DocumentData> | null; hasMore: boolean }> => {
    logger.debug('[Firebase] Fetching page:', cursor ? 'next' : 'first', `(size: ${pageSize})`);

    const baseConstraints = [
        where('status', '==', 'completed'),
        orderBy('startDate', 'desc'),
        limit(pageSize)
    ];

    const q = cursor
        ? query(collection(db, 'trips'), ...baseConstraints, startAfter(cursor))
        : query(collection(db, 'trips'), ...baseConstraints);

    const snapshot = await getDocs(q);
    const trips: Trip[] = [];
    let lastDoc: DocumentSnapshot<DocumentData> | null = null;

    snapshot.forEach((doc) => {
        const trip = mapDocToTrip(doc as DocumentSnapshot<DocumentData>);
        if (trip) trips.push(trip);
        lastDoc = doc as DocumentSnapshot<DocumentData>;
    });

    return {
        trips,
        lastDoc,
        hasMore: snapshot.size === pageSize
    };
};

export { db };
