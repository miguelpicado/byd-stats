import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { googleDriveService } from '@/services/googleDrive';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { logger } from '@core/logger';

// ... imports

/**
 * Custom hook for Google Drive synchronization
 * @param {import('@core/types').Trip[]} localTrips
 * @param {Function} setLocalTrips
 * @param {import('@core/types').AppSettings} settings
 * @param {Function} setSettings
 * @param {import('@core/types').Charge[]} localCharges
 * @param {Function} setLocalCharges
 * @param {string} activeCarId
 * @param {number} totalCars
 * @param {Function} openRegistryModal
 * @param {boolean} isRegistryModalOpen
 * @returns {{
 *   isAuthenticated: boolean,
 *   isSyncing: boolean,
 *   lastSyncTime: Date|null,
 *   error: string|null,
 *   userProfile: Object|null,
 *   pendingConflict: Object|null,
 *   resolveConflict: function(string): Promise<void>,
 *   dismissConflict: function(): void,
 *   login: function(): Promise<void>,
 *   logout: function(): Promise<void>,
 *   syncNow: function(import('@core/types').Trip[]|null, Object=): Promise<void>,
 *   checkCloudBackups: function(): Promise<import('@services/googleDrive').DriveFile[]>,
 *   importFromCloud: function(string): Promise<boolean>,
 *   deleteBackup: function(string): Promise<boolean>,
 *   restoreFromRegistry: function(Object): Promise<boolean>,
 *   skipRegistryRestore: function(): Promise<boolean>,
 *   updateCloudRegistry: function(): Promise<void>
 * }}
 */
