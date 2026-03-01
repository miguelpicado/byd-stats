/**
 * Tests for dataWorker
 *
 * Strategy:
 * - Mock `comlink` so that:
 *     • expose() captures the api object for direct testing
 *     • wrap()   returns a mock TF worker (avoids spawning a real Worker)
 * - Mock `../../core/dataProcessing` to prevent real data crunching
 * - The global `Worker` class is already replaced by MockWorker in setupTests.ts
 * - Test: API surface is exposed, processData delegation, TF-worker delegations,
 *   findSmartChargingWindows fallback (no predictions → default windows),
 *   and dispose.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { Trip, Settings } from '@/types';

// ─── Hoisted state (available inside vi.mock factories) ───────────────────────

const state = vi.hoisted(() => {
    return {
        // Will be populated by expose() when the module is loaded
        capturedApi: null as null | Record<string, (...args: unknown[]) => unknown>,

        // Mock TF worker returned by Comlink.wrap()
        mockTfWorker: {
            trainEfficiency:      vi.fn().mockResolvedValue('efficiency-trained'),
            getRangeScenarios:    vi.fn().mockResolvedValue(['range1', 'range2']),
            trainSoH:             vi.fn().mockResolvedValue('soh-trained'),
            getSoHStats:          vi.fn().mockResolvedValue({ soh: 92 }),
            trainParking:         vi.fn().mockResolvedValue('parking-trained'),
            predictDeparture:     vi.fn().mockResolvedValue(null), // no prediction by default
            exportParkingModel:   vi.fn().mockResolvedValue([{ data: [], shape: [] }]),
            importParkingModel:   vi.fn().mockResolvedValue(undefined),
            exportEfficiencyModel:vi.fn().mockResolvedValue({ weights: [] }),
            importEfficiencyModel:vi.fn().mockResolvedValue(undefined),
            dispose:              vi.fn().mockResolvedValue(undefined),
        },
    };
});

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('comlink', () => ({
    // Capture the api object that the worker exposes
    expose: (api: Record<string, (...args: unknown[]) => unknown>) => {
        state.capturedApi = api;
    },
    // Return our mock TF worker whenever wrap() is called
    wrap: () => state.mockTfWorker,
}));

vi.mock('../../core/dataProcessing', () => ({
    processData: vi.fn().mockReturnValue({ trips: [], summary: {}, monthly: [] }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeSettings = (overrides: Partial<Settings> = {}): Settings =>
    ({ batterySize: 60, homeChargerRating: 16, ...overrides } as Settings);

const makeTrip = (overrides: Partial<Trip> = {}): Trip => ({
    date: '2024-03-01',
    trip: 10,
    electricity: 1.6,
    duration: 30,
    start_timestamp: 1_700_000_000,
    end_timestamp:   1_700_003_600,
    ...overrides,
});

// ─── Load the module (triggers Comlink.expose at module level) ─────────────────

beforeAll(async () => {
    // Dynamic import ensures mocks are already in place before the module runs
    await import('../dataWorker');
});

beforeEach(() => {
    vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('dataWorker', () => {
    // ─── Initialization ───────────────────────────────────────────────────────

    describe('initialization', () => {
        it('exposes an API object via Comlink.expose', () => {
            expect(state.capturedApi).not.toBeNull();
            expect(typeof state.capturedApi).toBe('object');
        });

        it('exposes all expected API methods', () => {
            const api = state.capturedApi!;
            const expectedMethods = [
                'processData', 'trainModel', 'getRangeScenarios', 'trainSoH',
                'getSoHStats', 'trainParking', 'predictDeparture',
                'findSmartChargingWindows', 'exportParkingModel', 'importParkingModel',
                'exportEfficiencyModel', 'importEfficiencyModel', 'dispose',
            ];
            for (const method of expectedMethods) {
                expect(typeof api[method]).toBe('function');
            }
        });
    });

    // ─── processData delegation ───────────────────────────────────────────────

    describe('processData', () => {
        it('delegates to the imported processData function', async () => {
            const { processData } = await import('../../core/dataProcessing');
            const api = state.capturedApi!;

            api.processData(['trip1'] as unknown[], { batterySize: 60 } as unknown);

            expect(processData).toHaveBeenCalledWith(['trip1'], { batterySize: 60 });
        });
    });

    // ─── TF worker delegations ────────────────────────────────────────────────

    describe('TF worker delegation', () => {
        it('trainModel delegates to tf.trainEfficiency', async () => {
            const api = state.capturedApi!;
            const trips = [makeTrip()];

            const result = await (api.trainModel as (trips: Trip[]) => Promise<unknown>)(trips);

            expect(state.mockTfWorker.trainEfficiency).toHaveBeenCalledWith(trips);
            expect(result).toBe('efficiency-trained');
        });

        it('getRangeScenarios delegates to tf.getRangeScenarios', async () => {
            const api = state.capturedApi!;
            const result = await (api.getRangeScenarios as (c: number, s: number) => Promise<unknown>)(60, 92);

            expect(state.mockTfWorker.getRangeScenarios).toHaveBeenCalledWith(60, 92);
            expect(result).toEqual(['range1', 'range2']);
        });

        it('trainSoH delegates to tf.trainSoH', async () => {
            const api = state.capturedApi!;
            const charges = [{ id: 'c1' }];

            await (api.trainSoH as (charges: unknown[], cap: number) => Promise<unknown>)(charges, 60);

            expect(state.mockTfWorker.trainSoH).toHaveBeenCalledWith(charges, 60);
        });

        it('getSoHStats delegates to tf.getSoHStats', async () => {
            const api = state.capturedApi!;
            const result = await (api.getSoHStats as (charges: unknown[], cap: number) => Promise<unknown>)([], 60);

            expect(state.mockTfWorker.getSoHStats).toHaveBeenCalledWith([], 60);
            expect(result).toEqual({ soh: 92 });
        });

        it('trainParking delegates to tf.trainParking', async () => {
            const api = state.capturedApi!;
            const trips = [makeTrip()];

            await (api.trainParking as (trips: Trip[]) => Promise<unknown>)(trips);

            expect(state.mockTfWorker.trainParking).toHaveBeenCalledWith(trips);
        });

        it('predictDeparture delegates to tf.predictDeparture', async () => {
            const api = state.capturedApi!;

            await (api.predictDeparture as (ts: number) => Promise<unknown>)(12345678);

            expect(state.mockTfWorker.predictDeparture).toHaveBeenCalledWith(12345678);
        });

        it('exportParkingModel delegates to tf.exportParkingModel', async () => {
            const api = state.capturedApi!;
            const result = await (api.exportParkingModel as () => Promise<unknown>)();

            expect(state.mockTfWorker.exportParkingModel).toHaveBeenCalled();
            expect(result).toEqual([{ data: [], shape: [] }]);
        });

        it('importParkingModel delegates to tf.importParkingModel', async () => {
            const api = state.capturedApi!;
            const weights = [{ data: [1, 2], shape: [2] }];

            await (api.importParkingModel as (w: unknown) => Promise<unknown>)(weights);

            expect(state.mockTfWorker.importParkingModel).toHaveBeenCalledWith(weights);
        });

        it('exportEfficiencyModel delegates to tf.exportEfficiencyModel', async () => {
            const api = state.capturedApi!;
            await (api.exportEfficiencyModel as () => Promise<unknown>)();

            expect(state.mockTfWorker.exportEfficiencyModel).toHaveBeenCalled();
        });

        it('importEfficiencyModel delegates to tf.importEfficiencyModel', async () => {
            const api = state.capturedApi!;
            const data = { weights: [], normData: { mean: [], variance: [] } };

            await (api.importEfficiencyModel as (d: unknown) => Promise<unknown>)(data);

            expect(state.mockTfWorker.importEfficiencyModel).toHaveBeenCalledWith(data);
        });

        it('dispose calls tf.dispose', async () => {
            const api = state.capturedApi!;
            await (api.dispose as () => Promise<void>)();

            expect(state.mockTfWorker.dispose).toHaveBeenCalled();
        });
    });

    // ─── findSmartChargingWindows ─────────────────────────────────────────────

    describe('findSmartChargingWindows', () => {
        type SmartWindows = {
            windows: { day: string; start: string; end: string; tariffLimit: string; startMins: number; endMins: number }[];
            weeklyKwh: number;
            requiredHours: number;
            hoursFound: number;
            note?: string;
        };

        const callFindWindows = (trips: Trip[], settings: Settings) =>
            (state.capturedApi!.findSmartChargingWindows as (t: Trip[], s: Settings) => Promise<SmartWindows>)(trips, settings);

        it('returns default fallback windows when predictDeparture always returns null', async () => {
            state.mockTfWorker.predictDeparture.mockResolvedValue(null);
            const result = await callFindWindows([], makeSettings());

            // Fallback: Domingo 00:00-08:00, possibly Sábado
            expect(result.windows.length).toBeGreaterThanOrEqual(1);
            const days = result.windows.map(w => w.day);
            expect(days.some(d => ['Domingo', 'Sábado'].includes(d))).toBe(true);
        });

        it('returns windows with correct time format (HH:MM)', async () => {
            state.mockTfWorker.predictDeparture.mockResolvedValue(null);
            const result = await callFindWindows([], makeSettings());

            for (const w of result.windows) {
                expect(w.start).toMatch(/^\d{2}:\d{2}$/);
                expect(w.end).toMatch(/^\d{2}:\d{2}$/);
            }
        });

        it('sets weeklyKwh to at least the 15 kWh minimum', async () => {
            state.mockTfWorker.predictDeparture.mockResolvedValue(null);
            const result = await callFindWindows([], makeSettings());

            expect(result.weeklyKwh).toBeGreaterThanOrEqual(15);
        });

        it('reports hoursFound ≥ 0', async () => {
            state.mockTfWorker.predictDeparture.mockResolvedValue(null);
            const result = await callFindWindows([], makeSettings());

            expect(result.hoursFound).toBeGreaterThanOrEqual(0);
        });

        it('applies HITL overrides from smartChargingPreferences', async () => {
            state.mockTfWorker.predictDeparture.mockResolvedValue(null);
            const settingsWithPref = makeSettings({
                smartChargingPreferences: [
                    { day: 'Lunes', start: '01:00', end: '07:00', active: true },
                ] as Settings['smartChargingPreferences'],
            });

            const result = await callFindWindows([], settingsWithPref);

            // The user preference should appear in windows (score = 9999)
            expect(result.windows.some(w => w.day === 'Lunes' && w.start === '01:00')).toBe(true);
        });

        it('requiredHours equals weeklyKwh divided by charger power', async () => {
            state.mockTfWorker.predictDeparture.mockResolvedValue(null);
            const settings = makeSettings({ homeChargerRating: 16 }); // 16A × 230V / 1000 = 3.68 kW
            const result = await callFindWindows([], settings);

            const chargePower = (16 * 230) / 1000; // 3.68 kW
            const expectedHours = result.weeklyKwh / chargePower;
            expect(result.requiredHours).toBeCloseTo(expectedHours, 5);
        });

        it('handles empty trips without throwing', async () => {
            state.mockTfWorker.predictDeparture.mockResolvedValue(null);
            await expect(callFindWindows([], makeSettings())).resolves.toBeDefined();
        });
    });
});
