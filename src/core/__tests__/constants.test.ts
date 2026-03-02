import { describe, it, expect } from 'vitest';
import {
    BYD_RED,
    TAB_ORDER,
    TAB_COUNT,
    dayNamesFull,
    DEFAULT_SETTINGS,
    TRIP_DISTRIBUTION_COLORS,
    HYBRID_COLORS,
    FUEL_ENERGY_EQUIVALENT_KWH
} from '../constants';

describe('constants', () => {
    it('defines BYD_RED color accurately', () => {
        expect(BYD_RED).toBe('#EA0029');
    });

    it('contains all expected tabs in TAB_ORDER', () => {
        expect(TAB_ORDER).toEqual([
            'overview', 'calendar', 'efficiency', 'trends',
            'patterns', 'records', 'history', 'charges'
        ]);
        expect(TAB_COUNT).toBe(8);
        expect(TAB_ORDER.length).toBe(TAB_COUNT);
    });

    it('maps short day names to full names in Spanish', () => {
        expect(dayNamesFull['Lun']).toBe('Lunes');
        expect(dayNamesFull['Mié']).toBe('Miércoles');
        expect(dayNamesFull['Dom']).toBe('Domingo');
        expect(Object.keys(dayNamesFull)).toHaveLength(7);
    });

    it('provides sensible default settings', () => {
        expect(DEFAULT_SETTINGS).toBeDefined();
        // Check a few critical defaults
        expect(DEFAULT_SETTINGS.batterySize).toBe(60.48);
        expect(DEFAULT_SETTINGS.soh).toBe(100);
        expect(DEFAULT_SETTINGS.theme).toBe('auto');
        expect(DEFAULT_SETTINGS.chargerTypes).toEqual([]);
        expect(DEFAULT_SETTINGS.offPeakEnabled).toBe(false);
    });

    it('defines 5 ranges for trip distribution colors', () => {
        expect(TRIP_DISTRIBUTION_COLORS).toHaveLength(5);
        expect(TRIP_DISTRIBUTION_COLORS[0].range).toBe('0-5');
        expect(TRIP_DISTRIBUTION_COLORS[4].range).toBe('50+');
    });

    it('defines colors for hybrid vehicles', () => {
        expect(HYBRID_COLORS).toHaveProperty('electric');
        expect(HYBRID_COLORS).toHaveProperty('fuel');
        expect(HYBRID_COLORS).toHaveProperty('combined');
    });

    it('defines correct fuel energy equivalent', () => {
        expect(FUEL_ENERGY_EQUIVALENT_KWH).toBeGreaterThan(9);
        expect(FUEL_ENERGY_EQUIVALENT_KWH).toBeLessThan(10);
    });
});
