// BYD Stats - useAppData Hook Tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useAppData from '../useAppData';

// Mock i18n
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key) => key,
        i18n: { language: 'en' }
    }),
    initReactI18next: { type: '3rdParty', init: () => {} }
}));

vi.mock('i18next-http-backend', () => ({
    default: { type: 'backend', init: () => {}, read: () => {} }
}));

vi.mock('i18next', () => ({
    default: {
        use: () => ({ use: () => ({ use: () => ({ init: () => Promise.resolve() }) }) }),
        t: (key) => key,
        language: 'en'
    }
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

    it('should update rawTrips', () => {
        const { result } = renderHook(() => useAppData());
        const mockTrips = [{ trip: 10, electricity: 1.0, month: '202501', date: '20250114' }];

        act(() => {
            result.current.setRawTrips(mockTrips);
        });

        expect(result.current.rawTrips).toEqual(mockTrips);
        expect(result.current.filtered).toEqual(mockTrips);
    });

    it('should filter trips by month', () => {
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

        expect(result.current.filtered).toHaveLength(1);
        expect(result.current.filtered[0].month).toBe('202501');
    });

    it('should filter trips by date range', () => {
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

        expect(result.current.filtered).toHaveLength(1);
        expect(result.current.filtered[0].date).toBe('20250115');
    });

    it('should extract unique months', () => {
        const { result } = renderHook(() => useAppData());
        const mockTrips = [
            { trip: 10, month: '202501' },
            { trip: 20, month: '202501' },
            { trip: 30, month: '202502' },
        ];

        act(() => {
            result.current.setRawTrips(mockTrips);
        });

        expect(result.current.months).toEqual(['202501', '202502']);
    });

    it('should clear data', () => {
        window.confirm = vi.fn(() => true);
        const { result } = renderHook(() => useAppData());

        act(() => {
            result.current.setRawTrips([{ trip: 10 }]);
        });

        expect(result.current.rawTrips).toHaveLength(1);

        act(() => {
            result.current.clearData();
        });

        expect(result.current.rawTrips).toEqual([]);
    });
});

