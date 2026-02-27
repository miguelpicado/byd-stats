import { useState, useCallback, useRef, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { logger } from '@core/logger';
import { googleDriveService } from '@/services/googleDrive';

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
        localStorage.setItem('google_access_token', accessToken);
        const expiryTime = Date.now() + (60 * 60 * 1000); // 1 hour
        localStorage.setItem('google_token_expiry', expiryTime.toString());

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
            const token = localStorage.getItem('google_access_token');
            const expiry = localStorage.getItem('google_token_expiry');

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

                const resultAny = result as Record<string, unknown>;
                const resultObj = resultAny.result as Record<string, unknown> | undefined;
                const accessTokenObj = resultAny.accessToken as Record<string, unknown> | string | undefined;
                const resultAccessToken = resultObj?.accessToken as Record<string, unknown> | string | undefined;

                // Extract token string from various possible response formats
                const getTokenString = (tokenValue: unknown): string | null => {
                    if (typeof tokenValue === 'string') return tokenValue;
                    if (typeof tokenValue === 'object' && tokenValue !== null) {
                        const tokenObj = tokenValue as Record<string, unknown>;
                        if (typeof tokenObj.token === 'string') return tokenObj.token;
                    }
                    return null;
                };

                const accessToken =
                    getTokenString(resultAccessToken) ||
                    getTokenString(resultObj?.accessToken) ||
                    getTokenString(accessTokenObj) ||
                    getTokenString(resultAny.accessToken) ||
                    getTokenString(resultAny.token) ||
                    (resultObj && getTokenString(resultObj.token));

                if (accessToken) {
                    await handleLoginSuccess(accessToken);
                } else {
                    setError("Error: No Access Token received.");
                }
            } catch (e) {
                const error = e instanceof Error ? e : new Error(String(e));
                setError(error.message || "Error al iniciar sesión con Google");
            }
        } else {
            webLogin();
        }
    }, [webLogin, handleLoginSuccess]);

    const logout = useCallback(async () => {
        try {
            await googleDriveService.signOut();
            if (Capacitor.isNativePlatform()) {
                try { await SocialLogin.logout({ provider: 'google' }); } catch (ignored) { }
            }
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
