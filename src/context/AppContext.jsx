import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AppContext = createContext();

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};

export const AppProvider = ({ children }) => {
    // Settings state with localStorage persistence
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
            console.error('Error loading settings, using defaults:', e);
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

    // Save settings to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('byd_settings', JSON.stringify(settings));

        // Apply theme
        const root = window.document.documentElement;
        if (settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }, [settings]);

    // Layout mode state
    const [layoutMode, setLayoutMode] = useState('vertical');
    const [isCompact, setIsCompact] = useState(false);

    // Detect compact resolution (targeting ~1280x548/720) and layout mode
    useEffect(() => {
        const checkLayout = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;

            // Compact mode check
            const isCompactSize = w >= 1024 && h <= 800;
            setIsCompact(isCompactSize);

            // Apply dense scale for compact mode
            if (isCompactSize) {
                document.documentElement.style.fontSize = '13.5px';
            } else {
                document.documentElement.style.fontSize = '';
            }

            // Layout mode check (Tablet/Vertical)
            // Basic check: if width > 768 check orientation, but user logic favored specific conditions
            // In App.jsx logic was:
            // const isTablet = w >= 768 && w <= 1024; // simplified from user code which might have been more complex
            // Actually user code used 'isTablet' variable but I don't see it defined in my snippets?
            // Wait, in Step 114: if (isTablet && isLandscape) setLayoutMode('horizontal') else 'vertical'
            // I need to implement robust logic here.

            const isLandscape = w > h;
            // Assume tablet/desktop usually means horizontal if landscape and wide enough
            // Replicating logic found in App.jsx (inferred):
            // If width >= 1024 (desktop/laptop) -> horizontal
            // If width >= 768 (tablet) -> can be horizontal if landscape

            if (w >= 1024) {
                setLayoutMode('horizontal');
            } else if (w >= 768 && isLandscape) {
                setLayoutMode('horizontal');
            } else {
                setLayoutMode('vertical');
            }
        };

        checkLayout();
        window.addEventListener('resize', checkLayout);
        window.addEventListener('orientationchange', checkLayout);

        return () => {
            window.removeEventListener('resize', checkLayout);
            window.removeEventListener('orientationchange', checkLayout);
        };
    }, []);

    const updateSettings = useCallback((newSettings) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    }, []);

    const value = {
        settings,
        updateSettings,
        layoutMode,
        isCompact
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export default AppContext;
