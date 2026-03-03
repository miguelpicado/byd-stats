/**
 * Test factory functions — shared across all test files.
 *
 * Usage:
 *   import { makeTrip, makeCharge, makeCar, makeSettings } from '@test-utils/factories';
 *
 * Each factory returns a complete, valid object with sensible defaults.
 * Pass `overrides` to customize only the fields you care about in a specific test.
 */
import { Trip, Charge, Car, Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@core/constants';

export const makeTrip = (overrides?: Partial<Trip>): Trip => ({
    id: `trip-${Math.random().toString(36).slice(2, 8)}`,
    date: '20240115',
    trip: 25,
    electricity: 4.5,
    duration: 30,
    start_timestamp: 1700000000000,
    end_timestamp: 1700001800000,
    month: '202401',
    start_soc: 80,
    end_soc: 70,
    source: 'local',
    ...overrides,
});

export const makeCharge = (overrides?: Partial<Charge>): Charge => ({
    id: `charge-${Math.random().toString(36).slice(2, 8)}`,
    date: '20240115',
    time: '10:00',
    kwhCharged: 20,
    totalCost: 3.0,
    pricePerKwh: 0.15,
    chargerTypeId: 'home',
    initialPercentage: 30,
    finalPercentage: 80,
    ...overrides,
});

export const makeCar = (overrides?: Partial<Car>): Car => ({
    id: 'car-1',
    name: 'Test BYD Seal',
    type: 'ev',
    isHybrid: false,
    vin: 'TESTVIN00000000001',
    ...overrides,
});

export const makeSettings = (overrides?: Partial<Settings>): Settings => ({
    ...DEFAULT_SETTINGS,
    ...overrides,
});
