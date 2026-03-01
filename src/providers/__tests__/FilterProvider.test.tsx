/**
 * Tests for FilterProvider
 *
 * Strategy:
 * - FilterProvider is a thin wrapper around useFilters() (pure useState)
 * - No external dependencies to mock
 * - Test: initial state values, each setter, guard hook throws outside provider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { FilterProvider, useFiltersContext } from '../FilterProvider';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <FilterProvider>{children}</FilterProvider>
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FilterProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ─── Guard hook ──────────────────────────────────────────────────────────

    describe('useFiltersContext guard', () => {
        it('throws when used outside FilterProvider', () => {
            const { result } = renderHook(() => {
                try {
                    return useFiltersContext();
                } catch (e) {
                    return e;
                }
            });
            expect(result.current).toBeInstanceOf(Error);
            expect((result.current as Error).message).toContain('FilterProvider');
        });
    });

    // ─── Initial state ───────────────────────────────────────────────────────

    describe('initial state', () => {
        it('initializes filterType to "all"', () => {
            const { result } = renderHook(() => useFiltersContext(), { wrapper });
            expect(result.current.filterType).toBe('all');
        });

        it('initializes selMonth to empty string', () => {
            const { result } = renderHook(() => useFiltersContext(), { wrapper });
            expect(result.current.selMonth).toBe('');
        });

        it('initializes dateFrom to empty string', () => {
            const { result } = renderHook(() => useFiltersContext(), { wrapper });
            expect(result.current.dateFrom).toBe('');
        });

        it('initializes dateTo to empty string', () => {
            const { result } = renderHook(() => useFiltersContext(), { wrapper });
            expect(result.current.dateTo).toBe('');
        });

        it('exposes all required setters', () => {
            const { result } = renderHook(() => useFiltersContext(), { wrapper });
            expect(typeof result.current.setFilterType).toBe('function');
            expect(typeof result.current.setSelMonth).toBe('function');
            expect(typeof result.current.setDateFrom).toBe('function');
            expect(typeof result.current.setDateTo).toBe('function');
        });
    });

    // ─── Filter type ─────────────────────────────────────────────────────────

    describe('setFilterType', () => {
        it('updates filterType to the new value', () => {
            const { result } = renderHook(() => useFiltersContext(), { wrapper });

            act(() => { result.current.setFilterType('month'); });

            expect(result.current.filterType).toBe('month');
        });

        it('can switch between filter types', () => {
            const { result } = renderHook(() => useFiltersContext(), { wrapper });

            act(() => { result.current.setFilterType('range'); });
            expect(result.current.filterType).toBe('range');

            act(() => { result.current.setFilterType('all'); });
            expect(result.current.filterType).toBe('all');
        });
    });

    // ─── Month selection ─────────────────────────────────────────────────────

    describe('setSelMonth', () => {
        it('updates selMonth', () => {
            const { result } = renderHook(() => useFiltersContext(), { wrapper });

            act(() => { result.current.setSelMonth('2024-03'); });

            expect(result.current.selMonth).toBe('2024-03');
        });

        it('can clear selMonth', () => {
            const { result } = renderHook(() => useFiltersContext(), { wrapper });

            act(() => { result.current.setSelMonth('2024-03'); });
            act(() => { result.current.setSelMonth(''); });

            expect(result.current.selMonth).toBe('');
        });
    });

    // ─── Date range ──────────────────────────────────────────────────────────

    describe('setDateFrom / setDateTo', () => {
        it('updates dateFrom', () => {
            const { result } = renderHook(() => useFiltersContext(), { wrapper });

            act(() => { result.current.setDateFrom('2024-01-01'); });

            expect(result.current.dateFrom).toBe('2024-01-01');
        });

        it('updates dateTo', () => {
            const { result } = renderHook(() => useFiltersContext(), { wrapper });

            act(() => { result.current.setDateTo('2024-12-31'); });

            expect(result.current.dateTo).toBe('2024-12-31');
        });

        it('sets a full date range independently', () => {
            const { result } = renderHook(() => useFiltersContext(), { wrapper });

            act(() => {
                result.current.setDateFrom('2024-01-01');
                result.current.setDateTo('2024-06-30');
            });

            expect(result.current.dateFrom).toBe('2024-01-01');
            expect(result.current.dateTo).toBe('2024-06-30');
        });

        it('does not affect filterType or selMonth when date range changes', () => {
            const { result } = renderHook(() => useFiltersContext(), { wrapper });

            act(() => {
                result.current.setFilterType('range');
                result.current.setDateFrom('2024-01-01');
                result.current.setDateTo('2024-06-30');
            });

            expect(result.current.filterType).toBe('range');
            expect(result.current.selMonth).toBe('');
        });
    });

    // ─── State isolation ─────────────────────────────────────────────────────

    describe('state isolation', () => {
        it('two independent providers do not share state', () => {
            const { result: r1 } = renderHook(() => useFiltersContext(), { wrapper });
            const { result: r2 } = renderHook(() => useFiltersContext(), { wrapper });

            act(() => { r1.current.setFilterType('month'); });

            expect(r1.current.filterType).toBe('month');
            expect(r2.current.filterType).toBe('all'); // untouched
        });
    });
});
