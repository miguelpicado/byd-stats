import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTrips } from '../useTrips';
import type { Trip } from '@/types';

vi.mock('@/services/StorageService', () => ({
    StorageService: {
        get: vi.fn((_key: string, defaultValue: unknown) => defaultValue),
        save: vi.fn(),
        remove: vi.fn(),
    },
}));

import { StorageService } from '@/services/StorageService';

const CAR_ID = 'car-test';

const makeTrip = (overrides: Partial<Trip> = {}): Trip => ({
    date: '20240115',
    trip: 10,
    electricity: 2,
    duration: 30,
    start_timestamp: 1705312800000,
    end_timestamp: 1705314600000,
    ...overrides,
});

describe('useTrips', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (StorageService.get as ReturnType<typeof vi.fn>).mockReturnValue([]);
    });

    // ─── Initial state ─────────────────────────────────────────────────────────

    describe('initial state', () => {
        it('returns empty rawTrips and tripHistory when activeCarId is null', () => {
            const { result } = renderHook(() => useTrips(null));
            expect(result.current.rawTrips).toEqual([]);
            expect(result.current.tripHistory).toEqual([]);
        });

        it('loads trips from StorageService on mount', async () => {
            const trips = [makeTrip({ date: '20240101' })];
            (StorageService.get as ReturnType<typeof vi.fn>).mockReturnValue(trips);

            const { result } = renderHook(() => useTrips(CAR_ID));
            await waitFor(() => expect(result.current.rawTrips).toHaveLength(1));
        });

        it('loads trip history from StorageService on mount', async () => {
            const history = [makeTrip({ date: '20230601' })];
            // first call (rawTrips) returns [], second call (history) returns history
            (StorageService.get as ReturnType<typeof vi.fn>)
                .mockReturnValueOnce([])
                .mockReturnValueOnce(history);

            const { result } = renderHook(() => useTrips(CAR_ID));
            await waitFor(() => expect(result.current.tripHistory).toHaveLength(1));
        });

        it('handles non-array storage value gracefully for rawTrips', async () => {
            (StorageService.get as ReturnType<typeof vi.fn>).mockReturnValue('corrupted');

            const { result } = renderHook(() => useTrips(CAR_ID));
            await waitFor(() => expect(result.current.rawTrips).toEqual([]));
        });

        it('handles non-array storage value gracefully for tripHistory', async () => {
            (StorageService.get as ReturnType<typeof vi.fn>)
                .mockReturnValueOnce([])
                .mockReturnValueOnce({ wrong: true });

            const { result } = renderHook(() => useTrips(CAR_ID));
            await waitFor(() => expect(result.current.tripHistory).toEqual([]));
        });

        it('resets rawTrips when activeCarId changes to null', async () => {
            const trips = [makeTrip()];
            (StorageService.get as ReturnType<typeof vi.fn>).mockReturnValue(trips);

            const { result, rerender } = renderHook(
                ({ carId }: { carId: string | null }) => useTrips(carId),
                { initialProps: { carId: CAR_ID } as { carId: string | null } }
            );
            await waitFor(() => expect(result.current.rawTrips).toHaveLength(1));

            rerender({ carId: null });
            await waitFor(() => expect(result.current.rawTrips).toEqual([]));
        });
    });

    // ─── clearData ─────────────────────────────────────────────────────────────

    describe('clearData', () => {
        it('empties rawTrips and returns true', async () => {
            const trips = [makeTrip()];
            (StorageService.get as ReturnType<typeof vi.fn>).mockReturnValue(trips);

            const { result } = renderHook(() => useTrips(CAR_ID));
            await waitFor(() => expect(result.current.rawTrips).toHaveLength(1));

            let ok!: boolean;
            act(() => { ok = result.current.clearData(); });

            expect(ok).toBe(true);
            expect(result.current.rawTrips).toEqual([]);
        });

        it('calls StorageService.remove with the correct key', async () => {
            const { result } = renderHook(() => useTrips(CAR_ID));
            await waitFor(() => expect(result.current.rawTrips).toEqual([]));

            act(() => { result.current.clearData(); });

            expect(StorageService.remove).toHaveBeenCalledWith(
                expect.stringContaining(CAR_ID)
            );
        });
    });

    // ─── saveToHistory ─────────────────────────────────────────────────────────

    describe('saveToHistory', () => {
        it('returns failure with reason "no_trips" when rawTrips is empty', async () => {
            const { result } = renderHook(() => useTrips(CAR_ID));
            await waitFor(() => expect(result.current.rawTrips).toEqual([]));

            let res!: ReturnType<typeof result.current.saveToHistory>;
            act(() => { res = result.current.saveToHistory(); });

            expect(res.success).toBe(false);
            expect(res.reason).toBe('no_trips');
        });

        it('merges rawTrips into history and returns success', async () => {
            const trip = makeTrip({ date: '20240101', start_timestamp: 1000 });
            (StorageService.get as ReturnType<typeof vi.fn>).mockReturnValue([trip]);

            const { result } = renderHook(() => useTrips(CAR_ID));
            await waitFor(() => expect(result.current.rawTrips).toHaveLength(1));

            let res!: ReturnType<typeof result.current.saveToHistory>;
            act(() => { res = result.current.saveToHistory(); });

            expect(res.success).toBe(true);
            expect(res.total).toBeGreaterThan(0);
            expect(result.current.tripHistory).toHaveLength(1);
        });

        it('deduplicates by date + start_timestamp when saving twice', async () => {
            const trip = makeTrip({ date: '20240101', start_timestamp: 1000 });
            (StorageService.get as ReturnType<typeof vi.fn>).mockReturnValue([trip]);

            const { result } = renderHook(() => useTrips(CAR_ID));
            await waitFor(() => expect(result.current.rawTrips).toHaveLength(1));

            act(() => { result.current.saveToHistory(); });
            act(() => { result.current.saveToHistory(); });

            expect(result.current.tripHistory).toHaveLength(1);
        });

        it('accumulates new trips from multiple saves', async () => {
            const trip1 = makeTrip({ date: '20240101', start_timestamp: 1000 });
            const trip2 = makeTrip({ date: '20240201', start_timestamp: 2000 });
            (StorageService.get as ReturnType<typeof vi.fn>).mockReturnValue([trip1]);

            const { result } = renderHook(() => useTrips(CAR_ID));
            await waitFor(() => expect(result.current.rawTrips).toHaveLength(1));

            act(() => { result.current.saveToHistory(); });

            // Simulate loading a different set of trips
            act(() => { result.current.setRawTrips([trip2]); });
            act(() => { result.current.saveToHistory(); });

            expect(result.current.tripHistory).toHaveLength(2);
        });

        it('reports "added" count correctly', async () => {
            const trip = makeTrip({ date: '20240301', start_timestamp: 3000 });
            // rawTrips has the trip, tripHistory starts empty → added should be 1
            (StorageService.get as ReturnType<typeof vi.fn>)
                .mockReturnValueOnce([trip]) // rawTrips
                .mockReturnValueOnce([]);    // tripHistory (empty)

            const { result } = renderHook(() => useTrips(CAR_ID));
            await waitFor(() => expect(result.current.rawTrips).toHaveLength(1));

            let res!: ReturnType<typeof result.current.saveToHistory>;
            act(() => { res = result.current.saveToHistory(); });

            expect(res.added).toBe(1);
        });
    });

    // ─── loadFromHistory ───────────────────────────────────────────────────────

    describe('loadFromHistory', () => {
        it('returns failure with reason "no_history" when history is empty', async () => {
            const { result } = renderHook(() => useTrips(CAR_ID));
            await waitFor(() => expect(result.current.tripHistory).toEqual([]));

            let res!: ReturnType<typeof result.current.loadFromHistory>;
            act(() => { res = result.current.loadFromHistory(); });

            expect(res.success).toBe(false);
            expect(res.reason).toBe('no_history');
        });

        it('copies history into rawTrips and returns success + count', async () => {
            const trip = makeTrip({ date: '20240101', start_timestamp: 1000 });
            (StorageService.get as ReturnType<typeof vi.fn>).mockReturnValue([trip]);

            const { result } = renderHook(() => useTrips(CAR_ID));
            await waitFor(() => expect(result.current.rawTrips).toHaveLength(1));

            // Save to history, then clear rawTrips
            act(() => { result.current.saveToHistory(); });
            act(() => { result.current.clearData(); });
            expect(result.current.rawTrips).toEqual([]);

            // Load from history
            let res!: ReturnType<typeof result.current.loadFromHistory>;
            act(() => { res = result.current.loadFromHistory(); });

            expect(res.success).toBe(true);
            expect(res.count).toBe(1);
            expect(result.current.rawTrips).toHaveLength(1);
        });
    });

    // ─── clearHistory ──────────────────────────────────────────────────────────

    describe('clearHistory', () => {
        it('empties tripHistory and returns true', async () => {
            const trip = makeTrip({ date: '20240101', start_timestamp: 1000 });
            (StorageService.get as ReturnType<typeof vi.fn>).mockReturnValue([trip]);

            const { result } = renderHook(() => useTrips(CAR_ID));
            await waitFor(() => expect(result.current.rawTrips).toHaveLength(1));

            act(() => { result.current.saveToHistory(); });
            expect(result.current.tripHistory).toHaveLength(1);

            let ok!: boolean;
            act(() => { ok = result.current.clearHistory(); });

            expect(ok).toBe(true);
            expect(result.current.tripHistory).toEqual([]);
        });

        it('calls StorageService.remove with the history key', async () => {
            const { result } = renderHook(() => useTrips(CAR_ID));
            await waitFor(() => expect(result.current.rawTrips).toEqual([]));

            act(() => { result.current.clearHistory(); });

            expect(StorageService.remove).toHaveBeenCalled();
        });
    });
});
