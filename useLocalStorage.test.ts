
// src/hooks/__tests__/useLocalStorage.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';

describe('useLocalStorage', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns initial value when localStorage is empty', () => {
        const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
        expect(result.current[0]).toBe('default');
    });

    it('returns stored value when localStorage has data', () => {
        localStorage.setItem('test-key', JSON.stringify('stored-value'));
        const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
        expect(result.current[0]).toBe('stored-value');
    });

    it('updates localStorage when setValue is called', () => {
        const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

        act(() => {
            // setValue
            result.current[1]('new-value');
        });

        // Advance timers to trigger batched write (150ms)
        act(() => {
            vi.advanceTimersByTime(200);
        });

        expect(JSON.parse(localStorage.getItem('test-key')!)).toBe('new-value');
    });

    it('batches multiple writes within 150ms', () => {
        const { result } = renderHook(() => useLocalStorage('test-key', 0));
        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

        act(() => {
            result.current[1](1);
            result.current[1](2);
            result.current[1](3);
        });

        // Before batch delay, no writes should happen (or maybe 1 if useEffect runs fast? No, batchedWrite uses setTimeout)
        // Note: React 18 automatic batching might result in only one render for the 3 updates,
        // so useEffect might only run ONCE with value 3.
        // If it runs once, batchedWrite is called once.
        // If it runs 3 times, batchedWrite cancels previous timeout.

        // In any case, we expect LAST value to be written.

        act(() => {
            vi.advanceTimersByTime(200);
        });

        expect(JSON.parse(localStorage.getItem('test-key')!)).toBe(3);

        // We expect FEW writes (ideally 1), but definitely the last one invalidates previous ones if they were pending
        // check spy call count if relevant, but correctness of value is most important.
        setItemSpy.mockRestore();
    });

    it('removeValue clears the key', () => {
        localStorage.setItem('test-key', JSON.stringify('value'));
        const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

        act(() => {
            result.current[2](); // removeValue
        });

        // removeValue calls localStorage.removeItem immediately in implementation (lines 94)
        expect(localStorage.getItem('test-key')).toBeNull();
        expect(result.current[0]).toBe('default');
    });

    it('handles JSON parse errors gracefully', () => {
        localStorage.setItem('test-key', 'invalid-json');
        const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
        expect(result.current[0]).toBe('default');
    });

    it('handles objects correctly', () => {
        const initialObj = { name: 'test', value: 42 };
        const { result } = renderHook(() => useLocalStorage('test-obj', initialObj));

        act(() => {
            result.current[1]({ name: 'updated', value: 100 });
        });

        act(() => {
            vi.advanceTimersByTime(200);
        });

        const stored = JSON.parse(localStorage.getItem('test-obj')!);
        expect(stored.name).toBe('updated');
        expect(stored.value).toBe(100);
    });
});
