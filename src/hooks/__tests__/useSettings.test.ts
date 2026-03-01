import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSettings } from '../useSettings';
import { SETTINGS_KEY, DEFAULT_SETTINGS } from '@core/constants';
import { flushWrites } from '../useLocalStorage';

describe('useSettings', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    // ─── Initial state ─────────────────────────────────────────────────────────

    describe('initial state', () => {
        it('returns all DEFAULT_SETTINGS keys when nothing is stored', () => {
            const { result } = renderHook(() => useSettings());
            const [settings] = result.current;

            for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof typeof DEFAULT_SETTINGS>) {
                expect(settings).toHaveProperty(key);
            }
        });

        it('returns default values for numeric fields', () => {
            const { result } = renderHook(() => useSettings());
            const [settings] = result.current;

            expect(settings.batterySize).toBe(DEFAULT_SETTINGS.batterySize);
            expect(settings.electricPrice).toBe(DEFAULT_SETTINGS.electricPrice);
            expect(settings.soh).toBe(DEFAULT_SETTINGS.soh);
        });

        it('returns default values for boolean fields', () => {
            const { result } = renderHook(() => useSettings());
            const [settings] = result.current;

            expect(settings.useCalculatedPrice).toBe(DEFAULT_SETTINGS.useCalculatedPrice);
            expect(settings.offPeakEnabled).toBe(DEFAULT_SETTINGS.offPeakEnabled);
        });

        it('returns default array fields as arrays', () => {
            const { result } = renderHook(() => useSettings());
            const [settings] = result.current;

            expect(Array.isArray(settings.chargerTypes)).toBe(true);
            expect(Array.isArray(settings.hiddenTabs)).toBe(true);
        });
    });

    // ─── Loading from storage ──────────────────────────────────────────────────

    describe('loading from storage', () => {
        it('loads stored settings from localStorage', () => {
            const stored = { ...DEFAULT_SETTINGS, batterySize: 77, theme: 'dark' as const };
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(stored));

            const { result } = renderHook(() => useSettings());
            const [settings] = result.current;

            expect(settings.batterySize).toBe(77);
            expect(settings.theme).toBe('dark');
        });

        it('merges partial stored settings with defaults (fills in missing keys)', async () => {
            // Store only a subset of settings
            localStorage.setItem(SETTINGS_KEY, JSON.stringify({ batterySize: 99 }));

            const { result } = renderHook(() => useSettings());

            // After the merge effect runs, all keys should be present
            await waitFor(() => {
                const [settings] = result.current;
                for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof typeof DEFAULT_SETTINGS>) {
                    expect(settings).toHaveProperty(key);
                }
            });
        });

        it('preserves the stored value when merging with defaults', async () => {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify({ electricPrice: 0.99 }));

            const { result } = renderHook(() => useSettings());

            await waitFor(() => {
                const [settings] = result.current;
                expect(settings.electricPrice).toBe(0.99);
            });
        });

        it('does not overwrite stored values with defaults', () => {
            const stored = { ...DEFAULT_SETTINGS, soh: 85 };
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(stored));

            const { result } = renderHook(() => useSettings());
            const [settings] = result.current;

            expect(settings.soh).toBe(85);
        });
    });

    // ─── Updating settings ─────────────────────────────────────────────────────

    describe('updating settings', () => {
        it('updates settings via the object setter', () => {
            const { result } = renderHook(() => useSettings());
            const [, setSettings] = result.current;

            act(() => {
                setSettings({ ...DEFAULT_SETTINGS, batterySize: 77 });
            });

            flushWrites();
            const [updated] = result.current;
            expect(updated.batterySize).toBe(77);
        });

        it('updates settings via a function updater', () => {
            const { result } = renderHook(() => useSettings());
            const [, setSettings] = result.current;

            act(() => {
                setSettings(prev => ({ ...prev, electricPrice: 0.25 }));
            });

            flushWrites();
            expect(result.current[0].electricPrice).toBe(0.25);
        });

        it('persists updated settings to localStorage', () => {
            const { result } = renderHook(() => useSettings());
            const [, setSettings] = result.current;

            act(() => {
                setSettings(prev => ({ ...prev, soh: 90 }));
            });

            flushWrites();
            const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY)!);
            expect(stored.soh).toBe(90);
        });
    });

    // ─── Setter stability ──────────────────────────────────────────────────────

    describe('setter stability', () => {
        it('returns a stable setter reference across re-renders', () => {
            const { result, rerender } = renderHook(() => useSettings());
            const [, firstSetter] = result.current;

            rerender();
            const [, secondSetter] = result.current;

            expect(firstSetter).toBe(secondSetter);
        });
    });
});
