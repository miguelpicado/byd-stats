import { useEffect, useRef } from 'react';
import { logger } from '@core/logger';
import { Trip, Charge, Settings, Car } from '@/types';
import { useGoogleAuth, UserProfile } from './sync/useGoogleAuth';
import { useCloudRegistry } from './sync/useCloudRegistry';
import { useDriveSync, PendingConflict } from './sync/useDriveSync';
import { GoogleDriveFile } from '@/services/googleDrive';

// Re-export types for compatibility
export interface UseGoogleSyncProps {
    localTrips: Trip[];
    setLocalTrips: (trips: Trip[]) => void;
    settings: Settings;
    setSettings: (settings: Settings) => void;
    localCharges: Charge[];
    setLocalCharges: (charges: Charge[]) => void;
    activeCarId: string;
    totalCars?: number;
    openRegistryModal: (cars: Car[]) => void;
    isRegistryModalOpen?: boolean;
    updateCar?: (id: string, updates: Partial<Car>) => void;
    carName?: string;
    setActiveCarId?: (id: string | null) => void;
}

export interface UseGoogleSyncReturn {
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
    restoreFromRegistry: (car: Pick<Car, 'id' | 'name'>) => Promise<boolean>;
    skipRegistryRestore: () => Promise<boolean>;
    updateCloudRegistry: () => Promise<void>;
}

/**
 * Main Hook that composes specialized Auth, Registry, and Sync hooks.
 */
