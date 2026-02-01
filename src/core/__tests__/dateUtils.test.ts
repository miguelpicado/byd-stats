// BYD Stats - Date Utilities Tests
import { describe, it, expect, beforeAll } from 'vitest';
import { formatMonth, formatDate, formatTime, parseDate, toDateString } from '../dateUtils';
import i18n from '../../i18n';

// Initialize i18n for testing
beforeAll(async () => {
    if (!i18n.isInitialized) {
        await i18n.init();
    }
});

describe('dateUtils', () => {
    describe('formatMonth', () => {
        it('should format valid month string (YYYYMM)', () => {
            const result = formatMonth('202501');
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(0);
        });

        it('should handle empty or invalid input', () => {
            expect(formatMonth('')).toBe('');
            expect(formatMonth(null as any)).toBe('');
            expect(formatMonth(undefined as any)).toBe('');
            expect(formatMonth('2025')).toBe('2025'); // Too short
        });

        it('should capitalize first letter', () => {
            const result = formatMonth('202501');
            expect(result[0]).toBe(result[0].toUpperCase());
        });
    });

    describe('formatDate', () => {
        it('should format valid date string (YYYYMMDD)', () => {
            const result = formatDate('20250114');
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(0);
        });

        it('should handle empty or invalid input', () => {
            expect(formatDate('')).toBe('');
            expect(formatDate(null as any)).toBe('');
            expect(formatDate(undefined as any)).toBe('');
            expect(formatDate('202501')).toBe('202501'); // Too short
        });

        it('should handle edge dates', () => {
            expect(formatDate('20240229')).toBeTruthy(); // Leap year
            expect(formatDate('20250101')).toBeTruthy(); // New year
            expect(formatDate('20251231')).toBeTruthy(); // End of year
        });
    });

    describe('formatTime', () => {
        it('should format valid timestamp', () => {
            const timestamp = 1705237200; // Jan 14, 2024 12:00:00 GMT
            const result = formatTime(timestamp);
            expect(result).toBeTruthy();
            expect(result).toMatch(/\d{1,2}:\d{2}/); // HH:MM or H:MM
        });

        it('should handle empty or invalid input', () => {
            expect(formatTime(null as any)).toBe('');
            expect(formatTime(undefined as any)).toBe('');
            expect(formatTime(0)).toBe('');
        });
    });

    describe('parseDate', () => {
        it('should parse valid date string to Date object', () => {
            const result = parseDate('20250114');
            expect(result).toBeInstanceOf(Date);
            if (result) {
                expect(result.getFullYear()).toBe(2025);
                expect(result.getMonth()).toBe(0); // January (0-indexed)
                expect(result.getDate()).toBe(14);
            }
        });

        it('should return null for invalid input', () => {
            expect(parseDate('')).toBeNull();
            expect(parseDate(null as any)).toBeNull();
            expect(parseDate(undefined as any)).toBeNull();
            expect(parseDate('2025')).toBeNull(); // Too short
        });

        it('should handle edge dates correctly', () => {
            const leapDay = parseDate('20240229');
            if (leapDay) {
                expect(leapDay.getFullYear()).toBe(2024);
                expect(leapDay.getMonth()).toBe(1); // February
                expect(leapDay.getDate()).toBe(29);
            }
        });
    });

    describe('toDateString', () => {
        it('should convert Date to YYYYMMDD format', () => {
            const date = new Date(2025, 0, 14); // Jan 14, 2025
            const result = toDateString(date);
            expect(result).toBe('20250114');
        });

        it('should pad single digit months and days', () => {
            const date = new Date(2025, 0, 5); // Jan 5, 2025
            const result = toDateString(date);
            expect(result).toBe('20250105');
        });

        it('should handle December correctly', () => {
            const date = new Date(2025, 11, 31); // Dec 31, 2025
            const result = toDateString(date);
            expect(result).toBe('20251231');
        });
    });
});
