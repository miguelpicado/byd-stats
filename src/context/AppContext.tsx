/* eslint-disable react-refresh/only-export-components */
// BYD Stats - App Context
// Manages application settings and theme (layout moved to LayoutContext)

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { logger } from '@core/logger';
import { useCar } from './CarContext';
import { SETTINGS_KEY as BASE_SETTINGS_KEY, DEFAULT_SETTINGS, DEFAULT_CHARGER_TYPES } from '@core/constants';
import { Settings } from '@/types';

interface AppContextType {
    settings: Settings;
    updateSettings: (newSettings: Partial<Settings> | ((prev: Settings) => Partial<Settings>)) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

/**
 * Hook to access app context (settings and theme)
 * @returns {Object} Settings state and utilities
 */
export const useApp = (): AppContextType => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};

/**
 * Provider component for app settings
 * Handles settings persistence and theme management
 */
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { activeCarId } = useCar();
    const settingsKey = activeCarId ? `${BASE_SETTINGS_KEY}_${activeCarId}` : null;

    // --- Settings State ---
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

    // Load settings when activeCarId (key) changes
    useEffect(() => {
        if (!settingsKey) {
            // If no car selected, maybe default or empty?
            // Keep default settings
            setSettings(DEFAULT_SETTINGS);
            return;
        }

        try {
            const saved = localStorage.getItem(settingsKey);
            const loaded = saved ? JSON.parse(saved) : {};

            // Migration: Ensure smartChargingPreferences is an array (was object in previous version)
            if (loaded.smartChargingPreferences && !Array.isArray(loaded.smartChargingPreferences)) {
                loaded.smartChargingPreferences = [];
            }

            // Merge with defaults
            setSettings({ ...DEFAULT_SETTINGS, ...loaded });
        } catch (e) {
            logger.error('Error loading settings:', e);
            setSettings(DEFAULT_SETTINGS);
        }
    }, [settingsKey]);


    /**
     * Update settings with validation and persistence
     * @param {Object|Function} newSettings - New settings object or updater function
     */
    const updateSettings = (newSettings: Partial<Settings> | ((prev: Settings) => Partial<Settings>)) => {
        setSettings(prev => {
            // Handle both functional updates and direct values
            const updated = typeof newSettings === 'function' ? newSettings(prev) : newSettings;

            // Defensive: Ensure updated is a valid settings object
            if (!updated || typeof updated !== 'object' || Array.isArray(updated)) {
                logger.warn('updateSettings received invalid settings, ignoring:', updated);
                return prev;
            }

            // Merge with defaults to ensure all fields exist
            const validated: Settings = {
                carModel: updated.carModel ?? prev.carModel ?? '',
                licensePlate: updated.licensePlate ?? prev.licensePlate ?? '',
                batterySize: Number(updated.batterySize ?? prev.batterySize ?? 60.48),
                soh: updated.soh ?? prev.soh ?? 100,
                electricPrice: updated.electricPrice ?? prev.electricPrice ?? 0.15,
                fuelPrice: updated.fuelPrice ?? prev.fuelPrice ?? 1.50,
                useCalculatedPrice: updated.useCalculatedPrice ?? prev.useCalculatedPrice ?? false,
                useCalculatedFuelPrice: updated.useCalculatedFuelPrice ?? prev.useCalculatedFuelPrice ?? false,
                priceStrategy: updated.priceStrategy ?? prev.priceStrategy ?? 'custom',
                fuelPriceStrategy: updated.fuelPriceStrategy ?? prev.fuelPriceStrategy ?? 'custom',
                theme: updated.theme ?? prev.theme ?? 'auto',
                chargerTypes: updated.chargerTypes ?? prev.chargerTypes ?? DEFAULT_CHARGER_TYPES,
                hiddenTabs: updated.hiddenTabs ?? prev.hiddenTabs ?? [],
                odometerOffset: updated.odometerOffset ?? prev.odometerOffset ?? 0,
                thermalStressFactor: updated.thermalStressFactor ?? prev.thermalStressFactor ?? 1.0,
                mfgDate: updated.mfgDate ?? prev.mfgDate ?? '',
                mfgDateDisplay: updated.mfgDateDisplay ?? prev.mfgDateDisplay ?? '',
                sohMode: updated.sohMode ?? prev.sohMode ?? 'manual',
                // Home Charging / Off-Peak
                homeChargerRating: updated.homeChargerRating ?? prev.homeChargerRating ?? 8,
                offPeakEnabled: updated.offPeakEnabled ?? prev.offPeakEnabled ?? false,
                offPeakStart: updated.offPeakStart ?? prev.offPeakStart ?? '00:00',
                offPeakEnd: updated.offPeakEnd ?? prev.offPeakEnd ?? '08:00',
                offPeakStartWeekend: updated.offPeakStartWeekend ?? prev.offPeakStartWeekend,
                offPeakEndWeekend: updated.offPeakEndWeekend ?? prev.offPeakEndWeekend,
                offPeakPrice: updated.offPeakPrice ?? prev.offPeakPrice ?? 0.08,

                // HITL Preferences
                smartChargingPreferences: Array.isArray(updated.smartChargingPreferences)
                    ? updated.smartChargingPreferences
                    : (Array.isArray(prev.smartChargingPreferences) ? prev.smartChargingPreferences : [])
            };

            if (settingsKey) {
                try {
                    localStorage.setItem(settingsKey, JSON.stringify(validated));
                } catch (e) {
                    logger.warn('Settings save failed (quota or access)', e);
                }
            }
            return validated;
        });
    };

    // --- Theme Management ---
    useEffect(() => {
        const root = window.document.documentElement;
        const applyTheme = (theme: string | undefined) => {
            root.classList.remove('light', 'dark');
            if (theme === 'system' || theme === 'auto' || !theme) {
                const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                root.classList.add(systemDark ? 'dark' : 'light');
            } else {
                root.classList.add(theme);
            }
        };
        applyTheme(settings.theme);

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (settings.theme === 'auto' || settings.theme === 'system') {
                applyTheme('auto');
            }
        };
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [settings.theme]);

    // Memoize context value to prevent unnecessary re-renders
    const value = useMemo(() => ({
        settings,
        updateSettings
    }), [settings]);

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

export default AppContext;
