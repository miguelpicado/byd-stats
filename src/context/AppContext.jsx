import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};

export const AppProvider = ({ children }) => {
    // --- Layout State ---
    const [layoutMode, setLayoutMode] = useState('vertical');
    const [isCompact, setIsCompact] = useState(false);

    useEffect(() => {
        const checkCompact = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            // Consider compact if width is large enough but height is restricted (e.g. 1280x720)
            const isCompactSize = w >= 1024 && h <= 800;
            setIsCompact(isCompactSize);

            // Apply dense scale for compact mode
            if (isCompactSize) {
                document.documentElement.style.fontSize = '13.5px';
            } else {
                document.documentElement.style.fontSize = '';
            }

            // Layout Mode Logic
            const isLandscape = w > h;
            // Tablet is typically > 10 inches (600dp ~ 960px in landscape)
            const isTablet = w >= 960 || (w >= 768 && isLandscape);
            if (isTablet && isLandscape) {
                setLayoutMode('horizontal');
            } else {
                setLayoutMode('vertical');
            }
        };

        checkCompact();
        window.addEventListener('resize', checkCompact);
        window.addEventListener('orientationchange', checkCompact);
        return () => {
            window.removeEventListener('resize', checkCompact);
            window.removeEventListener('orientationchange', checkCompact);
        };
    }, []);

    // --- Settings State ---
    const [settings, setSettings] = useState(() => {
        try {
            const saved = localStorage.getItem('byd_settings');
            return saved ? JSON.parse(saved) : {
                carModel: '',
                licensePlate: '',
                insurancePolicy: '',
                batterySize: 60.48,
                soh: 100,
                electricityPrice: 0.15,
                theme: 'auto'
            };
        } catch (e) {
            console.error('Error loading settings:', e);
            return {
                carModel: '',
                licensePlate: '',
                insurancePolicy: '',
                batterySize: 60.48,
                soh: 100,
                electricityPrice: 0.15,
                theme: 'auto'
            };
        }
    });

    const updateSettings = (newSettings) => {
        setSettings(prev => {
            // Handle both functional updates and direct values
            const updated = typeof newSettings === 'function' ? newSettings(prev) : newSettings;
            localStorage.setItem('byd_settings', JSON.stringify(updated));
            return updated;
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

    const value = {
        settings,
        updateSettings, // Compatible with setSettings signature
        layoutMode,
        setLayoutMode,
        isCompact
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};
