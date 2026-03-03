import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppProviders } from '../AppProviders';
import { useData } from '../DataProvider';
import { useApp } from '@/context/AppContext';
import { useCar } from '@/context/CarContext';
import { Trip } from '@/types';
import React from 'react';

// Mock external dependencies that cause OOM (Firebase, SQL, etc.)
vi.mock('@react-oauth/google', () => ({
    GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    useGoogleLogin: () => ({}),
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
    registerPlugin: vi.fn(),
}));

// Mock all sub-providers so DataProvider doesn't spin up Firebase/SQL workers
vi.mock('../ModalProvider', () => ({
    ModalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useModalContext: () => ({
        modals: { registryRestore: false },
        openModal: vi.fn(),
        closeModal: vi.fn(),
        openRegistryModal: vi.fn(),
        isAnyModalOpen: false,
    }),
}));

vi.mock('../FilterProvider', () => ({
    FilterProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useFiltersContext: () => ({
        filterType: 'all',
        selMonth: '',
        dateFrom: '',
        dateTo: '',
        setFilterType: vi.fn(),
        setSelMonth: vi.fn(),
        setDateFrom: vi.fn(),
        setDateTo: vi.fn(),
    }),
}));

vi.mock('../ChargesProvider', () => ({
    ChargesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useChargesContext: () => ({
        charges: [],
        replaceCharges: vi.fn(),
        addCharge: vi.fn(),
        updateCharge: vi.fn(),
        deleteCharge: vi.fn(),
        addMultipleCharges: vi.fn(),
        exportCharges: vi.fn(),
    }),
}));

const mockSetRawTrips = vi.fn();
vi.mock('../TripsProvider', () => ({
    TripsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useTripsContext: () => ({
        rawTrips: [],
        setRawTrips: mockSetRawTrips,
        tripHistory: [],
        setTripHistory: vi.fn(),
        filteredTrips: [],
        allTrips: [],
        months: [],
        hasMore: false,
        isLoadingMore: false,
        loadMore: vi.fn(),
        stats: null,
        isProcessing: false,
        isAiTraining: false,
        aiScenarios: [],
        aiLoss: null,
        aiSoH: null,
        aiSoHStats: null,
        predictDeparture: vi.fn(),
        findSmartChargingWindows: vi.fn(),
        forceRecalculate: vi.fn(),
        recalculateSoH: vi.fn(),
        recalculateAutonomy: vi.fn(),
        clearData: vi.fn(),
        saveToHistory: vi.fn(),
        loadFromHistory: vi.fn(),
        clearHistory: vi.fn(),
        acknowledgedAnomalies: [],
        setAcknowledgedAnomalies: vi.fn(),
        deletedAnomalies: [],
        setDeletedAnomalies: vi.fn(),
    }),
}));

vi.mock('../SyncProvider', () => ({
    SyncProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useSyncContext: () => ({
        googleSync: { isAuthenticated: false, isSyncing: false, syncNow: vi.fn() },
        database: { sqlReady: true, initSql: vi.fn(), processDB: vi.fn(), exportDatabase: vi.fn() },
        fileHandling: {},
        loadFile: vi.fn(),
        exportData: vi.fn(),
        exportSyncData: vi.fn(),
        importSyncData: vi.fn(),
        loadChargeRegistry: vi.fn(),
    }),
}));

vi.mock('@hooks/useConfirmation', () => ({
    useConfirmation: () => ({
        confirmModalState: { isOpen: false },
        closeConfirmation: vi.fn(),
        showConfirmation: vi.fn(),
        clearData: vi.fn(),
        saveToHistory: vi.fn(),
        loadFromHistory: vi.fn(),
        clearHistory: vi.fn(),
    }),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { changeLanguage: () => Promise.resolve(), language: 'en' },
    }),
    initReactI18next: { type: '3rdParty', init: () => { } },
    I18nextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('react-router-dom', () => ({
    BrowserRouter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/' }),
}));

vi.mock('@/components/common/ErrorBoundary', () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

        expect(result.current).toBeDefined();
        expect(result.current.trips).toEqual([]);
        expect(result.current.charges).toEqual([]);
    });

    it('should update trips when setRawTrips is called', async () => {
        const { result } = renderHook(() => useData(), { wrapper });

        const mockTrips = [
            { id: '1', date: '2023-01-01', distance: 10, totalDistance: 100, duration: 15 }
        ] as unknown as Trip[];

        act(() => {
            result.current.setRawTrips(mockTrips);
        });

        // setRawTrips from mock context is captured; confirm dispatch was called
        expect(mockSetRawTrips).toHaveBeenCalledWith(mockTrips);
    });

    it('should add a charge using addCharge', () => {
        const { result } = renderHook(() => useData(), { wrapper });

        // addCharge is from the mocked ChargesProvider
        expect(typeof result.current.addCharge).toBe('function');
        result.current.addCharge({
            type: 'electric',
            date: '2023-01-01',
            time: '12:00',
            kwhCharged: 50,
            pricePerKwh: 0.15,
            odometer: 1000,
        });
        // We just verify it's callable without throwing
    });

    it('should verify AppContext provides settings', () => {
        const { result } = renderHook(() => useApp(), { wrapper });

        expect(result.current.settings).toBeDefined();
        expect(result.current.settings.batterySize).toBeDefined();
    });

    it('should verify CarContext provides active car', () => {
        const { result } = renderHook(() => useCar(), { wrapper });

        expect(result.current).toBeDefined();
    });
});
