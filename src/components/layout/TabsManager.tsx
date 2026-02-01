import React, { Suspense, memo, FC } from 'react';
import { AlertCircle } from '../Icons';
import { TAB_PADDING, COMPACT_TAB_PADDING } from '@core/constants';
import { Trip, Charge, Summary, MonthlyData, DailyData, Settings, ProcessedData } from '@/types';
import { ModalsState } from '@hooks/useModalState';

// Tabs
import OverviewTab from '@tabs/OverviewTab';
import TabFallback from '../common/TabFallback';
import FloatingActionButton from '../common/FloatingActionButton'; // Used in vertical mode

// Lazy loaded tabs
const CalendarTab = React.lazy(() => import('@tabs/CalendarTab'));
const HistoryTab = React.lazy(() => import('@tabs/HistoryTab'));
const RecordsTab = React.lazy(() => import('@tabs/RecordsTab'));
const TrendsTab = React.lazy(() => import('@tabs/TrendsTab'));
const PatternsTab = React.lazy(() => import('@tabs/PatternsTab'));
const EfficiencyTab = React.lazy(() => import('@tabs/EfficiencyTab'));
const ChargesTab = React.lazy(() => import('@tabs/ChargesTab'));

interface TabsManagerProps {
    activeTab: string;
    tabs: any[];
    layoutMode: 'vertical' | 'horizontal';
    isCompact: boolean;
    isTransitioning: boolean;
    transitionDuration?: number;
    fadingTab: string | null;
    backgroundLoad: boolean;
    // Data Props
    data: ProcessedData | null;
    rawTrips: Trip[];
    settings: Settings;
    summary: Summary | null;
    monthly: MonthlyData[];
    daily: DailyData[];
    hourly: any[];
    weekday: any[];
    tripDist: any[];
    effScatter: any[];
    top: any;
    charges: Charge[];
    filtered: Trip[]; // trips filtered
    // Chart Dimensions
    chartDimensions: {
        smallChartHeight: number;
        patternsChartHeight: number;
        largeChartHeight: number;
        overviewSpacingVertical: number;
        overviewSpacingHorizontal: number;
        patternsSpacing: number;
        recordsItemPadding: number;
        recordsItemPaddingHorizontal: number;
        recordsListHeightHorizontal: number;
    };
    // Handlers
    openModal: (modalName: keyof ModalsState, props?: any) => void;
    openTripDetail: (trip: Trip) => void;
    setShowAllTripsModal: (show: boolean) => void;
    setShowAllChargesModal: (show: boolean) => void;
    setSelectedCharge: (charge: Charge | null) => void;
    t: any;
}

const TabsManager: FC<TabsManagerProps> = memo(({
    activeTab,
    tabs,
    layoutMode,
    isCompact,
    isTransitioning,
    transitionDuration = 500,
    fadingTab,
    backgroundLoad,
    // Data Props
    data,
    rawTrips,
    settings,
    summary,
    monthly,
    daily,
    hourly,
    weekday,
    tripDist,
    effScatter,
    top,
    charges,
    filtered, // trips filtered
    // Chart Dimensions
    chartDimensions,
    // Handlers
    openModal,
    openTripDetail,
    setShowAllTripsModal,
    setShowAllChargesModal,
    setSelectedCharge,
    t
}) => {
    // Helper for class names
    const getTabClassName = (tabId: string, isActive: boolean, isFading: boolean, baseClass = 'tab-content-container') => {
        const classes = [baseClass];
        if (isActive && isFading) {
            classes.push('tab-fade-in');
        }
        return classes.join(' ');
    };

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

    if (!data) {
        // Fallback for no data state inside tabs container if needed,
        // though typically App handles this or passes null.
        // Assuming we show empty states per tab if data is missing but structure exists.
        // Or if data object itself is null/loading.
    }

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
                    {!data ? (
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
                                style={{
                                    width: `${100 / tabs.length}%`,
                                    flexShrink: 0,
                                    height: '100%',
                                    // Strict overflow control: hide EVERYTHING if not active
                                    overflowY: activeTab === tab.id ? 'auto' : 'hidden',
                                    // Strict visibility: don't paint if not active
                                    visibility: activeTab === tab.id ? 'visible' : 'hidden',
                                    padding: isCompact ? COMPACT_TAB_PADDING : TAB_PADDING
                                }}
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
                                                onAddCharge={() => openModal('addCharge')}
                                                trips={rawTrips}
                                                settings={settings}
                                            />
                                        )}
                                        {tab.id === 'calendar' && (
                                            <Suspense fallback={<TabFallback />}>
                                                <CalendarTab
                                                    trips={rawTrips}
                                                    charges={charges}
                                                    isActive={activeTab === tab.id}
                                                    onTripSelect={openTripDetail}
                                                    onChargeSelect={setSelectedCharge ? (charge: Charge) => {
                                                        setSelectedCharge(charge);
                                                        openModal('chargeDetail');
                                                    } : undefined}
                                                />
                                            </Suspense>
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
                                                    openTripDetail={openTripDetail}
                                                    setShowAllTripsModal={setShowAllTripsModal}
                                                />
                                            </Suspense>
                                        )}
                                        {tab.id === 'charges' && (
                                            <Suspense fallback={<TabFallback />}>
                                                <ChargesTab
                                                    charges={charges}
                                                    chargerTypes={settings.chargerTypes || []}
                                                    onChargeClick={(charge: Charge) => {
                                                        setSelectedCharge(charge);
                                                        openModal('chargeDetail');
                                                    }}
                                                    onAddClick={() => openModal('addCharge')}
                                                    setShowAllChargesModal={setShowAllChargesModal}
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
                        onClick={() => openModal('addCharge')}
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
            {!data ? (
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
                            {tab.id === 'calendar' && (
                                <CalendarTab
                                    key={isActive ? 'calendar-active' : 'calendar-bg'}
                                    trips={rawTrips}
                                    charges={charges}
                                    isActive={isActive}
                                    onTripSelect={openTripDetail}
                                    onChargeSelect={setSelectedCharge ? (charge) => {
                                        setSelectedCharge(charge);
                                        openModal('chargeDetail');
                                    } : undefined}
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
                                    openTripDetail={openTripDetail}
                                    setShowAllTripsModal={setShowAllTripsModal}
                                />
                            )}
                            {tab.id === 'charges' && (
                                <ChargesTab
                                    key={isActive ? 'charges-active' : 'charges-bg'}
                                    charges={charges}
                                    chargerTypes={settings.chargerTypes || []}
                                    onChargeClick={(charge) => {
                                        setSelectedCharge(charge);
                                        openModal('chargeDetail');
                                    }}
                                    onAddClick={() => openModal('addCharge')}
                                    setShowAllChargesModal={setShowAllChargesModal}
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

TabsManager.displayName = 'TabsManager';

export default TabsManager;



