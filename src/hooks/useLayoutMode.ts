// BYD Stats - useLayoutMode Hook

import { useState, useEffect } from 'react';

export interface LayoutModeInfo {
    layoutMode: 'vertical' | 'horizontal';
    isCompact: boolean;
    isFullscreenBYD: boolean;
}

/**
 * Custom hook for detecting layout mode (vertical/horizontal)
 */
export function useLayoutMode(): LayoutModeInfo {
    const [layoutMode, setLayoutMode] = useState<'vertical' | 'horizontal'>('vertical');
    const [isCompact, setIsCompact] = useState(false);
    const [isFullscreenBYD, setIsFullscreenBYD] = useState(false);

    useEffect(() => {
        const updateLayoutMode = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const isLandscape = width > height;

            // Tablet is typically > 10 inches (600dp ~ 960px in landscape)
            const isTablet = width >= 960 || (width >= 768 && isLandscape);

            if (isTablet && isLandscape) {
                setLayoutMode('horizontal');
            } else {
                setLayoutMode('vertical');
            }
        };

        const checkCompact = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            // Consider compact if width is large enough but height is restricted
            const isCompactSize = w >= 1024 && h <= 800;
            setIsCompact(isCompactSize);

            // Apply dense scale for compact mode
            if (isCompactSize) {
                document.documentElement.style.fontSize = '13.5px';
            } else {
                document.documentElement.style.fontSize = '';
            }
        };

        const checkFullscreenBYD = () => {
            const h = window.innerHeight;
            // Fullscreen BYD mode for car display (1280x720)
            // Activates when height is between 680px and 740px
            const isBYDFullscreen = h >= 680 && h <= 740;
            setIsFullscreenBYD(isBYDFullscreen);
        };

        updateLayoutMode();
        checkCompact();
        checkFullscreenBYD();

        window.addEventListener('resize', updateLayoutMode);
        window.addEventListener('resize', checkCompact);
        window.addEventListener('resize', checkFullscreenBYD);
        window.addEventListener('orientationchange', updateLayoutMode);
        window.addEventListener('orientationchange', checkFullscreenBYD);

        return () => {
            window.removeEventListener('resize', updateLayoutMode);
            window.removeEventListener('resize', checkCompact);
            window.removeEventListener('resize', checkFullscreenBYD);
            window.removeEventListener('orientationchange', updateLayoutMode);
            window.removeEventListener('orientationchange', checkFullscreenBYD);
        };
    }, []);

    return { layoutMode, isCompact, isFullscreenBYD };
}

export default useLayoutMode;
