// BYD Stats - Formatters Tests
import { describe, it, expect } from 'vitest';
import {
    calculateScore,
    getScoreColor,
    formatDuration,
    calculatePercentile,
    formatNumber
} from '../formatters';

describe('formatters', () => {
    describe('calculateScore', () => {
        it('should return 10 for best efficiency (minimum)', () => {
            const result = calculateScore(12, 12, 20);
            expect(result).toBe(10);
        });

        it('should return 0 for worst efficiency (maximum)', () => {
            const result = calculateScore(20, 12, 20);
            expect(result).toBe(0);
        });

        it('should return 5 for middle efficiency', () => {
            const result = calculateScore(16, 12, 20);
            expect(result).toBe(5);
        });

        it('should handle equal min and max (return 5)', () => {
            const result = calculateScore(15, 15, 15);
            expect(result).toBe(5);
        });

        it('should handle null/undefined efficiency', () => {
            expect(calculateScore(null as any, 12, 20)).toBe(5);
            expect(calculateScore(undefined as any, 12, 20)).toBe(5);
            expect(calculateScore(0, 12, 20)).toBe(5);
        });

        it('should clamp values between 0 and 10', () => {
            const result1 = calculateScore(10, 12, 20); // Better than best
            expect(result1).toBeLessThanOrEqual(10);

            const result2 = calculateScore(25, 12, 20); // Worse than worst
            expect(result2).toBeGreaterThanOrEqual(0);
        });
    });

    describe('getScoreColor', () => {
        it('should return red-ish for low scores (0-2)', () => {
            const color = getScoreColor(1);
            expect(color).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
            expect(color).toContain('rgb(');
        });

        it('should return orange for middle scores (4-6)', () => {
            const color = getScoreColor(5);
            expect(color).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
        });

        it('should return green-ish for high scores (8-10)', () => {
            const color = getScoreColor(10);
            expect(color).toBe('rgb(100, 255, 0)');
        });

        it('should handle edge values', () => {
            expect(getScoreColor(0)).toBeTruthy();
            expect(getScoreColor(10)).toBeTruthy();
        });
    });

    describe('formatDuration', () => {
        it('should format seconds to minutes', () => {
            expect(formatDuration(180)).toBe('3 min');
            expect(formatDuration(60)).toBe('1 min');
        });

        it('should format seconds to hours and minutes', () => {
            expect(formatDuration(3660)).toBe('1h 1min');
            expect(formatDuration(7200)).toBe('2h 0min');
        });

        it('should handle zero/null values', () => {
            expect(formatDuration(0)).toBe('0 min');
            expect(formatDuration(null as any)).toBe('0 min');
            expect(formatDuration(undefined as any)).toBe('0 min');
        });

        it('should handle very large durations', () => {
            const result = formatDuration(86400); // 24 hours
            expect(result).toContain('h');
        });
    });

    describe('calculatePercentile', () => {
        const mockTrips = [
            { trip: 10, electricity: 1.2 },  // 12 kWh/100km
            { trip: 10, electricity: 1.5 },  // 15 kWh/100km
            { trip: 10, electricity: 1.8 },  // 18 kWh/100km
            { trip: 10, electricity: 2.0 },  // 20 kWh/100km
        ];

        it('should calculate percentile correctly for middle trip', () => {
            const trip = { trip: 10, electricity: 1.5 };
            const percentile = calculatePercentile(trip, mockTrips);
            expect(percentile).toBeGreaterThanOrEqual(0);
            expect(percentile).toBeLessThanOrEqual(100);
        });

        it('should return 50 for null/undefined trip', () => {
            expect(calculatePercentile(null, mockTrips)).toBe(50);
            expect(calculatePercentile(undefined, mockTrips)).toBe(50);
        });

        it('should return 50 for empty trips array', () => {
            const trip = { trip: 10, electricity: 1.5 };
            expect(calculatePercentile(trip, [])).toBe(50);
        });

        it('should filter out invalid trips', () => {
            const invalidTrips = [
                { trip: 0, electricity: 1.0 },     // Invalid: trip = 0
                { trip: 10, electricity: 0 },      // Invalid: electricity = 0
                { trip: 10, electricity: 1.5 },    // Valid
            ];
            const trip = { trip: 10, electricity: 1.5 };
            const result = calculatePercentile(trip, invalidTrips);
            expect(result).toBeGreaterThanOrEqual(0);
        });
    });

    describe('formatNumber', () => {
        it('should format number with default 1 decimal', () => {
            expect(formatNumber(12.345)).toBe('12.3');
            expect(formatNumber(10)).toBe('10.0');
        });

        it('should format number with custom decimals', () => {
            expect(formatNumber(12.345, 2)).toBe('12.35');
            expect(formatNumber(12.345, 0)).toBe('12');
        });

        it('should handle null/undefined/NaN', () => {
            expect(formatNumber(null as any)).toBe('0');
            expect(formatNumber(undefined as any)).toBe('0');
            expect(formatNumber(NaN)).toBe('0');
        });

        it('should handle zero', () => {
            expect(formatNumber(0)).toBe('0.0');
            expect(formatNumber(0, 2)).toBe('0.00');
        });

        it('should handle negative numbers', () => {
            expect(formatNumber(-5.5)).toBe('-5.5');
            expect(formatNumber(-10, 0)).toBe('-10');
        });
    });
});
