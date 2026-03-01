/**
 * Tests for AnomalyService
 *
 * Strategy:
 * - AnomalyService is a pure object with no external dependencies
 * - No mocks required — test each function with focused data fixtures
 * - Test: analyzePhantomDrain, analyzeTireHealth, analyzeCharges,
 *   and checkSystemHealth (which exercises the private checkBatteryHealth)
 */

import { describe, it, expect } from 'vitest';
import { AnomalyService } from '../AnomalyService';
import type { Trip, Charge, Settings, Summary, ProcessedData, SoHData } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeSettings = (overrides: Partial<Settings> = {}): Settings =>
    ({ batterySize: 60, ...overrides } as Settings);

// Timestamps are compared as-is by analyzePhantomDrain (divides by 3_600_000).
// Use millisecond-scale values so gapHours has meaningful magnitudes.
const H = 3_600_000; // 1 hour in "timestamp units" (ms)

const makeTrip = (overrides: Partial<Trip> = {}): Trip => ({
    date: '2024-03-01',
    trip: 10,
    electricity: 1.6,   // 16 kWh/100km
    duration: 30,
    start_timestamp: 1_700_000_000_000,
    end_timestamp:   1_700_000_000_000 + H,
    ...overrides,
});

const makeCharge = (overrides: Partial<Charge> = {}): Charge => ({
    id: 'c1',
    date: '2024-03-01',
    time: '14:00',
    kwhCharged: 40,
    totalCost: 8,
    pricePerKwh: 0.2,
    chargerTypeId: 'home',
    ...overrides,
});

const makeSummary = (overrides: Partial<Summary> = {}): Summary =>
    ({ soh: 90, avgEff: '16', sohData: null, ...overrides } as Summary);

const makeProcessedData = (summaryOverrides: Partial<Summary> = {}): ProcessedData =>
    ({
        summary: makeSummary(summaryOverrides),
        monthly: [], daily: [], hourly: [], weekday: [], tripDist: [], effScatter: [],
        top: { km: [], kwh: [], dur: [], fuel: [] },
        isHybrid: false, sohData: null,
    } as ProcessedData);

// ─── analyzePhantomDrain ──────────────────────────────────────────────────────

