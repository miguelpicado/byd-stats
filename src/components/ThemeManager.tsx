import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useApp } from '../context/AppContext';
import { logger } from '@core/logger';

const ThemeManager = () => {
    const { settings } = useApp();
    const isNative = Capacitor.isNativePlatform();

    // Theme management - UNIFIED AND ROBUST
    useEffect(() => {
        const applyTheme = (isDark) => {
            // 1. CSS Classes
            if (isDark) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }

            // 2. Browser color-scheme (prevents system override)
            document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';

            // 2.1 Force meta tag to match active theme (critical for car systems)
            // This prevents the car's dark mode from overriding app's light theme
            let colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
            if (!colorSchemeMeta) {
                colorSchemeMeta = document.createElement('meta');
                colorSchemeMeta.name = 'color-scheme';
                document.head.appendChild(colorSchemeMeta);
            }
            // Set to ONLY the active theme, not "light dark" which allows system override
            colorSchemeMeta.content = isDark ? 'dark' : 'light';

            // 3. PWA theme-color meta tag (for status bar in PWA)
            let themeColorMeta = document.querySelector('meta[name="theme-color"]');
            if (themeColorMeta) {
                // Dark theme: dark slate background
                // Light theme: light background
                themeColorMeta.setAttribute('content', isDark ? '#0f172a' : '#f8fafc');
            }

            // 4. Native StatusBar (for Capacitor apps)
            if (isNative && window.StatusBar) {
                window.StatusBar.setStyle({ style: isDark ? 'LIGHT' : 'DARK' })
                    .catch(e => logger.error('StatusBar error:', e));
            }
        };

        const getSystemTheme = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (settings.theme === 'auto') {
            // Apply initial theme
            applyTheme(getSystemTheme());

            // Listen for system changes
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handler = (e) => applyTheme(e.matches);

            mediaQuery.addEventListener('change', handler);
            return () => mediaQuery.removeEventListener('change', handler);
        } else {
            // Manual theme
            applyTheme(settings.theme === 'dark');
        }
    }, [settings.theme, isNative]);

    return null;
};

export default ThemeManager;


