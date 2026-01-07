// BYD Stats - useLayoutMode Hook

import { useState, useEffect } from 'react';

/**
 * Custom hook for detecting layout mode (vertical/horizontal)
 * @returns {{ layoutMode: string, isCompact: boolean }}
 */
export function useLayoutMode() {
    const [layoutMode, setLayoutMode] = useState('vertical');
    const [isCompact, setIsCompact] = useState(false);

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

        updateLayoutMode();
        checkCompact();

        window.addEventListener('resize', updateLayoutMode);
        window.addEventListener('resize', checkCompact);
        window.addEventListener('orientationchange', updateLayoutMode);

        return () => {
            window.removeEventListener('resize', updateLayoutMode);
            window.removeEventListener('resize', checkCompact);
            window.removeEventListener('orientationchange', updateLayoutMode);
        };
    }, []);

    return { layoutMode, isCompact };
}

export default useLayoutMode;
