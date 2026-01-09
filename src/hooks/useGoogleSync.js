import { useState, useCallback, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { googleDriveService } from '../services/googleDrive';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';

export function useGoogleSync(localTrips, setLocalTrips, settings, setSettings) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState(null);
    const [error, setError] = useState(null);
    const [userProfile, setUserProfile] = useState(null);

    // Define fetchUserProfile here so it's available for the initial useEffect
    const fetchUserProfile = useCallback(async (accessToken) => {
        try {
            const response = await fetch(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${accessToken}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/json'
                }
            });
            if (response.ok) {
                const data = await response.json();
                setUserProfile({
                    name: data.name,
                    imageUrl: data.picture,
                    email: data.email
                });
            } else {
                // If profile fetch fails with 401, token is likely expired
                if (response.status === 401) {
                    console.warn("Token expired, clearing session");
                    // Call logout here, but ensure it doesn't cause a circular dependency or infinite loop
                    // For now, we'll just clear auth state. The actual logout function will handle clearing token.
                    setIsAuthenticated(false);
                    setUserProfile(null);
                    localStorage.removeItem('google_access_token');
                }
            }
        } catch (e) {
            console.error("Error fetching user profile", e);
        }
    }, []); // No dependencies needed for this specific implementation

    // Initial auth check (restore session)
    useEffect(() => {
        console.log("useGoogleSync: MOUNTED");

        // Initialize Native SocialLogin immediately if native
        if (Capacitor.isNativePlatform()) {
            SocialLogin.initialize({
                google: {
                    webClientId: '689099974608-b4q9jhdglhlqfmr7lo44rgqtehor4o33.apps.googleusercontent.com'
                }
            }).catch(err => console.error("Failed to init SocialLogin on mount:", err));
        }

        const restoreSession = async () => {
            try {
                // Initialize service (Fetch mode)
                await googleDriveService.initClient();

                const savedToken = localStorage.getItem('google_access_token');
                if (savedToken) {
                    console.log("Restoring session from token");
                    googleDriveService.setAccessToken(savedToken);
                    setIsAuthenticated(true);
                    fetchUserProfile(savedToken);
                }
            } catch (e) {
                console.error("Failed to restore session", e);
            }
        };
        restoreSession();
        return () => console.log("useGoogleSync: UNMOUNTED");
    }, [fetchUserProfile]);

    useEffect(() => {
        console.log("useGoogleSync: isAuthenticated changed to:", isAuthenticated);
    }, [isAuthenticated]);

    // Moved fetchUserProfile definition above useEffect to avoid lint warning and ensure availability
    // const fetchUserProfile = async (accessToken) => { ... };

    const logout = useCallback(async () => {
        try {
            await googleDriveService.signOut();

            if (Capacitor.isNativePlatform()) {
                try {
                    await SocialLogin.logout({ provider: 'google' });
                    console.log("Native SocialLogin logout completed");
                } catch (nativeErr) {
                    console.warn("Native logout error (ignoring):", nativeErr);
                }
            }

            localStorage.removeItem('google_access_token'); // Clear Token
            setIsAuthenticated(false);
            setUserProfile(null);
        } catch (e) {
            console.error("Logout failed", e);
        }
    }, []);

    /**
     * Core Sync Logic
     * @param {Array} newTripsData - Optional. If provided, represents the latest local trips state (e.g. after file load).
     */
    const performSync = useCallback(async (newTripsData = null) => {
        if (!googleDriveService.isInited) return;

        setIsSyncing(true);
        setError(null);
        try {
            // 1. Find or Create File
            const files = await googleDriveService.listFiles();
            let fileId = null;

            if (files && files.length > 0) {
                fileId = files[0].id;
                console.log("Found existing DB file:", fileId);
            }

            // 2. Download Remote Data
            let remoteData = { trips: [], settings: {} };
            if (fileId) {
                remoteData = await googleDriveService.downloadFile(fileId);
            }

            // 3. Determine Merge Strategy
            // "Cloud Wins" Check: If local is empty and remote has data, assume fresh login on new device.
            const isFreshLogin = localTrips.length === 0 && !newTripsData && remoteData.trips.length > 0;

            if (isFreshLogin) {
                console.log("Fresh login detected: Loading data from Cloud.");
                setLocalTrips(remoteData.trips);
                if (remoteData.settings && Object.keys(remoteData.settings).length > 0) {
                    setSettings(remoteData.settings);
                }
            } else {
                // Standard Merge: Union of local + remote
                console.log("Syncing: Merging local and cloud data.");
                const currentTrips = newTripsData || localTrips;

                // Merge Data (Services handles Trips Union and Settings Overlay)
                const tripsToMerge = Array.isArray(currentTrips) ? currentTrips : [];
                const merged = googleDriveService.mergeData(
                    { trips: tripsToMerge, settings: settings },
                    remoteData
                );

                // Update Local State
                setLocalTrips(merged.trips);
                setSettings(merged.settings);

                // Upload Merged State
                await googleDriveService.uploadFile(merged, fileId);
            }

            setLastSyncTime(new Date());

        } catch (e) {
            console.error("Sync failed:", e);

            if (e.status === 401 || e.status === 403 ||
                (e.result && e.result.error && (e.result.error.code === 401 || e.result.error.code === 403))) {
                console.warn("Auth error (401/403), logging out...");
                logout(); // Auto logout on auth error or permission denied
            }
            setError(e.message || "Error de sincronización");
        } finally {
            setIsSyncing(false);
        }
    }, [localTrips, settings, setLocalTrips, setSettings, logout]); // Added logout to dependencies

    // Web login hook (only used on web)
    const webLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            console.log("Web Login Success:", tokenResponse);
            await handleLoginSuccess(tokenResponse.access_token);
        },
        onError: (error) => {
            console.error("Web Login Failed:", error);
            setError("Login failed");
        },
        scope: "https://www.googleapis.com/auth/drive.appdata"
    });

    // Common login success handler
    const handleLoginSuccess = async (accessToken) => {
        googleDriveService.setAccessToken(accessToken);
        localStorage.setItem('google_access_token', accessToken);
        setIsAuthenticated(true);
        await fetchUserProfile(accessToken);
        performSync();
    };

    // Platform-aware login function
    const login = useCallback(async () => {
        const isNative = Capacitor.isNativePlatform();
        console.log("Login attempt. Platform:", isNative ? "Native" : "Web");

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
                console.log("Native Login Success:", JSON.stringify(result));

                // Get access token from authentication - try multiple paths
                const accessToken = result.result?.accessToken?.token
                    || result.result?.accessToken
                    || result.accessToken?.token
                    || result.accessToken;

                // DEBUG: Inspect the result structure exactly
                const hasAccess = !!(result.result?.accessToken?.token || result.result?.accessToken || result.accessToken?.token || result.accessToken);

                if (accessToken) {
                    console.log("Access token found, handling success...");
                    await handleLoginSuccess(accessToken);
                } else {
                    console.error("No accessToken found. Result:", JSON.stringify(result));
                    // setError("Error crítico: Google no devolvió Token de Acceso (solo ID). Reporta esto.");

                    // Fallback attempt (sometimes plugins put it elsewhere) or try ID token as last resort if needed
                    // But for now, error out to be safe.
                    setError("Error: No Access Token received.");
                }
            } catch (e) {
                console.error("Native Login Failed:", e);
                setError(e.message || "Error al iniciar sesión con Google");
            }
        } else {
            // Web - use @react-oauth/google
            webLogin();
        }
    }, [webLogin, fetchUserProfile, performSync]);


    return {
        isAuthenticated,
        isSyncing,
        lastSyncTime,
        error,
        userProfile,
        login,
        logout,
        syncNow: (data) => performSync(data)
    };
}
