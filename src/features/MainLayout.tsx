import React, { Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
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

                <Toaster
                    position="bottom-center"
                    containerStyle={{
                        bottom: 100, // Move it up to clear the bottom navigation bar
                    }}
                    toastOptions={{
                        duration: 4000,
                        style: {
                            background: 'rgba(15, 23, 42, 0.85)',
                            color: '#fff',
                            backdropFilter: 'blur(12px) saturate(180%)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '16px',
                            padding: '12px 20px',
                            fontSize: '14px',
                            fontWeight: '500',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
                            maxWidth: '350px',
                        },
                        success: {
                            iconTheme: {
                                primary: '#10b981',
                                secondary: '#fff',
                            },
                            style: {
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                            }
                        },
                        error: {
                            iconTheme: {
                                primary: '#EA0029',
                                secondary: '#fff',
                            },
                            style: {
                                border: '1px solid rgba(234, 0, 41, 0.3)',
                            }
                        },
                        loading: {
                            style: {
                                background: 'rgba(30, 41, 59, 0.9)',
                            }
                        }
                    }}
                />

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
