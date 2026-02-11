import { initializeApp } from 'firebase/app';
import {
    initializeFirestore,
    collection,
    query,
    orderBy,
    limit,
    where,
    onSnapshot,
    DocumentData,
    DocumentSnapshot,
    startAfter,
    getDocs,
    persistentLocalCache,
    persistentMultipleTabManager,
    QueryConstraint
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
export const subscribeToTrips = (
    onUpdate: (trips: Trip[]) => void,
    userId: string,
    maxTrips = 500,
    dateRange?: { start?: string; end?: string }
) => {
    logger.info('[Firebase] Subscribe init:', firebaseConfig.projectId, `(userId: ${userId}, limit: ${maxTrips}, range: ${JSON.stringify(dateRange)})`);

    const constraints: QueryConstraint[] = [
        where('userId', '==', userId),
        where('status', '==', 'completed')
    ];

    if (dateRange?.start) {
        // Convert YYYYMMDD string or ensure timestamp
        const startTimestamp = new Date(
            parseInt(dateRange.start.substring(0, 4)),
            parseInt(dateRange.start.substring(4, 6)) - 1,
            parseInt(dateRange.start.substring(6, 8))
        );
        constraints.push(where('startDate', '>=', startTimestamp));
    }

    if (dateRange?.end) {
        const endTimestamp = new Date(
            parseInt(dateRange.end.substring(0, 4)),
            parseInt(dateRange.end.substring(4, 6)) - 1,
            parseInt(dateRange.end.substring(6, 8)),
            23, 59, 59
        );
        constraints.push(where('startDate', '<=', endTimestamp));
    }

    // Try optimized query (requires composite index)
    // Always order by startDate desc
    const optimizedQuery = query(
        collection(db, 'trips'),
        ...(constraints as any),
        orderBy('startDate', 'desc'),
        limit(maxTrips)
    );

    // Explicit fallback removed for clarity - we should assume indexes exist for S6

    let unsubscribe = onSnapshot(optimizedQuery, (snapshot) => {
        const trips: Trip[] = [];
        snapshot.forEach((doc) => {
            const trip = mapDocToTrip(doc as DocumentSnapshot<DocumentData>);
            if (trip) trips.push(trip);
        });
        onUpdate(trips);
    }, (error) => {
        logger.error('[Firebase] Subscribe error:', error);
    });

    return () => unsubscribe();
};

/**
 * Fetch trips with cursor pagination for infinite scroll
 */
export const fetchTripsPage = async (
    userId: string,
    cursor: DocumentSnapshot<DocumentData> | null = null,
    pageSize = 50,
    dateRange?: { start?: string; end?: string }
): Promise<{ trips: Trip[]; lastDoc: DocumentSnapshot<DocumentData> | null; hasMore: boolean }> => {
    logger.debug('[Firebase] Fetching page:', cursor ? 'next' : 'first', `(userId: ${userId}, size: ${pageSize})`);

    const constraints: QueryConstraint[] = [
        where('userId', '==', userId),
        where('status', '==', 'completed')
    ];

    if (dateRange?.start) {
        const startTimestamp = new Date(
            parseInt(dateRange.start.substring(0, 4)),
            parseInt(dateRange.start.substring(4, 6)) - 1,
            parseInt(dateRange.start.substring(6, 8))
        );
        constraints.push(where('startDate', '>=', startTimestamp));
    }

    if (dateRange?.end) {
        const endTimestamp = new Date(
            parseInt(dateRange.end.substring(0, 4)),
            parseInt(dateRange.end.substring(4, 6)) - 1,
            parseInt(dateRange.end.substring(6, 8)),
            23, 59, 59
        );
        constraints.push(where('startDate', '<=', endTimestamp));
    }

    constraints.push(orderBy('startDate', 'desc'));
    constraints.push(limit(pageSize));

    const q = cursor
        ? query(collection(db, 'trips'), ...(constraints as any), startAfter(cursor))
        : query(collection(db, 'trips'), ...(constraints as any));

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