describe('AnomalyService.analyzePhantomDrain', () => {
    const settings = makeSettings();

    it('returns empty for an empty trip list', () => {
        expect(AnomalyService.analyzePhantomDrain([], settings)).toEqual([]);
    });

    it('returns empty for a single trip (no gap to evaluate)', () => {
        expect(AnomalyService.analyzePhantomDrain([makeTrip()], settings)).toEqual([]);
    });

    it('returns empty when the gap between trips is less than 12 hours', () => {
        const t1 = makeTrip({ end_timestamp: 0, end_soc: 80 });
        const t2 = makeTrip({ start_timestamp: 10 * H, start_soc: 77 }); // 10h gap
        expect(AnomalyService.analyzePhantomDrain([t1, t2], settings)).toEqual([]);
    });

    it('returns empty when SoC data is absent on either trip', () => {
        const t1 = makeTrip({ end_timestamp: 0 });                   // no end_soc
        const t2 = makeTrip({ start_timestamp: 24 * H });            // no start_soc
        expect(AnomalyService.analyzePhantomDrain([t1, t2], settings)).toEqual([]);
    });

    it('returns empty when SoC does not drop (e.g. charged overnight)', () => {
        const t1 = makeTrip({ end_timestamp: 0, end_soc: 40 });
        const t2 = makeTrip({ start_timestamp: 24 * H, start_soc: 90 }); // SoC rose
        expect(AnomalyService.analyzePhantomDrain([t1, t2], settings)).toEqual([]);
    });

    it('returns empty when drop-per-24h is below threshold (≤ 2 %)', () => {
        // 1 % drop over 24 h → dropPer24h = 1.0 → below the 2.0 threshold
        const t1 = makeTrip({ end_timestamp: 0, end_soc: 80 });
        const t2 = makeTrip({ start_timestamp: 24 * H, start_soc: 79 });
        expect(AnomalyService.analyzePhantomDrain([t1, t2], settings)).toEqual([]);
    });

    it('returns an "info" anomaly when dropPer24h is between 2 and 4 %', () => {
        // 3 % drop over 24 h → dropPer24h = 3.0 → "info"
        // Both trips need explicit start/end to guarantee sort order
        const t1 = makeTrip({ date: '2024-03-01', start_timestamp: 0,      end_timestamp: H,      end_soc: 80 });
        const t2 = makeTrip({ date: '2024-03-02', start_timestamp: 25 * H, end_timestamp: 26 * H, start_soc: 77 });
        const result = AnomalyService.analyzePhantomDrain([t1, t2], settings);

        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('drain');
        expect(result[0].severity).toBe('info');
        expect(result[0].id).toBe('drain_2024-03-01');
    });

    it('returns a "warning" anomaly when dropPer24h exceeds 4 %', () => {
        // 6 % drop over 24 h → dropPer24h = 6.0 → "warning"
        const t1 = makeTrip({ date: '2024-03-01', start_timestamp: 0,      end_timestamp: H,      end_soc: 80 });
        const t2 = makeTrip({ date: '2024-03-02', start_timestamp: 25 * H, end_timestamp: 26 * H, start_soc: 74 });
        const result = AnomalyService.analyzePhantomDrain([t1, t2], settings);

        expect(result).toHaveLength(1);
        expect(result[0].severity).toBe('warning');
        expect(result[0].value).toBe('-6.0%/día');
    });

    it('reports only the first anomaly found and then stops (break)', () => {
        // Two consecutive 24h gaps, both with significant drain
        const t1 = makeTrip({ date: '2024-03-01', start_timestamp: 0,       end_timestamp: H,      end_soc: 80 });
        const t2 = makeTrip({ date: '2024-03-02', start_timestamp: 25 * H,  end_timestamp: 26 * H, end_soc: 80, start_soc: 74 });
        const t3 = makeTrip({ date: '2024-03-03', start_timestamp: 51 * H,  end_timestamp: 52 * H, start_soc: 74 });
        const result = AnomalyService.analyzePhantomDrain([t1, t2, t3], settings);

        // Only the FIRST gap anomaly should be returned
        expect(result).toHaveLength(1);
    });

    it('uses battery capacity from settings to compute kWh in description', () => {
        // 6 % drop over 24 h with a 30 kWh battery → 1.8 kWh
        const t1 = makeTrip({ date: '2024-03-01', start_timestamp: 0,      end_timestamp: H,      end_soc: 80 });
        const t2 = makeTrip({ date: '2024-03-02', start_timestamp: 25 * H, end_timestamp: 26 * H, start_soc: 74 });
        const smallBattery = makeSettings({ batterySize: 30 });
        const result = AnomalyService.analyzePhantomDrain([t1, t2], smallBattery);

        expect(result[0].description).toContain('1.8 kWh');
    });
});

// ─── analyzeTireHealth ────────────────────────────────────────────────────────

describe('AnomalyService.analyzeTireHealth', () => {
    const avgSummary = makeSummary({ avgEff: '16' }); // 16 kWh/100km average
    const threshold = 16 * 1.25; // 20 kWh/100km

    it('returns empty for an empty trip list', () => {
        expect(AnomalyService.analyzeTireHealth([], avgSummary)).toEqual([]);
    });

    it('returns empty when avgEff is zero or falsy', () => {
        const noAvg = makeSummary({ avgEff: '0' });
        const trips = [makeTrip({ electricity: 2.5, trip: 10 })];
        expect(AnomalyService.analyzeTireHealth(trips, noAvg)).toEqual([]);
    });

    it('returns empty when fewer than 3 of the recent trips exceed the threshold', () => {
        // Only 2 of 5 trips above threshold
        const trips = [
            makeTrip({ electricity: threshold * 0.11, trip: 10 }),  // high: 22 kWh/100km
            makeTrip({ electricity: threshold * 0.11, trip: 10 }),  // high
            makeTrip({ electricity: 1.6,              trip: 10 }),  // normal
            makeTrip({ electricity: 1.6,              trip: 10 }),  // normal
            makeTrip({ electricity: 1.6,              trip: 10 }),  // normal
        ];
        expect(AnomalyService.analyzeTireHealth(trips, avgSummary)).toEqual([]);
    });

    it('returns an efficiency anomaly when 3 or more recent trips are high-consumption', () => {
        const high = makeTrip({ electricity: 2.5, trip: 10 }); // 25 kWh/100km > 20
        const trips = [high, high, high, makeTrip(), makeTrip()];
        const result = AnomalyService.analyzeTireHealth(trips, avgSummary);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('tire_pressure');
        expect(result[0].type).toBe('efficiency');
        expect(result[0].severity).toBe('info');
    });

    it('only evaluates the first 5 trips in the provided array', () => {
        // Trips 1-5: all normal. Trip 6+: all high. Should NOT trigger.
        const normal = makeTrip({ electricity: 1.6, trip: 10 });
        const high   = makeTrip({ electricity: 2.5, trip: 10 });
        const trips  = [normal, normal, normal, normal, normal, high, high, high];
        expect(AnomalyService.analyzeTireHealth(trips, avgSummary)).toEqual([]);
    });
});

