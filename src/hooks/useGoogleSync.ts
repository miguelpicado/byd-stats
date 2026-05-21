import { useState, useCallback, useEffect, useRef } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { googleDriveService, GoogleDriveFile, SyncData, RegistryData } from '@/services/googleDrive';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { logger } from '@core/logger';
import { Trip, Charge, Settings, Car } from '@/types';

// Types for Conflict Resolution
interface ConflictDifference {
    label: string;
    local: string | number;
    cloud: string | number;
}

interface PendingConflict {
    localData: SyncData;
    remoteData: SyncData;
    differences: ConflictDifference[];
    fileId: string;
}

interface UserProfile {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    locale: string;
}

interface UseGoogleSyncProps {
    localTrips: Trip[];
    setLocalTrips: (trips: Trip[]) => void;
    settings: Settings;
    setSettings: (settings: Settings) => void;
    localCharges: Charge[];
    setLocalCharges: (charges: Charge[]) => void;
    activeCarId: string;
    totalCars?: number;
    openRegistryModal: (cars: any[]) => void;
    isRegistryModalOpen?: boolean;
    updateCar?: (id: string, updates: Partial<Car>) => void;
    carName?: string;
}

interface UseGoogleSyncReturn {
    isAuthenticated: boolean;
    isSyncing: boolean;
    lastSyncTime: Date | null;
    error: string | null;
    userProfile: UserProfile | null;
    pendingConflict: PendingConflict | null;
    resolveConflict: (resolution: 'local' | 'cloud' | 'merge') => Promise<void>;
    dismissConflict: () => void;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    syncNow: (newTripsData?: Trip[] | null, options?: { forcePull?: boolean; forcePush?: boolean }) => Promise<void>;
    checkCloudBackups: () => Promise<GoogleDriveFile[]>;
    importFromCloud: (fileId: string) => Promise<boolean>;
    deleteBackup: (fileId: string) => Promise<boolean>;
    restoreFromRegistry: (car: any) => Promise<boolean>;
    skipRegistryRestore: () => Promise<boolean>;
    updateCloudRegistry: () => Promise<void>;
}

/**
 * Custom hook for Google Drive synchronization
 */
