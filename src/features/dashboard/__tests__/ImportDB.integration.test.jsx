import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { DataProvider, useData } from '../../../providers/DataProvider';
import { AppProvider } from '../../../context/AppContext';
import { LayoutProvider } from '../../../context/LayoutContext';
import { CarProvider } from '../../../context/CarContext';

// Mock dependencies
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key) => key,
        i18n: { changeLanguage: () => Promise.resolve(), language: 'en' }
    }),
    initReactI18next: { type: '3rdParty', init: () => { } },
    I18nextProvider: ({ children }) => <>{children}</>
}));

// Mock sub-providers to prevent OOM from real Firebase/SQL instantiation
vi.mock('../../../providers/ModalProvider', () => ({
    ModalProvider: ({ children }) => <>{children}</>,
    useModalContext: () => ({
        modals: { registryRestore: false },
        openModal: vi.fn(),
        closeModal: vi.fn(),
        openRegistryModal: vi.fn(),
        isAnyModalOpen: false,
    }),
}));

vi.mock('../../../providers/FilterProvider', () => ({
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

vi.mock('../../../providers/ChargesProvider', () => ({
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

vi.mock('../../../providers/TripsProvider', () => ({
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

const mockLoadFile = vi.fn();
vi.mock('../../../providers/SyncProvider', () => ({
    SyncProvider: ({ children }) => <>{children}</>,
    useSyncContext: () => ({
        googleSync: { isAuthenticated: false, isSyncing: false, syncNow: vi.fn() },
        database: { sqlReady: true, loadFile: mockLoadFile, initSql: vi.fn(), processDB: vi.fn(), exportDatabase: vi.fn() },
        fileHandling: {},
        loadFile: mockLoadFile,
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

// Mock window.crypto.randomUUID for CarContext
if (!global.crypto.randomUUID) { // eslint-disable-line no-undef
    global.crypto.randomUUID = () => 'test-uuid-' + Math.random(); // eslint-disable-line no-undef
}

describe('Import DB Integration Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    const AllProviders = ({ children }) => (
        <CarProvider>
            <LayoutProvider>
                <AppProvider>
                    <DataProvider>
                        {children}
                    </DataProvider>
                </AppProvider>
            </LayoutProvider>
        </CarProvider>
    );

    it('should trigger database load when a file is selected', () => {
        // Consumer component to trigger the action
        const ActionTrigger = () => {
            const { loadFile } = useData();
            return <button onClick={() => loadFile(new File([], 'test.db'))}>Trigger Import</button>;
        };

        render(
            <AllProviders>
                <ActionTrigger />
            </AllProviders>
        );

        fireEvent.click(screen.getByText('Trigger Import'));

        expect(mockLoadFile).toHaveBeenCalled();
    });
});
