import React, { Suspense, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from '@components/Icons';
import ErrorBoundary from '@components/common/ErrorBoundary';

// Contexts & Hooks
import { useData } from '@/providers/DataProvider';
import { useApp } from '@/context/AppContext';
import { useLayout } from '@/context/LayoutContext';
import { useChartDimensions } from '@hooks/useChartDimensions';

// Tabs
import OverviewTab from '@tabs/OverviewTab';
import TabFallback from '@components/common/TabFallback';

// Lazy loaded tabs
const CalendarTab = React.lazy(() => import('@tabs/CalendarTab'));
const HistoryTab = React.lazy(() => import('@tabs/HistoryTab'));
const RecordsTab = React.lazy(() => import('@tabs/RecordsTab'));
const TrendsTab = React.lazy(() => import('@tabs/TrendsTab'));
const PatternsTab = React.lazy(() => import('@tabs/PatternsTab'));
const EfficiencyTab = React.lazy(() => import('@tabs/EfficiencyTab'));
const ChargesTab = React.lazy(() => import('@tabs/ChargesTab'));

/**
 * Desktop Dashboard View - Optimized for tab navigation and larger screens
 */
const DesktopDashboardView = memo(({
    activeTab,
    tabs,
    fadingTab,
    backgroundLoad,
    onTripSelect,
    onChargeSelect
}) => {
    const { t } = useTranslation();

    const { stats, trips: rawTrips, filtered, charges } = useData();
    const { summary, monthly, daily, hourly, weekday, tripDist, effScatter, top } = stats || {};

    const { settings } = useApp();
    const { isCompact, isFullscreenBYD } = useLayout();
    const { openModal } = useData();

    const { smallChartHeight, patternsChartHeight, largeChartHeight, overviewSpacingHorizontal, patternsSpacing, recordsItemPadding, recordsItemPaddingHorizontal, recordsListHeightHorizontal } = useChartDimensions({ isVertical: false, isFullscreenBYD, isCompact });

    // Handlers
    const handleAddCharge = () => openModal('addCharge');
    const handleShowAllTrips = () => openModal('allTrips');
    const handleShowAllCharges = () => openModal('allCharges');

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
                                <ErrorBoundary key={isActive ? 'overview-active' : 'overview-bg'} isTab title={t('common.errorLoadingTab')}>
                                    <OverviewTab
                                        summary={summary}
                                        monthly={monthly}
                                        tripDist={tripDist}
                                        smallChartHeight={smallChartHeight}
                                        overviewSpacing={overviewSpacingHorizontal}
                                        trips={rawTrips}
                                        settings={settings}
                                    />
                                </ErrorBoundary>
                            )}
                            {tab.id === 'calendar' && (
                                <ErrorBoundary key={isActive ? 'calendar-active' : 'calendar-bg'} isTab title={t('common.errorLoadingTab')}>
                                    <CalendarTab
                                        trips={rawTrips}
                                        charges={charges}
                                        isActive={isActive}
                                        onTripSelect={onTripSelect}
                                        onChargeSelect={onChargeSelect}
                                    />
                                </ErrorBoundary>
                            )}
                            {tab.id === 'trends' && (
                                <ErrorBoundary key={isActive ? 'trends-active' : 'trends-bg'} isTab title={t('common.errorLoadingTab')}>
                                    <TrendsTab
                                        filtered={filtered}
                                        summary={summary}
                                        monthly={monthly}
                                        daily={daily}
                                        settings={settings}
                                        largeChartHeight={largeChartHeight}
                                    />
                                </ErrorBoundary>
                            )}
                            {tab.id === 'patterns' && (
                                <ErrorBoundary key={isActive ? 'patterns-active' : 'patterns-bg'} isTab title={t('common.errorLoadingTab')}>
                                    <PatternsTab
                                        weekday={weekday}
                                        hourly={hourly}
                                        summary={summary}
                                        patternsSpacing={patternsSpacing}
                                        patternsChartHeight={patternsChartHeight}
                                    />
                                </ErrorBoundary>
                            )}
                            {tab.id === 'efficiency' && (
                                <ErrorBoundary key={isActive ? 'efficiency-active' : 'efficiency-bg'} isTab title={t('common.errorLoadingTab')}>
                                    <EfficiencyTab
                                        summary={summary}
                                        monthly={monthly}
                                        effScatter={effScatter}
                                        largeChartHeight={largeChartHeight}
                                    />
                                </ErrorBoundary>
                            )}
                            {tab.id === 'records' && (
                                <ErrorBoundary key={isActive ? 'records-active' : 'records-bg'} isTab title={t('common.errorLoadingTab')}>
                                    <RecordsTab
                                        summary={summary}
                                        top={top}
                                        recordsItemPadding={recordsItemPadding}
                                        recordsItemPaddingHorizontal={recordsItemPaddingHorizontal}
                                        recordsListHeightHorizontal={recordsListHeightHorizontal}
                                    />
                                </ErrorBoundary>
                            )}
                            {tab.id === 'history' && (
                                <ErrorBoundary key={isActive ? 'history-active' : 'history-bg'} isTab title={t('common.errorLoadingTab')}>
                                    <HistoryTab
                                        filtered={filtered}
                                        openTripDetail={onTripSelect}
                                        setShowAllTripsModal={handleShowAllTrips}
                                    />
                                </ErrorBoundary>
                            )}
                            {tab.id === 'charges' && (
                                <ErrorBoundary key={isActive ? 'charges-active' : 'charges-bg'} isTab title={t('common.errorLoadingTab')}>
                                    <ChargesTab
                                        charges={charges}
                                        chargerTypes={settings.chargerTypes || []}
                                        onChargeClick={onChargeSelect}
                                        onAddClick={handleAddCharge}
                                        setShowAllChargesModal={handleShowAllCharges}
                                        batterySize={settings.batterySize}
                                    />
                                </ErrorBoundary>
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

                    // For lazy tabs, we wrap Suspense INSIDE the hidden container
                    // This way, the fallback is also hidden if the tab is not active
                    return (
                        <div
                            key={tab.id}
                            className={isActive && isFading ? 'tab-fade-in' : ''}
                            style={{ display: isActive ? 'block' : 'none' }}
                        >
                            {(isActive || backgroundLoad) && (
                                <Suspense fallback={<TabFallback />}>
                                    {content}
                                </Suspense>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
});

DesktopDashboardView.displayName = 'DesktopDashboardView';

export default DesktopDashboardView;


