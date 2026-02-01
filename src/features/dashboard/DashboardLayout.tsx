import React, { memo } from 'react';
import { useLayout } from '@/context/LayoutContext';
import MobileDashboardView from './MobileDashboardView';
import DesktopDashboardView from './DesktopDashboardView';

/**
 * Dashboard Layout Selector
 * Renders the appropriate dashboard view based on the current layout mode.
 * This component is now a thin wrapper that delegates to specialized views.
 */
// Define types for props
interface DashboardLayoutProps {
    layoutMode?: string;
    isCompact?: boolean;
    activeTab: string;
    tabs: any[];
    handleTabClick?: (id: string) => void;
    isTransitioning: boolean;
    fadingTab?: string;
    backgroundLoad?: boolean;
    onTripSelect?: (trip: any) => void;
    onChargeSelect?: (charge: any) => void;
    setSwipeContainer?: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
}

const DashboardLayout = memo((props: DashboardLayoutProps) => {
    const { layoutMode } = useLayout();

    if (layoutMode === 'vertical') {
        return <MobileDashboardView {...props} setSwipeContainer={props.setSwipeContainer} />;
    }

    return <DesktopDashboardView {...props} />;
});

DashboardLayout.displayName = 'DashboardLayout';

export default DashboardLayout;


