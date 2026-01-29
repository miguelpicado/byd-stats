import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Line as LineJS, Pie as PieJS } from 'react-chartjs-2';
import StatCard from '../ui/StatCard';
import ChartCard from '../ui/ChartCard';
import HybridStatsCard from '../cards/HybridStatsCard';
import TripInsightsModal from '../modals/TripInsightsModal';
import OdometerAdjustmentModal from '../modals/OdometerAdjustmentModal';
import { MapPin, Zap, Car, Clock, Battery, TrendingUp, Activity, Fuel } from '../Icons.jsx'; // Removed unused icons if any
import { useLayout } from '../../context/LayoutContext';

const PIE_CHART_OPTIONS = {
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            callbacks: {
                label: (context) => {
                    const label = context.label || '';
                    const value = context.parsed;
                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                    const percent = ((value / total) * 100).toFixed(0) + '%';
                    return `${label}: ${context.raw} (${percent})`;
                }
            }
        }
    }
};

const OverviewContent = ({
    summary,
    monthly,
    tripDist,
    smallChartHeight,
    overviewSpacing,
    lineChartOptions,
    lineChartData,
    pieChartData,
    trips,
    settings,
    onInsightClick,
    onOdometerClick,
    showOdometerModal,
    onCloseOdometerModal,
    insightType,
    onCloseInsightModal,
    isActive = true
}) => {
    const { t } = useTranslation();
    const { isCompact, isLargerCard, isVertical } = useLayout();

    const getStatsConfig = () => [
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
            onClick: () => onInsightClick('energy')
        },
        {
            key: 'trips',
            icon: Car,
            label: t('stats.trips'),
            value: summary.totalTrips,
            unit: "",
            color: "bg-amber-500/20 text-amber-400",
            sub: `${summary.tripsDay}/${t('units.day')}`,
            onClick: () => onInsightClick('trips')
        },
        summary.isHybrid ? {
            key: 'stationary',
            icon: Activity,
            label: t('stats.stationary'),
            value: summary.stationaryConsumption,
            unit: t('units.kWh'),
            color: "bg-yellow-500/20 text-yellow-500",
            onClick: () => onInsightClick('stationary')
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
        summary.isHybrid ? {
            key: 'fuel',
            icon: Fuel,
            label: t('hybrid.avgFuelEfficiency'),
            value: summary.avgFuelEff,
            unit: "L/100km",
            color: "bg-amber-500/20 text-amber-500",
            onClick: () => onInsightClick('fuel')
        } : {
            key: 'stationary_ev',
            icon: Activity,
            label: t('stats.stationary'),
            value: summary.stationaryConsumption,
            unit: t('units.kWh'),
            color: "bg-yellow-500/20 text-yellow-500",
            onClick: () => onInsightClick('stationary')
        },
        {
            key: 'avgTrip',
            icon: MapPin,
            label: t('stats.avgTrip'),
            value: summary.avgKm,
            unit: t('units.km'),
            color: "bg-orange-500/20 text-orange-400",
            sub: `${summary.avgMin} min`,
            onClick: () => onInsightClick('avgTrip')
        },
        {
            key: 'speed',
            icon: TrendingUp,
            label: t('stats.speed'),
            value: summary.avgSpeed,
            unit: t('units.kmh'),
            color: "bg-blue-500/20 text-blue-400",
            onClick: () => onInsightClick('speed')
        }
    ];

    const statItems = getStatsConfig();

    return (
        <div className={`${overviewSpacing}`}>
            {/* Stats Grid */}
            <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${isCompact ? '!gap-3' : ''}`}>
                {statItems.slice(0, 4).map(item => (
                    <StatCard
                        key={item.key}
                        isVerticalMode={isVertical}
                        isLarger={isLargerCard}
                        isCompact={isCompact}
                        {...item}
                    />
                ))}
            </div>
            <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${isCompact ? '!gap-3' : ''}`}>
                {statItems.slice(4, 8).map(item => (
                    <StatCard
                        key={item.key}
                        isVerticalMode={isVertical}
                        isLarger={isLargerCard}
                        isCompact={isCompact}
                        {...item}
                    />
                ))}
            </div>

            {/* Hybrid Stats Card */}
            {summary.isHybrid && (
                <div className={`grid grid-cols-2 gap-4 ${isCompact ? '!gap-3' : ''}`}>
                    <HybridStatsCard summary={summary} isCompact={isCompact} isVertical={false} />
                </div>
            )}

            {/* Charts */}
            <div className={`grid gap-4 ${isCompact ? 'grid-cols-1 lg:grid-cols-2 !gap-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
                <ChartCard isCompact={isCompact} title={t('charts.monthlyDist')}>
                    <div key="line-container-h" style={{ width: '100%', height: smallChartHeight }}>
                        {/* Used isActive in key to force remount and animation on tab switch */}
                        <LineJS key={`overview-line-h-${isActive}`} options={lineChartOptions} data={lineChartData} />
                    </div>
                </ChartCard>
                <ChartCard isCompact={isCompact} title={t('charts.tripDist')}>
                    <div className="flex flex-row items-center gap-4">
                        <div className="w-1/2">
                            <div key="pie-container-h" style={{ width: '100%', height: smallChartHeight }}>
                                {/* Used isActive in key to force remount and animation on tab switch */}
                                <PieJS key={`overview-pie-h-${isActive}`} options={PIE_CHART_OPTIONS} data={pieChartData} />
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
            />
            <OdometerAdjustmentModal
                isOpen={showOdometerModal}
                onClose={onCloseOdometerModal}
            />
        </div>
    );
};

OverviewContent.propTypes = {
    summary: PropTypes.object.isRequired,
    monthly: PropTypes.array.isRequired,
    tripDist: PropTypes.array.isRequired,
    smallChartHeight: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    overviewSpacing: PropTypes.string.isRequired,
    lineChartOptions: PropTypes.object.isRequired,
    lineChartData: PropTypes.object.isRequired,
    pieChartData: PropTypes.object.isRequired,
    trips: PropTypes.array,
    settings: PropTypes.object,
    onInsightClick: PropTypes.func.isRequired,
    onOdometerClick: PropTypes.func.isRequired,
    showOdometerModal: PropTypes.bool.isRequired,
    onCloseOdometerModal: PropTypes.func.isRequired,
    insightType: PropTypes.string,
    onCloseInsightModal: PropTypes.func.isRequired
};

export default OverviewContent;
