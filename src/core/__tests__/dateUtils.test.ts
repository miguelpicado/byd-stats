import { describe, it, expect } from 'vitest';
import { formatMonth, formatDate, formatTime, parseDate, toDateString } from '../dateUtils';

describe('Date Utilities (dateUtils)', () => {
    describe('formatMonth', () => {
        it('should format YYYYMM string into Short Month YYYY (en locale)', () => {
            const result = formatMonth('202401', 'en');
            expect(result).toBe('Jan 2024');
        });

        it('should format YYYYMM string into Short Month YYYY (es locale default fallback)', () => {
            const result = formatMonth('202401', 'es');
            // 'ene 2024' -> capitalized -> 'Ene 2024' (depending on env, might be Ene. 2024)
            // Just verifying it contains year and some text
            expect(result.toLowerCase()).toContain('ene');
            expect(result).toContain('2024');
        });

        it('should return original string if length < 6 or empty', () => {
            expect(formatMonth('2024', 'en')).toBe('2024');
            expect(formatMonth('', 'en')).toBe('');
        });
    });

    describe('formatDate', () => {
        it('should format YYYYMMDD into DD/MM/YYYY locally (es)', () => {
            const result = formatDate('20240115', 'es');
            // Depending on the Node.js locale it could be 15/01/2024 or 15/1/2024
            expect(result).toMatch(/15[/-]0?1[/-]2024/);
        });

        it('should format YYYYMMDD correctly locally (en-US)', () => {
            const result = formatDate('20240115', 'en-US');
            // en-US normally does MM/DD/YYYY => 01/15/2024
            expect(result).toMatch(/0?1[/-]15[/-]2024/);
        });

        it('should return original string if length < 8 or empty', () => {
            expect(formatDate('2024', 'en')).toBe('2024');
            expect(formatDate('', 'en')).toBe('');
        });
    });

    describe('formatTime', () => {
        it('should format a Unix timestamp (seconds) into HH:MM', () => {
            // Let's create a known timestamp. e.g. 2024-01-01T15:30:00Z
            // But it depends on the local timezone where tests are run.
            // We'll just ensure it returns a valid time format like HH:MM 
            const ts = Math.floor(new Date().getTime() / 1000);
            const result = formatTime(ts, 'es');
            expect(result).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM|am|pm)?$/);
        });

        it('should return empty string if no timestamp is provided', () => {
            expect(formatTime(0)).toBe('');
        });
    });

    describe('parseDate', () => {
        it('should convert YYYYMMDD string to Date object', () => {
            const result = parseDate('20240520');
            expect(result).toBeInstanceOf(Date);
            expect(result?.getFullYear()).toBe(2024);
            expect(result?.getMonth()).toBe(4); // 0-indexed, so May is 4
            expect(result?.getDate()).toBe(20);
        });

        it('should return null if string length is < 8 or empty', () => {
            expect(parseDate('2024')).toBeNull();
            expect(parseDate('')).toBeNull();
        });
    });

    describe('toDateString', () => {
        it('should format Date object into YYYYMMDD', () => {
            const date = new Date(2024, 4, 3); // May 3, 2024
            const result = toDateString(date);
            expect(result).toBe('20240503');
        });

        it('should pad single digit days and months with zero', () => {
            const date = new Date(2023, 0, 9); // Jan 9, 2023
            const result = toDateString(date);
            expect(result).toBe('20230109');
        });
    });
});
