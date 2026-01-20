import React, { Suspense, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from '../../components/Icons';
import { TAB_PADDING, COMPACT_TAB_PADDING } from '../../utils/constants';

// Contexts & Hooks
import { useData } from '../../providers/DataProvider';
import { useApp } from '../../context/AppContext';
import { useLayout } from '../../context/LayoutContext';
import useModalState from '../../hooks/useModalState';
import { useChartDimensions } from '../../hooks/useChartDimensions';

// Tabs
import OverviewTab from '../../components/tabs/OverviewTab';
import TabFallback from '../../components/common/TabFallback';
import FloatingActionButton from '../../components/common/FloatingActionButton'; // Used in vertical mode

// Lazy loaded tabs
const HistoryTab = React.lazy(() => import('../../components/tabs/HistoryTab'));
const RecordsTab = React.lazy(() => import('../../components/tabs/RecordsTab'));
const TrendsTab = React.lazy(() => import('../../components/tabs/TrendsTab'));
const PatternsTab = React.lazy(() => import('../../components/tabs/PatternsTab'));
const EfficiencyTab = React.lazy(() => import('../../components/tabs/EfficiencyTab'));
const ChargesTab = React.lazy(() => import('../../components/tabs/ChargesTab'));

const DashboardLayout = memo(({
    activeTab,
    tabs,
    isTransitioning,
    transitionDuration = 500,
    fadingTab,
    backgroundLoad,
    // Navigation handlers passed from parent
    onTripSelect,
    onChargeSelect
}) => {
    const { t } = useTranslation();

    // Consume contexts - Major cleanup from original TabsManager
    const {
        stats, // { summary, monthly, etc }
        trips: rawTrips,
        filtered,
        charges
    } = useData();

    // Destructure stats for easier access
    const { summary, monthly, daily, hourly, weekday, tripDist, effScatter, top } = stats || {};

    const { settings } = useApp();
    const { layoutMode, isCompact, isFullscreenBYD, isVertical } = useLayout();
    // Context openModal
    const { openModal } = useData();

    // Chart Dimensions internal hook usage
    const chartDimensions = useChartDimensions({ isVertical, isFullscreenBYD, isCompact });
    const {
        smallChartHeight,
        patternsChartHeight,
        largeChartHeight,
        overviewSpacingVertical,
        overviewSpacingHorizontal,
        patternsSpacing,
        recordsItemPadding,
        recordsItemPaddingHorizontal,
        recordsListHeightHorizontal
    } = chartDimensions;

    // Helper for class names
    const getTabClassName = (tabId, isActive, isFading, baseClass = 'tab-content-container') => {
        const classes = [baseClass];
        if (isActive && isFading) {
            classes.push('tab-fade-in');
        }
        return classes.join(' ');
    };

    // Helper handlers
    const handleAddCharge = () => openModal('addCharge');
    const handleShowAllTrips = () => openModal('allTrips');
    const handleShowAllCharges = () => openModal('allCharges');

    // Handle opening trip detail - assumes parent passed a handler or we use modal state?
    // The original code used openTripDetail callback which set selectedTrip AND opened modal.
    // DashboardLayout can just open modal, but selecting trip needs state setter.
    // Ideally selectedTrip should be in DataProvider or App state. It is currently in App.jsx.
    // We received `onTripSelect` prop for this precise reason.

    // Render logic for Vertical Mode (Slider)
    if (layoutMode === 'vertical') {
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
                        tabs.map((tab) => (
                            <div
                                key={tab.id}
                                className={getTabClassName(tab.id, activeTab === tab.id, fadingTab === tab.id)}
                                style={{ width: `${100 / tabs.length}%`, flexShrink: 0, height: '100%', overflowY: 'auto', padding: isCompact ? COMPACT_TAB_PADDING : TAB_PADDING }}
                            >
                                {(activeTab === tab.id || backgroundLoad) && (
                                    <>
                                        {tab.id === 'overview' && (
                                            <OverviewTab
                                                summary={summary}
                                                monthly={monthly}
                                                tripDist={tripDist}
                                                smallChartHeight={smallChartHeight}
                                                overviewSpacing={overviewSpacingVertical}
                                                onAddCharge={handleAddCharge}
                                                trips={rawTrips}
                                                settings={settings}
                                            />
                                        )}
                                        {tab.id === 'trends' && (
                                            <Suspense fallback={<TabFallback />}>
                                                <TrendsTab
                                                    filtered={filtered}
                                                    summary={summary}
                                                    monthly={monthly}
                                                    daily={daily}
                                                    settings={settings}
                                                    largeChartHeight={largeChartHeight}
                                                />
                                            </Suspense>
                                        )}
                                        {tab.id === 'patterns' && (
                                            <Suspense fallback={<TabFallback />}>
                                                <PatternsTab
                                                    weekday={weekday}
                                                    hourly={hourly}
                                                    summary={summary}
                                                    patternsSpacing={patternsSpacing}
                                                    patternsChartHeight={patternsChartHeight}
                                                />
                                            </Suspense>
                                        )}
                                        {tab.id === 'efficiency' && (
                                            <Suspense fallback={<TabFallback />}>
                                                <EfficiencyTab
                                                    summary={summary}
                                                    monthly={monthly}
                                                    effScatter={effScatter}
                                                    largeChartHeight={largeChartHeight}
                                                />
                                            </Suspense>
                                        )}
                                        {tab.id === 'records' && (
                                            <Suspense fallback={<TabFallback />}>
                                                <RecordsTab
                                                    summary={summary}
                                                    top={top}
                                                    recordsItemPadding={recordsItemPadding}
                                                    recordsItemPaddingHorizontal={recordsItemPaddingHorizontal}
                                                    recordsListHeightHorizontal={recordsListHeightHorizontal}
                                                />
                                            </Suspense>
                                        )}
                                        {tab.id === 'history' && (
                                            <Suspense fallback={<TabFallback />}>
                                                <HistoryTab
                                                    filtered={filtered}
                                                    openTripDetail={onTripSelect}
                                                    setShowAllTripsModal={handleShowAllTrips}
                                                />
                                            </Suspense>
                                        )}
                                        {tab.id === 'charges' && (
                                            <Suspense fallback={<TabFallback />}>
                                                <ChargesTab
                                                    charges={charges}
                                                    chargerTypes={settings.chargerTypes || []}
                                                    onChargeClick={onChargeSelect}
                                                    onAddClick={handleAddCharge}
                                                    setShowAllChargesModal={handleShowAllCharges}
                                                    batterySize={settings.batterySize}
                                                />
                                            </Suspense>
                                        )}
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Floating Action Button for Overview tab in vertical mode */}
                {activeTab === 'overview' && (
                    <FloatingActionButton
                        onClick={handleAddCharge}
                        label={t('charges.addCharge')}
                    />
                )}
            </div>
        );
    }

    // Render logic for Horizontal Mode
    return (
        <div
            className="tab-content-container horizontal-tab-transition"
            style={{ padding: isCompact ? '8px 10px' : '12px', height: '100%', overflowY: 'auto' }}
        >
            {!stats ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800/30 rounded-2xl">
                    <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                    <p className="text-slate-400">{t('common.noData')}</p>
                </div>
            ) : (
                tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const isFading = fadingTab === tab.id;

                    const content = (
                        <>
                            {tab.id === 'overview' && (
                                <OverviewTab
                                    key={isActive ? 'overview-active' : 'overview-bg'}
                                    summary={summary}
                                    monthly={monthly}
                                    tripDist={tripDist}
                                    smallChartHeight={smallChartHeight}
                                    overviewSpacing={overviewSpacingHorizontal}
                                    trips={rawTrips}
                                    settings={settings}
                                />
                            )}
                            {tab.id === 'trends' && (
                                <TrendsTab
                                    key={isActive ? 'trends-active' : 'trends-bg'}
                                    filtered={filtered}
                                    summary={summary}
                                    monthly={monthly}
                                    daily={daily}
                                    settings={settings}
                                    largeChartHeight={largeChartHeight}
                                />
                            )}
                            {tab.id === 'patterns' && (
                                <PatternsTab
                                    key={isActive ? 'patterns-active' : 'patterns-bg'}
                                    weekday={weekday}
                                    hourly={hourly}
                                    summary={summary}
                                    patternsSpacing={patternsSpacing}
                                    patternsChartHeight={patternsChartHeight}
                                />
                            )}
                            {tab.id === 'efficiency' && (
                                <EfficiencyTab
                                    key={isActive ? 'efficiency-active' : 'efficiency-bg'}
                                    summary={summary}
                                    monthly={monthly}
                                    effScatter={effScatter}
                                    largeChartHeight={largeChartHeight}
                                />
                            )}
                            {tab.id === 'records' && (
                                <RecordsTab
                                    key={isActive ? 'records-active' : 'records-bg'}
                                    summary={summary}
                                    top={top}
                                    recordsItemPadding={recordsItemPadding}
                                    recordsItemPaddingHorizontal={recordsItemPaddingHorizontal}
                                    recordsListHeightHorizontal={recordsListHeightHorizontal}
                                />
                            )}
                            {tab.id === 'history' && (
                                <HistoryTab
                                    key={isActive ? 'history-active' : 'history-bg'}
                                    filtered={filtered}
                                    openTripDetail={onTripSelect}
                                    setShowAllTripsModal={handleShowAllTrips}
                                />
                            )}
                            {tab.id === 'charges' && (
                                <ChargesTab
                                    key={isActive ? 'charges-active' : 'charges-bg'}
                                    charges={charges}
                                    chargerTypes={settings.chargerTypes || []}
                                    onChargeClick={onChargeSelect}
                                    onAddClick={handleAddCharge}
                                    setShowAllChargesModal={handleShowAllCharges}
                                    batterySize={settings.batterySize}
                                />
                            )}
                        </>
                    );

                    const container = (
                        <div
                            className={isActive && isFading ? 'tab-fade-in' : ''}
                            style={{ display: isActive ? 'block' : 'none' }}
                        >
                            {(isActive || backgroundLoad) && content}
                        </div>
                    );

                    if (tab.id === 'overview') {
                        return <div key={tab.id}>{container}</div>;
                    }

                    return (
                        <Suspense key={tab.id} fallback={<TabFallback />}>
                            {container}
                        </Suspense>
                    );
                })
            )}
        </div>
    );
});

DashboardLayout.displayName = 'DashboardLayout';

export default DashboardLayout;
