// BYD Stats - Vehicle Status Hook
// Shared hook for subscribing to real-time vehicle data from Firestore
// Eliminates duplicate subscriptions across components

import { useState, useEffect } from 'react';
import { getFirestore, doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { logger } from '@core/logger';

/**
 * Vehicle data structure from Firestore
 */
export interface VehicleStatus {
    // Battery & Charging
    lastSoC?: number;
    chargingActive?: boolean;
    activeChargeSessionId?: string;

    // Trip status
    activeTripId?: string;
    pollingActive?: boolean;

    // Security
    isLocked?: boolean;

    // Climate
    climateActive?: boolean;

    // Trunk
    trunkOpen?: boolean;

    // Tires
    tires?: {
        frontLeft: number;
        frontRight: number;
        backLeft: number;
        backRight: number;
    };

    // Capacity tracking
    lastBatteryCapacity?: number;
    lastBatteryCapacityDate?: Timestamp;

    // Metadata
    lastUpdate?: Timestamp;
}

interface UseVehicleStatusOptions {
    /** Only subscribe when this is true (e.g., when modal is open) */
    enabled?: boolean;
}

/**
 * Hook to subscribe to vehicle status in Firestore
 * @param vehicleId - The Vehicle VIN/ID to subscribe to
 * @param options - Configuration options
 * @returns Vehicle status data or null if not available
 */
export function useVehicleStatus(
    vehicleId: string | undefined,
    options: UseVehicleStatusOptions = {}
): VehicleStatus | null {
    const { enabled = true } = options;
    const [vehicleData, setVehicleData] = useState<VehicleStatus | null>(null);

    useEffect(() => {
        // Don't subscribe if disabled or no vehicle ID
        if (!enabled || !vehicleId) {
            setVehicleData(null);
            return;
        }

        const db = getFirestore(getApp());
        // BYD VINs are 17 chars, use bydVehicles collection
        const isByd = vehicleId.length === 17;
        const vehicleRef = isByd
            ? doc(db, 'bydVehicles', vehicleId)
            : doc(db, 'vehicles', vehicleId);

        // Note: BYD vehicle wake is handled in SyncProvider on app load

        const unsubscribe = onSnapshot(
            vehicleRef,
            (docSnapshot) => {
                if (docSnapshot.exists()) {
                    setVehicleData(docSnapshot.data() as VehicleStatus);
                } else {
                    setVehicleData(null);
                }
            },
            (error) => {
                logger.error('[useVehicleStatus] Error listening to vehicle:', error);
                setVehicleData(null);
            }
        );

        return () => unsubscribe();
    }, [vehicleId, enabled]);

    return vehicleData;
}

/**
 * Helper to determine the correct ID to use for status subscription
 */
export function getStatusId(car: any): string | undefined {
    return car?.vin; // PyBYD uses VIN
}

export default useVehicleStatus;