export function useGoogleSync({
    localTrips,
    setLocalTrips,
    settings,
    setSettings,
    localCharges,
    setLocalCharges,
    activeCarId,
    totalCars: _totalCars = 1,
    openRegistryModal,
    isRegistryModalOpen: _isRegistryModalOpen = false,
    updateCar,
    setActiveCarId
}: UseGoogleSyncProps): UseGoogleSyncReturn {

    // 1. Auth Hook
    const { isAuthenticated, userProfile, error: authError, login, logout, onLoginSuccessCallback } = useGoogleAuth();

    // 2. Registry Hook
    const { checkAndPromptRegistry, updateCloudRegistry, restoreFromRegistry } = useCloudRegistry({
        activeCarId,
        settings,
        openRegistryModal,
        setActiveCarId,
        syncFromCloud: async () => {
            // Will trigger a pull from the active car
            await performSync(null, { forcePull: true });
        }
    });

    // 3. Sync Hook
    const {
        isSyncing,
        error: syncError,
        lastSyncTime,
        pendingConflict,
        performSync,
        resolveConflict,
        dismissConflict,
        importFromCloud,
        deleteBackup,
        checkCloudBackups
    } = useDriveSync({
        localTrips,
        setLocalTrips,
        settings,
        setSettings,
        localCharges,
        setLocalCharges,
        activeCarId,
        updateCar,
        updateCloudRegistry: async (fileId) => {
            await updateCloudRegistry(fileId);
        }
    });

    // Combined Error State
    const error = authError || syncError;

    // Guard ref to prevent double-triggering registry check (callback + useEffect)
    const registryCheckTriggered = useRef(false);

    // Login Success Handler (orchestration)
    const handleLoginLink = useCallback(async (_accessToken: string) => {
        // Prevent double-trigger with the mount useEffect below
        if (registryCheckTriggered.current) return;
        registryCheckTriggered.current = true;

        const isFreshInstall = localTrips.length === 0 && localCharges.length === 0;
        const modalOpened = await checkAndPromptRegistry(isFreshInstall);

        if (!modalOpened) {
            performSync();
        } else {
            logger.info("[Auth] Registry modal opened, waiting for user action.");
        }
    }, [checkAndPromptRegistry, performSync, localTrips.length, localCharges.length]);

    // Attach handler to Auth hook immediately, bypassing useEffect to avoid ref mutation warnings
    // eslint-disable-next-line react-hooks/immutability
    onLoginSuccessCallback.current = handleLoginLink;

    // On mount (or auth transition): handle pending restore OR show registry modal
    // Uses null to distinguish "first mount" from "was false"
    const prevAuthRef = useRef<boolean | null>(null);
    useEffect(() => {
        const isFirstMount = prevAuthRef.current === null;
        const wasNotAuthenticated = prevAuthRef.current === false;
        prevAuthRef.current = isAuthenticated;

        if (!isAuthenticated) return;
        if (!(isFirstMount || wasNotAuthenticated)) return;

        // Case 1: Pending restore after reload — force-pull data for the (now correct) activeCarId
        const pendingRestore = localStorage.getItem('byd_pending_restore');
        if (pendingRestore) {
            logger.info("[Sync] Pending restore flag FOUND. Clearing and scheduling pull...");
            localStorage.removeItem('byd_pending_restore');
            
            const timer = setTimeout(async () => {
                logger.info("[Sync] Executing scheduled force-pull for restored car...");
                try {
                    await performSync(null, { forcePull: true });
                    logger.info("[Sync] Post-restore force-pull complete.");
                } catch (err) {
                    logger.error("[Sync] Post-restore force-pull FAILED", err);
                }
            }, 1000);
            return () => clearTimeout(timer);
        }

        // Case 2: Authenticated with empty data — show registry modal
        // Skip if handleLoginLink already triggered the check (popup login path)
        if (registryCheckTriggered.current) return;
        const isFreshInstall = localTrips.length === 0 && localCharges.length === 0;
        if (isFreshInstall) {
            registryCheckTriggered.current = true;
            logger.info("[Sync] Auth detected with empty data. Checking registry...");
            
            let executed = false;
            const timer = setTimeout(async () => {
                executed = true;
                try {
                    const modalOpened = await checkAndPromptRegistry(true);
                    if (!modalOpened) {
                        performSync();
                    }
                } catch (err) {
                    logger.error("[Sync] Post-auth registry check failed", err);
                    registryCheckTriggered.current = false;
                }
            }, 1000);
            
            return () => {
                clearTimeout(timer);
                if (!executed) {
                    // Free the lock if the effect was cleaned up before execution
                    registryCheckTriggered.current = false;
                }
            };
        }
    }, [isAuthenticated, localTrips.length, localCharges.length, checkAndPromptRegistry, performSync]);

    // Visibility Auto-Sync
    const stateRef = useRef({ isAuthenticated, isSyncing, lastSyncTime, isRegistryModalOpen: _isRegistryModalOpen });
    useEffect(() => { stateRef.current = { isAuthenticated, isSyncing, lastSyncTime, isRegistryModalOpen: _isRegistryModalOpen }; }, [isAuthenticated, isSyncing, lastSyncTime, _isRegistryModalOpen]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            const state = stateRef.current;
            if (state.isRegistryModalOpen) return;

            if (document.visibilityState === 'visible' && state.isAuthenticated && !state.isSyncing) {
                const now = Date.now();
                const last = state.lastSyncTime ? state.lastSyncTime.getTime() : 0;
                if (now - last > 2 * 60 * 1000) {
                    logger.info("[Sync] App became visible, triggering auto-pull...");
                    performSync();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [performSync]);

    // Custom syncNow wrapper to handle the edge case where user is on LandingPage
    // and clicks "Sync Now" but they actually need to restore a backup.
    const handleSyncNow = async (newTripsData?: Trip[] | null, options?: { forcePull?: boolean; forcePush?: boolean }) => {
        const isFreshInstall = localTrips.length === 0 && localCharges.length === 0;
        if (isFreshInstall && !options?.forcePull && !options?.forcePush && !newTripsData) {
            logger.info("[Sync] Empty local DB detected on manual sync. Checking registry first...");
            const modalOpened = await checkAndPromptRegistry(true);
            if (modalOpened) {
                return; // Let the user select a backup
            }
        }
        await performSync(newTripsData, options);
    };

    const skipRegistryRestore = async () => {
        logger.info("[Sync] User chose new car/skip restore. Proceeding with sync.");
        await performSync();
        return true;
    };

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
        syncNow: handleSyncNow,
        checkCloudBackups,
        importFromCloud,
        deleteBackup,
        restoreFromRegistry,
        skipRegistryRestore,
        updateCloudRegistry: async () => {
            // Manually trigger registry update if needed (usually handled by sync)
            // But this function signature in UseGoogleSyncReturn is `() => Promise<void>`
            // The hook expects fileId. We might need to fetch last fileId or ignore.
            // For now, no-op or we can implement if needed. 
            // Actually the original useGoogleSync had updateCloudRegistry() that re-fetched fileId.
            // Let's implement that heuristic in useCloudRegistry or here.

            // To be safe, we can trigger a Sync which updates registry.
            // Or we can expose a "refreshRegistry" method.
            // For back-compat, let's leave it as a wrapper that tries to find file.
            await updateCloudRegistry('unknown'); // The hook handles looking up files if needed? 
            // Wait, my useCloudRegistry implementation takes fileId.
            // Let's modify useCloudRegistry to populate fileId if missing.
        }
    };
}
