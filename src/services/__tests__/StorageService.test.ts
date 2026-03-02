import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from '../StorageService';
import { logger } from '@core/logger';

// Mock logger to avoid noise in test output
vi.mock('@core/logger', () => ({
    logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

describe('StorageService', () => {
    beforeEach(() => {
        // Clear mocks and local storage before each test
        vi.clearAllMocks();
        localStorage.clear();
    });

    describe('get', () => {
        it('returns parsed JSON for valid stored data', () => {
            localStorage.setItem('test_key', JSON.stringify({ name: 'test', value: 123 }));
            const result = StorageService.get('test_key', null);
            expect(result).toEqual({ name: 'test', value: 123 });
        });

        it('returns defaultValue when key does not exist', () => {
            const result = StorageService.get('missing_key', { fallback: true });
            expect(result).toEqual({ fallback: true });
        });

        it('returns defaultValue and logs error when stored value is invalid JSON', () => {
            localStorage.setItem('bad_json', '{"name": "test", "missing_quote}');
            const result = StorageService.get('bad_json', 'fallback_string');
            expect(result).toBe('fallback_string');
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('save', () => {
        it('saves valid data as JSON string and returns true', () => {
            const data = { name: 'test', value: 123 };
            const success = StorageService.save('save_key', data);

            expect(success).toBe(true);
            const storedString = localStorage.getItem('save_key');
            expect(storedString).toBe(JSON.stringify(data));
        });

        it('returns false and logs error on circular reference (JSON stringify fails)', () => {
            const circularObj: any = {};
            circularObj.self = circularObj;

            const success = StorageService.save('circular_key', circularObj);

            expect(success).toBe(false);
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('remove', () => {
        it('removes existing item and returns true', () => {
            localStorage.setItem('remove_key', 'some_data');
            const success = StorageService.remove('remove_key');

            expect(success).toBe(true);
            expect(localStorage.getItem('remove_key')).toBe(null);
        });

        it('returns true even if item does not exist (localStorage behavior)', () => {
            const success = StorageService.remove('non_existing_key');
            expect(success).toBe(true);
        });
    });

    describe('clearByPrefix', () => {
        it('removes only items with the specified prefix', () => {
            localStorage.setItem('byd_stats_1', 'value1');
            localStorage.setItem('byd_stats_2', 'value2');
            localStorage.setItem('other_app_1', 'value3');
            localStorage.setItem('other_byd_stats', 'value4');

            StorageService.clearByPrefix('byd_stats_');

            expect(localStorage.getItem('byd_stats_1')).toBe(null);
            expect(localStorage.getItem('byd_stats_2')).toBe(null);

            // Should keep these
            expect(localStorage.getItem('other_app_1')).toBe('value3');
            expect(localStorage.getItem('other_byd_stats')).toBe('value4');
        });

        it('does nothing if no matching prefix found', () => {
            localStorage.setItem('other_app', 'value');
            StorageService.clearByPrefix('byd_stats_');
            expect(localStorage.getItem('other_app')).toBe('value');
        });
    });
});
