// BYD Stats - useLocalStorage Hook Tests
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';

describe('useLocalStorage', () => {
    const TEST_KEY = 'test_key';

    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('should return initial value when no stored value exists', () => {
        const { result } = renderHook(() => useLocalStorage(TEST_KEY, 'default'));
        expect(result.current[0]).toBe('default');
    });

    it('should return stored value if it exists', () => {
        localStorage.setItem(TEST_KEY, JSON.stringify('stored'));
        const { result } = renderHook(() => useLocalStorage(TEST_KEY, 'default'));
        expect(result.current[0]).toBe('stored');
    });

    it('should update localStorage when value changes', () => {
        const { result } = renderHook(() => useLocalStorage(TEST_KEY, 'initial'));

        act(() => {
            result.current[1]('updated');
        });

        expect(result.current[0]).toBe('updated');
        expect(localStorage.getItem(TEST_KEY)).toBe(JSON.stringify('updated'));
    });

    it('should handle function updater', () => {
        const { result } = renderHook(() => useLocalStorage(TEST_KEY, 10));

        act(() => {
            result.current[1](prev => prev + 5);
        });

        expect(result.current[0]).toBe(15);
    });

    it('should handle objects and arrays', () => {
        const { result } = renderHook(() => useLocalStorage(TEST_KEY, { count: 0 }));

        act(() => {
            result.current[1]({ count: 5 });
        });

        expect(result.current[0]).toEqual({ count: 5 });
        expect(JSON.parse(localStorage.getItem(TEST_KEY))).toEqual({ count: 5 });
    });

    it('should handle parse errors gracefully', () => {
        // Set invalid JSON
        localStorage.setItem(TEST_KEY, 'invalid json{');
        const { result } = renderHook(() => useLocalStorage(TEST_KEY, 'default'));

        // Should fall back to initial value
        expect(result.current[0]).toBe('default');
    });

    it('should handle null and undefined', () => {
        const { result: result1 } = renderHook(() => useLocalStorage(TEST_KEY, null));
        expect(result1.current[0]).toBeNull();

        const { result: result2 } = renderHook(() => useLocalStorage(TEST_KEY, undefined));
        expect(result2.current[0]).toBeUndefined();
    });
});

