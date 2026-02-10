import { useState, useCallback } from 'react';

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
        if (!navigator.onLine) {
            setError("Sin conexión a Internet");
            return;
        }
        if (!googleDriveService.isInited) return;

        setIsSyncing(true);
        setError(null);

        try {
            const targetFilename = getTargetFilename();
            const files = await googleDriveService.listFiles(targetFilename);

            let fileId: string | null = null;
            let legacyImport = false;

            if (files && files.length > 0) {
                // Heuristic: Use largest file
                files.sort((a, b) => parseInt(b.size || '0') - parseInt(a.size || '0'));
                fileId = files[0].id;

                // Cleanup duplicates
                if (files.length > 1) {
                    files.slice(1).forEach(f => googleDriveService.deleteFile(f.id).catch(console.error));
                }
            } else if (localTrips.length === 0 && !newTripsData) {
                // Legacy recovery
                const legacyFiles = await googleDriveService.listFiles('byd_stats_data.json');
                if (legacyFiles && legacyFiles.length > 0) {
                    fileId = legacyFiles[0].id;
                    legacyImport = true;
                }
            }

            let remoteData: SyncData = { trips: [], settings: {} as Settings, charges: [] };
            if (fileId) {
                remoteData = await googleDriveService.downloadFile(fileId);
            }

            const currentTrips = newTripsData || localTrips;
            const currentCharges = localCharges || [];
            const localDataToMerge: SyncData = { trips: currentTrips, settings, charges: currentCharges };

            if (currentTrips.length > 0 && remoteData.trips.length > 0 && !options.forcePull && !options.forcePush) {
                const conflict = detectConflict(localDataToMerge, remoteData);
                if (conflict) {
                    setPendingConflict({ ...conflict, fileId: fileId! });
                    setIsSyncing(false);
                    return;
                }
            }

            let merged: SyncData;
            if (options.forcePull) merged = remoteData;
            else if (options.forcePush) merged = localDataToMerge;
            else merged = googleDriveService.mergeData(localDataToMerge, remoteData);

            setLocalTrips(merged.trips);
            setSettings(merged.settings);
            setLocalCharges(merged.charges);

            const uploadResult = await googleDriveService.uploadFile(merged, legacyImport ? null : fileId, targetFilename);

            if (updateCar && merged.settings?.carModel && activeCarId) {
                updateCar(activeCarId, { name: merged.settings.carModel });
            }

            setLastSyncTime(new Date());

            // Trigger Registry Update
            await updateCloudRegistry(uploadResult.id);

        } catch (e: any) {
            setError(e.message || "Error de sincronización");
        } finally {
            setIsSyncing(false);
        }
    }, [localTrips, settings, localCharges, activeCarId, updateCloudRegistry, getTargetFilename, detectConflict]);

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
        } catch (e: any) {
            setError(e.message);
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

            const targetFilename = getTargetFilename();
            const upload = await googleDriveService.uploadFile(merged, null, targetFilename);
            await updateCloudRegistry(upload.id);
            return true;
        } catch (e: any) {
            setError(e.message);
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
