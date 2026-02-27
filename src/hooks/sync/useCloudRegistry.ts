import { useCallback } from 'react';
import { logger } from '@core/logger';
import { googleDriveService, RegistryData } from '@/services/googleDrive';
import { Car, Settings, Trip } from '@/types';

interface UseCloudRegistryProps {
    activeCarId: string;
    settings: Settings;
    openRegistryModal: (cars: Car[]) => void;
    syncFromCloud?: (newTripsData?: Trip[] | null, options?: { forcePull?: boolean; forcePush?: boolean }) => Promise<void>;
    setActiveCarId?: (id: string | null) => void;
}

export function useCloudRegistry({ activeCarId, settings, openRegistryModal, syncFromCloud, setActiveCarId }: UseCloudRegistryProps) {

    // Check Registry for existing cars
    const checkAndPromptRegistry = useCallback(async (forcePrompt: boolean = false): Promise<boolean> => {
        if (!googleDriveService.isInited) return false;

        try {
            logger.info("[Sync] Checking registry for existing cars...");
            let registry = await googleDriveService.getRegistry();

            // FALLBACK: If registry is empty/missing, scan for data files directly
            if (!registry || !registry.cars || registry.cars.length === 0) {
                logger.warn("[Sync] Registry empty/missing. Attempting FALLBACK scan for data files...");

                try {
                    const allFiles = await googleDriveService.listAllDatabaseFiles();
                    const recoveredCars: Array<Car & { isRecovered?: boolean }> = [];

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
                                type: 'ev',
                                isHybrid: false,
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

            // Validate registry cars against actual Drive files to remove stale entries
            try {
                const actualFiles = await googleDriveService.listAllDatabaseFiles({ forceRefresh: true });
                const actualFileNames = new Set(actualFiles.map(f => f.name));

                const validCars = registry!.cars.filter(car => {
                    const expectedFile = car.id === 'legacy'
                        ? 'byd_stats_data.json'
                        : `byd_stats_data_${car.id}.json`;
                    return actualFileNames.has(expectedFile);
                });

                if (validCars.length === 0) {
                    logger.info("[Sync] Registry had entries but no matching files found. Cleaning up.");
                    await googleDriveService.updateRegistry({ cars: [], lastUpdated: new Date().toISOString() });
                    return false;
                }

                if (validCars.length !== registry!.cars.length) {
                    logger.info(`[Sync] Cleaned registry: ${registry!.cars.length} → ${validCars.length} cars`);
                    registry!.cars = validCars;
                    try {
                        await googleDriveService.updateRegistry(registry!);
                    } catch (persistErr) {
                        logger.warn("[Sync] Failed to persist cleaned registry", persistErr);
                    }
                }
            } catch (validationErr) {
                logger.warn("[Sync] Registry validation failed, proceeding with unvalidated registry", validationErr);
            }

            const isKnown = registry!.cars.some(c => c.id === activeCarId);

            // If the car is known BUT we have 0 local trips, we still want to prompt to restore.
            // However, useCloudRegistry doesn't know about local trips directly.
            // BUT LandingPage only calls handleLoginLink if isLandingPage (0 trips) is true
            // or we evaluate it in useGoogleSync. For now, let's allow the modal
            // if we are checking after login on an empty state (handled by caller).
            if (isKnown && !forcePrompt) return false;

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
    const restoreFromRegistry = useCallback(async (car: Pick<Car, 'id' | 'name'>) => {
        try {
            logger.info("Restoring from registry car:", car.id);

            const restoredCar = {
                id: car.id,
                name: car.name,
                type: 'ev',
                isHybrid: false,
                model: car.name
            };

            // Persist to localStorage so the reload picks up the correct car
            localStorage.setItem('byd_cars', JSON.stringify([restoredCar]));
            localStorage.setItem('byd_active_car_id', car.id);

            // Flag for post-reload: triggers a force-pull with the correct activeCarId
            localStorage.setItem('byd_pending_restore', 'true');

            // Reload guarantees all hooks re-initialize with the correct car ID.
            // Without reload, performSync would use the OLD activeCarId from its closure.
            window.location.reload();

            return true;
        } catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            logger.error('Restore failed', error);
            throw error;
        }
    }, []);

    return {
        checkAndPromptRegistry,
        updateCloudRegistry,
        restoreFromRegistry
    };
}
