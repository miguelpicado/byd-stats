import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { TripsProvider, useTripsContext } from '../TripsProvider';
import { ReactNode } from 'react';

// Setup Mocks
const mockSettings = vi.hoisted(() => ({
    chargerTypes: [],
    batteryCapacity: 60.48
}));
vi.mock('@/context/AppContext', () => ({
    useApp: () => ({ settings: mockSettings })
}));

const mockCar = vi.hoisted(() => ({ activeCarId: 'car_1', activeCar: { vin: 'TEST_VIN' } }));
vi.mock('@/context/CarContext', () => ({
    useCar: () => mockCar
}));

const mockCharges = vi.hoisted(() => ({ charges: [] }));
vi.mock('../ChargesProvider', () => ({
    useChargesContext: () => mockCharges
}));

const mockFilters = vi.hoisted(() => ({ filterType: 'all', selMonth: '', dateFrom: '', dateTo: '' }));
vi.mock('../FilterProvider', () => ({
    useFiltersContext: () => mockFilters
}));

// Mock inner hooks
const mockUseTripsData = vi.hoisted(() => ({
    rawTrips: [{ id: '1', date: '20231015' }],
    setRawTrips: vi.fn(),
    tripHistory: [],
    setTripHistory: vi.fn(),
    clearData: vi.fn(),
    saveToHistory: vi.fn(),
    loadFromHistory: vi.fn(),
    clearHistory: vi.fn()
}));
vi.mock('@hooks/useTrips', () => ({
    useTrips: () => mockUseTripsData
}));

const mockUseMergedTripsData = vi.hoisted(() => ({
    allTrips: [
        { id: '1', date: '20231015', month: '2023-10' },
        { id: '2', date: '20231120', month: '2023-11' }
    ],
    months: ['2023-10', '2023-11'],
    hasMore: false,
    isLoadingMore: false,
    loadMore: vi.fn()
}));
vi.mock('@hooks/useMergedTrips', () => ({
    useMergedTrips: () => mockUseMergedTripsData
}));

const mockUseProcessedDataInfo = vi.hoisted(() => ({
    data: { stats: 'processed' },
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
    recalculateAutonomy: vi.fn()
}));
vi.mock('@hooks/useProcessedData', () => ({
    useProcessedData: () => mockUseProcessedDataInfo
}));

vi.mock('@hooks/useLocalStorage', () => ({
    useLocalStorage: (_key: string, initialValue: any) => {
        return [initialValue, vi.fn()];
    }
}));

describe('TripsProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset filters
        mockFilters.filterType = 'all';
        mockFilters.selMonth = '';
        mockFilters.dateFrom = '';
        mockFilters.dateTo = '';
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
        <TripsProvider>{children}</TripsProvider>
    );

    it('provides trips context to children', () => {
        const { result } = renderHook(() => useTripsContext(), { wrapper });
        expect(result.current).toBeDefined();
        expect(result.current.allTrips).toHaveLength(2);
        expect(result.current.months).toEqual(['2023-10', '2023-11']);
    });

    it('throws error when useTripsContext used outside provider', () => {
        // Mock console.error to avoid React error boundary noise in tests
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        expect(() => renderHook(() => useTripsContext())).toThrow('useTripsContext must be used within a TripsProvider');
        consoleSpy.mockRestore();
    });

    it('filters trips by month when filterType is "month"', () => {
        mockFilters.filterType = 'month';
        mockFilters.selMonth = '2023-10';

        const { result } = renderHook(() => useTripsContext(), { wrapper });

        // Use useMemo logic from the hook
        expect(result.current.filteredTrips).toHaveLength(1);
        expect(result.current.filteredTrips[0].id).toBe('1');
    });

    it('filters trips by date range when filterType is "range"', () => {
        mockFilters.filterType = 'range';
        mockFilters.dateFrom = '2023-11-01';
        mockFilters.dateTo = '2023-12-31';

        // We mocked allTrips date as '20231015' and '20231120'
        // '2023-11-01'.replace(/-/g, '') => '20231101'
        // '2023-12-31'.replace(/-/g, '') => '20231231'
        const { result } = renderHook(() => useTripsContext(), { wrapper });

        expect(result.current.filteredTrips).toHaveLength(1);
        expect(result.current.filteredTrips[0].id).toBe('2');
    });

    it('returns all trips when filterType is "all"', () => {
        mockFilters.filterType = 'all';

        const { result } = renderHook(() => useTripsContext(), { wrapper });

        expect(result.current.filteredTrips).toHaveLength(2);
    });

    it('exposes process data stats and actions correctly', () => {
        const { result } = renderHook(() => useTripsContext(), { wrapper });

        expect(result.current.stats).toEqual({ stats: 'processed' });
        expect(result.current.isProcessing).toBe(false);
        expect(result.current.forceRecalculate).toBeDefined();
    });

    it('provides action functions from useTrips', () => {
        const { result } = renderHook(() => useTripsContext(), { wrapper });

        // Just verify they are wired up
        result.current.clearData();
        expect(mockUseTripsData.clearData).toHaveBeenCalled();

        result.current.saveToHistory();
        expect(mockUseTripsData.saveToHistory).toHaveBeenCalled();
    });
});
