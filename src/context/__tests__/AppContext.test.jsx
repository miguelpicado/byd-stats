import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { AppProvider, useApp } from '../AppContext';

// Mock logger
vi.mock('@core/logger', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    }
}));

// Mock CarContext
vi.mock('../CarContext', () => ({
    useCar: () => ({ activeCarId: 'test-car' })
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key) => key,
        i18n: {
            changeLanguage: () => Promise.resolve(),
            language: 'en'
        }
    }),
    initReactI18next: {
        type: '3rdParty',
        init: () => { }
    }
}));



describe('AppContext', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.clearAllMocks();
    });

    const wrapper = ({ children }) => <AppProvider>{children}</AppProvider>;

    it('should initialize with default settings if localStorage is empty', () => {
        const { result } = renderHook(() => useApp(), { wrapper });

        expect(result.current.settings.batterySize).toBe(60.48);
        expect(result.current.settings.theme).toBe('auto');
        expect(result.current.settings.chargerTypes).toHaveLength(4);
    });

    it('should load settings from localStorage if available', () => {
        const savedSettings = {
            batterySize: 75,
            theme: 'dark',
            carModel: 'BYD Seal'
        };
        window.localStorage.setItem('byd_settings_test-car', JSON.stringify(savedSettings));

        const { result } = renderHook(() => useApp(), { wrapper });

        expect(result.current.settings.batterySize).toBe(75);
        expect(result.current.settings.theme).toBe('dark');
        expect(result.current.settings.carModel).toBe('BYD Seal');
        // Check merged defaults
        expect(result.current.settings.chargerTypes).toHaveLength(4);
    });

    it('should update settings and persist to localStorage', () => {
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.updateSettings({ carModel: 'BYD Atto 3', theme: 'light' });
        });

        expect(result.current.settings.carModel).toBe('BYD Atto 3');
        expect(result.current.settings.theme).toBe('light');

        const saved = JSON.parse(window.localStorage.getItem('byd_settings_test-car'));
        expect(saved.carModel).toBe('BYD Atto 3');
        expect(saved.theme).toBe('light');
    });

    it('should handle functional updates', () => {
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.updateSettings(prev => ({ ...prev, batterySize: prev.batterySize + 10 }));
        });

        expect(result.current.settings.batterySize).toBeCloseTo(70.48);
    });

    it('should validate and merge settings on update', () => {
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            // Pass partial invalid settings (like missing keys)
            result.current.updateSettings({ batterySize: 100 });
        });

        expect(result.current.settings.batterySize).toBe(100);
        // Ensure other keys are preserved from defaults or previous state
        expect(result.current.settings.theme).toBe('auto');
        expect(result.current.settings.chargerTypes).toHaveLength(4);

        const saved = JSON.parse(window.localStorage.getItem('byd_settings_test-car'));
        expect(saved.batterySize).toBe(100);
    });

    it('should apply theme classes to document element', () => {
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.updateSettings({ theme: 'dark' });
        });
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.classList.contains('light')).toBe(false);

        act(() => {
            result.current.updateSettings({ theme: 'light' });
        });
        expect(document.documentElement.classList.contains('light')).toBe(true);
        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should throw error if used outside AppProvider', () => {
        // Suppress console.error for this test as throwing in a hook inside renderHook will log
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        expect(() => {
            renderHook(() => useApp());
        }).toThrow('useApp must be used within an AppProvider');

        consoleSpy.mockRestore();
    });
});

