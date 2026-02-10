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
        const token = sessionStorage.getItem('google_access_token');
        const expiry = sessionStorage.getItem('google_token_expiry');
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
        googleDriveService.setAccessToken(accessToken);
        sessionStorage.setItem('google_access_token', accessToken);
        const expiryTime = Date.now() + (60 * 60 * 1000); // 1 hour
        sessionStorage.setItem('google_token_expiry', expiryTime.toString());

        setIsAuthenticated(true);
        await fetchUserProfile(accessToken);

        if (onLoginSuccessCallback.current) {
            onLoginSuccessCallback.current(accessToken);
        }
    }, [fetchUserProfile]);

    // Handle initial auth check
    useEffect(() => {
        const checkAuth = async () => {
            if (Capacitor.isNativePlatform()) {
                await SocialLogin.initialize({
                    google: {
                        webClientId: "721727786401-l61n23pt50lq34789851610211116124.apps.googleusercontent.com"
                    }
                }).catch(() => { });
            }

            const token = sessionStorage.getItem('google_access_token');
            const expiry = sessionStorage.getItem('google_token_expiry');

            if (token && expiry && Date.now() < parseInt(expiry)) {
                googleDriveService.setAccessToken(token);
                setIsAuthenticated(true);
                fetchUserProfile(token);
                // Trigger success callback for initial load if needed?
                // Usually we just set state. Consumers watch isAuthenticated.
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
        scope: "https://www.googleapis.com/auth/drive.appdata"
    });

    const login = useCallback(async () => {
        const isNative = Capacitor.isNativePlatform();
        if (isNative) {
            try {
                const result = await SocialLogin.login({
                    provider: 'google',
                    options: { scopes: ['email', 'profile', 'https://www.googleapis.com/auth/drive.appdata'] }
                });
                const resultAny = result as any;
                const accessToken = resultAny.result?.accessToken?.token || resultAny.result?.accessToken || resultAny.accessToken?.token || resultAny.accessToken;

                if (accessToken) {
                    await handleLoginSuccess(accessToken);
                } else {
                    setError("Error: No Access Token received.");
                }
            } catch (e: any) {
                setError(e.message || "Error al iniciar sesión con Google");
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
            sessionStorage.removeItem('google_access_token');
            sessionStorage.removeItem('google_token_expiry');
            setIsAuthenticated(false);
            setUserProfile(null);
        } catch (e) {
            logger.error('Logout failed', e);
        }
    }, []);

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
