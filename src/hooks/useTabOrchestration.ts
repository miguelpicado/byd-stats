/**
 * useTabOrchestration
 *
 * Self-contained hook that handles tab navigation, swipe gestures,
 * and chart dimension calculations. Extracted from useAppOrchestrator
 * for single-responsibility.
 */
import { useApp } from '@/context/AppContext';
import { useLayout } from '@/context/LayoutContext';
import { useData } from '@/providers/DataProvider';
import { useChartDimensions } from '@hooks/useChartDimensions';
import { useTabNavigation } from '@hooks/useTabNavigation';
import { useSwipeGesture } from '@hooks/useSwipeGesture';

export const useTabOrchestration = () => {
    const { settings } = useApp();
    const { layoutMode, isCompact, isFullscreenBYD, isVertical, isNative } = useLayout();
    const { isAnyModalOpen } = useData();

    const { activeTab, fadingTab, isTransitioning, handleTabClick, tabs } = useTabNavigation({
        settings,
        isVertical,
        isNative,
    });

    const setSwipeContainer = useSwipeGesture({
        activeTab,
        handleTabClick,
        isTransitioning,
        tabs,
        layoutMode,
        isModalOpen: isAnyModalOpen,
    });

    const chartDimensions = useChartDimensions({ isVertical, isFullscreenBYD, isCompact });

    return {
        activeTab,
        fadingTab,
        isTransitioning,
        handleTabClick,
        tabs,
        setSwipeContainer,
        chartDimensions,
    };
};
