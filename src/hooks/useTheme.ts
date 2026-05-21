// BYD Stats - useTheme Hook

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { logger } from '@core/logger';

// Add type definition for StatusBar if needed, or act as if global
// Assuming window.StatusBar exists in Capacitor context if plugin loaded
declare global {
    interface Window {
        StatusBar?: any;
    }
}

/**
 * Custom hook for managing app theme
 * @param {string} theme - Theme setting: 'auto', 'light', or 'dark'
 */
export function useTheme(theme: string) {
    const isNative = Capacitor.isNativePlatform();

    useEffect(() => {
        const applyTheme = (isDark: boolean) => {
            // 1. CSS Classes
            if (isDark) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }

            // 2. Browser color-scheme
            document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';

            // 3. Native StatusBar
            if (isNative && window.StatusBar) {
                window.StatusBar.setStyle({ style: isDark ? 'DARK' : 'LIGHT' })
                    .catch((e: any) => logger.error('StatusBar error:', e));
            }
        };

        const getSystemTheme = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (theme === 'auto') {
            // Apply initial theme
            applyTheme(getSystemTheme());

            // Listen for system changes
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);

            mediaQuery.addEventListener('change', handler);
            return () => mediaQuery.removeEventListener('change', handler);
        } else {
            // Manual theme
            applyTheme(theme === 'dark');
        }
    }, [theme, isNative]);
}

export default useTheme;
