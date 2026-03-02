import { useEffect } from 'react';
import { logger } from '@core/logger';
import { bydWakeVehicle } from '@/services/bydApi';
import { Car } from '@/types';

export function useVehicleWakeup(activeCar: Car | null) {
    useEffect(() => {
        const vin = activeCar?.vin;
        if (!vin) return;

        const COOLDOWN_KEY = 'byd_last_wake_timestamp';
        const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

        const lastWake = parseInt(localStorage.getItem(COOLDOWN_KEY) || '0', 10);
        const now = Date.now();

        if (now - lastWake < COOLDOWN_MS) {
            logger.info(`[SyncProvider] Wake skipped — cooldown active (${Math.round((COOLDOWN_MS - (now - lastWake)) / 60000)}min remaining)`);
            return;
        }

        logger.info(`[SyncProvider] Waking vehicle ${vin} on app open...`);
        localStorage.setItem(COOLDOWN_KEY, String(now));

        bydWakeVehicle(vin)
            .then((result) => {
                logger.info(`[SyncProvider] Wake on open: success=${result.success}, SoC=${result.data?.socPercent}%`);
            })
            .catch((err) => {
                logger.error('[SyncProvider] Wake on open failed:', err);
                // Reset timestamp so next open can retry
                localStorage.removeItem(COOLDOWN_KEY);
            });
    }, [activeCar?.vin]);
}
