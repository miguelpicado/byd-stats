import { useState, useEffect, useMemo } from 'react';
import { Trip, Settings } from '@/types';
import { subscribeToTrips } from '@/services/firebase';

/**
 * Hook to manage trips from Firebase and merge them with local storage
 * Handles subscription, debouncing, and consumption calculation
 */
export const useMergedTrips = (rawTrips: Trip[], settings: Settings) => {
    // Firebase Trips State
    const [firebaseTrips, setFirebaseTrips] = useState<Trip[]>([]);

    // Subscribe to Firebase
    useEffect(() => {
        let debounceTimer: NodeJS.Timeout;

        // Subscribe without batterySize - consumption calculated at merge time
        const unsubscribe = subscribeToTrips((trips) => {
            // Debounce updates to prevent excessive re-renders
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                setFirebaseTrips(trips);
            }, 300); // 300ms debounce
        }, 500);

        return () => {
            clearTimeout(debounceTimer);
            unsubscribe();
        };
    }, []); // No dependencies - subscribe once

    // Computed: Merged Trips (Local + Remote)
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

    // Computed: Unique Months
    const months = useMemo(() => {
        return [...new Set(allTrips.map(t => t.month).filter(Boolean) as string[])].sort();
    }, [allTrips]);

    return { allTrips, months };
};
