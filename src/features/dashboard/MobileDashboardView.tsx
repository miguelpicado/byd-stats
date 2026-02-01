import React, { Suspense, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from '@components/Icons';
import { TAB_PADDING, COMPACT_TAB_PADDING } from '@utils/constants';
import ErrorBoundary from '@components/common/ErrorBoundary';
import { Trip, Charge } from '@/types';

// Contexts & Hooks
import { useData } from '@/providers/DataProvider';
import { useApp } from '@/context/AppContext';
import { useLayout } from '@/context/LayoutContext';
import { useChartDimensions } from '@hooks/useChartDimensions';

// Tabs
import OverviewTab from '@tabs/OverviewTab';
import TabFallback from '@components/common/TabFallback';
import FloatingActionButton from '@components/common/FloatingActionButton';

// Lazy loaded tabs
const CalendarTab = React.lazy(() => import('@tabs/CalendarTab'));
const HistoryTab = React.lazy(() => import('@tabs/HistoryTab'));
const RecordsTab = React.lazy(() => import('@tabs/RecordsTab'));
const TrendsTab = React.lazy(() => import('@tabs/TrendsTab'));
const PatternsTab = React.lazy(() => import('@tabs/PatternsTab'));
const EfficiencyTab = React.lazy(() => import('@tabs/EfficiencyTab'));
const ChargesTab = React.lazy(() => import('@tabs/ChargesTab'));

/**
 * Mobile Dashboard View - Optimized for touch gestures and vertical slider navigation
 */
interface MobileDashboardViewProps {
    activeTab: string;
    tabs: any[];
    isTransitioning: boolean;
    transitionDuration?: number;
    fadingTab?: string;
    backgroundLoad?: boolean;
    onTripSelect?: (trip: Trip) => void;
    onChargeSelect?: (charge: Charge) => void;
    setSwipeContainer?: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
}

const MobileDashboardView = memo(({
    activeTab,
    tabs,
    isTransitioning,
    transitionDuration = 500,
    fadingTab,
    backgroundLoad,
    onTripSelect,
    onChargeSelect,
    setSwipeContainer
}: MobileDashboardViewProps) => {
    const { t } = useTranslation();

    const { stats, trips: rawTrips, filtered, charges } = useData();
    const { summary, monthly, daily, hourly, weekday, tripDist, effScatter, top } = stats || {};

    const { settings } = useApp();
    const { isCompact } = useLayout();
    const { openModal } = useData();

    const { smallChartHeight, patternsChartHeight, largeChartHeight, overviewSpacingVertical, patternsSpacing, recordsItemPadding, recordsItemPaddingHorizontal, recordsListHeightHorizontal } = useChartDimensions({ isVertical: true, isFullscreenBYD: false, isCompact });

    // Helper for class names
    const getTabClassName = (tabId: string, isActive: boolean, isFading: boolean, baseClass = 'tab-content-container') => {
        const classes = [baseClass];
        if (isActive && isFading) {
            classes.push('tab-fade-in');
        }
        return classes.join(' ');
    };

    // Handlers
    const handleAddCharge = () => openModal('addCharge');
    const handleShowAllTrips = () => openModal('allTrips');
    const handleShowAllCharges = () => openModal('allCharges');

    return (
        <div className="relative h-full w-full overflow-hidden">
            <div
                style={{
                    display: 'flex',
                    height: '100%',
                    width: `${tabs.length * 100}%`,
                    transform: `translate3d(-${tabs.findIndex(t => t.id === activeTab) * (100 / tabs.length)}%, 0, 0)`,
                    transition: isTransitioning ? `transform ${transitionDuration}ms cubic-bezier(0.33, 1, 0.68, 1)` : 'none',
                    willChange: 'transform',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    perspective: 1000,
                    WebkitPerspective: 1000,
                    transformStyle: 'preserve-3d',
                    WebkitTransformStyle: 'preserve-3d',
                    userSelect: 'none',
                    touchAction: 'pan-y',
                    overscrollBehavior: 'none'
                }}
            >
                {!stats ? (
                    tabs.map((tab) => (
                        <div key={tab.id} className="text-center py-12 bg-white dark:bg-slate-800/30 rounded-2xl mx-3 sm:mx-4" style={{ width: `${100 / tabs.length}%`, flexShrink: 0 }}>
                            <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                            <p className="text-slate-400">{t('common.noData')}</p>
                        </div>
                    ))
                ) : (
                    tabs.map((tab) => {
                        const isActive = activeTab === tab.id;

                        return (
                            <div
                                key={tab.id}
                                className={getTabClassName(tab.id, activeTab === tab.id, fadingTab === tab.id)}
                                style={{
                                    width: `${100 / tabs.length}%`,
                                    flexShrink: 0,
                                    height: '100%',
                                    overflow: 'hidden', // Outer container NEVER scrolls
                                    padding: 0
                                }}
                            >
                                <div
                                    ref={isActive ? setSwipeContainer : null}
                                    style={{
                                        height: '100%',
                                        width: '100%',
                                        overflowY: 'auto',
                                        display: isActive ? 'block' : 'none', // Truly hide background content from layout if inactive
                                        padding: isCompact ? COMPACT_TAB_PADDING : TAB_PADDING,
                                        touchAction: 'pan-y'
                                    }}
                                >
                                    {(isActive || backgroundLoad) && (
                                        <>
                                            {tab.id === 'overview' && (
                                                <ErrorBoundary isTab title={t('common.errorLoadingTab')}>
                                                    <OverviewTab
                                                        summary={summary || null}
                                                        monthly={monthly || []}
                                                        tripDist={tripDist || []}
                                                        smallChartHeight={smallChartHeight}
                                                        overviewSpacing={overviewSpacingVertical}
                                                        onAddCharge={handleAddCharge}
                                                        trips={rawTrips}
                                                        settings={settings}
                                                        isActive={isActive}
                                                    />
                                                </ErrorBoundary>
                                            )}
                                            {tab.id === 'calendar' && (
                                                <ErrorBoundary isTab title={t('common.errorLoadingTab')}>
                                                    <Suspense fallback={<TabFallback />}>
                                                        <CalendarTab
                                                            trips={rawTrips}
                                                            charges={charges}
                                                            isActive={isActive}
                                                            onTripSelect={onTripSelect}
                                                            onChargeSelect={onChargeSelect}
                                                        />
                                                    </Suspense>
                                                </ErrorBoundary>
                                            )}
                                            {tab.id === 'trends' && (
                                                <ErrorBoundary isTab title={t('common.errorLoadingTab')}>
                                                    <Suspense fallback={<TabFallback />}>
                                                        <TrendsTab
                                                            filtered={filtered}
                                                            summary={summary || null}
                                                            monthly={monthly || []}
                                                            daily={daily || []}
                                                            settings={settings}
                                                            largeChartHeight={largeChartHeight}
                                                            isActive={isActive}
                                                        />
                                                    </Suspense>
                                                </ErrorBoundary>
                                            )}
                                            {tab.id === 'patterns' && (
                                                <ErrorBoundary isTab title={t('common.errorLoadingTab')}>
                                                    <Suspense fallback={<TabFallback />}>
                                                        <PatternsTab
                                                            weekday={weekday || []}
                                                            hourly={hourly || []}
                                                            summary={summary || null}
                                                            patternsSpacing={patternsSpacing}
                                                            patternsChartHeight={patternsChartHeight}
                                                            isActive={isActive}
                                                        />
                                                    </Suspense>
                                                </ErrorBoundary>
                                            )}
                                            {tab.id === 'efficiency' && (
                                                <ErrorBoundary isTab title={t('common.errorLoadingTab')}>
                                                    <Suspense fallback={<TabFallback />}>
                                                        <EfficiencyTab
                                                            summary={summary || null}
                                                            monthly={monthly || []}
                                                            effScatter={effScatter || []}
                                                            largeChartHeight={largeChartHeight}
                                                            isActive={isActive}
                                                        />
                                                    </Suspense>
                                                </ErrorBoundary>
                                            )}
                                            {tab.id === 'records' && (
                                                <ErrorBoundary isTab title={t('common.errorLoadingTab')}>
                                                    <Suspense fallback={<TabFallback />}>
                                                        <RecordsTab
                                                            summary={summary || null}
                                                            top={top || { km: [], kwh: [], dur: [], fuel: [] }}
                                                            recordsItemPadding={recordsItemPadding}
                                                            recordsItemPaddingHorizontal={recordsItemPaddingHorizontal}
                                                            recordsListHeightHorizontal={recordsListHeightHorizontal}
                                                            isActive={isActive}
                                                        />
                                                    </Suspense>
                                                </ErrorBoundary>
                                            )}
                                            {tab.id === 'history' && (
                                                <ErrorBoundary isTab title={t('common.errorLoadingTab')}>
                                                    <Suspense fallback={<TabFallback />}>
                                                        <HistoryTab
                                                            filtered={filtered}
                                                            openTripDetail={onTripSelect || (() => { })}
                                                            setShowAllTripsModal={handleShowAllTrips}
                                                            isActive={isActive}
                                                        />
                                                    </Suspense>
                                                </ErrorBoundary>
                                            )}
                                            {tab.id === 'charges' && (
                                                <ErrorBoundary isTab title={t('common.errorLoadingTab')}>
                                                    <Suspense fallback={<TabFallback />}>
                                                        <ChargesTab
                                                            charges={charges}
                                                            chargerTypes={settings.chargerTypes || []}
                                                            onChargeClick={onChargeSelect || (() => { })}
                                                            onAddClick={handleAddCharge}
                                                            setShowAllChargesModal={handleShowAllCharges}
                                                            batterySize={typeof settings.batterySize === 'string' ? parseFloat(settings.batterySize) : settings.batterySize}
                                                            isActive={isActive}
                                                        />
                                                    </Suspense>
                                                </ErrorBoundary>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Floating Action Button for Overview tab */}
            {activeTab === 'overview' && (
                <FloatingActionButton
                    onClick={handleAddCharge}
                    label={t('charges.addCharge')}
                />
            )}
        </div>
    );
});

MobileDashboardView.displayName = 'MobileDashboardView';

export default MobileDashboardView;


