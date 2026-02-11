
// src/core/__tests__/dataProcessing.test.ts
import { describe, it, expect } from 'vitest';
import {
    calculateStats,
    getTopN,
    isStationaryTrip,
    mergeTrips,
    deduplicateByKey
} from '../dataProcessing';
import { Trip } from '@/types';

// Mock data
const mockTrips = [
    { date: '2025-01-01', trip: 50, electricity: 8, start_timestamp: 1704067200 },
    { date: '2025-01-02', trip: 100, electricity: 16, start_timestamp: 1704153600 },
    { date: '2025-01-03', trip: 0.3, electricity: 0.1, start_timestamp: 1704240000 }, // stationary
] as Trip[];

describe('dataProcessing', () => {
    describe('isStationaryTrip', () => {
        it('returns true for trips < 0.5 km', () => {
            // @ts-ignore
            expect(isStationaryTrip({ trip: 0.3 })).toBe(true);
            // @ts-ignore
            expect(isStationaryTrip({ trip: 0.49 })).toBe(true);
        });

        it('returns false for trips >= 0.5 km', () => {
            // @ts-ignore
            expect(isStationaryTrip({ trip: 0.5 })).toBe(false);
            // @ts-ignore
            expect(isStationaryTrip({ trip: 10 })).toBe(false);
        });

        it('handles undefined trip', () => {
            // @ts-ignore
            expect(isStationaryTrip({})).toBe(true);
        });
    });

    describe('getTopN', () => {
        const items = [
            { value: 5 },
            { value: 2 },
            { value: 8 },
            { value: 1 },
            { value: 9 },
        ];

        it('returns top N items', () => {
            const top3 = getTopN(items, (a, b) => b.value - a.value, 3);
            expect(top3.map(i => i.value)).toEqual([9, 8, 5]);
        });

        it('handles N > array length', () => {
            const top10 = getTopN(items, (a, b) => b.value - a.value, 10);
            expect(top10.length).toBe(5);
        });

        it('handles empty array', () => {
            expect(getTopN([], (a, b) => b - a, 3)).toEqual([]);
        });
    });

    describe('deduplicateByKey', () => {
        const items = [
            { id: 1, name: 'first' },
            { id: 2, name: 'second' },
            { id: 1, name: 'duplicate' },
        ];

        it('removes duplicates keeping first occurrence', () => {
            const result = deduplicateByKey(items, item => item.id);
            expect(result.length).toBe(2);
            expect(result[0].name).toBe('first');
        });

        it('handles empty array', () => {
            expect(deduplicateByKey([], i => i)).toEqual([]);
        });
    });

    describe('calculateStats', () => {
        it('calculates total distance', () => {
            const stats = calculateStats(mockTrips);
            expect(stats.totalDistance).toBe(150.3);
        });

        it('calculates total energy', () => {
            const stats = calculateStats(mockTrips);
            expect(stats.totalEnergy).toBe(24.1);
        });

        it('calculates average efficiency', () => {
            const stats = calculateStats(mockTrips);
            // (8+16+0.1) / (50+100+0.3) * 100 = ~16.034... -> 16.03
            // Expected logic in implementation: (totalEnergy / totalDistance) * 100
            expect(stats.avgEfficiency).toBe(16.03);
        });

        it('excludes stationary trips from efficiency', () => {
            const stats = calculateStats(mockTrips, { excludeStationary: true });
            // (8+16) / (50+100) * 100 = 16
            expect(stats.avgEfficiency).toBe(16.00);
            expect(stats.totalDistance).toBe(150);
        });

        it('handles empty array', () => {
            const stats = calculateStats([]);
            expect(stats.totalDistance).toBe(0);
            expect(stats.totalEnergy).toBe(0);
            expect(stats.avgEfficiency).toBe(0);
        });
    });

    describe('mergeTrips', () => {
        const localTrips = [
            { date: '2025-01-01', trip: 50, start_timestamp: 1000, source: 'local' },
        ] as any[];
        const remoteTrips = [
            { date: '2025-01-01', trip: 50, start_timestamp: 1000, source: 'remote' },
            { date: '2025-01-02', trip: 100, start_timestamp: 2000, source: 'remote' },
        ] as any[];

        it('merges without duplicates', () => {
            const merged = mergeTrips(localTrips, remoteTrips);
            expect(merged.length).toBe(2);
        });

        it('prefers remote over local for same key', () => {
            const merged = mergeTrips(localTrips, remoteTrips);
            const jan1 = merged.find(t => t.date === '2025-01-01');
            expect(jan1).toBeDefined();
            expect(jan1?.source).toBe('remote');
        });
    });
});
