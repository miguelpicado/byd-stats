/**
 * Tests for ChargesProvider
 *
 * Strategy:
 * - Mock CarContext and AppContext so the provider can be rendered in isolation
 * - Render the provider with renderHook + wrapper to access the context value
 * - Verify the provider delegates correctly to useChargesData (CRUD, summary, etc.)
 * - Test the guard hook throws when used outside the provider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { ChargesProvider, useChargesContext } from '../ChargesProvider';
import type { Charge } from '@/types';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@core/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const mockActiveCarId = vi.fn<() => string | null>(() => 'car-test');

vi.mock('@/context/CarContext', () => ({
    useCar: () => ({ activeCarId: mockActiveCarId() }),
}));

vi.mock('@/context/AppContext', () => ({
    useApp: () => ({ settings: { chargerTypes: [] } }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CAR_ID = 'car-test';
const STORAGE_KEY = `byd_charges_data_${CAR_ID}`;

const makeCharge = (overrides: Partial<Charge> = {}): Charge => ({
    id: 'charge-1',
    date: '2024-03-01',
    time: '10:00',
    kwhCharged: 40,
    totalCost: 8,
    pricePerKwh: 0.2,
    chargerTypeId: 'home',
    timestamp: new Date('2024-03-01T10:00').getTime(),
    ...overrides,
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ChargesProvider>{children}</ChargesProvider>
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ChargesProvider', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        mockActiveCarId.mockReturnValue(CAR_ID);
    });

    afterEach(() => {
        localStorage.clear();
    });

    // ─── Guard hook ──────────────────────────────────────────────────────────

    describe('useChargesContext guard', () => {
        it('throws when used outside ChargesProvider', () => {
            const { result } = renderHook(() => {
                try {
                    return useChargesContext();
                } catch (e) {
                    return e;
                }
            });
            expect(result.current).toBeInstanceOf(Error);
            expect((result.current as Error).message).toContain('ChargesProvider');
        });
    });

    // ─── Initialization ──────────────────────────────────────────────────────

    describe('initialization', () => {
        it('provides context with empty charges when no data stored', async () => {
            const { result } = renderHook(() => useChargesContext(), { wrapper });
            await waitFor(() => expect(result.current.charges).toEqual([]));
        });

        it('loads stored charges on mount', async () => {
            const stored = [
                makeCharge({ id: 'a', timestamp: 1000 }),
                makeCharge({ id: 'b', timestamp: 2000 }),
            ];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

            const { result } = renderHook(() => useChargesContext(), { wrapper });
            await waitFor(() => expect(result.current.charges).toHaveLength(2));
        });

        it('provides null summary when no charges loaded', async () => {
            const { result } = renderHook(() => useChargesContext(), { wrapper });
            await waitFor(() => expect(result.current.charges).toEqual([]));
            expect(result.current.summary).toBeNull();
        });

        it('returns empty charges when activeCarId is null', async () => {
            mockActiveCarId.mockReturnValue(null);
            const { result } = renderHook(() => useChargesContext(), { wrapper });
            await waitFor(() => expect(result.current.charges).toEqual([]));
        });
    });

    // ─── addCharge ───────────────────────────────────────────────────────────

    describe('addCharge', () => {
        it('adds a charge and assigns an id', async () => {
            const { result } = renderHook(() => useChargesContext(), { wrapper });
            await waitFor(() => expect(result.current.charges).toEqual([]));

            act(() => {
                result.current.addCharge({
                    date: '2024-06-01',
                    time: '09:00',
                    kwhCharged: 50,
                    totalCost: 10,
                    pricePerKwh: 0.2,
                    chargerTypeId: 'fast',
                });
            });

            expect(result.current.charges).toHaveLength(1);
            expect(result.current.charges[0].kwhCharged).toBe(50);
            expect(result.current.charges[0].id).toBeTruthy();
        });

        it('defaults chargerTypeId to "unknown" when not provided', async () => {
            const { result } = renderHook(() => useChargesContext(), { wrapper });
            await waitFor(() => expect(result.current.charges).toEqual([]));

            act(() => {
                result.current.addCharge({ date: '2024-06-01', time: '10:00' });
            });

            expect(result.current.charges[0].chargerTypeId).toBe('unknown');
        });
    });

    // ─── updateCharge ────────────────────────────────────────────────────────

    describe('updateCharge', () => {
        it('updates an existing charge', async () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([makeCharge({ id: 'u1', kwhCharged: 20 })]));

            const { result } = renderHook(() => useChargesContext(), { wrapper });
            await waitFor(() => expect(result.current.charges).toHaveLength(1));

            act(() => {
                result.current.updateCharge('u1', { kwhCharged: 99 });
            });

            expect(result.current.charges.find(c => c.id === 'u1')?.kwhCharged).toBe(99);
        });

        it('is a no-op for unknown id', async () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([makeCharge({ id: 'keep' })]));

            const { result } = renderHook(() => useChargesContext(), { wrapper });
            await waitFor(() => expect(result.current.charges).toHaveLength(1));

            act(() => {
                result.current.updateCharge('nonexistent', { kwhCharged: 0 });
            });

            expect(result.current.charges).toHaveLength(1);
        });
    });

    // ─── deleteCharge ────────────────────────────────────────────────────────

    describe('deleteCharge', () => {
        it('removes the charge with the matching id', async () => {
            const stored = [
                makeCharge({ id: 'del', timestamp: 2000 }),
                makeCharge({ id: 'keep', timestamp: 1000 }),
            ];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

            const { result } = renderHook(() => useChargesContext(), { wrapper });
            await waitFor(() => expect(result.current.charges).toHaveLength(2));

            act(() => { result.current.deleteCharge('del'); });

            expect(result.current.charges).toHaveLength(1);
            expect(result.current.charges[0].id).toBe('keep');
        });
    });

    // ─── clearCharges ────────────────────────────────────────────────────────

    describe('clearCharges', () => {
        it('empties the charges array', async () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([makeCharge()]));

            const { result } = renderHook(() => useChargesContext(), { wrapper });
            await waitFor(() => expect(result.current.charges).toHaveLength(1));

            act(() => { result.current.clearCharges(); });

            expect(result.current.charges).toEqual([]);
        });
    });

    // ─── summary ─────────────────────────────────────────────────────────────

    describe('summary', () => {
        it('calculates totals after charges are loaded', async () => {
            const charges: Charge[] = [
                makeCharge({ id: '1', kwhCharged: 30, totalCost: 6, type: 'electric', timestamp: 1000 }),
                makeCharge({ id: '2', kwhCharged: 20, totalCost: 4, type: 'electric', timestamp: 2000 }),
            ];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(charges));

            const { result } = renderHook(() => useChargesContext(), { wrapper });
            await waitFor(() => expect(result.current.charges).toHaveLength(2));

            expect(result.current.summary?.chargeCount).toBe(2);
            expect(result.current.summary?.totalKwh).toBe(50);
            expect(result.current.summary?.totalCost).toBe(10);
        });

        it('separates electric and fuel charges in summary', async () => {
            const charges: Charge[] = [
                makeCharge({ id: 'e', type: 'electric', kwhCharged: 40, totalCost: 8, timestamp: 1000 }),
                makeCharge({ id: 'f', type: 'fuel', kwhCharged: 0, litersCharged: 30, totalCost: 45, timestamp: 2000 }),
            ];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(charges));

            const { result } = renderHook(() => useChargesContext(), { wrapper });
            await waitFor(() => expect(result.current.charges).toHaveLength(2));

            expect(result.current.summary?.electricCount).toBe(1);
            expect(result.current.summary?.fuelCount).toBe(1);
            expect(result.current.summary?.totalLiters).toBe(30);
        });
    });
});
