import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { SyncProvider, useSyncContext } from '../SyncProvider';
import { ReactNode } from 'react';
import { toast } from 'react-hot-toast';

// Setup Mocks Before Imports
const mockUpdateSettings = vi.hoisted(() => vi.fn());
const mockSettings = vi.hoisted(() => ({ chargerTypes: [] }));
vi.mock('@/context/AppContext', () => ({
    useApp: () => ({ settings: mockSettings, updateSettings: mockUpdateSettings })
}));

const mockActiveCarId = vi.hoisted(() => 'car_1');
const mockActiveCar = vi.hoisted(() => ({ vin: 'TEST_VIN', name: 'Test Car' }));
const mockUpdateCar = vi.hoisted(() => vi.fn());
const mockSetActiveCarId = vi.hoisted(() => vi.fn());
vi.mock('@/context/CarContext', () => ({
    useCar: () => ({
        activeCarId: mockActiveCarId,
        cars: [mockActiveCar],
        updateCar: mockUpdateCar,
        activeCar: mockActiveCar,
        setActiveCarId: mockSetActiveCarId
    })
}));

const mockRawTrips = vi.hoisted(() => [{ id: '1', date: '20231015', start_timestamp: 1000 }]);
const mockSetRawTrips = vi.hoisted(() => vi.fn());
const mockAiScenarios = vi.hoisted(() => [{ name: 'Test', speed: 100, efficiency: 15, range: 400 }]);
vi.mock('../TripsProvider', () => ({
    useTripsContext: () => ({
        rawTrips: mockRawTrips,
        setRawTrips: mockSetRawTrips,
        aiScenarios: mockAiScenarios,
        aiLoss: 5,
        aiSoH: 95,
        aiSoHStats: { samples: 10 }
    })
}));

const mockCharges = vi.hoisted(() => [{ id: 'c1', timestamp: 2000 }]);
const mockReplaceCharges = vi.hoisted(() => vi.fn());
const mockAddMultipleCharges = vi.hoisted(() => vi.fn().mockReturnValue(1));
vi.mock('../ChargesProvider', () => ({
    useChargesContext: () => ({
        charges: mockCharges,
        replaceCharges: mockReplaceCharges,
        addMultipleCharges: mockAddMultipleCharges
    })
}));

const mockOpenRegistryModal = vi.hoisted(() => vi.fn());
const mockModals = vi.hoisted(() => ({ registryRestore: false }));
vi.mock('../ModalProvider', () => ({
    useModalContext: () => ({
        openRegistryModal: mockOpenRegistryModal,
        modals: mockModals
    })
}));

// Mocks for internally used hooks
const mockDatabase = vi.hoisted(() => ({
    sqlReady: true,
    initSql: vi.fn(),
    exportDatabase: vi.fn(),
    isJsonSyncData: vi.fn().mockResolvedValue(true),
    processDB: vi.fn(),
    setError: vi.fn()
}));
vi.mock('@hooks/useDatabase', () => ({ useDatabase: () => mockDatabase }));

const mockGoogleSync = vi.hoisted(() => ({
    isAuthenticated: true,
    isSyncing: false,
    syncNow: vi.fn()
}));
vi.mock('@hooks/useGoogleSync', () => ({ useGoogleSync: () => mockGoogleSync }));

vi.mock('@hooks/useFileHandling', () => ({ useFileHandling: () => ({}) }));
vi.mock('@hooks/useAutoChargeDetection', () => ({ useAutoChargeDetection: vi.fn() }));
vi.mock('@hooks/sync/useVehicleWakeup', () => ({ useVehicleWakeup: vi.fn() }));
vi.mock('@hooks/sync/useSoHAutoSync', () => ({ useSoHAutoSync: vi.fn() }));

// Mock parseChargeRegistry
const mockParseChargeRegistry = vi.hoisted(() => vi.fn().mockResolvedValue({
    chargesArray: [{ id: 'new_charge', kwhCharged: 10 }],
    newChargerTypes: [{ id: 'new_type', name: 'New Type' }]
}));
vi.mock('@/utils/parseChargeRegistry', () => ({
    parseChargeRegistry: mockParseChargeRegistry
}));

vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

