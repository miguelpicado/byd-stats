// BYD Stats - Vehicle Status Hook
// Shared hook for subscribing to real-time vehicle data from Firestore
// Eliminates duplicate subscriptions across components

import { useState, useEffect } from 'react';
import { getFirestore, doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { logger } from '@core/logger';
import { useLayout } from '@/context/LayoutContext';

/**
 * Vehicle data structure from Firestore
 */
export interface VehicleStatus {
    // Battery & Charging
    lastSoC?: number;
    chargingActive?: boolean;
    activeChargeSessionId?: string;
    lastOdometer?: number;

    // Telemetry & Driving
    lastPower?: number;
    lastSpeed?: number;
    lastGear?: number;
    epbStatus?: number;

    // Trip status
    activeTripId?: string;
    pollingActive?: boolean;

    // Security
    isLocked?: boolean;

    // Climate
    climateActive?: boolean;
    interiorTemp?: number;
    exteriorTemp?: number;

    // Windows & Doors
    doors?: {
        frontLeft: boolean;
        frontRight: boolean;
        rearLeft: boolean;
        rearRight: boolean;
        trunk: boolean;
        hood: boolean;
    };
    windows?: {
        frontLeft: boolean;
        frontRight: boolean;
        rearLeft: boolean;
        rearRight: boolean;
    };

    // Trunk
    trunkOpen?: boolean;

    // Tires
    tirePressure?: {
        frontLeft: number;
        frontRight: number;
        rearLeft: number;
        rearRight: number;
    };

    // Capacity tracking
    lastBatteryCapacity?: number;
    lastBatteryCapacityDate?: Timestamp;

    // Location
    lastLocation?: {
        lat: number;
        lon: number;
        heading?: number;
    };

    // Charging detail (from cloudProbeVehicle)
    chargingDetail?: {
        soc: number;
        chargeType?: string | null;
        remainingMinutes?: number | null;
        targetSoc?: number | null;
        initialSoC?: number | null;
        chargingStartTime?: Timestamp;
        estimatedPowerKw?: number | null;
        scheduledCharging?: boolean;
        lastUpdate?: Timestamp;
    };

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
    const { isNative } = useLayout();
    // Initialize state lazily to avoid cascading renders
    const [vehicleData, setVehicleData] = useState<VehicleFirestoreData | null>(() => {
        if (!enabled || !vehicleId || !isNative) return null;
        try {
            const cached = localStorage.getItem(`byd_vehicle_${vehicleId}`);
            if (cached) return JSON.parse(cached);
        } catch (e) {
            logger.error('Failed to parse cached vehicle data', e);
        }
        return null;
    });

    // Realtime listener
    useEffect(() => {
        // Don't subscribe if disabled, no vehicle ID, or not native (PWA)
        if (!enabled || !vehicleId || !isNative) {
            return;
        }
        const db = getFirestore(getApp());
        const vehicleRef = doc(db, 'bydVehicles', vehicleId);

        // Note: BYD vehicle wake is handled in SyncProvider on app load

        const unsubscribe = onSnapshot(
            vehicleRef,
            (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const newData = docSnapshot.data() as VehicleStatus;

                    setVehicleData(prevData => {
                        // Merge new data with previous, keeping last valid values
                        const merged = { ...newData };

                        // Keep last valid location if new location is 0,0 (deep sleep)
                        if (newData.lastLocation?.lat === 0 && newData.lastLocation?.lon === 0) {
                            if (prevData?.lastLocation && !(prevData.lastLocation.lat === 0 && prevData.lastLocation.lon === 0)) {
                                logger.info('[useVehicleStatus] Keeping last valid location (new location is 0,0 - deep sleep)');
                                merged.lastLocation = prevData.lastLocation;
                            }
                        }

                        // Keep last valid tire pressure if new pressure is all 0s (deep sleep)
                        if (newData.tirePressure) {
                            const allZero = Object.values(newData.tirePressure).every(v => v === 0);
                            if (allZero && prevData?.tirePressure) {
                                const prevAllZero = Object.values(prevData.tirePressure).every(v => v === 0);
                                if (!prevAllZero) {
                                    logger.info('[useVehicleStatus] Keeping last valid tire pressure (new pressure is all 0s - deep sleep)');
                                    merged.tirePressure = prevData.tirePressure;
                                }
                            }
                        }

                        return merged;
                    });
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
    }, [vehicleId, enabled, isNative]);

    return vehicleData;
}

/**
 * Helper to determine the correct ID to use for status subscription
 */
export function getStatusId(car: any): string | undefined {
    return car?.vin; // PyBYD uses VIN
}

export default useVehicleStatus;