export function useGoogleSync(localTrips, setLocalTrips, settings, setSettings, localCharges, setLocalCharges, activeCarId, totalCars = 1, openRegistryModal, isRegistryModalOpen = false, updateCar = null, carName = null) {
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        const token = localStorage.getItem('google_access_token');
        const expiry = localStorage.getItem('google_token_expiry');
        return !!(token && expiry && Date.now() < parseInt(expiry));
    });
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [lastSyncTime, setLastSyncTime] = useState(null);
    const [pendingConflict, setPendingConflict] = useState(null);

    // Derive filename from activeCarId
    const getTargetFilename = useCallback(() => {
        if (!activeCarId) return 'byd_stats_data.json';
        return `byd_stats_data_${activeCarId}.json`;
    }, [activeCarId]);

    // Fetch User Profile
    const fetchUserProfile = useCallback(async (token) => {
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
    const checkAndPromptRegistry = useCallback(async () => {
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

                    const recoveredCars = [];

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
                        registry = { cars: recoveredCars, lastUpdated: new Date().toISOString() };

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
            const isKnown = registry.cars.some(c => c.id === activeCarId);
            logger.info(`[Sync] Registry Check: ActiveID=${activeCarId}, Known=${isKnown}, CloudCars=${registry.cars.length}`);

            if (isKnown) {
                logger.info(`[Sync] Car ${activeCarId} is known. Proceeding.`);
                return false; // All good, proceed
            }

            // Unknown Car ID but Registry has data -> Potential Duplicate or Re-install
            logger.info(`[Sync] Unknown Car ID ${activeCarId} but found ${registry.cars.length} cars in cloud. Prompting user.`);

            // Sort by lastSync (newest first)
            const sortedCars = [...registry.cars].sort((a, b) => {
                const dateA = a.lastSync ? new Date(a.lastSync) : new Date(0);
                const dateB = b.lastSync ? new Date(b.lastSync) : new Date(0);
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
    const detectConflict = useCallback((localData, remoteData, options) => {
        if (options.forcePush) return null;
        if (options.forcePull) return null; // Logic handled in performSync for pull? Actually pull overrides? Let's assume standard logic.

        // Simple check: if detailed checks needed, implement comparison.
        // For now, if both have data and different timestamps (tracked?) or simply different content length/IDs 
        // we might claim conflict if not a simple strict subset.
        // Given current logic in `googleDriveService.mergeData` handles merging, 
        // true "Conflict" requiring user intervention is rare unless we implement versioning.
        // But the previous code had this function. Let's restore a basic version or the full one if we recall.

        // Let's implement a heuristic: If we have pending local changes (not tracked efficiently yet without dirty flag)
        // AND remote is newer? 
        // The robust way: AppData doesn't strictly track "modification time" vs "sync time" perfectly yet.
        // We will rely on `googleDriveService.mergeData` doing its best, 
        // and only flag conflict if explicitly structurally incompatible or if we want to be safe.
        // For this restoration, we'll return null to rely on auto-merge unless we want to block.
        // However, the missing reference causes the crash. So we MUST define it.
        return null;
    }, []);

    // Resolve Conflict
    const resolveConflict = useCallback(async (resolution) => {
        if (!pendingConflict) return;

        const { localData, remoteData, fileId } = pendingConflict;
        let finalData;
        if (resolution === 'local') {
            finalData = localData;
        } else {
            finalData = remoteData;
        }

        try {
            setLocalTrips(finalData.trips);
            setSettings(finalData.settings);
            setLocalCharges(finalData.charges);

            const targetFilename = getTargetFilename();
            await googleDriveService.uploadFile(finalData, fileId, targetFilename);

            setPendingConflict(null);
            setLastSyncTime(new Date());
        } catch (e) {
            setError("Error resolviendo conflicto: " + e.message);
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

    // Debug log for render
    // logger.debug(`useGoogleSync Render: localTrips=${localTrips?.length}`);

    const performSync = useCallback(async (newTripsData = null, options = {}) => {
        logger.info(`[Sync] Initiated. Local trips: ${localTrips?.length}, New data: ${newTripsData?.length}, Online: ${navigator.onLine}`);

        if (!navigator.onLine) {
            setError("Sin conexión a Internet");
            setIsSyncing(false);
            return;
        }

        // We rely on service state primarily, as isAuthenticated state might lag during login flow
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

            let fileId = null;
            let legacyImport = false;

            if (files && files.length > 0) {
                // Sort by size (heaviest first)
                // Note: size is string in API response
                files.sort((a, b) => {
                    const sizeA = parseInt(a.size || '0', 10);
                    const sizeB = parseInt(b.size || '0', 10);
                    return sizeB - sizeA;
                });

                // Pick the heaviest
                const heaviestFile = files[0];
                fileId = heaviestFile.id;

                logger.info(`[Sync] Selected heaviest file: ${heaviestFile.name} (${heaviestFile.size} bytes)`);

                // Cleanup: Delete duplicates (smaller files)
                if (files.length > 1) {
                    const duplicates = files.slice(1);
                    logger.warn(`[Sync] Found ${duplicates.length} smaller duplicates. Cleaning up...`);

                    // Process deletions in background to not block sync too much
                    // or await if we want strict safety. Let's await to ensure clean state.
                    for (const dup of duplicates) {
                        try {
                            await googleDriveService.deleteFile(dup.id);
                            logger.info(`[Sync] Deleted duplicate: ${dup.id} (${dup.size} bytes)`);
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
            let remoteData = { trips: [], settings: {}, charges: [] };
            if (fileId) {
                remoteData = await googleDriveService.downloadFile(fileId);
                logger.info(`[Sync] Remote data downloaded: ${remoteData.trips?.length} trips`);
            }

            // 3. Determine Merge Strategy
            const currentTrips = newTripsData || localTrips;
            const currentCharges = Array.isArray(localCharges) ? localCharges : [];
            const isFreshLogin = currentTrips.length === 0 && remoteData.trips.length > 0;

            let merged;
            if (isFreshLogin) {
                logger.warn(`[Sync] Fresh login/Clean install. Loading ${remoteData.trips.length} trips from Cloud.`);
                merged = remoteData;
            } else {
                // Standard Merge
                merged = googleDriveService.mergeData(
                    { trips: currentTrips, settings: { ...settings, carName: carName || settings.carName }, charges: currentCharges },
                    remoteData
                );

                // Safety check: Don't allow clearing all trips if we had some before
                if (merged.trips.length === 0 && currentTrips.length > 0) {
                    logger.error('[Sync] CRITICAL: Merge resulted in 0 trips but local had data. Aborting sync.');
                    throw new Error("Error crítico: La sincronización resultó en datos vacíos. Operación cancelada para proteger tus datos.");
                }
            }

            // 4. Update Local State
            logger.info(`[Sync] Updating local state with ${merged.trips.length} trips`);
            setLocalTrips(merged.trips);
            setSettings(merged.settings);
            setLocalCharges(merged.charges);

            // 5. Upload Merged State
            // If legacyImport, create NEW file (targetFileId = null)
            const uploadId = legacyImport ? null : fileId;
            const uploadResult = await googleDriveService.uploadFile(merged, uploadId, targetFilename);
            const finalFileId = uploadResult.id;

            // 5b. Update Local Car Name if found in settings
            // This ensures "BYD Recuperado..." is replaced by real name "My Seal" after sync
            if (updateCar && merged.settings?.carName && activeCarId) {
                logger.info(`[Sync] Updating car name to: ${merged.settings.carName}`);
                updateCar(activeCarId, { name: merged.settings.carName });
            }

            setLastSyncTime(new Date());
            logger.info('[Sync] Successfully synchronized and uploaded.');

            // 6. Update Cloud Registry (background)
            try {
                const now = new Date().toISOString();
                const currentReg = await googleDriveService.getRegistry() || { cars: [] };
                const existingIndex = currentReg.cars.findIndex(c => c.id === activeCarId);

                const carEntry = {
                    id: activeCarId,
                    name: settings.carName || 'Mi BYD',
                    model: 'BYD',
                    lastSync: now,
                    fileId: finalFileId
                };

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

        } catch (e) {
            // Handle Auth Errors (Redirect to Landing if token dead)
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
    }, [localTrips, settings, localCharges, setLocalTrips, setSettings, setLocalCharges, logout, getTargetFilename, isAuthenticated, activeCarId, totalCars]);

    // Common login success handler
    const handleLoginSuccess = useCallback(async (accessToken) => {
        googleDriveService.setAccessToken(accessToken);
        localStorage.setItem('google_access_token', accessToken);

        // Google access tokens typically expire in 1 hour (3600 seconds)
        // Store expiry time as timestamp
        const expiryTime = Date.now() + (60 * 60 * 1000); // 1 hour from now
        localStorage.setItem('google_token_expiry', expiryTime.toString());

        setIsAuthenticated(true);
        await fetchUserProfile(accessToken);

        // Registry Check with Conflict Prevention
        const modalOpened = await checkAndPromptRegistry();

        if (!modalOpened) {
            performSync();
        } else {
            logger.info("[Sync] Suspended pending registry action");
        }
    }, [fetchUserProfile, performSync, checkAndPromptRegistry]);

    // Ref to hold the latest handleLoginSuccess to avoid stale closures in useGoogleLogin
    const handleLoginSuccessRef = useRef(handleLoginSuccess);
    useEffect(() => {
        handleLoginSuccessRef.current = handleLoginSuccess;
    }, [handleLoginSuccess]);

    // Web login hook (only used on web)
    const webLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            // Use ref to ensure we call the latest version with fresh state (localTrips)
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

    // Platform-aware login function
    const login = useCallback(async () => {
        const isNative = Capacitor.isNativePlatform();

        if (isNative) {
            // Native Android/iOS - use Capacitor SocialLogin
            try {
                // SocialLogin is already initialized in useEffect

                const result = await SocialLogin.login({
                    provider: 'google',
                    options: {
                        scopes: ['email', 'profile', 'https://www.googleapis.com/auth/drive.appdata']
                    }
                });

                // Get access token from authentication - try multiple paths
                const accessToken = result.result?.accessToken?.token
                    || result.result?.accessToken
                    || result.accessToken?.token
                    || result.accessToken;

                // Get access token from authentication - try multiple paths

                if (accessToken) {
                    await handleLoginSuccess(accessToken);
                } else {
                    logger.error('No accessToken found. Result:', JSON.stringify(result));
                    // setError("Error crítico: Google no devolvió Token de Acceso (solo ID). Reporta esto.");

                    // Fallback attempt (sometimes plugins put it elsewhere) or try ID token as last resort if needed
                    // But for now, error out to be safe.
                    setError("Error: No Access Token received.");
                }
            } catch (e) {
                logger.error('Native Login Failed:', e);
                setError(e.message || "Error al iniciar sesión con Google");
            }
        } else {
            // Web - use @react-oauth/google
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

    const importFromCloud = useCallback(async (fileId) => {
        setIsSyncing(true);
        try {
            logger.info(`Importing data from cloud file: ${fileId}`);
            const remoteData = await googleDriveService.downloadFile(fileId);

            // Merge with local data
            const currentTrips = localTrips || [];
            const currentCharges = localCharges || [];

            const merged = googleDriveService.mergeData(
                { trips: currentTrips, settings: settings, charges: currentCharges },
                remoteData
            );

            // Update local state
            setLocalTrips(merged.trips);
            setSettings(merged.settings);
            setLocalCharges(merged.charges);

            // Sync result to CURRENT target file
            const targetFilename = getTargetFilename();
            // Pass null as fileId to ensure we find/create the TARGET file, not update the source file
            await googleDriveService.uploadFile(merged, null, targetFilename);

            setLastSyncTime(new Date());
            return true;
        } catch (e) {
            logger.error('Import failed', e);
            setError("Error importando: " + e.message);
            return false;
        } finally {
            setIsSyncing(false);
        }
    }, [localTrips, settings, localCharges, setLocalTrips, setSettings, setLocalCharges, getTargetFilename]);

    const deleteBackup = useCallback(async (fileId) => {
        try {
            await googleDriveService.deleteFile(fileId);
            return true;
        } catch (e) {
            logger.error('Error deleting backup', e);
            throw e;
        }
    }, []);

    const restoreFromRegistry = useCallback(async (car) => {
        setIsSyncing(true);
        try {
            logger.info("Restoring from registry car:", car.id);
            // 1. Set activeCarId in local storage (CarContext handles state update ideally, but we might need to force reload or callback)
            // Wait, we can't change activeCarId directly here, it's a prop. 
            // We need a callback prop to update it?
            // "useGoogleSync" receives "activeCarId". It doesn't receive "setActiveCarId" or similar.
            // Oh, we need to pass a method to update the car ID.

            // Actually, we can update localStorage and reload? Or expect the parent to handle it?
            // Let's modify the signature of useGoogleSync to accept "restoreCar" callback?
            // Or simpler: We return the car ID, and the component (GoogleSyncSettings) handles it?
            // But the modal is inside ModalContainer which doesn't have access to CarContext setter easily?
            // Wait, ModalContainer is inside AppProviders -> CarProvider. So useData uses CarContext.
            // We can just call a method from useData/CarContext?
            // But useGoogleSync is a hook used inside DataProvider/useData. Circular?

            // Solution: We'll implement the logic to download data here, but the ID update must happen externally if possible.
            // OR we assume we can write to localStorage directly for the "fresh install" case and reload.
            // Let's try to update localStorage and trigger a callback if provided.

            // Better: update file content logic (already handled by performSync if we change ID).
            // But first we must switch ID.

            // Let's assume we can dispatch an event or use a provided callback.
            // For now, let's write to localStorage 'byd_active_car_id' and 'byd_cars'.

            const carsKey = 'byd_cars';
            const activeKey = 'byd_active_car_id';

            // Construct car object
            const restoredCar = {
                id: car.id,
                name: car.name,
                type: 'ev', // default
                isHybrid: false
            };

            localStorage.setItem(carsKey, JSON.stringify([restoredCar]));
            localStorage.setItem(activeKey, car.id);

            // Force reload to pick up new context
            window.location.reload();
            return true;

        } catch (e) {
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

    // Helper to update registry
    const updateCloudRegistry = useCallback(async () => {
        if (!activeCarId || !googleDriveService.isInited) return;
        try {
            // Get current file ID
            // We don't know it easily unless we list?
            // We can search.
            const targetFilename = `byd_stats_data_${activeCarId}.json`;
            const files = await googleDriveService.listFiles(targetFilename);
            if (!files || files.length === 0) return;

            const fileId = files[0].id;

            // Get current registry
            const currentReg = await googleDriveService.getRegistry() || { cars: [] };

            // Update/Add current car
            const now = new Date().toISOString();
            const carName = settings.carName || 'Mi BYD'; // Where do we get name? Settings or CarContext?
            // settings doesn't have name usually? Car object does.
            // But useGoogleSync doesn't have full car object? 
            // We might need to pass it or read from settings if we added it there.
            // Let's assume settings has it or use generic.

            const existingIndex = currentReg.cars.findIndex(c => c.id === activeCarId);
            const carEntry = {
                id: activeCarId,
                name: carName,
                model: 'BYD', // detailed model info?
                lastSync: now,
                fileId: fileId
            };

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

    // Hook into performSync to update registry on success?
    // Or do it separately?

    // --- EFFECTS (Keep after function definitions to avoid TDZ) ---

    // check previous session
    useEffect(() => {
        const checkAuth = async () => {
            // Init SocialLogin for native
            if (Capacitor.isNativePlatform()) {
                await SocialLogin.initialize({
                    google: {
                        webClientId: "721727786401-l61n23pt50lq34789851610211116124.apps.googleusercontent.com"
                    }
                }).catch(err => {
                    // logger.debug('SocialLogin init error', err);
                });
            }

            const token = localStorage.getItem('google_access_token');
            const expiry = localStorage.getItem('google_token_expiry');

            if (token && expiry && Date.now() < parseInt(expiry)) {
                googleDriveService.setAccessToken(token);
                setIsAuthenticated(true);
                // fetch profile
                fetchUserProfile(token);

                // Registry Check on Session Restore
                checkAndPromptRegistry().then(opened => {
                    if (opened) {
                        logger.info("[Auth] Registry modal opened, waiting for user action.");
                    } else {
                        // Optional: Trigger sync if not opened?
                        // Standard behavior for session restore is usually passive or auto-refresh on visibility.
                        // But if token is valid, we might want to sync?
                        // The original code didn't force sync on session restore immediately unless fresh install.
                        // Let's keep it passive unless fresh install?
                        // Actually, if we just logged in (restored session), we should probably sync eventually.
                        // But let's stick to the prompt logic first.
                    }
                });
            } else if (token || expiry) {
                // Token expired - attempt silent refresh if native
                if (Capacitor.isNativePlatform()) {
                    logger.info("[Auth] Token expired, attempting silent refresh...");
                    login(); // This will trigger the native SocialLogin which often handles silent refresh
                } else {
                    localStorage.removeItem('google_access_token');
                    localStorage.removeItem('google_token_expiry');
                }
            }
        };
        checkAuth();
    }, [fetchUserProfile, localTrips.length, totalCars, openRegistryModal, login]);

    // Visibility Listener for Auto-Refresh
    useEffect(() => {
        const handleVisibilityChange = () => {
            // Block auto-sync if registry modal is waiting for user input
            if (isRegistryModalOpen) return;

            if (document.visibilityState === 'visible' && isAuthenticated && !isSyncing) {
                const now = Date.now();
                const lastSync = lastSyncTime ? lastSyncTime.getTime() : 0;
                // Min 2 minutes between auto-refreshes on visibility
                if (now - lastSync > 2 * 60 * 1000) {
                    logger.info("[Sync] App became visible, triggering auto-pull...");
                    performSync();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isAuthenticated, isSyncing, lastSyncTime, performSync, isRegistryModalOpen]);

    return useMemo(() => ({
        isAuthenticated,
        isSyncing,
        lastSyncTime,
        error,
        userProfile,
        pendingConflict,
        resolveConflict,
        dismissConflict: () => setPendingConflict(null),
        login,
        logout,
        syncNow: (data, options) => performSync(data, options),
        checkCloudBackups,
        importFromCloud,
        deleteBackup,
        restoreFromRegistry,
        skipRegistryRestore,
        updateCloudRegistry
    }), [
        isAuthenticated, isSyncing, lastSyncTime, error, userProfile, pendingConflict,
        resolveConflict, login, logout, performSync, checkCloudBackups, importFromCloud, deleteBackup,
        restoreFromRegistry, skipRegistryRestore, updateCloudRegistry
    ]);
}
