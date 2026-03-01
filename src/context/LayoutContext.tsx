/* eslint-disable react-refresh/only-export-components */
// BYD Stats - Layout Context
// Manages layout state separately from app settings to prevent unnecessary re-renders

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';

interface LayoutContextType {
    layoutMode: 'vertical' | 'horizontal';
    setLayoutMode: (mode: 'vertical' | 'horizontal') => void;
    isCompact: boolean;
    isFullscreenBYD: boolean;
    isVertical: boolean;
    isHorizontal: boolean;
    isLargerCard: boolean;
    isNative: boolean;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

/**
 * Hook to access layout context
 * @returns {Object} Layout state and utilities
 */
export const useLayout = (): LayoutContextType => {
    const context = useContext(LayoutContext);
    if (!context) {
        throw new Error('useLayout must be used within a LayoutProvider');
    }
    return context;
};

/**
 * Provider component for layout state
 * Handles responsive layout detection and mode switching
 */
export const LayoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [layoutMode, setLayoutMode] = useState<'vertical' | 'horizontal'>('vertical');
    const [isCompact, setIsCompact] = useState(false);
    const [isFullscreenBYD, setIsFullscreenBYD] = useState(false);

    useEffect(() => {
        const checkLayout = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;

            // Layout Mode Logic
            const isLandscape = w > h;
            // Tablet is typically > 10 inches (600dp ~ 960px in landscape)
            // Or smaller tablets > 768px in landscape
            const isTablet = w >= 960 || (w >= 768 && isLandscape);

            let newLayoutMode: 'vertical' | 'horizontal' = 'vertical';
            if (isTablet && isLandscape) {
                newLayoutMode = 'horizontal';
            }

            // Force vertical mode if debugging APK on desktop
            const searchParams = new URLSearchParams(window.location.search);
            const isModeApk = searchParams.get('mode') === 'apk' || window.location.href.includes('mode=apk');
            if (isModeApk) {
                newLayoutMode = 'vertical';
            }

            setLayoutMode(newLayoutMode);

            // Sub-modes (Compact / FullscreenBYD) - ONLY enabled in Horizontal Mode
            if (newLayoutMode === 'horizontal') {
                // Fullscreen BYD mode for car display (1280x720)
                // Activates when height is between 680px and 740px
                const isBYDFullscreen = h >= 680 && h <= 740;
                setIsFullscreenBYD(isBYDFullscreen);

                // Consider compact if width is large enough but height is restricted (e.g. 1280x720)
                const isCompactSize = w >= 1024 && h <= 680;
                setIsCompact(isCompactSize);

                // Apply dense scale for compact mode
                if (isCompactSize) {
                    document.documentElement.classList.add('compact-mode');
                } else {
                    document.documentElement.classList.remove('compact-mode');
                }
            } else {
                // In vertical mode, strictly disable these
                setIsFullscreenBYD(false);
                setIsCompact(false);
                document.documentElement.classList.remove('compact-mode');
            }
        };

        checkLayout();

        // ResizeObserver for reliable viewport detection (catches DevTools emulation, PWA changes)
        const resizeObserver = new ResizeObserver(() => {
            checkLayout();
        });
        resizeObserver.observe(document.documentElement);

        window.addEventListener('orientationchange', checkLayout);
        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('orientationchange', checkLayout);
        };
    }, []);

    // Memoize the context value to prevent unnecessary re-renders
    const value = useMemo(() => {
        // Allow forcing native mode via ?mode=apk for testing
        // Check both search params and href to handle HashRouter cases where ? might be after #
        const searchParams = new URLSearchParams(window.location.search);
        const isModeApk = searchParams.get('mode') === 'apk' || window.location.href.includes('mode=apk');
        // Initial detection
        const isNativeDetected = isModeApk || window.Capacitor?.isNativePlatform() === true;

        return {
            layoutMode,
            setLayoutMode,
            isCompact,
            isFullscreenBYD,
            isNative: isNativeDetected,
            // Convenience computed values
            isVertical: layoutMode === 'vertical',
            isHorizontal: layoutMode === 'horizontal',
            isLargerCard: isCompact && layoutMode === 'horizontal'
        };
    }, [layoutMode, isCompact, isFullscreenBYD]);

    return (
        <LayoutContext.Provider value={value}>
            {children}
        </LayoutContext.Provider>
    );
};

export default LayoutContext;
