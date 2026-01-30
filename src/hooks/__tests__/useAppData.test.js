// BYD Stats - useAppData Hook Tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useAppData from '../useAppData';

// Mock i18n
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key) => key,
        i18n: { language: 'en' }
    }),
    initReactI18next: { type: '3rdParty', init: () => { } }
}));

vi.mock('i18next-http-backend', () => ({
    default: { type: 'backend', init: () => { }, read: () => { } }
}));

vi.mock('i18next', () => ({
    default: {
        use: () => ({ use: () => ({ use: () => ({ init: () => Promise.resolve() }) }) }),
        t: (key) => key,
        language: 'en'
    }
}));

// Mock Worker and Comlink
global.Worker = class {
    constructor(url) {
        this.url = url;
    }
    terminate() { }
    postMessage() { }
};

vi.mock('comlink', () => ({
    wrap: () => ({
        processData: vi.fn().mockResolvedValue({
            summary: {},
            monthly: [],
            daily: [],
            hourly: [],
            weekday: [],
            tripDist: [],
            effScatter: [],
            top: { km: [], kwh: [], dur: [], fuel: [] }
        })
    })
}));

describe('useAppData', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should initialize with empty rawTrips', () => {
        const { result } = renderHook(() => useAppData());
        expect(result.current.rawTrips).toEqual([]);
        expect(result.current.filtered).toEqual([]);
        expect(result.current.data).toBeNull();
    });

    it('should update rawTrips', async () => {
        const { result } = renderHook(() => useAppData());
        const mockTrips = [{ trip: 10, electricity: 1.0, month: '202501', date: '20250114' }];

        act(() => {
            result.current.setRawTrips(mockTrips);
        });

        act(() => {
            result.current.setRawTrips(mockTrips);
        });

        await waitFor(() => {
            expect(result.current.rawTrips).toEqual(mockTrips);
            expect(result.current.filtered).toEqual(mockTrips);
        });
    });

    it('should filter trips by month', async () => {
        const { result } = renderHook(() => useAppData());
        const mockTrips = [
            { trip: 10, month: '202501' },
            { trip: 20, month: '202502' },
        ];

        act(() => {
            result.current.setRawTrips(mockTrips);
            result.current.setFilterType('month');
            result.current.setSelMonth('202501');
        });

        await waitFor(() => {
            expect(result.current.filtered).toHaveLength(1);
            expect(result.current.filtered[0].month).toBe('202501');
        });
    });

    it('should filter trips by date range', async () => {
        const { result } = renderHook(() => useAppData());
        const mockTrips = [
            { trip: 10, date: '20250110' },
            { trip: 20, date: '20250115' },
            { trip: 30, date: '20250120' },
        ];

        act(() => {
            result.current.setRawTrips(mockTrips);
            result.current.setFilterType('range');
            result.current.setDateFrom('2025-01-12');
            result.current.setDateTo('2025-01-18');
        });

        await waitFor(() => {
            expect(result.current.filtered).toHaveLength(1);
            expect(result.current.filtered[0].date).toBe('20250115');
        });
    });

    it('should extract unique months', async () => {
        const { result } = renderHook(() => useAppData());
        const mockTrips = [
            { trip: 10, month: '202501' },
            { trip: 20, month: '202501' },
            { trip: 30, month: '202502' },
        ];

        act(() => {
            result.current.setRawTrips(mockTrips);
        });

        await waitFor(() => {
            expect(result.current.months).toEqual(['202501', '202502']);
        });
    });

    it('should clear data', async () => {
        window.confirm = vi.fn(() => true);
        const { result } = renderHook(() => useAppData());

        act(() => {
            result.current.setRawTrips([{ trip: 10 }]);
        });

        await waitFor(() => {
            expect(result.current.rawTrips).toHaveLength(1);
        });

        act(() => {
            result.current.clearData();
        });

        await waitFor(() => {
            expect(result.current.rawTrips).toEqual([]);
        });
    });
});

