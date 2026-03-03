import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { DataProvider, useData, useDataState, useDataDispatch } from '../DataProvider';

// Mock all sub-providers and their contexts directly.
// DataProvider is now a composition layer — mocking the sub-providers is the right approach.

vi.mock('../ModalProvider', () => ({
    ModalProvider: ({ children }) => <>{children}</>,
    useModalContext: () => ({
        modals: { registryRestore: false },
        openModal: vi.fn(),
        closeModal: vi.fn(),
        openRegistryModal: vi.fn(),
        isAnyModalOpen: false,
    }),
}));

vi.mock('../FilterProvider', () => ({
    FilterProvider: ({ children }) => <>{children}</>,
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
    ChargesProvider: ({ children }) => <>{children}</>,
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

vi.mock('../TripsProvider', () => ({
    TripsProvider: ({ children }) => <>{children}</>,
    useTripsContext: () => ({
        rawTrips: [],
        setRawTrips: vi.fn(),
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
    SyncProvider: ({ children }) => <>{children}</>,
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

vi.mock('@/context/AppContext', () => ({
    useApp: () => ({
        settings: {},
        updateSettings: vi.fn(),
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
        t: (key) => key,
        i18n: { changeLanguage: () => Promise.resolve(), language: 'en' },
    }),
    initReactI18next: { type: '3rdParty', init: () => { } },
}));

describe('DataProvider', () => {
    const wrapper = ({ children }) => <DataProvider>{children}</DataProvider>;

    it('provides data via useDataState', () => {
        const { result } = renderHook(() => useDataState(), { wrapper });
        expect(result.current).toBeDefined();
        expect(result.current.database.sqlReady).toBe(true);
    });

    it('provides actions via useDataDispatch', () => {
        const { result } = renderHook(() => useDataDispatch(), { wrapper });
        expect(result.current).toBeDefined();
        expect(typeof result.current.openModal).toBe('function');
    });

    it('provides unified data via useData', () => {
        const { result } = renderHook(() => useData(), { wrapper });
        expect(result.current.database.sqlReady).toBe(true);
        expect(typeof result.current.openModal).toBe('function');
    });

    it('throws error if used outside provider', () => {
        // Suppress console.error as React will log the error even if we catch it
        vi.spyOn(console, 'error').mockImplementation(() => { });

        expect(() => renderHook(() => useData())).toThrow(/must be used within a DataProvider/);
        expect(() => renderHook(() => useDataState())).toThrow(/must be used within a DataProvider/);
        expect(() => renderHook(() => useDataDispatch())).toThrow(/must be used within a DataProvider/);
    });
});