describe('SyncProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset confirmation
        global.confirm = vi.fn().mockReturnValue(true);

        // Let's mock window.URL explicitly to track export behavior safely
        global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
        global.URL.revokeObjectURL = vi.fn();
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
        <SyncProvider>{children}</SyncProvider>
    );

    it('provides sync context to children', () => {
        const { result } = renderHook(() => useSyncContext(), { wrapper });
        expect(result.current).toBeDefined();
        expect(result.current.exportSyncData).toBeInstanceOf(Function);
        expect(result.current.importSyncData).toBeInstanceOf(Function);
    });

    it('throws error when useSyncContext used outside provider', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        expect(() => renderHook(() => useSyncContext())).toThrow('useSyncContext must be used within a SyncProvider');
        consoleSpy.mockRestore();
    });

    describe('exportSyncData', () => {
        let createElSpy: any;
        let appendChildSpy: any;
        let removeChildSpy: any;
        let anchorMock: any;

        beforeEach(() => {
            anchorMock = {
                click: vi.fn(),
                href: '',
                setAttribute: vi.fn(),
                style: { display: '' }
            };
            const originalCreateElement = document.createElement.bind(document);
            createElSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: any) => {
                if (tagName === 'a') return anchorMock as any;
                return originalCreateElement(tagName) as any;
            });
            // We only want to mock appendChild/removeChild when called with our anchor
            // otherwise React will fail to render the component into its own container
            const originalAppend = document.body.appendChild.bind(document.body);
            appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
                if (node === anchorMock) return node;
                return originalAppend(node);
            });

            const originalRemove = document.body.removeChild.bind(document.body);
            removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => {
                if (node === anchorMock) return node;
                return originalRemove(node);
            });
        });

        afterEach(() => {
            createElSpy.mockRestore();
            appendChildSpy.mockRestore();
            removeChildSpy.mockRestore();
        });

        it('creates JSON blob with trips, charges, settings, AI cache', async () => {
            const { result } = renderHook(() => useSyncContext(), { wrapper });

            await act(async () => {
                const response = await result.current.exportSyncData();
                expect(response.success).toBe(true);
            });

            expect(createElSpy).toHaveBeenCalledWith('a');
            expect(anchorMock.setAttribute).toHaveBeenCalledWith('download', expect.stringContaining('BYD_Stats_Data_car_1'));
            expect(anchorMock.click).toHaveBeenCalled();
            expect(toast.success).toHaveBeenCalledWith('sync.exportSuccess');
        });
    });

    describe('importSyncData formats and merging', () => {
        const createMockFile = (content: any) => {
            const blob = new Blob([JSON.stringify(content)], { type: 'application/json' });
            return Object.assign(blob, {
                name: 'test.json',
                text: () => Promise.resolve(JSON.stringify(content))
            }) as File;
        };

        it('importSyncData throws on invalid JSON format', async () => {
            const { result } = renderHook(() => useSyncContext(), { wrapper });
            const invalidFile = { text: () => Promise.resolve('{"malformed": json') } as any;

            await act(async () => {
                await expect(result.current.importSyncData(invalidFile)).rejects.toThrow();
            });
            expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('sync.importFailed'));
        });

        it('importSyncData aborts on user cancel', async () => {
            global.confirm = vi.fn().mockReturnValue(false);
            const { result } = renderHook(() => useSyncContext(), { wrapper });
            const validFile = createMockFile({ trips: [], charges: [], settings: {} });

            await act(async () => {
                await result.current.importSyncData(validFile);
            });

            expect(mockSetRawTrips).not.toHaveBeenCalled();
            expect(toast.error).toHaveBeenCalledWith('sync.importCancelled');
        });

        it('importSyncData with merge=true deduplicates by date-timestamp', async () => {
            const { result } = renderHook(() => useSyncContext(), { wrapper });

            // Contains 1 duplicate (date 20231015, ts 1000) and 1 new trip
            const importData = {
                trips: [
                    { id: 'import1', date: '20231015', start_timestamp: 1000 },
                    { id: 'import2', date: '20231016', start_timestamp: 2000 }
                ],
                charges: [],
                settings: { someSetting: true }
            };
            const validFile = createMockFile(importData);

            await act(async () => {
                await result.current.importSyncData(validFile, true);
            });

            // Original 1 trip + 1 new trip = 2 trips
            expect(mockSetRawTrips).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({ id: '1' }), // Original kept
                expect.objectContaining({ id: 'import2' }) // New added
            ]));
            expect(mockReplaceCharges).toHaveBeenCalled(); // Since original was 1, and no new charges, it sets 1 merged charge
            expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({
                chargerTypes: [],
                someSetting: true
            }));
        });

        it('importSyncData with merge=false replaces all data', async () => {
            const { result } = renderHook(() => useSyncContext(), { wrapper });

            const importData = {
                trips: [{ id: 'new_trip' }],
                charges: [{ id: 'new_charge' }],
                settings: { replaceMe: true }
            };
            const validFile = createMockFile(importData);

            await act(async () => {
                await result.current.importSyncData(validFile, false);
            });

            // Replacing everything
            expect(mockSetRawTrips).toHaveBeenCalledWith([{ id: 'new_trip' }]);
            expect(mockReplaceCharges).toHaveBeenCalledWith([{ id: 'new_charge' }]);
            expect(mockUpdateSettings).toHaveBeenCalledWith({ replaceMe: true });
        });
    });

    it('loadChargeRegistry parses CSV and updates settings/charges', async () => {
        const { result } = renderHook(() => useSyncContext(), { wrapper });
        const mockCsvFile = new File(['csv content'], 'charges.csv', { type: 'text/csv' });

        await act(async () => {
            await result.current.loadChargeRegistry(mockCsvFile);
        });

        expect(mockParseChargeRegistry).toHaveBeenCalledWith(mockCsvFile, mockSettings);

        // Updates settings with new charger type
        expect(mockUpdateSettings).toHaveBeenCalledWith({
            chargerTypes: [{ id: 'new_type', name: 'New Type' }]
        });

        // Add multiple charges
        expect(mockAddMultipleCharges).toHaveBeenCalledWith([{ id: 'new_charge', kwhCharged: 10 }]);
        expect(mockGoogleSync.syncNow).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('charges.chargesImported'));
    });

    it('loadFile routes .json to importSyncData handler', async () => {
        const { result } = renderHook(() => useSyncContext(), { wrapper });

        // We will spy on importSyncData via the returned object
        const createMockFile = (name: string) => {
            const blob = new Blob(['{}'], { type: 'application/json' });
            return Object.assign(blob, {
                name,
                text: () => Promise.resolve('{}')
            }) as File;
        };

        const jsonFile = createMockFile('data.json');

        await act(async () => {
            await result.current.loadFile(jsonFile, true);
        });

        // isJsonSyncData was mocked to return true
        // It should have hit the import flow (meaning it asks for confirmation)
        expect(global.confirm).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('sync.importSuccess'));
    });
});
