import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useChargesData from '../useChargesData';
import type { Charge } from '@/types';

vi.mock('@core/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

const STORAGE_KEY = 'byd_charges_data';
const CAR_ID = 'car-001';
const KEY = `${STORAGE_KEY}_${CAR_ID}`;

const makeCharge = (overrides: Partial<Charge> = {}): Charge => ({
    id: 'charge-1',
    date: '2024-01-15',
    time: '10:00',
    kwhCharged: 30,
    totalCost: 6,
    pricePerKwh: 0.2,
    chargerTypeId: 'home',
    timestamp: new Date('2024-01-15T10:00').getTime(),
    ...overrides,
});

describe('useChargesData', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        localStorage.clear();
    });

    // ─── Initial load ──────────────────────────────────────────────────────────

    describe('initial load', () => {
        it('returns empty array and null summary when activeCarId is null', () => {
            const { result } = renderHook(() => useChargesData(null));
            expect(result.current.charges).toEqual([]);
            expect(result.current.summary).toBeNull();
        });

        it('returns empty array when nothing is stored for the car', async () => {
            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toEqual([]));
        });

        it('loads charges from localStorage on mount', async () => {
            const stored = [
                makeCharge({ id: 'a', timestamp: 1000 }),
                makeCharge({ id: 'b', timestamp: 2000 }),
            ];
            localStorage.setItem(KEY, JSON.stringify(stored));

            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toHaveLength(2));
        });

        it('sorts charges by timestamp descending (newest first)', async () => {
            const older = makeCharge({ id: 'old', timestamp: 1000 });
            const newer = makeCharge({ id: 'new', timestamp: 9000 });
            localStorage.setItem(KEY, JSON.stringify([older, newer]));

            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => {
                expect(result.current.charges[0].id).toBe('new');
                expect(result.current.charges[1].id).toBe('old');
            });
        });

        it('handles corrupted JSON gracefully (returns empty array)', async () => {
            localStorage.setItem(KEY, 'not-valid-json!!{');

            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toEqual([]));
        });

        it('handles non-array JSON gracefully', async () => {
            localStorage.setItem(KEY, JSON.stringify({ wrong: 'format' }));

            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toEqual([]));
        });

        it('resets charges when activeCarId changes to null', async () => {
            const stored = [makeCharge()];
            localStorage.setItem(KEY, JSON.stringify(stored));

            const { result, rerender } = renderHook(
                ({ carId }: { carId: string | null }) => useChargesData(carId),
                { initialProps: { carId: CAR_ID } as { carId: string | null } }
            );
            await waitFor(() => expect(result.current.charges).toHaveLength(1));

            rerender({ carId: null });
            await waitFor(() => expect(result.current.charges).toEqual([]));
        });
    });

    // ─── addCharge ─────────────────────────────────────────────────────────────

    describe('addCharge', () => {
        it('adds a charge and returns it with a generated id', async () => {
            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toEqual([]));

            act(() => {
                result.current.addCharge({
                    date: '2024-03-01',
                    time: '14:30',
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

        it('uses kwh as fallback for kwhCharged', async () => {
            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toEqual([]));

            act(() => {
                result.current.addCharge({ date: '2024-03-01', time: '10:00', kwh: 25 });
            });

            expect(result.current.charges[0].kwhCharged).toBe(25);
        });

        it('defaults chargerTypeId to "unknown" when not provided', async () => {
            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toEqual([]));

            act(() => {
                result.current.addCharge({ date: '2024-03-01', time: '10:00' });
            });

            expect(result.current.charges[0].chargerTypeId).toBe('unknown');
        });

        it('keeps charges sorted by timestamp after adding', async () => {
            const old = makeCharge({ id: 'old', timestamp: 1000 });
            localStorage.setItem(KEY, JSON.stringify([old]));

            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toHaveLength(1));

            act(() => {
                result.current.addCharge({ date: '2025-01-01', time: '12:00', kwhCharged: 10 });
            });

            expect(result.current.charges[0].timestamp).toBeGreaterThan(
                result.current.charges[1].timestamp!
            );
        });

        it('calculates timestamp from date and time fields', async () => {
            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toEqual([]));

            act(() => {
                result.current.addCharge({ date: '2024-06-15', time: '08:30' });
            });

            expect(result.current.charges[0].timestamp).toBe(
                new Date('2024-06-15T08:30').getTime()
            );
        });
    });

    // ─── addMultipleCharges ────────────────────────────────────────────────────

    describe('addMultipleCharges', () => {
        it('returns 0 for empty array', async () => {
            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toEqual([]));

            let count!: number;
            act(() => { count = result.current.addMultipleCharges([]); });
            expect(count).toBe(0);
        });

        it('adds multiple charges and returns count', async () => {
            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toEqual([]));

            let count!: number;
            act(() => {
                count = result.current.addMultipleCharges([
                    { date: '2024-01-01', time: '09:00', kwhCharged: 20 },
                    { date: '2024-02-01', time: '10:00', kwhCharged: 30 },
                ]);
            });

            expect(count).toBe(2);
            expect(result.current.charges).toHaveLength(2);
        });

        it('deduplicates charges by timestamp', async () => {
            const ts = new Date('2024-01-01T10:00').getTime();
            const existing = makeCharge({ id: 'existing', timestamp: ts });
            localStorage.setItem(KEY, JSON.stringify([existing]));

            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toHaveLength(1));

            act(() => {
                result.current.addMultipleCharges([
                    { date: '2024-01-01', time: '10:00', kwhCharged: 30 }, // duplicate timestamp
                    { date: '2024-06-01', time: '08:00', kwhCharged: 40 }, // new
                ]);
            });

            expect(result.current.charges).toHaveLength(2);
        });
    });

    // ─── updateCharge ──────────────────────────────────────────────────────────

    describe('updateCharge', () => {
        it('updates fields of an existing charge', async () => {
            const charge = makeCharge({ id: 'update-me', kwhCharged: 20 });
            localStorage.setItem(KEY, JSON.stringify([charge]));

            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toHaveLength(1));

            act(() => {
                result.current.updateCharge('update-me', { kwhCharged: 99 });
            });

            expect(result.current.charges.find(c => c.id === 'update-me')?.kwhCharged).toBe(99);
        });

        it('recalculates timestamp when date changes', async () => {
            const charge = makeCharge({ id: 'ts-test', date: '2024-01-01', time: '10:00' });
            localStorage.setItem(KEY, JSON.stringify([charge]));

            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toHaveLength(1));

            act(() => {
                result.current.updateCharge('ts-test', { date: '2025-06-01' });
            });

            const updated = result.current.charges.find(c => c.id === 'ts-test');
            expect(updated?.timestamp).toBe(new Date('2025-06-01T10:00').getTime());
        });

        it('does not affect other charges', async () => {
            const a = makeCharge({ id: 'a', timestamp: 2000, kwhCharged: 10 });
            const b = makeCharge({ id: 'b', timestamp: 1000, kwhCharged: 20 });
            localStorage.setItem(KEY, JSON.stringify([a, b]));

            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toHaveLength(2));

            act(() => {
                result.current.updateCharge('a', { kwhCharged: 99 });
            });

            expect(result.current.charges.find(c => c.id === 'b')?.kwhCharged).toBe(20);
        });
    });

    // ─── deleteCharge ──────────────────────────────────────────────────────────

    describe('deleteCharge', () => {
        it('removes the charge with the matching id', async () => {
            const a = makeCharge({ id: 'a', timestamp: 2000 });
            const b = makeCharge({ id: 'b', timestamp: 1000 });
            localStorage.setItem(KEY, JSON.stringify([a, b]));

            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toHaveLength(2));

            act(() => { result.current.deleteCharge('a'); });

            expect(result.current.charges).toHaveLength(1);
            expect(result.current.charges[0].id).toBe('b');
        });

        it('is a no-op for unknown id', async () => {
            const charge = makeCharge({ id: 'keep-me' });
            localStorage.setItem(KEY, JSON.stringify([charge]));

            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toHaveLength(1));

            act(() => { result.current.deleteCharge('nonexistent'); });

            expect(result.current.charges).toHaveLength(1);
        });
    });

    // ─── getChargeById ─────────────────────────────────────────────────────────

    describe('getChargeById', () => {
        it('returns the charge with the matching id', async () => {
            const charge = makeCharge({ id: 'find-me' });
            localStorage.setItem(KEY, JSON.stringify([charge]));

            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toHaveLength(1));

            expect(result.current.getChargeById('find-me')?.id).toBe('find-me');
        });

        it('returns undefined for unknown id', async () => {
            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toEqual([]));

            expect(result.current.getChargeById('nope')).toBeUndefined();
        });
    });

    // ─── clearCharges ──────────────────────────────────────────────────────────

    describe('clearCharges', () => {
        it('empties the charges array', async () => {
            localStorage.setItem(KEY, JSON.stringify([makeCharge()]));

            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toHaveLength(1));

            act(() => { result.current.clearCharges(); });

            expect(result.current.charges).toEqual([]);
        });
    });

    // ─── replaceCharges ────────────────────────────────────────────────────────

    describe('replaceCharges', () => {
        it('replaces all charges and sorts them newest first', async () => {
            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toEqual([]));

            act(() => {
                result.current.replaceCharges([
                    makeCharge({ id: 'x', timestamp: 1000 }),
                    makeCharge({ id: 'y', timestamp: 5000 }),
                ]);
            });

            expect(result.current.charges).toHaveLength(2);
            expect(result.current.charges[0].id).toBe('y');
        });

        it('does not crash on non-array input', async () => {
            localStorage.setItem(KEY, JSON.stringify([makeCharge()]));
            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toHaveLength(1));

            act(() => { result.current.replaceCharges('bad' as unknown as Charge[]); });

            // Should not crash; charges unchanged
            expect(result.current.charges).toHaveLength(1);
        });
    });

    // ─── summary ──────────────────────────────────────────────────────────────

    describe('summary', () => {
        it('returns null when no charges loaded', async () => {
            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toEqual([]));
            expect(result.current.summary).toBeNull();
        });

        it('calculates electric totals correctly', async () => {
            const charges: Charge[] = [
                makeCharge({ id: '1', kwhCharged: 30, totalCost: 6, pricePerKwh: 0.2, type: 'electric', timestamp: 1000 }),
                makeCharge({ id: '2', kwhCharged: 20, totalCost: 4, pricePerKwh: 0.2, type: 'electric', timestamp: 2000 }),
            ];
            localStorage.setItem(KEY, JSON.stringify(charges));

            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toHaveLength(2));

            expect(result.current.summary?.chargeCount).toBe(2);
            expect(result.current.summary?.totalKwh).toBe(50);
            expect(result.current.summary?.totalCost).toBe(10);
            expect(result.current.summary?.electricCount).toBe(2);
            expect(result.current.summary?.fuelCount).toBe(0);
        });

        it('separates electric and fuel charges', async () => {
            const charges: Charge[] = [
                makeCharge({ id: 'e', type: 'electric', kwhCharged: 40, totalCost: 8, timestamp: 1000 }),
                makeCharge({ id: 'f', type: 'fuel', kwhCharged: 0, litersCharged: 30, totalCost: 45, timestamp: 2000 }),
            ];
            localStorage.setItem(KEY, JSON.stringify(charges));

            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toHaveLength(2));

            expect(result.current.summary?.electricCount).toBe(1);
            expect(result.current.summary?.fuelCount).toBe(1);
            expect(result.current.summary?.totalLiters).toBe(30);
            expect(result.current.summary?.electricCost).toBe(8);
            expect(result.current.summary?.fuelCost).toBe(45);
        });

        it('treats charges without explicit type as electric', async () => {
            // No `type` field = defaults to electric
            const charge = makeCharge({ id: 'no-type', kwhCharged: 10, timestamp: 1000 });
            delete charge.type;
            localStorage.setItem(KEY, JSON.stringify([charge]));

            const { result } = renderHook(() => useChargesData(CAR_ID));
            await waitFor(() => expect(result.current.charges).toHaveLength(1));

            expect(result.current.summary?.electricCount).toBe(1);
            expect(result.current.summary?.fuelCount).toBe(0);
        });
    });
});