// ─── analyzeCharges ───────────────────────────────────────────────────────────

describe('AnomalyService.analyzeCharges', () => {
    const settings = makeSettings({ batterySize: 60 });
    const noTrips: Trip[] = [];

    it('returns empty when charge has no SoC data', () => {
        const charge = makeCharge(); // no initialPercentage / finalPercentage
        expect(AnomalyService.analyzeCharges([charge], settings, noTrips)).toEqual([]);
    });

    it('returns empty when only finalPercentage is missing', () => {
        const charge = makeCharge({ initialPercentage: 20 }); // finalPercentage absent
        expect(AnomalyService.analyzeCharges([charge], settings, noTrips)).toEqual([]);
    });

    it('returns empty when efficiency is within normal range for fast charging (≥ 0.80)', () => {
        // 70 % SoC added (0.70 × 60 = 42 kWh) / 40 kWh drawn = 1.05 → good
        const charge = makeCharge({ initialPercentage: 20, finalPercentage: 90, kwhCharged: 40, time: '14:00' });
        expect(AnomalyService.analyzeCharges([charge], settings, noTrips)).toEqual([]);
    });

    it('returns empty when efficiency is erratic (> 1.1 or ≤ 0.45)', () => {
        // Impossibly high efficiency (> 1.1)
        const overEfficient = makeCharge({ initialPercentage: 10, finalPercentage: 100, kwhCharged: 1, time: '14:00' });
        expect(AnomalyService.analyzeCharges([overEfficient], settings, noTrips)).toEqual([]);

        // Too-low efficiency (≤ 0.45): (10%×60)/40 = 6/40 = 0.15
        const tooLow = makeCharge({ initialPercentage: 20, finalPercentage: 30, kwhCharged: 40, time: '14:00' });
        expect(AnomalyService.analyzeCharges([tooLow], settings, noTrips)).toEqual([]);
    });

    it('returns an "info" anomaly for fast charging with efficiency 0.70–0.80', () => {
        // (70-20) % × 60 kWh = 30 kWh / 40 kWh drawn = 0.75 → 'info' (below 0.80 but above 0.70)
        const charge = makeCharge({ id: 'f1', initialPercentage: 20, finalPercentage: 70, kwhCharged: 40, time: '14:00' });
        const result = AnomalyService.analyzeCharges([charge], settings, noTrips);

        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('charging');
        expect(result[0].severity).toBe('info');
        expect(result[0].id).toBe('eff_f1');
    });

    it('returns a "warning" anomaly for fast charging with efficiency < 0.70', () => {
        // (52-20) % × 60 = 19.2 kWh / 40 kWh = 0.48 → 'warning' (below 0.70 = 0.80-0.10)
        const charge = makeCharge({ id: 'f2', initialPercentage: 20, finalPercentage: 52, kwhCharged: 40, time: '14:00' });
        const result = AnomalyService.analyzeCharges([charge], settings, noTrips);

        expect(result).toHaveLength(1);
        expect(result[0].severity).toBe('warning');
    });

    it('uses a lower threshold (0.70) for valley-time charging (time 00:00–07:59)', () => {
        // (60-20) % × 60 = 24 kWh / 40 kWh = 0.60 → below 0.70 → anomaly
        const charge = makeCharge({ id: 'v1', initialPercentage: 20, finalPercentage: 60, kwhCharged: 40, time: '02:00' });
        const result = AnomalyService.analyzeCharges([charge], settings, noTrips);

        expect(result).toHaveLength(1);
        expect(result[0].title).toContain('Valle');
    });

    it('ignores charges without kwhCharged > 0', () => {
        const charge = makeCharge({ initialPercentage: 20, finalPercentage: 50, kwhCharged: 0 });
        expect(AnomalyService.analyzeCharges([charge], settings, noTrips)).toEqual([]);
    });

    it('only evaluates the most recent 5 charges', () => {
        // 6 charges, all bad efficiency. Only first 5 (by date desc) should be checked.
        const bad = (id: string, date: string) =>
            makeCharge({ id, date, initialPercentage: 20, finalPercentage: 52, kwhCharged: 40, time: '14:00' });

        const charges = [
            bad('c1', '2024-01-01'),
            bad('c2', '2024-01-02'),
            bad('c3', '2024-01-03'),
            bad('c4', '2024-01-04'),
            bad('c5', '2024-01-05'),
            bad('c6', '2024-01-06'),
        ];
        const result = AnomalyService.analyzeCharges(charges, settings, noTrips);
        expect(result).toHaveLength(5); // Only 5 evaluated
    });
});

