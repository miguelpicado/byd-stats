import React, { useState } from 'react';
import { useCar } from '@/context/CarContext';
import { bydWakeVehicle } from '@/services/bydApi';
import toast from 'react-hot-toast';
import { logger } from '@core/logger';
import type { Trip, Charge } from '@/types';
import type { VehicleStatus } from '@/hooks/useVehicleStatus';
import ChargingOverlay from './ChargingOverlay';

interface CarVisualizationProps {
    onForceRefresh?: () => void;
    trips?: Trip[];
    charges?: Charge[];
    recalculateSoH?: () => Promise<void>;
    recalculateAutonomy?: () => Promise<void>;
    vehicleStatus?: VehicleStatus | null;
    batteryCapacityKwh?: number;
}

const CarVisualization: React.FC<CarVisualizationProps> = ({
    onForceRefresh,
    trips = [],
    charges = [],
    recalculateSoH,
    recalculateAutonomy,
    vehicleStatus,
    batteryCapacityKwh = 0
}) => {
    const { activeCar } = useCar();
    const [tapCount, setTapCount] = useState(0);
    const [lastTap, setLastTap] = useState(0);

    const handleImageClick = async () => {
        const now = Date.now();
        const vin = activeCar?.vin;

        if (now - lastTap > 2000) {
            setTapCount(1);
        } else {
            const newCount = tapCount + 1;
            if (newCount >= 10) {
                logger.info('[CarVisualization] 10 taps detected - triggering AI recalculation');

                // Wake vehicle if VIN available
                if (vin) {
                    toast.promise(
                        bydWakeVehicle(vin).then((result) => {
                            onForceRefresh?.();
                            return result;
                        }),
                        {
                            loading: 'Waking car and updating location...',
                            success: 'Vehicle data and location refreshed!',
                            error: 'Failed to wake car'
                        }
                    );
                } else {
                    onForceRefresh?.();
                }

                // Check if we have relevant new data for AI recalculation
                const hasEnoughCharges = charges.length >= 3;
                const hasEnoughTrips = trips.length >= 5;

                // Recalculate AI models if we have enough data
                if (hasEnoughCharges && recalculateSoH) {
                    logger.info(`[CarVisualization] Recalculating SoH with ${charges.length} charges`);
                    toast.promise(
                        recalculateSoH(),
                        {
                            loading: 'Recalculating Battery Health (SoH)...',
                            success: 'SoH AI model updated!',
                            error: 'Failed to recalculate SoH'
                        }
                    );
                } else if (!hasEnoughCharges) {
                    logger.warn(`[CarVisualization] Not enough charges for SoH (need 3, have ${charges.length})`);
                }

                if (hasEnoughTrips && recalculateAutonomy) {
                    logger.info(`[CarVisualization] Recalculating Autonomy with ${trips.length} trips`);
                    toast.promise(
                        recalculateAutonomy(),
                        {
                            loading: 'Recalculating Range Analysis...',
                            success: 'Range AI model updated!',
                            error: 'Failed to recalculate range'
                        }
                    );
                } else if (!hasEnoughTrips) {
                    logger.warn(`[CarVisualization] Not enough trips for Autonomy (need 5, have ${trips.length})`);
                }

                // Show feedback if no AI models were recalculated
                if (!hasEnoughCharges && !hasEnoughTrips) {
                    toast('Need more data for AI analysis\n(min: 3 charges, 5 trips)', {
                        icon: 'ℹ️',
                        duration: 3000
                    });
                }

                setTapCount(0);
            } else {
                setTapCount(newCount);
            }
        }
        setLastTap(now);
    };

    // Match LiveVehicleStatus detection: check both fields (Firestore may have either)
    const isCharging = vehicleStatus?.chargingActive === true || ('isCharging' in (vehicleStatus ?? {}) && (vehicleStatus as { isCharging?: boolean })?.isCharging === true);

    return (
        <div
            className="w-full h-52 relative flex items-center justify-center py-1 shrink-0 cursor-pointer"
            onClick={handleImageClick}
        >
            <img
                src="/assets/byd_seal.png?t=1"
                alt="BYD Seal 2024"
                className={`w-full h-full object-contain select-none scale-[0.8] relative z-0 transition-all duration-500 ${isCharging ? 'blur-[2px] opacity-30' : ''}`}
                onError={(e) => {
                    e.currentTarget.parentElement?.classList.add('border-2', 'border-red-500');
                    console.error('Image failed to load:', e.currentTarget.src);
                }}
            />
            {/* Ground shadow */}
            <div
                className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-[85%] h-6 rounded-[50%] blur-sm transition-opacity duration-500 ${isCharging ? 'opacity-20' : 'opacity-60'}`}
                style={{
                    background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.4) 30%, rgba(0,0,0,0.1) 60%, transparent 80%)'
                }}
            />
            {/* Charging overlay */}
            {isCharging && vehicleStatus && (
                <ChargingOverlay
                    vehicleStatus={vehicleStatus}
                    batteryCapacityKwh={batteryCapacityKwh}
                />
            )}
        </div>
    );
};

export default CarVisualization;
