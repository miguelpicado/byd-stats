import { describe, it, expect } from 'vitest';
import {
    normalizeSoCToPercent,
    normalizeSoCToDecimal,
    getNumericBatterySize
} from '../normalize';

describe('normalize', () => {
    describe('normalizeSoCToPercent', () => {
        it('converts decimal to percent (0.5 → 50)', () => {
            expect(normalizeSoCToPercent(0.5)).toBe(50);
            expect(normalizeSoCToPercent(0.99)).toBe(99);
        });
        it('keeps percent as percent (50 → 50)', () => {
            expect(normalizeSoCToPercent(50)).toBe(50);
            expect(normalizeSoCToPercent(99)).toBe(99);
            expect(normalizeSoCToPercent(100)).toBe(100);
        });
        it('handles boundary: 0 → 0, 1 → 100', () => {
            expect(normalizeSoCToPercent(0)).toBe(0);
            expect(normalizeSoCToPercent(1)).toBe(100);
        });
        it('handles values > 1 as already percent', () => {
            expect(normalizeSoCToPercent(1.5)).toBe(2); // Math.round(1.5) = 2
            expect(normalizeSoCToPercent(101)).toBe(101);
        });
        it('returns null for null/undefined input', () => {
            expect(normalizeSoCToPercent(null)).toBe(null);
            expect(normalizeSoCToPercent(undefined)).toBe(null);
        });
    });

    describe('normalizeSoCToDecimal', () => {
        it('converts percent to decimal (50 → 0.5)', () => {
            expect(normalizeSoCToDecimal(50)).toBe(0.5);
            expect(normalizeSoCToDecimal(99)).toBe(0.99);
            expect(normalizeSoCToDecimal(100)).toBe(1);
        });
        it('keeps decimal as decimal (0.5 → 0.5)', () => {
            expect(normalizeSoCToDecimal(0.5)).toBe(0.5);
            expect(normalizeSoCToDecimal(0.99)).toBe(0.99);
            expect(normalizeSoCToDecimal(1)).toBe(1);
            expect(normalizeSoCToDecimal(0)).toBe(0);
        });
        it('returns null for null/undefined input', () => {
            expect(normalizeSoCToDecimal(null)).toBe(null);
            expect(normalizeSoCToDecimal(undefined)).toBe(null);
        });
    });

    describe('getNumericBatterySize', () => {
        it('parses string "60.48" → 60.48', () => {
            expect(getNumericBatterySize('60.48')).toBe(60.48);
            expect(getNumericBatterySize('71')).toBe(71);
        });
        it('returns number as-is', () => {
            expect(getNumericBatterySize(60.48)).toBe(60.48);
            expect(getNumericBatterySize(71)).toBe(71);
        });
        it('returns 60 for undefined', () => {
            expect(getNumericBatterySize(undefined)).toBe(60);
        });
    });
});
