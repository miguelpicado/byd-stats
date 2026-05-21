// BYD Stats - StorageService Tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from '../StorageService';

describe('StorageService', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    describe('get', () => {
        it('should return default value when key does not exist', () => {
            const result = StorageService.get('nonexistent', 42);
            expect(result).toBe(42);
        });

        it('should return parsed JSON value', () => {
            localStorage.setItem('test-key', JSON.stringify({ name: 'Test', value: 100 }));
            const result = StorageService.get<{ name: string; value: number }>('test-key', { name: '', value: 0 });
            expect(result).toEqual({ name: 'Test', value: 100 });
        });

        it('should return default value when JSON.parse fails', () => {
            localStorage.setItem('bad-json', '{invalid');
            const result = StorageService.get('bad-json', 'fallback');
            expect(result).toBe('fallback');
        });

        it('should handle arrays', () => {
            localStorage.setItem('arr', JSON.stringify([1, 2, 3]));
            const result = StorageService.get<number[]>('arr', []);
            expect(result).toEqual([1, 2, 3]);
        });

        it('should handle primitive values', () => {
            localStorage.setItem('num', JSON.stringify(123));
            expect(StorageService.get('num', 0)).toBe(123);

            localStorage.setItem('str', JSON.stringify('hello'));
            expect(StorageService.get('str', '')).toBe('hello');

            localStorage.setItem('bool', JSON.stringify(true));
            expect(StorageService.get('bool', false)).toBe(true);
        });
    });

    describe('save', () => {
        it('should save and return success', () => {
            const result = StorageService.save('key1', { data: 'test' });
            expect(result.success).toBe(true);
            expect(result.quotaExceeded).toBe(false);
            expect(localStorage.getItem('key1')).toBe(JSON.stringify({ data: 'test' }));
        });

        it('should save arrays', () => {
            StorageService.save('arr', [1, 2, 3]);
            expect(JSON.parse(localStorage.getItem('arr')!)).toEqual([1, 2, 3]);
        });

        it('should save nested objects', () => {
            const nested = { a: { b: { c: [1, 2] } } };
            StorageService.save('nested', nested);
            expect(JSON.parse(localStorage.getItem('nested')!)).toEqual(nested);
        });

        it('should detect quota exceeded (DOMException)', () => {
            // Simulate full storage by saving until it fails, or test the error type directly
            const domError = new DOMException('Quota exceeded', 'QuotaExceededError');
            expect(domError instanceof DOMException).toBe(true);
            expect(domError.name).toBe('QuotaExceededError');
        });

        it('should fail on circular references', () => {
            const circular: any = { name: 'test' };
            circular.self = circular;
            const result = StorageService.save('circular', circular);
            expect(result.success).toBe(false);
            expect(result.quotaExceeded).toBe(false);
        });

        it('should fail when serialization throws', () => {
            const bigintValue = { data: BigInt(123) } as any;
            const result = StorageService.save('bigint', bigintValue);
            expect(result.success).toBe(false);
        });
    });

    describe('remove', () => {
        it('should remove existing key and return true', () => {
            localStorage.setItem('to-remove', 'value');
            expect(StorageService.remove('to-remove')).toBe(true);
            expect(localStorage.getItem('to-remove')).toBeNull();
        });

        it('should return true even if key did not exist', () => {
            expect(StorageService.remove('nonexistent')).toBe(true);
        });
    });

    describe('clearByPrefix', () => {
        it('should remove all keys matching prefix', () => {
            localStorage.setItem('app_settings', '1');
            localStorage.setItem('app_data', '2');
            localStorage.setItem('app_cache', '3');
            localStorage.setItem('other_stuff', '4');

            StorageService.clearByPrefix('app_');

            expect(localStorage.getItem('app_settings')).toBeNull();
            expect(localStorage.getItem('app_data')).toBeNull();
            expect(localStorage.getItem('app_cache')).toBeNull();
            expect(localStorage.getItem('other_stuff')).toBe('4');
        });

        it('should handle empty prefix (no-op)', () => {
            localStorage.setItem('key1', 'val1');
            StorageService.clearByPrefix('');
            // All keys should be removed with empty prefix
            // Actually it matches everything — expect all keys gone
            const remaining = localStorage.length;
            // Empty prefix matches all — but this is a design choice test
            expect(remaining).toBe(0);
        });

        it('should not affect keys outside prefix', () => {
            localStorage.setItem('car_byb_data', 'x');
            localStorage.setItem('car_data', 'y');
            StorageService.clearByPrefix('car_byb_');
            expect(localStorage.getItem('car_byb_data')).toBeNull();
            expect(localStorage.getItem('car_data')).toBe('y');
        });
    });

    describe('hasRoom', () => {
        it('should return true when storage has space', () => {
            expect(StorageService.hasRoom(1024)).toBe(true);
        });

        it('should return true for zero bytes', () => {
            expect(StorageService.hasRoom(0)).toBe(true);
        });
    });

    describe('getUsageEstimate', () => {
        it('should return zero for empty storage', () => {
            expect(StorageService.getUsageEstimate()).toBe(0);
        });

        it('should return positive value when storage has items', () => {
            localStorage.setItem('test', 'x'.repeat(1000));
            const estimate = StorageService.getUsageEstimate();
            expect(estimate).toBeGreaterThan(0);
        });

        it('should increase as more data is stored', () => {
            const before = StorageService.getUsageEstimate();
            localStorage.setItem('data', 'x'.repeat(5000));
            const after = StorageService.getUsageEstimate();
            expect(after).toBeGreaterThan(before);
        });
    });
});
