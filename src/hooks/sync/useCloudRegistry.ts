import { useCallback } from 'react';
import { logger } from '@core/logger';
import { googleDriveService, RegistryData } from '@/services/googleDrive';
import { Car, Settings } from '@/types';

interface UseCloudRegistryProps {
    activeCarId: string;
    settings: Settings;
    openRegistryModal: (cars: any[]) => void;
}

export function useCloudRegistry({ activeCarId, settings, openRegistryModal }: UseCloudRegistryProps) {

    // Check Registry for existing cars
    const checkAndPromptRegistry = useCallback(async (): Promise<boolean> => {
        if (!googleDriveService.isInited) return false;

        try {
            logger.info("[Sync] Checking registry for existing cars...");
            let registry = await googleDriveService.getRegistry();

            // FALLBACK: If registry is empty/missing, scan for data files directly
            if (!registry || !registry.cars || registry.cars.length === 0) {
                logger.warn("[Sync] Registry empty/missing. Attempting FALLBACK scan for data files...");

                try {
                    const allFiles = await googleDriveService.listAllDatabaseFiles();
                    const recoveredCars: any[] = [];

                    for (const file of allFiles) {
                        if (file.name.startsWith('byd_stats_data')) {
                            let carId = 'unknown';
                            let carName = 'Coche Recuperado';

                            if (file.name === 'byd_stats_data.json') {
                                carId = 'legacy';
                                carName = 'Coche (Legacy/Antiguo)';
                            } else {
                                const match = file.name.match(/byd_stats_data_(.+)\.json/);
                                if (match && match[1]) {
                                    carId = match[1];
                                    carName = `BYD Recuperado (${carId.substring(0, 8)}...)`;
                                }
                            }

                            recoveredCars.push({
                                id: carId,
                                name: carName,
                                model: 'BYD (Backup)',
                                lastSync: file.modifiedTime,
                                fileId: file.id,
                                isRecovered: true
                            });
                        }
                    }

                    if (recoveredCars.length > 0) {
                        logger.info(`[Sync] Fallback successful. Found ${recoveredCars.length} recovered cars.`);
                        registry = { cars: recoveredCars as Car[], lastUpdated: new Date().toISOString() };
                        try {
                            await googleDriveService.updateRegistry(registry);
                        } catch (persistErr) {
                            logger.warn("[Sync] Failed to persist reconstructed registry", persistErr);
                        }
                    } else {
                        return false;
                    }

                } catch (fallbackErr) {
                    logger.error("[Sync] Fallback scan failed", fallbackErr);
                    return false;
                }
            }

            const isKnown = registry!.cars.some(c => c.id === activeCarId);
            if (isKnown) return false;

            // Sort by lastSync (newest first)
            const sortedCars = [...registry!.cars].sort((a, b) => {
                const dateA = a.lastSync ? new Date(a.lastSync).getTime() : 0;
                const dateB = b.lastSync ? new Date(b.lastSync).getTime() : 0;
                return dateB - dateA;
            });

            if (openRegistryModal) {
                openRegistryModal(sortedCars);
                return true;
            }

            return false;
        } catch (e) {
            logger.warn("[Sync] Registry check failed", e);
            return false;
        }
    }, [activeCarId, openRegistryModal]);

    // Update Registry with current car
    const updateCloudRegistry = useCallback(async (fileId: string) => {
        if (!activeCarId || !googleDriveService.isInited) return;
        try {
            const currentReg: RegistryData = await googleDriveService.getRegistry() || { cars: [], lastUpdated: new Date().toISOString() };
            const now = new Date().toISOString();
            const carName = settings.carModel || 'Mi BYD';

            const existingIndex = currentReg.cars.findIndex(c => c.id === activeCarId);
            const carEntry: Car = {
                id: activeCarId,
                name: carName,
                model: 'BYD',
                lastSync: now,
                fileId: fileId
            } as Car;

            if (existingIndex >= 0) {
                currentReg.cars[existingIndex] = { ...currentReg.cars[existingIndex], ...carEntry };
            } else {
                currentReg.cars.push(carEntry);
            }

            currentReg.lastUpdated = now;
            await googleDriveService.updateRegistry(currentReg);
        } catch (e) {
            logger.warn('[Sync] Registry update failed', e);
        }
    }, [activeCarId, settings]);

    // Restore from Registry
    const restoreFromRegistry = useCallback(async (car: any) => {
        try {
            logger.info("Restoring from registry car:", car.id);
            const carsKey = 'byd_cars';
            const activeKey = 'byd_active_car_id';

            const restoredCar = {
                id: car.id,
                name: car.name,
                type: 'ev',
                isHybrid: false
            };

            localStorage.setItem(carsKey, JSON.stringify([restoredCar]));
            localStorage.setItem(activeKey, car.id);
            window.location.reload();
            return true;
        } catch (e: any) {
            logger.error('Restore failed', e);
            throw e;
        }
    }, []);

    return {
        checkAndPromptRegistry,
        updateCloudRegistry,
        restoreFromRegistry
    };
}
