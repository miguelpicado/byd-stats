import { useRef, useEffect, useMemo, FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Line as LineJS, Pie as PieJS } from 'react-chartjs-2';
import StatCard from '@components/ui/StatCard';
import ChartCard from '@components/ui/ChartCard';
import HybridStatsCard from '@components/cards/HybridStatsCard';
import EstimatedChargeCard from '@components/cards/EstimatedChargeCard';
import TripInsightsModal from '@components/modals/TripInsightsModal';
import OdometerAdjustmentModal from '@components/modals/OdometerAdjustmentModal';
import { MapPin, Zap, Clock, Battery, Fuel, Euro, IconProps } from '@components/Icons';
import { useLayout } from '@/context/LayoutContext';
import { Summary, Trip, Settings, TripInsightType, Charge, LiveData } from '@/types';

const PIE_CHART_OPTIONS = {
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            callbacks: {
                label: (context: any) => {
                    const label = context.label || '';
                    const value = context.parsed;
                    const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                    const percent = ((value / total) * 100).toFixed(0) + '%';
                    return `${label}: ${context.raw} (${percent})`;
                }
            }
        }
    }
};

interface OverviewContentProps {
    summary: Summary;
    tripDist: { range: string; count: number; color: string }[];
    smallChartHeight: number | string;
    overviewSpacing: string;
    lineChartOptions: any;
    lineChartData: any;
    pieChartData: any;
    trips?: Trip[];
    settings: Settings;
    onInsightClick: (type: TripInsightType) => void;
    onOdometerClick: () => void;
    onMfgDateClick: () => void;
    onThermalStressClick?: () => void;
    showOdometerModal: boolean;
    onCloseOdometerModal: () => void;
    insightType: TripInsightType | null;
    onCloseInsightModal: () => void;
    isActive?: boolean;
    charges?: Charge[];
    liveData?: LiveData | null;
}

