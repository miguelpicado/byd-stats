import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage, flushWrites } from '../useLocalStorage';
import { logger } from '@core/logger';

// Mock logger
vi.mock('@core/logger', () => ({
    logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

const TEST_KEY = 'test_local_storage_key';

describe('useLocalStorage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.useFakeTimers();
    });

    afterEach(() => {
        flushWrites(); // Ensure queue is cleared between tests
        vi.useRealTimers();
    });

    it('initializes with value from localStorage if exists', () => {
        localStorage.setItem(TEST_KEY, JSON.stringify({ saved: true }));

        const { result } = renderHook(() => useLocalStorage(TEST_KEY, { saved: false }));

        expect(result.current[0]).toEqual({ saved: true });
    });

    it('initializes with default value if localStorage is empty', () => {
        const { result } = renderHook(() => useLocalStorage(TEST_KEY, 'default_value'));

        expect(result.current[0]).toBe('default_value');
    });

    it('updates localStorage when state changes (debounced)', () => {
        const { result } = renderHook(() => useLocalStorage(TEST_KEY, 'initial'));

        act(() => {
            const setValue = result.current[1];
            setValue('new_value');
        });

        // Value in state updates immediately
        expect(result.current[0]).toBe('new_value');

        // Value in localStorage is not updated immediately due to batching
        expect(localStorage.getItem(TEST_KEY)).toBeNull();

        // Fast forward timers past BATCH_DELAY (150ms)
        act(() => {
            vi.advanceTimersByTime(200);
        });

        // Now it should be in localStorage
        expect(localStorage.getItem(TEST_KEY)).toBe(JSON.stringify('new_value'));
    });

    it('handles JSON parse errors gracefully on initialization', () => {
        localStorage.setItem(TEST_KEY, 'invalid json {');

        const { result } = renderHook(() => useLocalStorage(TEST_KEY, 'fallback'));

        expect(result.current[0]).toBe('fallback');
        expect(logger.error).toHaveBeenCalled();
    });

    it('handles functional state updates', () => {
        const { result } = renderHook(() => useLocalStorage(TEST_KEY, 10));

        act(() => {
            const setValue = result.current[1];
            setValue(prev => prev + 5);
        });

        expect(result.current[0]).toBe(15);

        act(() => {
            vi.advanceTimersByTime(200);
        });

        expect(localStorage.getItem(TEST_KEY)).toBe('15');
    });

    it('removes item from storage when set to null', () => {
        localStorage.setItem(TEST_KEY, '"hello"');
        const { result } = renderHook(() => useLocalStorage<string | null>(TEST_KEY, 'hello'));

        act(() => {
            const setValue = result.current[1];
            setValue(null);
        });

        // Check if removed immediately (as per implementation for null/undefined)
        expect(localStorage.getItem(TEST_KEY)).toBeNull();
    });

    it('removes item from storage when using removeValue function', () => {
        localStorage.setItem(TEST_KEY, '"keep_me"');
        const { result } = renderHook(() => useLocalStorage(TEST_KEY, 'initial'));

        act(() => {
            const removeValue = result.current[2];
            removeValue();
        });

        expect(localStorage.getItem(TEST_KEY)).toBeNull();
        expect(result.current[0]).toBe('initial'); // State resets to initial
    });

    it('flushWrites forces immediate write of queued items', () => {
        const { result } = renderHook(() => useLocalStorage(TEST_KEY, 'initial'));

        act(() => {
            const setValue = result.current[1];
            setValue('flushed_value');
        });

        expect(localStorage.getItem(TEST_KEY)).toBeNull(); // Still queued

        flushWrites();

        expect(localStorage.getItem(TEST_KEY)).toBe(JSON.stringify('flushed_value'));
    });
});
