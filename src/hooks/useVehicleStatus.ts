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
 * @param smartcarVehicleId - The Smartcar vehicle ID to subscribe to
 * @param options - Configuration options
 * @returns Vehicle status data or null if not available
 */
export function useVehicleStatus(
    smartcarVehicleId: string | undefined,
    options: UseVehicleStatusOptions = {}
): VehicleStatus | null {
    const { enabled = true } = options;
    const [vehicleData, setVehicleData] = useState<VehicleStatus | null>(null);

    useEffect(() => {
        // Don't subscribe if disabled or no vehicle ID
        if (!enabled || !smartcarVehicleId) {
            setVehicleData(null);
            return;
        }

        const db = getFirestore(getApp());
        const vehicleRef = doc(db, 'vehicles', smartcarVehicleId);

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
    }, [smartcarVehicleId, enabled]);

    return vehicleData;
}

export default useVehicleStatus;
