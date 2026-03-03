import { useState, useCallback, useRef, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { logger } from '@core/logger';
import { googleDriveService } from '@/services/googleDrive';
import { toast } from 'react-hot-toast';
import { secureGet, secureSet, secureRemove } from '@/utils/secureStorage';

export interface UserProfile {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    locale: string;
}

export function useGoogleAuth() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
        // Fallback for initial state. The real check is async below.
        const token = localStorage.getItem('google_access_token');
        const expiry = localStorage.getItem('google_token_expiry');
        return !!(token && expiry && Date.now() < parseInt(expiry));
    });
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [error, setError] = useState<string | null>(null);

    const onLoginSuccessCallback = useRef<((token: string) => void) | null>(null);

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

    const handleLoginSuccess = useCallback(async (accessToken: string) => {
        logger.info('[Auth] Login successful, processing token...');
        googleDriveService.setAccessToken(accessToken);
        await secureSet('google_access_token', accessToken);
        const expiryTime = Date.now() + (60 * 60 * 1000); // 1 hour
        await secureSet('google_token_expiry', expiryTime.toString());

        // Trigger callback FIRST to establish locks before React re-renders
        if (onLoginSuccessCallback.current) {
            onLoginSuccessCallback.current(accessToken);
        }

        setIsAuthenticated(true);
        // Fetch profile in the background, no need to await and block
        fetchUserProfile(accessToken).catch(e => logger.error('[Auth] Profile fetch error', e));
    }, [fetchUserProfile]);

    // Handle initial auth check
    useEffect(() => {
        const checkAuth = async () => {
            // Restore token from localStorage IMMEDIATELY so Drive operations work
            // This must happen BEFORE SocialLogin.initialize() which can be slow on native
            const token = await secureGet('google_access_token');
            const expiry = await secureGet('google_token_expiry');

            if (token && expiry && Date.now() < parseInt(expiry)) {
                googleDriveService.setAccessToken(token);
                setIsAuthenticated(true);
                fetchUserProfile(token);
            }

            // Initialize SocialLogin for future login operations (doesn't block Drive API)
            if (Capacitor.isNativePlatform()) {
                const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
                logger.info('[Auth] Initializing SocialLogin with clientId:', clientId);
                await SocialLogin.initialize({
                    google: {
                        webClientId: clientId
                    }
                }).catch((err) => {
                    logger.error('[Auth] SocialLogin initialization failed:', err);
                });
            }
        };
        checkAuth();
    }, [fetchUserProfile]);

    const webLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            await handleLoginSuccess(tokenResponse.access_token);
        },
        onError: (err) => {
            logger.error('Web Login Failed:', err);
            setError("Login failed");
            toast.error("Web Login failed");
        },
        scope: "email profile https://www.googleapis.com/auth/drive.appdata"
    });

    const login = useCallback(async () => {
        const isNative = Capacitor.isNativePlatform();
        if (isNative) {
            try {
                logger.info('[Auth] Starting native Google login...');
                const result = await SocialLogin.login({
                    provider: 'google',
                    options: { scopes: ['email', 'profile', 'https://www.googleapis.com/auth/drive.appdata'] }
                });

                logger.info('[Auth] Native login result:', JSON.stringify(result));

                // Simplify token extraction by probing the expected structure directly
                let accessToken: string | null = null;
                try {
                    const res = result as any;
                    accessToken = 
                        res?.accessToken?.token || 
                        res?.accessToken || 
                        res?.result?.accessToken?.token || 
                        res?.result?.accessToken || 
                        res?.token || 
                        null;
                } catch (e) {
                    logger.error('[Auth] Failed to parse native auth result', e);
                }

                if (accessToken) {
                    await handleLoginSuccess(accessToken);
                    toast.success("Sesión iniciada correctamente");
                } else {
                    const msg = "Error: No Access Token received. Result: " + JSON.stringify(result);
                    setError(msg);
                    toast.error(msg);
                }
            } catch (e) {
                const error = e instanceof Error ? e : new Error(String(e));
                const msg = error.message || "Error al iniciar sesión con Google";
                setError(msg);
                toast.error(msg);
            }
        } else {
            webLogin();
        }
    }, [webLogin, handleLoginSuccess]);

    const logout = useCallback(async () => {
        try {
            await googleDriveService.signOut();
            if (Capacitor.isNativePlatform()) {
                try { 
                    await SocialLogin.logout({ provider: 'google' }); 
                } catch (err) {
                    logger.error('[Auth] Error closing native Google session', err);
                    // Forzar limpieza de tokens aunque falle el plugin
                }
            }
            await secureRemove('google_access_token');
            await secureRemove('google_token_expiry');
            localStorage.removeItem('google_access_token');
            localStorage.removeItem('google_token_expiry');
            setIsAuthenticated(false);
            setUserProfile(null);
        } catch (e) {
            logger.error('Logout failed', e);
        }
    }, []);

    // Register unauthorized listener to handle token expiry from Drive Service
    useEffect(() => {
        googleDriveService.setOnUnauthorized(() => {
            logger.warn('[Auth] Session invalidated by Drive Service (401)');
            logout();
            setError("Tu sesión de Google ha expirado o es inválida. Por favor, inicia sesión de nuevo.");
        });
        return () => googleDriveService.setOnUnauthorized(() => { });
    }, [logout]);

    return {
        isAuthenticated,
        userProfile,
        error,
        setError,
        login,
        logout,
        onLoginSuccessCallback
    };
}
