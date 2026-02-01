import { useRef, useEffect, useState, useMemo, FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Line as LineJS, Pie as PieJS } from 'react-chartjs-2';
import StatCard from '@components/ui/StatCard';
import ChartCard from '@components/ui/ChartCard';
import HybridStatsCard from '@components/cards/HybridStatsCard';
import EstimatedChargeCard from '@components/cards/EstimatedChargeCard';
import TripInsightsModal from '@components/modals/TripInsightsModal';
import OdometerAdjustmentModal from '@components/modals/OdometerAdjustmentModal';
import HealthReportModal from '@components/modals/HealthReportModal';
import { MapPin, Zap, Clock, Battery, TrendingUp, Activity, Fuel, IconProps, AlertTriangle } from '@components/Icons';
import { useLayout } from '@/context/LayoutContext';
import { Summary, Trip, Settings, TripInsightType, Charge, ProcessedData } from '@/types';
import { AnomalyService, Anomaly } from '@/services/AnomalyService';

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
    onRangeClick?: () => void;
    isAiReady?: boolean;
    aiSoH?: number | null;
    aiSoHStats?: { points: any[]; trend: any[] } | null;
    charges?: Charge[];
    stats?: ProcessedData;
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
    onRangeClick,
    isAiReady = false,
    aiSoH,
    aiSoHStats,
    charges,
    stats
}) => {
    const { t } = useTranslation();
    const { isCompact, isLargerCard, isVertical } = useLayout();

    // Refs to chart instances for manual animation control
    const lineChartRef = useRef<any>(null);
    const pieChartRef = useRef<any>(null);

    const [showHealthModal, setShowHealthModal] = useState(false);

    // Calculate Anomalies
    const anomalies: Anomaly[] = useMemo(() => {
        if (!stats || !settings) return [];
        return AnomalyService.checkSystemHealth(stats, settings, charges || [], trips);
    }, [stats, settings, charges, trips]);

    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical').length;
    const warningAnomalies = anomalies.filter(a => a.severity === 'warning').length;
    const hasAnomalies = anomalies.length > 0;

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
        isCustom?: boolean; // Flag for custom components
    }

    const getStatsConfig = (): StatConfigItem[] => [
        {
            key: 'distance',
            icon: MapPin,
            label: t('stats.distance'),
            value: summary.totalKm,
            unit: t('units.km'),
            color: "bg-red-500/20 text-red-400",
            sub: `${summary.kmDay} ${t('units.km')}/${t('units.day')}`,
            onClick: onOdometerClick
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
            icon: isAiReady ? () => <span className="text-lg">🧠</span> : Battery,
            label: isAiReady ? t('stats.aiRange', 'AI Range') : t('stats.estimatedRange'),
            value: summary.estimatedRange,
            unit: t('units.km'),
            color: isAiReady ? "bg-indigo-500/20 text-indigo-400" : "bg-amber-500/20 text-amber-400",
            onClick: onRangeClick || (() => onInsightClick('range'))
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
            label: t('settings.soh'),
            value: aiSoH ? aiSoH.toFixed(1) : summary.soh,
            unit: "%",
            color: "bg-emerald-500/20 text-emerald-400",
            onClick: () => onInsightClick('soh')
        },
        {
            key: 'system_health',
            icon: hasAnomalies ? AlertTriangle : Activity,
            label: t('stats.systemStatus', 'Estado Sistema'),
            value: hasAnomalies ? `${anomalies.length} Alerta${anomalies.length > 1 ? 's' : ''}` : t('stats.normal', 'Normal'),
            unit: '',
            color: criticalAnomalies > 0
                ? "bg-red-500/20 text-red-500"
                : (warningAnomalies > 0 ? "bg-amber-500/20 text-amber-500" : "bg-emerald-500/20 text-emerald-500"),
            sub: hasAnomalies ? t('stats.checkDetails', 'Ver detalles') : t('stats.allSystemsOk', 'Todo correcto'),
            onClick: () => setShowHealthModal(true)
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
                            summary={summary}
                            settings={settings}
                            stats={stats || null}
                            charges={charges}
                            trips={trips}
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
                        />
                    )
                ))}
            </div>
            <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${isCompact ? '!gap-3' : ''}`}>
                {statItems.slice(4, 8).map((item) => (
                    item.isCustom ? (
                        <EstimatedChargeCard
                            key={item.key}
                            summary={summary}
                            settings={settings}
                            stats={stats || null}
                            charges={charges}
                            trips={trips}
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
                aiSoH={aiSoH}
                aiSoHStats={aiSoHStats}
            />
            <OdometerAdjustmentModal
                isOpen={showOdometerModal}
                onClose={onCloseOdometerModal}
            />
            <HealthReportModal
                isOpen={showHealthModal}
                onClose={() => setShowHealthModal(false)}
                anomalies={anomalies}
            />
        </div>
    );
};

export default OverviewContent;


