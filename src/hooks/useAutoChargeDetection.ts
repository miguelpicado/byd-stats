/**
 * Auto Charge Detection Hook
 * Monitors vehicle status and automatically detects charge sessions
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useVehicleStatus } from './useVehicleStatus';
import { useCar } from '@/context/CarContext';
import { useModalContext } from '@/providers/ModalProvider';
import toast from 'react-hot-toast';

interface ChargeSession {
    startTime: number;
    startSoC: number;
    startOdometer: number;
}

export function useAutoChargeDetection() {
    const { t } = useTranslation();
    const { activeCar } = useCar();
    const { openModal } = useModalContext();
    const vehicleStatus = useVehicleStatus(activeCar?.vin);

    // Track previous charging state
    const previousChargingRef = useRef<boolean>(false);

    // Track current charge session
    const currentSessionRef = useRef<ChargeSession | null>(null);

    // Check if auto-register is enabled
    const isEnabled = () => {
        const saved = localStorage.getItem('byd_auto_register_charges');
        return saved === 'true';
    };

    useEffect(() => {
        if (!vehicleStatus || !isEnabled()) {
            return;
        }

        const isCharging = vehicleStatus.chargingActive || false;
        const wasCharging = previousChargingRef.current;

        // Charge started
        if (isCharging && !wasCharging) {
            console.log('[AutoChargeDetection] Charge started');
            currentSessionRef.current = {
                startTime: Date.now(),
                startSoC: vehicleStatus.lastSoC || 0,
                startOdometer: vehicleStatus.lastOdometer || 0,
            };

            toast.success(t('charges.autoDetectStart'));
        }

        // Charge ended
        if (!isCharging && wasCharging && currentSessionRef.current) {
            console.log('[AutoChargeDetection] Charge ended');

            const session = currentSessionRef.current;
            const endSoC = vehicleStatus.lastSoC || 0;
            const endOdometer = vehicleStatus.lastOdometer || 0;

            // Calculate charge data
            const duration = (Date.now() - session.startTime) / 1000 / 60; // minutes
            const socGain = endSoC - session.startSoC;

            // Only register if charge was meaningful (at least 1% SoC gain and 5+ minutes)
            if (socGain >= 0.01 && duration >= 5) {
                // Prepare prefilled data
                const now = new Date();
                const prefilledData = {
                    type: 'electric' as const,
                    date: now.toISOString().split('T')[0],
                    time: now.toTimeString().split(' ')[0].substring(0, 5),
                    odometer: endOdometer,
                    initialPercentage: Math.round(session.startSoC * 100),
                    finalPercentage: Math.round(endSoC * 100),
                    kwhCharged: '',
                    totalCost: '',
                    location: '',
                    notes: t('charges.autoDetectedNote'),
                };

                // Store prefilled data in localStorage for the modal to pick up
                localStorage.setItem('auto_charge_prefill', JSON.stringify(prefilledData));

                // Open the modal
                openModal('addCharge');

                toast.success(t('charges.autoDetectEnd'));
            }

            // Clear session
            currentSessionRef.current = null;
        }

        // Update previous state
        previousChargingRef.current = isCharging;
    }, [vehicleStatus, openModal]);
}

export default useAutoChargeDetection;
