import { useState, useCallback } from 'react';

import { logger } from '@core/logger';
import { googleDriveService, SyncData } from '@/services/googleDrive';
import { Trip, Charge, Settings, Car } from '@/types';

export interface ConflictDifference {
    label: string;
    local: string | number;
    cloud: string | number;
}

export interface PendingConflict {
    localData: SyncData;
    remoteData: SyncData;
    differences: ConflictDifference[];
    fileId: string;
}

interface UseDriveSyncProps {
    localTrips: Trip[];
    setLocalTrips: (trips: Trip[]) => void;
    settings: Settings;
    setSettings: (settings: Settings) => void;
    localCharges: Charge[];
    setLocalCharges: (charges: Charge[]) => void;
    activeCarId: string;
    updateCar?: (id: string, updates: Partial<Car>) => void;
    updateCloudRegistry: (fileId: string) => Promise<void>;
}

export function useDriveSync({
    localTrips,
    setLocalTrips,
    settings,
    setSettings,
    localCharges,
    setLocalCharges,
    activeCarId,
    updateCar,
    updateCloudRegistry
}: UseDriveSyncProps) {
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null);

    const getTargetFilename = useCallback(() => {
        if (!activeCarId) return 'byd_stats_data.json';
        return `byd_stats_data_${activeCarId}.json`;
    }, [activeCarId]);

    const detectConflict = useCallback((localData: SyncData, remoteData: SyncData): PendingConflict | null => {
        const localSettings = localData.settings || {};
        const remoteSettings = remoteData.settings || {};
        const differences: ConflictDifference[] = [];

        if (localSettings.carModel && remoteSettings.carModel && localSettings.carModel !== remoteSettings.carModel) {
            differences.push({ label: 'Modelo de Coche', local: localSettings.carModel, cloud: remoteSettings.carModel });
        }
        if (localSettings.odometerOffset !== undefined && remoteSettings.odometerOffset !== undefined &&
            localSettings.odometerOffset !== remoteSettings.odometerOffset) {
            differences.push({ label: 'Ajuste de Odómetro', local: `${localSettings.odometerOffset} km`, cloud: `${remoteSettings.odometerOffset} km` });
        }
        const localCount = (localData.trips || []).length;
        const remoteCount = (remoteData.trips || []).length;
        if (Math.abs(localCount - remoteCount) > 10) {
            differences.push({ label: 'Cantidad de Viajes', local: `${localCount} viajes`, cloud: `${remoteCount} viajes` });
        }

        if (differences.length > 0) {
            return { localData, remoteData, differences, fileId: 'pending' };
        }
        return null;
    }, []);

    const performSync = useCallback(async (newTripsData: Trip[] | null = null, options: { forcePull?: boolean; forcePush?: boolean } = {}) => {
        logger.info("[Sync] --- Starting performSync ---", { forcePull: options.forcePull, forcePush: options.forcePush });
        if (!navigator.onLine) {
            logger.warn("[Sync] Offline, skipping sync.");
            setError("Sin conexión a Internet");
            return;
        }
        if (!googleDriveService.isInited) {
            logger.warn("[Sync] Drive Service NOT inited, skipping.");
            return;
        }

        setIsSyncing(true);
        setError(null);

        try {
            const targetFilename = getTargetFilename();
            logger.info(`[Sync] Listing files for: ${targetFilename}`);
            const files = await googleDriveService.listFiles(targetFilename);
            logger.info(`[Sync] Found ${files?.length || 0} files.`);

            let fileId: string | null = null;
            let legacyImport = false;

            if (files && files.length > 0) {
                // Heuristic: Use largest file
                files.sort((a, b) => parseInt(b.size || '0') - parseInt(a.size || '0'));
                fileId = files[0].id;
                logger.info(`[Sync] Selected fileId: ${fileId}`);

                // Cleanup duplicates
                if (files.length > 1) {
                    logger.info(`[Sync] Cleaning up ${files.length - 1} duplicates.`);
                    files.slice(1).forEach(f => googleDriveService.deleteFile(f.id).catch(console.error));
                }
            } else if (localTrips.length === 0 && !newTripsData) {
                logger.info("[Sync] No specific car file found, looking for legacy file...");
                // Legacy recovery
                const legacyFiles = await googleDriveService.listFiles('byd_stats_data.json');
                if (legacyFiles && legacyFiles.length > 0) {
                    fileId = legacyFiles[0].id;
                    legacyImport = true;
                    logger.info(`[Sync] Found legacy fileId: ${fileId}`);
                }
            }

            let remoteData: SyncData = { trips: [], settings: {} as Settings, charges: [] };
            if (fileId) {
                logger.info("[Sync] Downloading file...");
                remoteData = await googleDriveService.downloadFile(fileId);
                logger.info(`[Sync] Downloaded ${remoteData.trips?.length || 0} trips.`);
            } else {
                logger.info("[Sync] No remote file found to download.");
            }

            const currentTrips = newTripsData || localTrips;
            const currentCharges = localCharges || [];

            // Read AI caches from localStorage for cloud sync
            const aiCacheStr = localStorage.getItem('ai_predictions');
            const sohCacheStr = localStorage.getItem('ai_soh_predictions');
            const parkingCacheStr = localStorage.getItem('ai_parking_predictions');

            const localDataToMerge: SyncData = {
                trips: currentTrips,
                settings,
                charges: currentCharges,
                aiCache: {
                    efficiency: aiCacheStr ? JSON.parse(aiCacheStr) : undefined,
                    soh: sohCacheStr ? JSON.parse(sohCacheStr) : undefined,
                    parking: parkingCacheStr ? JSON.parse(parkingCacheStr) : undefined,
                }
            };

            if (currentTrips.length > 0 && remoteData.trips.length > 0 && !options.forcePull && !options.forcePush) {
                const conflict = detectConflict(localDataToMerge, remoteData);
                if (conflict) {
                    logger.warn("[Sync] Conflict detected, stopping for user resolution.");
                    setPendingConflict({ ...conflict, fileId: fileId! });
                    setIsSyncing(false);
                    return;
                }
            }

            // Safety guard: if forcePull yields no remote data and local is also empty,
            // there is nothing to restore. Abort to avoid uploading empty data and
            // corrupting a Drive file that may have valid data under a different scope.
            if (options.forcePull && remoteData.trips.length === 0 && currentTrips.length === 0) {
                logger.warn("[Sync] Force-pull returned 0 trips and local is also empty. Aborting to prevent data corruption.");
                setError("No se encontraron datos en la nube para este coche. Comprueba que el fichero en Drive no está vacío.");
                setIsSyncing(false);
                return;
            }

            let merged: SyncData;
            if (options.forcePull) {
                logger.info("[Sync] Strategy: Force Pull (Cloud wins)");
                merged = remoteData;
            } else if (options.forcePush) {
                logger.info("[Sync] Strategy: Force Push (Local wins)");
                merged = localDataToMerge;
            } else {
                logger.info("[Sync] Strategy: Merge (Intelligent union)");
                merged = googleDriveService.mergeData(localDataToMerge, remoteData);
            }

            setLocalTrips(merged.trips);
            setSettings(merged.settings);
            setLocalCharges(merged.charges);

            // Write merged AI caches to localStorage
            if (merged.aiCache?.efficiency) {
                localStorage.setItem('ai_predictions', JSON.stringify(merged.aiCache.efficiency));
            }
            if (merged.aiCache?.soh) {
                localStorage.setItem('ai_soh_predictions', JSON.stringify(merged.aiCache.soh));
            }
            if (merged.aiCache?.parking) {
                localStorage.setItem('ai_parking_predictions', JSON.stringify(merged.aiCache.parking));
            }

            logger.info("[Sync] Uploading merged data...");
            const uploadResult = await googleDriveService.uploadFile(merged, legacyImport ? null : fileId, targetFilename);
            logger.info("[Sync] Upload complete.", { fileId: uploadResult.id });

            if (updateCar && merged.settings?.carModel && activeCarId) {
                updateCar(activeCarId, { name: merged.settings.carModel });
            }

            setLastSyncTime(new Date());

            // Trigger Registry Update
            logger.info("[Sync] Updating cloud registry...");
            await updateCloudRegistry(uploadResult.id);
            logger.info("[Sync] --- ALL DONE ---");

        } catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            logger.error("[Sync] Error in performSync:", error);
            setError(error.message || "Error de sincronización");
        } finally {
            setIsSyncing(false);
        }
    }, [localTrips, settings, localCharges, activeCarId, updateCar, updateCloudRegistry, getTargetFilename, detectConflict]);

    const resolveConflict = useCallback(async (resolution: 'local' | 'cloud' | 'merge') => {
        if (!pendingConflict) return;
        const { localData, remoteData, fileId } = pendingConflict;
        let finalData: SyncData;

        if (resolution === 'local') finalData = localData;
        else if (resolution === 'cloud') finalData = remoteData;
        else finalData = googleDriveService.mergeData(localData, remoteData);

        try {
            setLocalTrips(finalData.trips);
            setSettings(finalData.settings);
            setLocalCharges(finalData.charges);

            const targetFilename = getTargetFilename();
            await googleDriveService.uploadFile(finalData, fileId, targetFilename);

            setPendingConflict(null);
            setLastSyncTime(new Date());
        } catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            setError(error.message);
        }
    }, [pendingConflict, setLocalTrips, setSettings, setLocalCharges, getTargetFilename]);

    const dismissConflict = useCallback(() => setPendingConflict(null), []);

    const importFromCloud = useCallback(async (fileId: string) => {
        setIsSyncing(true);
        try {
            const remoteData = await googleDriveService.downloadFile(fileId);
            const currentTrips = localTrips || [];
            const merged = googleDriveService.mergeData({ trips: currentTrips, settings, charges: localCharges }, remoteData);

            setLocalTrips(merged.trips);
            setSettings(merged.settings);
            setLocalCharges(merged.charges);

            // Write merged AI caches to localStorage
            if (merged.aiCache?.efficiency) {
                localStorage.setItem('ai_predictions', JSON.stringify(merged.aiCache.efficiency));
            }
            if (merged.aiCache?.soh) {
                localStorage.setItem('ai_soh_predictions', JSON.stringify(merged.aiCache.soh));
            }
            if (merged.aiCache?.parking) {
                localStorage.setItem('ai_parking_predictions', JSON.stringify(merged.aiCache.parking));
            }

            const targetFilename = getTargetFilename();
            const upload = await googleDriveService.uploadFile(merged, null, targetFilename);
            await updateCloudRegistry(upload.id);
            return true;
        } catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            setError(error.message);
            return false;
        } finally {
            setIsSyncing(false);
        }
    }, [localTrips, settings, localCharges, getTargetFilename, updateCloudRegistry]);

    const deleteBackup = useCallback(async (fileId: string) => {
        try {
            await googleDriveService.deleteFile(fileId);
            return true;
        } catch (e) {
            throw e;
        }
    }, []);

    const checkCloudBackups = useCallback(async () => {
        if (!googleDriveService.isInited) return [];
        return googleDriveService.listAllDatabaseFiles();
    }, []);

    return {
        isSyncing,
        error,
        setError,
        lastSyncTime,
        pendingConflict,
        performSync,
        resolveConflict,
        dismissConflict,
        importFromCloud,
        deleteBackup,
        checkCloudBackups
    };
}
