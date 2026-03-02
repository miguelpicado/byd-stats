import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFilters } from '../useFilters';

describe('useFilters', () => {
    it('initializes with default values', () => {
        const { result } = renderHook(() => useFilters());

        expect(result.current.filterType).toBe('all');
        expect(result.current.selMonth).toBe('');
        expect(result.current.dateFrom).toBe('');
        expect(result.current.dateTo).toBe('');
    });

    it('setFilterType changes filter type', () => {
        const { result } = renderHook(() => useFilters());

        act(() => {
            result.current.setFilterType('month');
        });

        expect(result.current.filterType).toBe('month');
    });

    it('setSelMonth updates selected month', () => {
        const { result } = renderHook(() => useFilters());

        act(() => {
            result.current.setSelMonth('2023-01');
        });

        expect(result.current.selMonth).toBe('2023-01');
    });

    it('setDateFrom and setDateTo update date range', () => {
        const { result } = renderHook(() => useFilters());

        act(() => {
            result.current.setDateFrom('2023-01-01');
            result.current.setDateTo('2023-12-31');
        });

        expect(result.current.dateFrom).toBe('2023-01-01');
        expect(result.current.dateTo).toBe('2023-12-31');
    });
});
