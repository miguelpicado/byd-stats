import React, { memo, FC } from 'react';
import { useLayout } from '@/context/LayoutContext';
import MobileDashboardView from './MobileDashboardView';
import DesktopDashboardView from './DesktopDashboardView';
import { Trip, Charge } from '@/types';
import { IconProps } from '@components/Icons';

/**
 * Dashboard Layout Selector
 * Renders the appropriate dashboard view based on the current layout mode.
 * This component is now a thin wrapper that delegates to specialized views.
 */

interface Tab {
    id: string;
    label: string;
    icon: FC<IconProps>;
}

// Define types for props
interface DashboardLayoutProps {
    layoutMode?: string;
    isCompact?: boolean;
    activeTab: string;
    tabs: Tab[];
    handleTabClick?: (id: string) => void;
    isTransitioning: boolean;
    fadingTab?: string;
    backgroundLoad?: boolean;
    onTripSelect?: (trip: Trip) => void;
    onChargeSelect?: (charge: Charge) => void;
    setSwipeContainer?: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
}

const NOOP_TRIP = (_trip: Trip) => { };
const NOOP_CHARGE = (_charge: Charge) => { };

const DashboardLayout = memo((props: DashboardLayoutProps) => {
    const { layoutMode } = useLayout();

    if (layoutMode === 'vertical') {
        return <MobileDashboardView {...props} setSwipeContainer={props.setSwipeContainer} />;
    }

    return <DesktopDashboardView
        {...props}
        fadingTab={props.fadingTab || ''}
        backgroundLoad={props.backgroundLoad || false}
        onTripSelect={props.onTripSelect || NOOP_TRIP}
        onChargeSelect={props.onChargeSelect || NOOP_CHARGE}
    />;
});

DashboardLayout.displayName = 'DashboardLayout';

export default DashboardLayout;


