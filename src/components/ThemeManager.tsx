import { useEffect } from 'react';
import { useApp } from '../context/AppContext';

const ThemeManager = () => {
    const { settings } = useApp();

    // Theme management - UNIFIED AND ROBUST
    useEffect(() => {
        const applyTheme = (isDark: boolean) => {
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
            let colorSchemeMeta: HTMLMetaElement | null = document.querySelector('meta[name="color-scheme"]');
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
        };

        const getSystemTheme = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (settings.theme === 'auto') {
            // Apply initial theme
            applyTheme(getSystemTheme());

            // Listen for system changes
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);

            mediaQuery.addEventListener('change', handler);
            return () => mediaQuery.removeEventListener('change', handler);
        } else {
            // Manual theme
            applyTheme(settings.theme === 'dark');
        }
    }, [settings.theme]);

    return null;
};

export default ThemeManager;