// ─── checkSystemHealth ────────────────────────────────────────────────────────

describe('AnomalyService.checkSystemHealth', () => {
    const settings = makeSettings();
    const noTrips: Trip[] = [];
    const noCharges: Charge[] = [];

    describe('battery health (via checkBatteryHealth)', () => {
        it('adds a "critical" battery anomaly when SoH < 75', () => {
            const data = makeProcessedData({ soh: 70 });
            const result = AnomalyService.checkSystemHealth(data, settings, noCharges, noTrips);

            const battery = result.filter(a => a.id === 'soh_critical');
            expect(battery).toHaveLength(1);
            expect(battery[0].severity).toBe('critical');
            expect(battery[0].type).toBe('battery');
        });

        it('adds a "warning" battery anomaly when 75 ≤ SoH < 85', () => {
            const data = makeProcessedData({ soh: 80 });
            const result = AnomalyService.checkSystemHealth(data, settings, noCharges, noTrips);

            const battery = result.filter(a => a.id === 'soh_warning');
            expect(battery).toHaveLength(1);
            expect(battery[0].severity).toBe('warning');
        });

        it('adds no battery-health anomaly when SoH ≥ 85', () => {
            const data = makeProcessedData({ soh: 90 });
            const result = AnomalyService.checkSystemHealth(data, settings, noCharges, noTrips);

            const batteryAnomalies = result.filter(a => a.type === 'battery' && a.id !== 'bms_calibration');
            expect(batteryAnomalies).toHaveLength(0);
        });

        it('adds a BMS calibration "info" anomaly when calibration_warning is true', () => {
            const sohData: SoHData = {
                estimated_soh: 90, real_cycles_count: 50, stress_score: 0.3,
                charging_stress: 0.2, thermal_stress: 0.1, calibration_warning: true,
                degradation: { sei: 0, cycle: 0, calendar: 0 },
            };
            const data = makeProcessedData({ soh: 90, sohData });
            const result = AnomalyService.checkSystemHealth(data, settings, noCharges, noTrips);

            const calibration = result.filter(a => a.id === 'bms_calibration');
            expect(calibration).toHaveLength(1);
            expect(calibration[0].severity).toBe('info');
        });

        it('does not add BMS calibration anomaly when calibration_warning is false', () => {
            const sohData: SoHData = {
                estimated_soh: 90, real_cycles_count: 50, stress_score: 0,
                charging_stress: 0, thermal_stress: 0, calibration_warning: false,
                degradation: { sei: 0, cycle: 0, calendar: 0 },
            };
            const data = makeProcessedData({ soh: 90, sohData });
            const result = AnomalyService.checkSystemHealth(data, settings, noCharges, noTrips);

            expect(result.filter(a => a.id === 'bms_calibration')).toHaveLength(0);
        });
    });

    describe('integration with sub-analyzers', () => {
        it('includes phantom drain anomaly when detected', () => {
            const data = makeProcessedData();
            // 6 % drop over 24 h → 'warning' drain (full timestamps required for sort order)
            const trips = [
                makeTrip({ date: '2024-03-01', start_timestamp: 0,      end_timestamp: H,      end_soc: 80 }),
                makeTrip({ date: '2024-03-02', start_timestamp: 25 * H, end_timestamp: 26 * H, start_soc: 74 }),
            ];
            const result = AnomalyService.checkSystemHealth(data, settings, noCharges, trips);

            expect(result.some(a => a.type === 'drain')).toBe(true);
        });

        it('includes charging anomaly when detected', () => {
            const data = makeProcessedData();
            const charges = [
                makeCharge({ id: 'cx', initialPercentage: 20, finalPercentage: 52, kwhCharged: 40, time: '14:00' }),
            ];
            const result = AnomalyService.checkSystemHealth(data, settings, charges, noTrips);

            expect(result.some(a => a.type === 'charging')).toBe(true);
        });

        it('returns an empty array when everything is healthy', () => {
            const data = makeProcessedData({ soh: 90 });
            const result = AnomalyService.checkSystemHealth(data, settings, noCharges, noTrips);

            expect(result).toEqual([]);
        });
    });
});
