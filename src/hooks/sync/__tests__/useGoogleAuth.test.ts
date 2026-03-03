import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGoogleAuth } from '../useGoogleAuth';
import * as secureStorage from '@/utils/secureStorage';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';

// Mock Dependencies
vi.mock('@react-oauth/google', () => ({
    useGoogleLogin: vi.fn(() => vi.fn()) // Mock function that returns another function
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: vi.fn(() => false)
    }
}));

vi.mock('@capgo/capacitor-social-login', () => ({
    SocialLogin: {
        initialize: vi.fn().mockResolvedValue({}),
        login: vi.fn().mockResolvedValue({}),
        logout: vi.fn().mockResolvedValue({})
    }
}));

vi.mock('@core/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn()
    }
}));

vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('@/services/googleDrive', () => ({
    googleDriveService: {
        setAccessToken: vi.fn(),
        clearTokens: vi.fn(),
        setOnUnauthorized: vi.fn(),
        signOut: vi.fn().mockResolvedValue({})
    }
}));

vi.mock('@/utils/secureStorage', () => ({
    secureGet: vi.fn(),
    secureSet: vi.fn(),
    secureRemove: vi.fn()
}));

// Mock fetch for user profile
global.fetch = vi.fn();

describe('useGoogleAuth', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(secureStorage.secureGet).mockReset();
        localStorage.clear();

        // Reset fetch mock
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                name: 'Test User',
                email: 'test@example.com',
                picture: 'https://example.com/pic.jpg'
            })
        });
    });

    it('should initialize with isAuthenticated false if no valid token exists', () => {
        const { result } = renderHook(() => useGoogleAuth());
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.userProfile).toBe(null);
    });

    it('should initialize as authenticated if a valid token is in localStorage', () => {
        // Set up local storage with a future expiry
        const futureDate = Date.now() + 3600000;
        localStorage.setItem('google_access_token', 'valid-token');
        localStorage.setItem('google_token_expiry', futureDate.toString());

        const { result } = renderHook(() => useGoogleAuth());
        expect(result.current.isAuthenticated).toBe(true);
    });

    it('should fetch user profile when authenticated', async () => {
        // Mock secureGet to return token and valid expiry
        vi.mocked(secureStorage.secureGet).mockImplementation(async (key) => {
            if (key === 'google_access_token') return 'mock-token';
            if (key === 'google_token_expiry') return (Date.now() + 3600000).toString();
            return null;
        });

        // Use useEffect to trigger the async checkAuth
        const { result } = renderHook(() => useGoogleAuth());

        // Wait for profile fetch
        await waitFor(() => {
            expect(result.current.userProfile).not.toBeNull();
            if (result.current.userProfile) {
                expect(result.current.userProfile.name).toBe('Test User');
                expect(result.current.userProfile.email).toBe('test@example.com');
            }
        });
    });

    it('should perform native login when on native platform', async () => {
        vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
        vi.mocked(SocialLogin.login).mockResolvedValue({
            provider: 'google',
            result: { accessToken: { token: 'native-mock-token' } }
        } as any);

        const { result } = renderHook(() => useGoogleAuth());

        await act(async () => {
            await result.current.login();
        });

        expect(SocialLogin.login).toHaveBeenCalled();
        expect(secureStorage.secureSet).toHaveBeenCalledWith('google_access_token', 'native-mock-token');
        expect(result.current.isAuthenticated).toBe(true);
    });

    it('should clear data on logout', async () => {
        const { result } = renderHook(() => useGoogleAuth());

        await act(async () => {
            await result.current.logout();
        });

        await waitFor(() => {
            expect(secureStorage.secureRemove).toHaveBeenCalledWith('google_access_token');
            expect(secureStorage.secureRemove).toHaveBeenCalledWith('google_token_expiry');
            expect(result.current.isAuthenticated).toBe(false);
            expect(result.current.userProfile).toBe(null);
        });
    });
});
