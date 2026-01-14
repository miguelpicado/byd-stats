// BYD Stats - App Context
// Manages application settings and theme (layout moved to LayoutContext)

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { logger } from '../utils/logger';

const AppContext = createContext();

/**
 * Hook to access app context (settings and theme)
 * @returns {Object} Settings state and utilities
 */
export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};

// Default settings configuration
const DEFAULT_SETTINGS = {
    carModel: '',
    licensePlate: '',
    insurancePolicy: '',
    batterySize: 60.48,
    soh: 100,
    electricityPrice: 0.15,
    theme: 'auto'
};

/**
 * Provider component for app settings
 * Handles settings persistence and theme management
 */
export const AppProvider = ({ children }) => {
    // --- Settings State ---
    const [settings, setSettings] = useState(() => {
        try {
            const saved = localStorage.getItem('byd_settings');
            return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
        } catch (e) {
            logger.error('Error loading settings:', e);
            return DEFAULT_SETTINGS;
        }
    });

    /**
     * Update settings with validation and persistence
     * @param {Object|Function} newSettings - New settings object or updater function
     */
    const updateSettings = (newSettings) => {
        setSettings(prev => {
            // Handle both functional updates and direct values
            const updated = typeof newSettings === 'function' ? newSettings(prev) : newSettings;

            // Defensive: Ensure updated is a valid settings object
            if (!updated || typeof updated !== 'object' || Array.isArray(updated)) {
                logger.warn('updateSettings received invalid settings, ignoring:', updated);
                return prev;
            }

            // Merge with defaults to ensure all fields exist
            const validated = {
                carModel: updated.carModel ?? prev.carModel ?? '',
                licensePlate: updated.licensePlate ?? prev.licensePlate ?? '',
                insurancePolicy: updated.insurancePolicy ?? prev.insurancePolicy ?? '',
                batterySize: updated.batterySize ?? prev.batterySize ?? 60.48,
                soh: updated.soh ?? prev.soh ?? 100,
                electricityPrice: updated.electricityPrice ?? prev.electricityPrice ?? 0.15,
                theme: updated.theme ?? prev.theme ?? 'auto'
            };

            localStorage.setItem('byd_settings', JSON.stringify(validated));
            return validated;
        });
    };

    // --- Theme Management ---
    useEffect(() => {
        const root = window.document.documentElement;
        const applyTheme = (theme) => {
            root.classList.remove('light', 'dark');
            if (theme === 'system' || theme === 'auto') {
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
