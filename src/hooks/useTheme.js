// BYD Stats - useTheme Hook

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { logger } from '@core/logger';

/**
 * Custom hook for managing app theme
 * @param {string} theme - Theme setting: 'auto', 'light', or 'dark'
 */
export function useTheme(theme) {
    const isNative = Capacitor.isNativePlatform();

    useEffect(() => {
        const applyTheme = (isDark) => {
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
                    .catch(e => logger.error('StatusBar error:', e));
            }
        };

        const getSystemTheme = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (theme === 'auto') {
            // Apply initial theme
            applyTheme(getSystemTheme());

            // Listen for system changes
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handler = (e) => applyTheme(e.matches);

            mediaQuery.addEventListener('change', handler);
            return () => mediaQuery.removeEventListener('change', handler);
        } else {
            // Manual theme
            applyTheme(theme === 'dark');
        }
    }, [theme, isNative]);
}

export default useTheme;


