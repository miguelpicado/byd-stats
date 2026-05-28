import React, { Suspense, lazy } from 'react';
// Components
import BaseLayout from '@components/layout/MainLayout';
import Header from '@features/navigation/Header';
import TabNavigation from '@features/navigation/TabNavigation';
import DesktopSidebar from '@components/layout/DesktopSidebar';
import DashboardLayout from '@features/dashboard/DashboardLayout';
import ErrorBoundary from '@components/common/ErrorBoundary';
import ModalCoordinator from '@components/common/ModalCoordinator';

// Lazy load
const PWAManagerLazy = lazy(() => import('@components/PWAManager'));

interface MainLayoutProps {
    layoutMode: string;
    isCompact?: boolean;
    activeTab: string;
    tabs: any[];
    handleTabClick: (id: string) => void;
    isTransitioning: boolean;
    fadingTab?: string;
    backgroundLoad?: boolean;
    onTripSelect?: (trip: any) => void;
    onChargeSelect?: (charge: any) => void;
    setSwipeContainer?: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
}

const MainLayout = ({
    layoutMode,
    isCompact,
    activeTab,
    tabs,
    handleTabClick,
    isTransitioning,
    fadingTab,
    backgroundLoad,
    onTripSelect,
    onChargeSelect,
    setSwipeContainer
}: MainLayoutProps) => {
    return (
        <BaseLayout>
            <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300">

                {/* Header Feature */}
                <Header />

                {/* Content Area with Conditional Sidebar */}
                <div className="flex-1 overflow-hidden" style={{ display: layoutMode === 'horizontal' ? 'flex' : 'block' }}>

                    {/* Horizontal Layout: Sidebar */}
                    {layoutMode === 'horizontal' && (
                        <DesktopSidebar
                            tabs={tabs}
                            activeTab={activeTab}
                            handleTabClick={handleTabClick}
                        />
                    )}

                    {/* Main Content (Dashboard) */}
                    <div className={layoutMode === 'horizontal' ? 'flex-1 overflow-y-auto' : 'max-w-7xl mx-auto h-full w-full'}>
                        <ErrorBoundary>
                            <DashboardLayout
                                activeTab={activeTab}
                                tabs={tabs}
                                isTransitioning={isTransitioning}
                                fadingTab={fadingTab}
                                backgroundLoad={backgroundLoad}
                                onTripSelect={onTripSelect}
                                onChargeSelect={onChargeSelect}
                                setSwipeContainer={setSwipeContainer}
                            />
                        </ErrorBoundary>
                    </div>
                </div>

                {/* Vertical Layout: Bottom Navigation */}
                {layoutMode === 'vertical' && (
                    <TabNavigation
                        tabs={tabs}
                        activeTab={activeTab}
                        handleTabClick={handleTabClick}
                    />
                )}

                {/* PWA Manager */}
                <Suspense fallback={null}>
                    <PWAManagerLazy layoutMode={layoutMode} isCompact={isCompact} />
                </Suspense>

                {/* Modal Coordinator - handles all modals centrally */}
                <ModalCoordinator />
            </div>
        </BaseLayout>
    );
};

export default MainLayout;