export function useGoogleSync({
    localTrips,
    setLocalTrips,
    settings,
    setSettings,
    localCharges,
    setLocalCharges,
    activeCarId,
    totalCars = 1,
    openRegistryModal,
    isRegistryModalOpen = false,
    updateCar
}: UseGoogleSyncProps): UseGoogleSyncReturn {

    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
        const token = localStorage.getItem('google_access_token');
        const expiry = localStorage.getItem('google_token_expiry');
        return !!(token && expiry && Date.now() < parseInt(expiry));
    });
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null);

    // Derive filename from activeCarId
    const getTargetFilename = useCallback(() => {
        if (!activeCarId) return 'byd_stats_data.json';
        return `byd_stats_data_${activeCarId}.json`;
    }, [activeCarId]);

    // Fetch User Profile
    const fetchUserProfile = useCallback(async (token: string) => {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setUserProfile(data);
            }
        } catch (e) {
            logger.error('Error fetching profile', e);
        }
    }, []);

    // Helper: Check Registry (Reusable)
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
                    // files typically have name, id, modifiedTime
                    // We look for "byd_stats_data_UUID.json" or legacy "byd_stats_data.json"

                    const recoveredCars: any[] = []; // Using any for car entry here as it's partial/recovered

                    for (const file of allFiles) {
                        if (file.name.startsWith('byd_stats_data')) {
                            let carId = 'unknown';
                            let carName = 'Coche Recuperado';

                            if (file.name === 'byd_stats_data.json') {
                                carId = 'legacy';
                                carName = 'Coche (Legacy/Antiguo)';
                            } else {
                                // Extract UUID from "byd_stats_data_UUID.json"
                                const match = file.name.match(/byd_stats_data_(.+)\.json/);
                                if (match && match[1]) {
                                    carId = match[1];
                                    carName = `BYD Recuperado (${carId.substring(0, 8)}...)`;
                                }
                            }

                            // Prevent duplicates if multiple files exist for same ID (cleanup needed?)
                            // Assuming one file per ID for now.
                            recoveredCars.push({
                                id: carId,
                                name: carName,
                                model: 'BYD (Backup)',
                                lastSync: file.modifiedTime, // Use file modification time
                                fileId: file.id,
                                isRecovered: true
                            });
                        }
                    }

                    if (recoveredCars.length > 0) {
                        logger.info(`[Sync] Fallback successful. Found ${recoveredCars.length} recovered cars.`);
                        registry = { cars: recoveredCars as Car[], lastUpdated: new Date().toISOString() };

                        // PERSIST: Save the reconstructed registry so we don't scan again
                        try {
                            logger.info("[Sync] Persisting reconstructed registry to cloud...");
                            await googleDriveService.updateRegistry(registry);
                        } catch (persistErr) {
                            logger.warn("[Sync] Failed to persist reconstructed registry", persistErr);
                        }
                    } else {
                        logger.warn("[Sync] Fallback scan found no valid data files.");
                        return false;
                    }

                } catch (fallbackErr) {
                    logger.error("[Sync] Fallback scan failed", fallbackErr);
                    return false;
                }
            }

            // Check if CURRENT activeCarId is known
            const isKnown = registry!.cars.some(c => c.id === activeCarId);
            logger.info(`[Sync] Registry Check: ActiveID=${activeCarId}, Known=${isKnown}, CloudCars=${registry!.cars.length}`);

            if (isKnown) {
                logger.info(`[Sync] Car ${activeCarId} is known. Proceeding.`);
                return false; // All good, proceed
            }

            // Unknown Car ID but Registry has data -> Potential Duplicate or Re-install
            logger.info(`[Sync] Unknown Car ID ${activeCarId} but found ${registry!.cars.length} cars in cloud. Prompting user.`);

            // Sort by lastSync (newest first)
            const sortedCars = [...registry!.cars].sort((a, b) => {
                const dateA = a.lastSync ? new Date(a.lastSync).getTime() : 0;
                const dateB = b.lastSync ? new Date(b.lastSync).getTime() : 0;
                return dateB - dateA;
            });

            if (openRegistryModal) {
                logger.info("[Sync] Opening Registry Modal...");
                openRegistryModal(sortedCars);
                return true; // Modal opened
            } else {
                logger.error("[Sync] openRegistryModal is NOT defined! Cannot prompt user.");
            }

            return false;
        } catch (e) {
            logger.warn("[Sync] Registry check failed", e);
            return false;
        }
    }, [activeCarId, openRegistryModal]);


    // Conflict Detection
    const detectConflict = useCallback((localData: SyncData, remoteData: SyncData): PendingConflict | null => {
        const localSettings = localData.settings || {};
        const remoteSettings = remoteData.settings || {};
        const differences: ConflictDifference[] = [];

        // Check Car Model
        if (localSettings.carModel && remoteSettings.carModel && localSettings.carModel !== remoteSettings.carModel) {
            differences.push({
                label: 'Modelo de Coche',
                local: localSettings.carModel,
                cloud: remoteSettings.carModel
            });
        }

        // Check Odometer Offset
        if (localSettings.odometerOffset !== undefined && remoteSettings.odometerOffset !== undefined &&
            localSettings.odometerOffset !== remoteSettings.odometerOffset &&
            localSettings.odometerOffset !== 0 && remoteSettings.odometerOffset !== 0) {
            differences.push({
                label: 'Ajuste de Odómetro',
                local: `${localSettings.odometerOffset} km`,
                cloud: `${remoteSettings.odometerOffset} km`
            });
        }

        // Check Data Volume (significant difference)
        const localTripsCount = (localData.trips || []).length;
        const remoteTripsCount = (remoteData.trips || []).length;
        if (Math.abs(localTripsCount - remoteTripsCount) > 10) {
            differences.push({
                label: 'Cantidad de Viajes',
                local: `${localTripsCount} viajes`,
                cloud: `${remoteTripsCount} viajes`
            });
        }

        if (differences.length > 0) {
            return {
                localData,
                remoteData,
                differences,
                fileId: 'pending' // Placeholder, will be set in performSync
            };
        }

        return null; // No significant conflict
    }, []);

    // Resolve Conflict
    const resolveConflict = useCallback(async (resolution: 'local' | 'cloud' | 'merge') => {
        if (!pendingConflict) return;

        const { localData, remoteData, fileId } = pendingConflict;
        let finalData: SyncData;

        if (resolution === 'local') {
            finalData = localData;
        } else if (resolution === 'cloud') {
            finalData = remoteData;
        } else {
            finalData = googleDriveService.mergeData(localData, remoteData);
        }

        try {
            setLocalTrips(finalData.trips);
            setSettings(finalData.settings);
            setLocalCharges(finalData.charges);

            const targetFilename = getTargetFilename();
            await googleDriveService.uploadFile(finalData, fileId, targetFilename);

            setPendingConflict(null);
            setLastSyncTime(new Date());
            logger.info(`[Sync] Conflict resolved using: ${resolution}`);
        } catch (e: any) {
            setError("Error resolviendo conflicto: " + e.message);
            logger.error('[Sync] Resolution failed', e);
        }
    }, [pendingConflict, setLocalTrips, setSettings, setLocalCharges, getTargetFilename]);

    const logout = useCallback(async () => {
        try {
            await googleDriveService.signOut();

            if (Capacitor.isNativePlatform()) {
                try {
                    await SocialLogin.logout({ provider: 'google' });
                } catch (nativeErr) {
                    logger.warn('Native logout error (ignoring):', nativeErr);
                }
            }

            localStorage.removeItem('google_access_token'); // Clear Token
            localStorage.removeItem('google_token_expiry'); // Clear Token Expiry
            setIsAuthenticated(false);
            setUserProfile(null);
        } catch (e) {
            logger.error('Logout failed', e);
        }
    }, []);

    const performSync = useCallback(async (newTripsData: Trip[] | null = null, options: { forcePull?: boolean; forcePush?: boolean } = {}) => {
        logger.info(`[Sync] Initiated. Local trips: ${localTrips?.length}, New data: ${newTripsData?.length}, Online: ${navigator.onLine}`);

        if (!navigator.onLine) {
            setError("Sin conexión a Internet");
            setIsSyncing(false);
            return;
        }

        if (!googleDriveService.isInited) {
            logger.warn('[Sync] Aborted: service not inited');
            return;
        }

        setIsSyncing(true);
        setError(null);

        try {
            const targetFilename = getTargetFilename();
            logger.info(`[Sync] Active Car ID: ${activeCarId || 'None'} | Target Filename: ${targetFilename}`);

            // 1. Find or Create File
            const files = await googleDriveService.listFiles(targetFilename);
            logger.info(`[Sync] Files found: ${files?.length || 0}`);

            let fileId: string | null = null;
            let legacyImport = false;

            if (files && files.length > 0) {
                // Sort by size (heaviest first)
                files.sort((a, b) => {
                    const sizeA = parseInt(a.size || '0', 10);
                    const sizeB = parseInt(b.size || '0', 10);
                    return sizeB - sizeA;
                });

                const heaviestFile = files[0];
                fileId = heaviestFile.id;

                logger.info(`[Sync] Selected heaviest file: ${heaviestFile.name} (${heaviestFile.size} bytes)`);

                // Cleanup: Delete duplicates (smaller files)
                if (files.length > 1) {
                    const duplicates = files.slice(1);
                    logger.warn(`[Sync] Found ${duplicates.length} smaller duplicates. Cleaning up...`);
                    for (const dup of duplicates) {
                        try {
                            await googleDriveService.deleteFile(dup.id);
                        } catch (delErr) {
                            logger.error(`[Sync] Failed to delete duplicate ${dup.id}`, delErr);
                        }
                    }
                }
            } else if (localTrips.length === 0 && !newTripsData && totalCars === 1) {
                // Recovery Mode for fresh install with only 1 car
                const legacyFiles = await googleDriveService.listFiles('byd_stats_data.json');
                if (legacyFiles && legacyFiles.length > 0) {
                    fileId = legacyFiles[0].id;
                    legacyImport = true;
                    logger.info('[Sync] Found legacy backup for migration');
                }
            }

            // 2. Download Remote Data
            let remoteData: SyncData = { trips: [], settings: {} as Settings, charges: [] };
            if (fileId) {
                remoteData = await googleDriveService.downloadFile(fileId);
                logger.info(`[Sync] Remote data downloaded: ${remoteData.trips?.length} trips`);
            }

            // 3. Conflict Check
            const currentTrips = newTripsData || localTrips;
            const currentCharges = Array.isArray(localCharges) ? localCharges : [];
            const localDataToMerge: SyncData = { trips: currentTrips, settings: settings, charges: currentCharges };

            // Only detect conflict if not a fresh install and not forced
            if (currentTrips.length > 0 && remoteData.trips.length > 0 && !options.forcePull && !options.forcePush) {
                const conflict = detectConflict(localDataToMerge, remoteData);
                if (conflict) {
                    logger.warn('[Sync] Conflict detected. Pausing for user action.');
                    setPendingConflict({ ...conflict, fileId: fileId! });
                    setIsSyncing(false);
                    return;
                }
            }

            // 4. Determine Merge Strategy
            const isFreshLogin = currentTrips.length === 0 && remoteData.trips.length > 0;

            let merged: SyncData;
            if (isFreshLogin || options.forcePull) {
                logger.warn(`[Sync] Pulling data from Cloud. Remote: ${remoteData.trips.length} trips.`);
                merged = remoteData;
            } else if (options.forcePush) {
                logger.warn(`[Sync] Pushing local data to Cloud. Local: ${currentTrips.length} trips.`);
                merged = localDataToMerge;
            } else {
                merged = googleDriveService.mergeData(localDataToMerge, remoteData);
                if (merged.trips.length === 0 && currentTrips.length > 0) {
                    logger.error('[Sync] CRITICAL: Merge resulted in 0 trips but local had data. Aborting sync.');
                    throw new Error("Error crítico: La sincronización resultó en datos vacíos. Operación cancelada para proteger tus datos.");
                }
            }

            // 5. Update Local State
            logger.info(`[Sync] Updating local state with ${merged.trips.length} trips`);
            setLocalTrips(merged.trips);
            setSettings(merged.settings);
            setLocalCharges(merged.charges);

            // 6. Upload Merged State
            const uploadId = legacyImport ? null : fileId;
            const uploadResult = await googleDriveService.uploadFile(merged, uploadId, targetFilename);
            const finalFileId = uploadResult.id;

            // 6b. Update Local Car Name if found in settings
            if (updateCar && merged.settings?.carModel && activeCarId) {
                logger.info(`[Sync] Updating car name to: ${merged.settings.carModel}`);
                updateCar(activeCarId, { name: merged.settings.carModel });
            }

            setLastSyncTime(new Date());
            logger.info('[Sync] Successfully synchronized and uploaded.');

            // 7. Update Cloud Registry (background)
            try {
                const now = new Date().toISOString();
                const currentReg: RegistryData = await googleDriveService.getRegistry() || { cars: [], lastUpdated: now };
                const existingIndex = currentReg.cars.findIndex(c => c.id === activeCarId);

                const carEntry: Car = {
                    id: activeCarId,
                    name: settings.carModel || 'Mi BYD', // This might be loose typing if Settings doesn't have carModel strictly
                    model: 'BYD',
                    lastSync: now,
                    fileId: finalFileId
                    // type, isHybrid ?
                } as Car;

                if (existingIndex >= 0) {
                    currentReg.cars[existingIndex] = { ...currentReg.cars[existingIndex], ...carEntry };
                } else {
                    currentReg.cars.push(carEntry);
                }
                currentReg.lastUpdated = now;

                await googleDriveService.updateRegistry(currentReg);
            } catch (regErr) {
                logger.warn('[Sync] Registry update failed (non-critical)', regErr);
            }

        } catch (e: any) {
            const isAuthError = e.status === 401 || e.status === 403 ||
                (e.result?.error?.code === 401 || e.result?.error?.code === 403) ||
                e.message?.includes('401') || e.message?.includes('403');

            if (isAuthError) {
                logger.warn('[Sync] Authentication expired, logging out...');
                logout();
            } else {
                logger.error('[Sync] Error:', e);
            }

            setError(e.message || "Error de sincronización");
        } finally {
            setIsSyncing(false);
        }
    }, [localTrips, settings, localCharges, setLocalTrips, setSettings, setLocalCharges, logout, getTargetFilename, isAuthenticated, activeCarId, totalCars, updateCar]);

    const handleLoginSuccess = useCallback(async (accessToken: string) => {
        googleDriveService.setAccessToken(accessToken);
        localStorage.setItem('google_access_token', accessToken);

        const expiryTime = Date.now() + (60 * 60 * 1000); // 1 hour
        localStorage.setItem('google_token_expiry', expiryTime.toString());

        setIsAuthenticated(true);
        await fetchUserProfile(accessToken);

        const modalOpened = await checkAndPromptRegistry();

        if (!modalOpened) {
            performSync();
        } else {
            logger.info("[Sync] Suspended pending registry action");
        }
    }, [fetchUserProfile, performSync, checkAndPromptRegistry]);

    const handleLoginSuccessRef = useRef(handleLoginSuccess);
    useEffect(() => {
        handleLoginSuccessRef.current = handleLoginSuccess;
    }, [handleLoginSuccess]);

    const webLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            if (handleLoginSuccessRef.current) {
                await handleLoginSuccessRef.current(tokenResponse.access_token);
            }
        },
        onError: (error) => {
            logger.error('Web Login Failed:', error);
            setError("Login failed");
        },
        scope: "https://www.googleapis.com/auth/drive.appdata"
    });

    const login = useCallback(async () => {
        const isNative = Capacitor.isNativePlatform();

        if (isNative) {
            try {
                const result = await SocialLogin.login({
                    provider: 'google',
                    options: {
                        scopes: ['email', 'profile', 'https://www.googleapis.com/auth/drive.appdata']
                    }
                });

                const resultAny = result as any;
                const accessToken = resultAny.result?.accessToken?.token
                    || resultAny.result?.accessToken
                    || resultAny.accessToken?.token
                    || resultAny.accessToken;

                if (accessToken) {
                    await handleLoginSuccess(accessToken);
                } else {
                    logger.error('No accessToken found. Result:', JSON.stringify(result));
                    setError("Error: No Access Token received.");
                }
            } catch (e: any) {
                logger.error('Native Login Failed:', e);
                setError(e.message || "Error al iniciar sesión con Google");
            }
        } else {
            webLogin();
        }
    }, [webLogin, handleLoginSuccess]);


    const checkCloudBackups = useCallback(async () => {
        if (!googleDriveService.isInited) return [];
        try {
            const files = await googleDriveService.listAllDatabaseFiles();
            return files;
        } catch (e) {
            logger.error('Error checking backups', e);
            return [];
        }
    }, []);

    const importFromCloud = useCallback(async (fileId: string) => {
        setIsSyncing(true);
        try {
            logger.info(`Importing data from cloud file: ${fileId}`);
            const remoteData = await googleDriveService.downloadFile(fileId);

            const currentTrips = localTrips || [];
            const currentCharges = localCharges || [];

            const merged = googleDriveService.mergeData(
                { trips: currentTrips, settings: settings, charges: currentCharges },
                remoteData
            );

            setLocalTrips(merged.trips);
            setSettings(merged.settings);
            setLocalCharges(merged.charges);

            const targetFilename = getTargetFilename();
            await googleDriveService.uploadFile(merged, null, targetFilename);

            setLastSyncTime(new Date());
            return true;
        } catch (e: any) {
            logger.error('Import failed', e);
            setError("Error importando: " + e.message);
            return false;
        } finally {
            setIsSyncing(false);
        }
    }, [localTrips, settings, localCharges, setLocalTrips, setSettings, setLocalCharges, getTargetFilename]);

    const deleteBackup = useCallback(async (fileId: string) => {
        try {
            await googleDriveService.deleteFile(fileId);
            return true;
        } catch (e) {
            logger.error('Error deleting backup', e);
            throw e;
        }
    }, []);

    const restoreFromRegistry = useCallback(async (car: any) => {
        setIsSyncing(true);
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
            setError("Error restaurando: " + e.message);
            return false;
        } finally {
            setIsSyncing(false);
        }
    }, []);

    const skipRegistryRestore = useCallback(async () => {
        logger.info("[Sync] User chose new car/skip restore. Proceeding with sync.");
        await performSync();
        return true;
    }, [performSync]);

    const updateCloudRegistry = useCallback(async () => {
        if (!activeCarId || !googleDriveService.isInited) return;
        try {
            const targetFilename = `byd_stats_data_${activeCarId}.json`;
            const files = await googleDriveService.listFiles(targetFilename);
            if (!files || files.length === 0) return;

            const fileId = files[0].id;
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
            logger.error('Registry update failed', e);
        }
    }, [activeCarId, settings, googleDriveService]);

    const dismissConflict = useCallback(() => {
        setPendingConflict(null);
    }, []);

    useEffect(() => {
        const checkAuth = async () => {
            if (Capacitor.isNativePlatform()) {
                await SocialLogin.initialize({
                    google: {
                        webClientId: "721727786401-l61n23pt50lq34789851610211116124.apps.googleusercontent.com"
                    }
                }).catch(() => {
                    // console.log
                });
            }

            const token = localStorage.getItem('google_access_token');
            const expiry = localStorage.getItem('google_token_expiry');

            if (token && expiry && Date.now() < parseInt(expiry)) {
                googleDriveService.setAccessToken(token);
                setIsAuthenticated(true);
                fetchUserProfile(token);

                checkAndPromptRegistry().then(opened => {
                    if (opened) {
                        logger.info("[Auth] Registry modal opened, waiting for user action.");
                    }
                });
            } else if (token || expiry) {
                if (Capacitor.isNativePlatform()) {
                    logger.info("[Auth] Token expired, attempting silent refresh...");
                    login();
                } else {
                    localStorage.removeItem('google_access_token');
                    localStorage.removeItem('google_token_expiry');
                }
            }
        };
        checkAuth();
    }, [fetchUserProfile, localTrips.length, totalCars, openRegistryModal, login]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (isRegistryModalOpen) return;

            if (document.visibilityState === 'visible' && isAuthenticated && !isSyncing) {
                const now = Date.now();
                const lastSync = lastSyncTime ? lastSyncTime.getTime() : 0;
                if (now - lastSync > 2 * 60 * 1000) {
                    logger.info("[Sync] App became visible, triggering auto-pull...");
                    performSync();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isAuthenticated, isSyncing, lastSyncTime, performSync, isRegistryModalOpen]);

    return {
        isAuthenticated,
        isSyncing,
        lastSyncTime,
        error,
        userProfile,
        pendingConflict,
        resolveConflict,
        dismissConflict,
        login,
        logout,
        syncNow: performSync,
        checkCloudBackups,
        importFromCloud,
        deleteBackup,
        restoreFromRegistry,
        skipRegistryRestore,
        updateCloudRegistry
    };
}
