import { useState, useCallback, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { googleDriveService } from '../services/googleDrive';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { logger } from '../utils/logger';

export function useGoogleSync(localTrips, setLocalTrips, settings, setSettings, localCharges, setLocalCharges) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState(null);
    const [error, setError] = useState(null);
    const [userProfile, setUserProfile] = useState(null);

    // Define fetchUserProfile here so it's available for the initial useEffect
    const fetchUserProfile = useCallback(async (accessToken) => {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
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
                    logger.warn('Token expired, clearing session');
                    // Call logout here, but ensure it doesn't cause a circular dependency or infinite loop
                    // For now, we'll just clear auth state. The actual logout function will handle clearing token.
                    setIsAuthenticated(false);
                    setUserProfile(null);
                    sessionStorage.removeItem('google_access_token');
                    sessionStorage.removeItem('google_token_expiry');
                }
            }
        } catch (e) {
            logger.error('Error fetching user profile', e);
        }
    }, []); // No dependencies needed for this specific implementation

    // Initial auth check (restore session)
    useEffect(() => {
        logger.debug('useGoogleSync: MOUNTED');

        // Initialize Native SocialLogin immediately if native
        if (Capacitor.isNativePlatform()) {
            SocialLogin.initialize({
                google: {
                    webClientId: import.meta.env.VITE_GOOGLE_ANDROID_CLIENT_ID
                }
            }).catch(err => logger.error('Failed to init SocialLogin on mount:', err));
        }

        const restoreSession = async () => {
            try {
                // Initialize service (Fetch mode)
                await googleDriveService.initClient();

                const savedToken = sessionStorage.getItem('google_access_token');
                const tokenExpiry = sessionStorage.getItem('google_token_expiry');

                if (savedToken && tokenExpiry) {
                    const expiryTime = parseInt(tokenExpiry, 10);
                    const now = Date.now();

                    // Check if token is still valid (with 5 minute buffer)
                    if (now < expiryTime - (5 * 60 * 1000)) {
                        logger.debug('Restoring session from valid token');
                        googleDriveService.setAccessToken(savedToken);
                        setIsAuthenticated(true);
                        fetchUserProfile(savedToken);
                    } else {
                        logger.debug('Token expired, clearing session');
                        sessionStorage.removeItem('google_access_token');
                        sessionStorage.removeItem('google_token_expiry');
                    }
                } else if (savedToken) {
                    // Old token without expiry - try to validate it
                    logger.debug('Found token without expiry, validating...');
                    googleDriveService.setAccessToken(savedToken);

                    // Try to fetch profile - if it fails, token is invalid
                    const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
                        headers: {
                            Authorization: `Bearer ${savedToken}`,
                            Accept: 'application/json'
                        }
                    });

                    if (response.ok) {
                        setIsAuthenticated(true);
                        fetchUserProfile(savedToken);
                        // Set expiry to 1 hour from now as default
                        const expiry = Date.now() + (60 * 60 * 1000);
                        sessionStorage.setItem('google_token_expiry', expiry.toString());
                    } else {
                        logger.debug('Token validation failed, clearing');
                        sessionStorage.removeItem('google_access_token');
                    }
                }
            } catch (e) {
                logger.error('Failed to restore session', e);
                sessionStorage.removeItem('google_access_token');
                sessionStorage.removeItem('google_token_expiry');
            }
        };
        restoreSession();
        return () => logger.debug('useGoogleSync: UNMOUNTED');
    }, [fetchUserProfile]);

    useEffect(() => {
        logger.debug('useGoogleSync: isAuthenticated changed to:', isAuthenticated);
    }, [isAuthenticated]);

    // Moved fetchUserProfile definition above useEffect to avoid lint warning and ensure availability
    // const fetchUserProfile = async (accessToken) => { ... };

    const logout = useCallback(async () => {
        try {
            await googleDriveService.signOut();

            if (Capacitor.isNativePlatform()) {
                try {
                    await SocialLogin.logout({ provider: 'google' });
                    logger.debug('Native SocialLogin logout completed');
                } catch (nativeErr) {
                    logger.warn('Native logout error (ignoring):', nativeErr);
                }
            }

            sessionStorage.removeItem('google_access_token'); // Clear Token
            sessionStorage.removeItem('google_token_expiry'); // Clear Token Expiry
            setIsAuthenticated(false);
            setUserProfile(null);
        } catch (e) {
            logger.error('Logout failed', e);
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
                logger.debug('Found existing DB file:', fileId);
            }

            // 2. Download Remote Data
            let remoteData = { trips: [], settings: {}, charges: [] };
            if (fileId) {
                remoteData = await googleDriveService.downloadFile(fileId);
            }

            // 3. Determine Merge Strategy
            // "Cloud Wins" Check: If local is empty and remote has data, assume fresh login on new device.
            const isFreshLogin = localTrips.length === 0 && !newTripsData && remoteData.trips.length > 0;

            if (isFreshLogin) {
                logger.debug('Fresh login detected: Loading data from Cloud.');
                setLocalTrips(remoteData.trips);
                if (remoteData.settings && Object.keys(remoteData.settings).length > 0) {
                    setSettings(remoteData.settings);
                }
                if (remoteData.charges && Array.isArray(remoteData.charges) && remoteData.charges.length > 0) {
                    setLocalCharges(remoteData.charges);
                }
            } else {
                // Standard Merge: Union of local + remote
                logger.debug('Syncing: Merging local and cloud data.');
                const currentTrips = newTripsData || localTrips;
                const currentCharges = Array.isArray(localCharges) ? localCharges : [];

                // Merge Data (Services handles Trips Union, Settings Overlay, and Charges Union)
                const tripsToMerge = Array.isArray(currentTrips) ? currentTrips : [];
                const merged = googleDriveService.mergeData(
                    { trips: tripsToMerge, settings: settings, charges: currentCharges },
                    remoteData
                );

                // Update Local State
                setLocalTrips(merged.trips);
                setSettings(merged.settings);
                setLocalCharges(merged.charges);

                // Upload Merged State
                await googleDriveService.uploadFile(merged, fileId);
            }

            setLastSyncTime(new Date());

        } catch (e) {
            logger.error('Sync failed:', e);

            if (e.status === 401 || e.status === 403 ||
                (e.result && e.result.error && (e.result.error.code === 401 || e.result.error.code === 403))) {
                logger.warn('Auth error (401/403), logging out...');
                logout(); // Auto logout on auth error or permission denied
            }
            setError(e.message || "Error de sincronización");
        } finally {
            setIsSyncing(false);
        }
    }, [localTrips, settings, localCharges, setLocalTrips, setSettings, setLocalCharges, logout]); // Added charges to dependencies

    // Web login hook (only used on web)
    const webLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            logger.debug('Web Login Success:', tokenResponse);
            await handleLoginSuccess(tokenResponse.access_token);
        },
        onError: (error) => {
            logger.error('Web Login Failed:', error);
            setError("Login failed");
        },
        scope: "https://www.googleapis.com/auth/drive.appdata"
    });

    // Common login success handler
    const handleLoginSuccess = useCallback(async (accessToken) => {
        googleDriveService.setAccessToken(accessToken);
        sessionStorage.setItem('google_access_token', accessToken);

        // Google access tokens typically expire in 1 hour (3600 seconds)
        // Store expiry time as timestamp
        const expiryTime = Date.now() + (60 * 60 * 1000); // 1 hour from now
        sessionStorage.setItem('google_token_expiry', expiryTime.toString());

        setIsAuthenticated(true);
        await fetchUserProfile(accessToken);
        performSync();
    }, [fetchUserProfile, performSync]);

    // Platform-aware login function
    const login = useCallback(async () => {
        const isNative = Capacitor.isNativePlatform();
        logger.debug('Login attempt. Platform:', isNative ? 'Native' : 'Web');

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
                logger.debug('Native Login Success:', JSON.stringify(result));

                // Get access token from authentication - try multiple paths
                const accessToken = result.result?.accessToken?.token
                    || result.result?.accessToken
                    || result.accessToken?.token
                    || result.accessToken;

                // Get access token from authentication - try multiple paths

                if (accessToken) {
                    logger.debug('Access token found, handling success...');
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
