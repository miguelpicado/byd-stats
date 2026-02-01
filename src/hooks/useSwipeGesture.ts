import { useEffect, useRef, useState, Dispatch, SetStateAction } from 'react';

interface Tab {
    id: string;
    label: string;
    icon?: any;
}

interface UseSwipeGestureParams {
    activeTab: string;
    handleTabClick: (tabId: string) => void;
    isTransitioning: boolean;
    tabs: Tab[];
    layoutMode: 'vertical' | 'horizontal';
    minSwipeDistance?: number;
    isModalOpen?: boolean;
}

/**
 * Hook to handle swipe gestures for tab navigation
 * Supports both vertical and horizontal layouts with scroll prevention logic
 */
export const useSwipeGesture = ({
    activeTab,
    handleTabClick,
    isTransitioning,
    tabs,
    layoutMode,
    minSwipeDistance = 30,
    isModalOpen = false
}: UseSwipeGestureParams): Dispatch<SetStateAction<HTMLElement | null>> => {
    const [swipeContainer, setSwipeContainer] = useState<HTMLElement | null>(null);
    const touchStartRef = useRef<number | null>(null);
    const touchStartYRef = useRef<number | null>(null);

    // Refs to hold latest values (avoid re-registering listeners)
    const activeTabRef = useRef(activeTab);
    const isTransitioningRef = useRef(isTransitioning);
    const handleTabClickRef = useRef(handleTabClick);
    const layoutModeRef = useRef(layoutMode);

    // Keep refs updated
    useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
    useEffect(() => { isTransitioningRef.current = isTransitioning; }, [isTransitioning]);
    useEffect(() => { handleTabClickRef.current = handleTabClick; }, [handleTabClick]);
    useEffect(() => { layoutModeRef.current = layoutMode; }, [layoutMode]);

    // Ref for modal state
    const isModalOpenRef = useRef(isModalOpen);
    useEffect(() => { isModalOpenRef.current = isModalOpen; }, [isModalOpen]);

    useEffect(() => {
        // Require container to be available
        if (!swipeContainer) return;

        const container = swipeContainer;
        let swipeDirection: 'horizontal' | 'vertical' | null = null;
        let initialScrollTop = 0;

        const handleTouchStart = (e: TouchEvent) => {
            // Disable swipe when modal is open
            if (isModalOpenRef.current) return;
            if (isTransitioningRef.current) return;
            const touch = e.touches[0];
            touchStartRef.current = touch.clientX;
            touchStartYRef.current = touch.clientY;
            swipeDirection = null; // Reset direction on new touch
            // Capture initial scroll position at start of touch
            initialScrollTop = container.scrollTop;
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (touchStartRef.current === null || touchStartYRef.current === null || isTransitioningRef.current) return;

            const touch = e.touches[0];
            const diffX = Math.abs(touch.clientX - touchStartRef.current);
            const diffY = Math.abs(touch.clientY - touchStartYRef.current);

            // Detect direction only once
            if (!swipeDirection) {
                if (diffX > 10 || diffY > 10) { // Add threshold for initial direction lock
                    swipeDirection = diffX > diffY ? 'horizontal' : 'vertical';
                }
            }

            const currentMode = layoutModeRef.current;

            // In vertical mode: prevent scroll if horizontal swipe (for tab change)
            if (currentMode === 'vertical' && swipeDirection === 'horizontal') {
                if (e.cancelable) e.preventDefault();
            }
            // In horizontal mode: ONLY prevent native scroll if:
            // 1. We are at top of scroll (scrollTop <= 5)
            // 2. Gesture is DOWN (swipe down = go to previous tab)
            // In all other cases, allow native scroll
            else if (currentMode === 'horizontal' && swipeDirection === 'vertical') {
                const actualDiffY = touch.clientY - touchStartYRef.current;
                const isSwipingDown = actualDiffY > 0;
                const wasAtTop = initialScrollTop <= 5;

                // Only prevent if we were at top AND going down (prev tab)
                if (wasAtTop && isSwipingDown && diffY > 10) {
                    if (e.cancelable) e.preventDefault();
                }
                // If conditions not met, native scroll works normally
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (touchStartRef.current === null || touchStartYRef.current === null) return;

            const touch = e.changedTouches[0];
            const diffX = touch.clientX - touchStartRef.current;
            const diffY = touch.clientY - touchStartYRef.current;
            const currentMode = layoutModeRef.current;

            const currentIndex = tabs.findIndex(t => t.id === activeTabRef.current);

            if (currentMode === 'vertical') {
                // Vertical mode: horizontal swipe to change tabs
                if (swipeDirection === 'horizontal' && Math.abs(diffX) > minSwipeDistance) {
                    if (diffX < 0 && currentIndex < tabs.length - 1) {
                        // Swipe left - next tab
                        handleTabClickRef.current(tabs[currentIndex + 1].id);
                    } else if (diffX > 0 && currentIndex > 0) {
                        // Swipe right - prev tab
                        handleTabClickRef.current(tabs[currentIndex - 1].id);
                    }
                }
            } else {
                // Horizontal mode:
                // 1. Horizontal swipes to change tabs (standard)
                if (swipeDirection === 'horizontal' && Math.abs(diffX) > minSwipeDistance) {
                    if (diffX < 0 && currentIndex < tabs.length - 1) {
                        // Swipe left - next tab
                        handleTabClickRef.current(tabs[currentIndex + 1].id);
                    } else if (diffX > 0 && currentIndex > 0) {
                        // Swipe right - prev tab
                        handleTabClickRef.current(tabs[currentIndex - 1].id);
                    }
                }

                // 2. Vertical swipes (special scroll navigation)
                if (swipeDirection === 'vertical' && Math.abs(diffY) > minSwipeDistance) {
                    const wasAtTop = initialScrollTop <= 5;
                    const scrollHeight = container.scrollHeight;
                    const clientHeight = container.clientHeight;
                    const wasAtBottom = initialScrollTop + clientHeight >= scrollHeight - 5;

                    if (diffY > 0 && currentIndex > 0 && wasAtTop) {
                        // Swipe down + at top = prev tab
                        handleTabClickRef.current(tabs[currentIndex - 1].id);
                    } else if (diffY < 0 && currentIndex < tabs.length - 1 && wasAtBottom) {
                        // Swipe up + at bottom = next tab
                        handleTabClickRef.current(tabs[currentIndex + 1].id);
                    }
                }
            }

            // Reset
            touchStartRef.current = null;
            touchStartYRef.current = null;
            swipeDirection = null;
            initialScrollTop = 0;
        };

        // Add event listeners
        // Use non-passive on touchmove to be able to prevent native scroll when needed
        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [layoutMode, tabs, minSwipeDistance, swipeContainer]);

    return setSwipeContainer;
};

export default useSwipeGesture;