const OverviewContent: FC<OverviewContentProps> = ({
    summary,
    tripDist,
    smallChartHeight,
    overviewSpacing,
    lineChartOptions,
    lineChartData,
    pieChartData,
    trips = [],
    settings,
    onInsightClick,
    onOdometerClick,
    onMfgDateClick,
    onThermalStressClick,
    showOdometerModal,
    onCloseOdometerModal,
    insightType,
    onCloseInsightModal,
    isActive = true,
    charges,
    liveData = null,
}) => {
    const { t } = useTranslation();
    const { isCompact, isLargerCard, isVertical } = useLayout();

    // Refs to chart instances for manual animation control
    const lineChartRef = useRef<any>(null);
    const pieChartRef = useRef<any>(null);

    // Monthly cost: total charge cost divided by number of active months
    const monthlyCost = useMemo(() => {
        if (!charges || charges.length === 0) return 0;
        const total = charges.reduce((acc, c) => acc + (c.totalCost || 0), 0);
        const months = new Set(charges.map(c => c.date?.substring(0, 7)).filter(Boolean));
        return months.size > 0 ? total / months.size : 0;
    }, [charges]);

    // Staleness check for premium live data
    const isLiveDataStale = useMemo(() => {
        if (!liveData?.lastUpdated) return false;
        const ageMs = Date.now() - new Date(liveData.lastUpdated).getTime();
        return ageMs > 24 * 60 * 60 * 1000;
    }, [liveData?.lastUpdated]);

    const liveDataAge = useMemo(() => {
        if (!liveData?.lastUpdated) return null;
        const ageMs = Date.now() - new Date(liveData.lastUpdated).getTime();
        const hours = Math.round(ageMs / (60 * 60 * 1000));
        if (hours < 1) return t('premium.justNow', 'ahora');
        if (hours < 24) return t('premium.hoursAgo', { hours });
        return t('premium.daysAgo', { days: Math.round(hours / 24) });
    }, [liveData?.lastUpdated, t]);

    // Effect to trigger animation when tab becomes active
    useEffect(() => {
        if (isActive) {
            // Slight delay to ensure visibility before animating
            const timer = setTimeout(() => {
                if (lineChartRef.current) {
                    lineChartRef.current.reset();
                    lineChartRef.current.update();
                }
                if (pieChartRef.current) {
                    pieChartRef.current.reset();
                    pieChartRef.current.update();
                }
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isActive]);

    interface StatConfigItem {
        key: string;
        icon?: FC<IconProps>;
        label?: string;
        value?: string | number;
        unit?: string;
        color?: string;
        sub?: string;
        onClick?: () => void;
        isCustom?: boolean;
        isPremium?: boolean;
    }

    const getStatsConfig = (): StatConfigItem[] => [
        {
            key: 'distance',
            icon: MapPin,
            label: liveData ? t('stats.premiumOdometer', 'Odómetro Premium') : t('stats.distance'),
            value: liveData ? liveData.odometer.toFixed(0) : summary.totalKm,
            unit: t('units.km'),
            color: liveData ? "bg-red-500/20 text-red-300" : "bg-red-500/20 text-red-400",
            sub: liveData
                ? (isLiveDataStale ? `${t('premium.stale', 'desactualizado')} · ${liveDataAge}` : `Premium · ${liveDataAge}`)
                : `${summary.kmDay} ${t('units.km')}/${t('units.day')}`,
            onClick: onOdometerClick,
            isPremium: !!liveData
        },
        {
            key: 'energy',
            icon: Zap,
            label: t('stats.energy'),
            value: summary.totalKwh,
            unit: t('units.kWh'),
            color: "bg-cyan-500/20 text-cyan-400",
            // Add stationary consumption as sub-label
            sub: `${t('stats.stationary')}: ${summary.stationaryConsumption} kWh`,
            onClick: () => onInsightClick('energy')
        },
        {
            key: 'range',
            icon: Battery,
            label: liveData ? t('stats.premiumRange', 'Autonomía AI') : t('stats.estimatedRange'),
            value: liveData ? `${liveData.rangeAtCurrentSoc}/${liveData.rangeAt100Percent}` : summary.estimatedRange,
            unit: t('units.km'),
            color: liveData ? "bg-amber-400/20 text-amber-300" : "bg-amber-500/20 text-amber-400",
            sub: liveData ? `${t('stats.soc', 'SoC')}: ${liveData.currentSoc}%` : undefined,
            isPremium: !!liveData
        },
        // Replaces Stationary for Hybrid, and Time for EV
        summary.isHybrid ? {
            key: 'estimated_charge',
            isCustom: true // Custom renderer
        } : {
            key: 'time',
            icon: Clock,
            label: t('stats.time'),
            value: summary.totalHours,
            unit: "h",
            color: "bg-purple-500/20 text-purple-400",
            onClick: () => onInsightClick('time')
        },
        {
            key: 'efficiency',
            icon: Battery,
            label: t('stats.efficiency'),
            value: summary.avgEff,
            unit: t('units.kWh100km'),
            color: "bg-green-500/20 text-green-400",
            onClick: () => onInsightClick('efficiency')
        },
        // Replaces fuel for Hybrid, and Stationary_EV for EV
        summary.isHybrid ? {
            key: 'fuel',
            icon: Fuel,
            label: t('hybrid.avgFuelEfficiency'),
            value: summary.avgFuelEff,
            unit: "L/100km",
            color: "bg-amber-500/20 text-amber-500",
            onClick: () => onInsightClick('fuel')
        } : {
            key: 'estimated_charge',
            isCustom: true // Custom renderer
        },
        {
            key: 'soh',
            icon: Battery,
            label: liveData ? t('stats.premiumSoh', 'SoH Premium') : t('settings.soh'),
            value: liveData ? liveData.soh : summary.soh,
            unit: "%",
            color: liveData ? "bg-emerald-400/20 text-emerald-300" : "bg-emerald-500/20 text-emerald-400",
            sub: liveData ? `Premium · ${liveData.sohMode === 'ai' ? 'AI' : 'Manual'}` : undefined,
            onClick: () => onInsightClick('soh'),
            isPremium: !!liveData
        },
        {
            key: 'monthly_cost',
            icon: Euro,
            label: t('stats.monthlyCost', 'Coste mensual'),
            value: monthlyCost.toFixed(2),
            unit: '€',
            color: "bg-blue-500/20 text-blue-400",
            onClick: () => onInsightClick('energy')
        }
    ];

    const statItems = getStatsConfig();

    return (
        <div className={`${overviewSpacing}`}>
            {/* Stats Grid */}
            <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${isCompact ? '!gap-3' : ''}`}>
                {statItems.slice(0, 4).map((item) => (
                    item.isCustom ? (
                        <EstimatedChargeCard
                            key={item.key}
                            settings={settings}
                            charges={charges}
                        />
                    ) : (
                        <StatCard
                            key={item.key}
                            isVerticalMode={isVertical}
                            isLarger={isLargerCard}
                            isCompact={isCompact}
                            icon={item.icon!}
                            label={item.label!}
                            value={item.value!}
                            unit={item.unit!}
                            color={item.color!}
                            sub={item.sub}
                            onClick={item.onClick}
                            isPremium={item.isPremium}
                        />
                    )
                ))}
            </div>
            <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${isCompact ? '!gap-3' : ''}`}>
                {statItems.slice(4, 8).map((item) => (
                    item.isCustom ? (
                        <EstimatedChargeCard
                            key={item.key}
                            settings={settings}
                            charges={charges}
                        />
                    ) : (
                        <StatCard
                            key={item.key}
                            isVerticalMode={isVertical}
                            isLarger={isLargerCard}
                            isCompact={isCompact}
                            icon={item.icon!}
                            label={item.label!}
                            value={item.value!}
                            unit={item.unit!}
                            color={item.color!}
                            sub={item.sub}
                            onClick={item.onClick}
                            isPremium={item.isPremium}
                        />
                    )
                ))}
            </div>

            {summary.isHybrid && (
                <div className={`grid grid-cols-2 gap-4 ${isCompact ? '!gap-3' : ''}`}>
                    <HybridStatsCard summary={summary} isCompact={isCompact} isVertical={false} />
                </div>
            )}

            {/* Charts */}
            <div className={`grid gap-4 ${isCompact ? 'grid-cols-1 lg:grid-cols-2 !gap-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
                <ChartCard isCompact={isCompact} title={t('charts.monthlyDist')}>
                    <div key="line-container-h" style={{ width: '100%', height: smallChartHeight }}>
                        <LineJS ref={lineChartRef} options={lineChartOptions} data={lineChartData} />
                    </div>
                </ChartCard>
                <ChartCard isCompact={isCompact} title={t('charts.tripDist')}>
                    <div className="flex flex-row items-center gap-4">
                        <div className="w-1/2">
                            <div key="pie-container-h" style={{ width: '100%', height: smallChartHeight }}>
                                <PieJS ref={pieChartRef} options={PIE_CHART_OPTIONS} data={pieChartData} />
                            </div>
                        </div>
                        <div className="w-1/2 grid grid-cols-1 gap-1 text-center">
                            {tripDist.map((d, i) => (
                                <div key={i} className={`flex flex-row items-center justify-between px-2 py-1 bg-slate-100 dark:bg-slate-700/50 rounded-lg`}>
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }}></div>
                                        <p className="text-slate-600 dark:text-slate-400 truncate text-[9px]">{d.range}km</p>
                                    </div>
                                    <p className="font-bold text-slate-900 dark:text-white text-[11px]">{d.count}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </ChartCard>
            </div>

            <TripInsightsModal
                isOpen={!!insightType}
                onClose={onCloseInsightModal}
                type={insightType || 'distance'}
                trips={trips}
                settings={settings}
                summary={summary}
                onMfgDateClick={onMfgDateClick}
                onThermalStressClick={onThermalStressClick}
            />
            <OdometerAdjustmentModal
                isOpen={showOdometerModal}
                onClose={onCloseOdometerModal}
            />
        </div>
    );
};

export default OverviewContent;


