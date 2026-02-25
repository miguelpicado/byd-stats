import { useEffect, useRef } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { useVehicleStatus } from '@/hooks/useVehicleStatus';
import { useCar } from '@/context/CarContext';
import { useData } from '@/providers/DataProvider';
import { useLayout } from '@/context/LayoutContext';
import { logger } from '@core/logger';
import { bydUnlock, bydWakeVehicle, bydFlashLights, bydStartClimate, bydStopClimate } from '@/services/bydApi';
import { toast } from 'react-hot-toast';

interface WearSyncPlugin {
    syncVehicleData(options: { rangeKm: number; soc: number; vin: string; climateActive: boolean }): Promise<{ success: boolean }>;
    addListener(eventName: 'onWatchAction', listenerFunc: (data: { action: string }) => void): Promise<any>;
}

const WearSync = registerPlugin<WearSyncPlugin>('WearSync');

export const useWearSync = () => {
    const { activeCar } = useCar();
    const { isNative } = useLayout();
    const { stats, openModal } = useData();
    const vehicleStatus = useVehicleStatus(activeCar?.vin);

    const lastSyncedRef = useRef<{ soc: number; range: number; vin: string; climate: boolean }>({
        soc: -1, range: -1, vin: '', climate: false
    });

    const activeCarRef = useRef(activeCar);
    const vehicleStatusRef = useRef(vehicleStatus);
    useEffect(() => { activeCarRef.current = activeCar; }, [activeCar]);
    useEffect(() => { vehicleStatusRef.current = vehicleStatus; }, [vehicleStatus]);

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        console.log("[useWearSync] Registering permanent watch action listener");
        const listener = WearSync.addListener('onWatchAction', async (data) => {
            const currentCar = activeCarRef.current;
            const currentStatus = vehicleStatusRef.current;

            console.log(`[useWearSync] Action received: ${data.action} for car: ${currentCar?.vin}`);
            if (!currentCar?.vin) return;

            const performAction = async (name: string, fn: () => Promise<any>) => {
                const toastId = toast.loading(`${name}...`);
                try {
                    const result = await fn();
                    if (result && result.success) {
                        toast.success(`${name} OK`, { id: toastId });
                        setTimeout(() => bydWakeVehicle(currentCar.vin!).catch(() => { }), 2000);
                    } else {
                        toast.error(`Fallo: ${result?.message || 'Error'}`, { id: toastId });
                    }
                } catch (error: any) {
                    toast.error(`Error: ${error.message}`, { id: toastId });
                }
            };

            switch (data.action) {
                case 'unlock': performAction('Abriendo coche', () => bydUnlock(currentCar.vin!)); break;
                case 'flash': performAction('Ráfagas', () => bydFlashLights(currentCar.vin!)); break;
                case 'climate':
                    if (currentStatus?.climateActive) {
                        performAction('Parando clima', () => bydStopClimate(currentCar.vin!));
                    } else {
                        performAction('Iniciando clima', () => bydStartClimate(currentCar.vin!, 21));
                    }
                    break;
            }
        });

        return () => { listener.then(l => l.remove()); };
    }, [isNative]);

    useEffect(() => {
        if (!Capacitor.isNativePlatform() || !activeCar?.vin) return;

        const rawSoC = vehicleStatus?.lastSoC ?? 0;
        const soc = rawSoC <= 1 && rawSoC > 0 ? Math.round(rawSoC * 100) : Math.round(rawSoC);
        const baseRange = Number(stats?.summary?.estimatedRange ?? 0);
        const rangeValue = Math.round(baseRange * (soc / 100));
        const climateActive = !!vehicleStatus?.climateActive;

        if (soc !== lastSyncedRef.current.soc ||
            rangeValue !== lastSyncedRef.current.range ||
            activeCar.vin !== lastSyncedRef.current.vin ||
            climateActive !== lastSyncedRef.current.climate) {

            WearSync.syncVehicleData({
                rangeKm: rangeValue,
                soc: soc,
                vin: activeCar.vin,
                climateActive: climateActive
            }).then(() => {
                lastSyncedRef.current = { soc, range: rangeValue, vin: activeCar.vin!, climate: climateActive };
            });
        }
    }, [vehicleStatus, stats?.summary?.estimatedRange, isNative, activeCar?.vin]);
};

export default useWearSync;
