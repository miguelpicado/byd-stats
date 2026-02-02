import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { Trip } from '../types';

// TODO: User must replace with their own Firebase Config from Console
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const subscribeToTrips = (onUpdate: (trips: Trip[]) => void) => {
    const q = query(collection(db, 'trips'), orderBy('startDate', 'desc'));

    return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
        const trips: Trip[] = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            trips.push({
                id: doc.id,
                // Map Firestore types to App types
                date: new Date(data.startDate.seconds * 1000).toISOString().split('T')[0].replace(/-/g, ''), // YYYYMMDD
                start_timestamp: data.startDate.seconds * 1000,
                end_timestamp: data.endDate ? data.endDate.seconds * 1000 : (data.startDate.seconds * 1000) + ((data.durationMinutes || 0) * 60000),
                trip: data.distanceKm || 0,
                electricity: data.consumptionKwh || 0,
                // Estimate duration if missing or use logged duration
                duration: data.durationMinutes || 0,
                // Add source flag for UI distinction
                source: 'smartcar'
            } as any);
        });
        onUpdate(trips);
    });
};

export { db };
