import { describe, it, expect } from 'vitest';
import {
    isValidNumber,
    isNonEmptyString,
    parseNumericSetting,
    isTrip,
    isCharge,
    isTripsArray,
    isChargesArray,
    filterNonNull,
    getSettingValue
} from '../typeGuards';
import { Settings } from '@/types';

describe('typeGuards', () => {
    describe('isValidNumber', () => {
        it('returns true for valid numbers', () => {
            expect(isValidNumber(0)).toBe(true);
            expect(isValidNumber(1)).toBe(true);
            expect(isValidNumber(-1)).toBe(true);
            expect(isValidNumber(3.14)).toBe(true);
        });
        it('returns false for NaN', () => {
            expect(isValidNumber(NaN)).toBe(false);
        });
        it('returns false for Infinity and -Infinity', () => {
            expect(isValidNumber(Infinity)).toBe(false);
            expect(isValidNumber(-Infinity)).toBe(false);
        });
        it('returns false for null, undefined, string', () => {
            expect(isValidNumber(null)).toBe(false);
            expect(isValidNumber(undefined)).toBe(false);
            expect(isValidNumber('123')).toBe(false);
        });
    });

    describe('isNonEmptyString', () => {
        it('returns true for non-empty strings', () => {
            expect(isNonEmptyString('hello')).toBe(true);
            expect(isNonEmptyString('a')).toBe(true);
        });
        it('returns false for empty string and whitespace-only', () => {
            expect(isNonEmptyString('')).toBe(false);
            expect(isNonEmptyString('   ')).toBe(false);
        });
        it('returns false for null, undefined, numbers', () => {
            expect(isNonEmptyString(null)).toBe(false);
            expect(isNonEmptyString(undefined)).toBe(false);
            expect(isNonEmptyString(123)).toBe(false);
        });
    });

    describe('parseNumericSetting', () => {
        it('parses valid numeric strings', () => {
            expect(parseNumericSetting('60.48', 60)).toBe(60.48);
            expect(parseNumericSetting('-10.5', 0)).toBe(-10.5);
        });
        it('returns number as-is', () => {
            expect(parseNumericSetting(60.48, 60)).toBe(60.48);
        });
        it('returns default for invalid string', () => {
            expect(parseNumericSetting('abc', 60)).toBe(60);
            expect(parseNumericSetting('', 60)).toBe(60);
        });
        it('returns default for null/undefined/NaN', () => {
            expect(parseNumericSetting(null, 60)).toBe(60);
            expect(parseNumericSetting(undefined, 60)).toBe(60);
            expect(parseNumericSetting(NaN, 60)).toBe(60);
        });
    });

    describe('isTrip', () => {
        it('returns true for valid Trip objects', () => {
            const validTrip = { date: '2023-01-01', trip: 10, start_timestamp: 1, end_timestamp: 2 };
            expect(isTrip(validTrip)).toBe(true);

            // Trip can be undefined in the type guard based on typeof trip.trip === 'undefined'
            const validTrip2 = { date: '2023-01-01', start_timestamp: 1, end_timestamp: 2 };
            expect(isTrip(validTrip2)).toBe(true);
        });
        it('returns false for objects missing required fields', () => {
            expect(isTrip({ trip: 10 })).toBe(false); // missing date
            expect(isTrip({ date: 123 })).toBe(false); // date is not a string
            expect(isTrip({ date: '2023-01-01', trip: '10' })).toBe(false); // trip is not a number
        });
        it('returns false for null/undefined/primitives', () => {
            expect(isTrip(null)).toBe(false);
            expect(isTrip(undefined)).toBe(false);
            expect(isTrip('string')).toBe(false);
        });
    });

    describe('isCharge', () => {
        it('returns true for valid Charge objects', () => {
            expect(isCharge({ date: '2023-01-01', kwh: 10 })).toBe(true);
            expect(isCharge({ date: '2023-01-01', kwhCharged: 10 })).toBe(true);
        });
        it('returns false for objects missing date or numeric kwh', () => {
            expect(isCharge({ kwh: 10 })).toBe(false);
            expect(isCharge({ date: '2023-01-01' })).toBe(false);
            expect(isCharge({ date: '2023-01-01', kwh: '10' })).toBe(false);
        });
        it('returns false for null/undefined/primitives', () => {
            expect(isCharge(null)).toBe(false);
        });
    });

    describe('isTripsArray', () => {
        it('returns true for array of valid trips', () => {
            expect(isTripsArray([{ date: '2023-01-01', trip: 10 }])).toBe(true);
            expect(isTripsArray([])).toBe(true);
        });
        it('returns false for array containing invalid trips', () => {
            expect(isTripsArray([{ date: '2023-01-01', trip: 10 }, null])).toBe(false);
        });
        it('returns false for non-arrays', () => {
            expect(isTripsArray({})).toBe(false);
        });
    });

    describe('isChargesArray', () => {
        it('returns true for array of valid charges', () => {
            expect(isChargesArray([{ date: '2023-01-01', kwh: 10 }])).toBe(true);
            expect(isChargesArray([])).toBe(true);
        });
        it('returns false for array containing invalid charges', () => {
            expect(isChargesArray([{ date: '2023-01-01', kwh: 10 }, null])).toBe(false);
        });
    });

    describe('filterNonNull', () => {
        it('removes null and undefined from array', () => {
            expect(filterNonNull([1, null, 2, undefined, 3])).toEqual([1, 2, 3]);
        });
        it('preserves falsy values like 0, "", false', () => {
            expect(filterNonNull([0, '', false, null])).toEqual([0, '', false]);
        });
        it('returns empty array for all-null input', () => {
            expect(filterNonNull([null, undefined])).toEqual([]);
        });
    });

    describe('getSettingValue', () => {
        it('returns value from settings if it exists and is not null/undefined', () => {
            const settings: Partial<Settings> = { batterySize: 60 };
            expect(getSettingValue(settings, 'batterySize', 50)).toBe(60);
        });
        it('returns default value if settings is undefined or empty', () => {
            expect(getSettingValue(undefined, 'batterySize', 50)).toBe(50);
            expect(getSettingValue({}, 'batterySize', 50)).toBe(50);
        });
        it('returns default value if value is null or undefined in settings', () => {
            expect(getSettingValue({ batterySize: null as any }, 'batterySize', 50)).toBe(50);
            expect(getSettingValue({ batterySize: undefined }, 'batterySize', 50)).toBe(50);
        });
    });
});
