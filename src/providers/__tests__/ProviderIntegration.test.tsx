import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AppProviders } from '../AppProviders';
import { useData } from '../DataProvider';
import { useApp } from '@/context/AppContext';
import { useCar } from '@/context/CarContext';
import { Trip, Charge } from '@/types';

// Mock dependencies that would otherwise cause issues in test environment
vi.mock('@react-oauth/google', () => ({
    GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    useGoogleLogin: () => ({}),
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: () => false,
        getPlatform: () => 'web',
    },
    registerPlugin: vi.fn(),
}));

// Mock Database hook to prevent actual IndexedDB calls
vi.mock('@hooks/useDatabase', () => ({
    useDatabase: () => ({
        sqlReady: true,
        loading: false,
        error: null,
        initSql: vi.fn(),
        processDB: vi.fn().mockResolvedValue([]),
        exportDatabase: vi.fn().mockResolvedValue(true),
        getDatabaseInstance: vi.fn(),
    })
}));

// Mock Google Sync Hook
vi.mock('@hooks/useGoogleSync', () => ({
    useGoogleSync: () => ({
        isAuthenticated: false,
        isSyncing: false,
        lastSync: null,
        login: vi.fn(),
        logout: vi.fn(),
        syncNow: vi.fn(),
        manualSync: vi.fn(),
        downloadTripsRecord: vi.fn()
    })
}));

describe('Provider Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProviders>{children}</AppProviders>
    );

    it('should provide default trips and charges data through provider chain', async () => {
        const { result } = renderHook(() => useData(), { wrapper });

        await waitFor(() => {
            expect(result.current).toBeDefined();
            expect(result.current.trips).toEqual([]);
            expect(result.current.charges).toEqual([]);
        });
    });

    it('should update trips when setRawTrips is called', async () => {
        const { result } = renderHook(() => useData(), { wrapper });

        const mockTrips: Trip[] = [
            { id: '1', date: '2023-01-01', distance: 10, totalDistance: 100, duration: 15 }
        ];

        act(() => {
            result.current.setRawTrips(mockTrips);
        });

        await waitFor(() => {
            expect(result.current.trips).toHaveLength(1);
            expect(result.current.trips[0].id).toBe('1');
        });
    });

    it('should add a charge using addCharge', async () => {
        const { result } = renderHook(() => useData(), { wrapper });

        act(() => {
            result.current.addCharge({
                type: 'electric',
                date: '2023-01-01',
                time: '12:00',
                kwhCharged: 50,
                pricePerKwh: 0.15,
                odometer: 1000
            });
        });

        await waitFor(() => {
            expect(result.current.charges).toHaveLength(1);
            expect(result.current.charges[0].kwhCharged).toBe(50);
        });
    });

    it('should verify AppContext provides settings', async () => {
        const { result } = renderHook(() => useApp(), { wrapper });

        expect(result.current.settings).toBeDefined();
        // default setting example
        expect(result.current.settings.batterySize).toBeDefined();
    });

    it('should verify CarContext provides active car', async () => {
        const { result } = renderHook(() => useCar(), { wrapper });

        expect(result.current.activeCar).toBeDefined();
        // should be at least defaults or empty depending on initialstate
    });
});
