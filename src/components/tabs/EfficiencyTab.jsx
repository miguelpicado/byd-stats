// BYD Stats - Efficiency Tab Component
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Line as LineJS, Scatter as ScatterJS } from 'react-chartjs-2';
import { Battery, Zap, MapPin, TrendingUp, BYD_RED } from '../Icons.jsx';
import StatCard from '../ui/StatCard';
import ChartCard from '../ui/ChartCard';
import { useLayout } from '../../context/LayoutContext';

const COMPACT_SPACE_Y = 'space-y-3';

// Static base options for line chart
const LINE_CHART_BASE = {
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { display: false } },
  elements: { point: { hitRadius: 20, hoverRadius: 6 } }
};

// Static scatter chart tick callback
const scatterTickCallback = function (value) {
  const allowed = [1, 2, 5, 10, 50, 200, 500];
  return allowed.includes(value) ? value : '';
};

// Scatter tooltip callback
const scatterTooltipCallback = (c) => `Dist: ${c.raw.x.toFixed(1)}km, Eff: ${c.raw.y.toFixed(1)}`;

/**
 * Efficiency tab showing consumption patterns and efficiency analysis
 */
const EfficiencyTab = React.memo(({
  summary,
  monthly,
  effScatter,
  largeChartHeight
}) => {
  const { t } = useTranslation();
  const { isCompact, isLargerCard, isVertical } = useLayout();

  // Calculate consumption per trip
  const consumptionPerTrip = useMemo(() => {
    return (parseFloat(summary.totalKwh) / summary.totalTrips).toFixed(2);
  }, [summary.totalKwh, summary.totalTrips]);

  // Calculate y-axis min/max for efficiency chart
  const efficiencyYAxis = useMemo(() => {
    const validEfficiencies = monthly.map(m => m.efficiency).filter(e => e !== null && e !== undefined && e !== 0);
    if (validEfficiencies.length === 0) {
      return { min: 0, max: 30 };
    }
    return {
      min: Math.floor(Math.min(...validEfficiencies)) - 1,
      max: Math.ceil(Math.max(...validEfficiencies)) + 1
    };
  }, [monthly]);

  // Memoize line chart options (depends on efficiencyYAxis)
  const lineChartOptions = useMemo(() => ({
    ...LINE_CHART_BASE,
    scales: {
      y: {
        beginAtZero: false,
        min: efficiencyYAxis.min,
        max: efficiencyYAxis.max,
        border: { dash: [] },
        grid: { color: 'rgba(203, 213, 225, 0.3)', borderDash: [3, 3], drawBorder: false },
        ticks: { font: { size: 10 } }
      },
      x: { border: { dash: [] }, grid: { display: false }, ticks: { font: { size: 10 } } }
    }
  }), [efficiencyYAxis]);

  // Memoize scatter chart options
  const scatterChartOptions = useMemo(() => ({
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'logarithmic',
        position: 'bottom',
        title: { display: true, text: `${t('stats.distance')} (km)`, font: { size: 10 } },
        border: { dash: [] },
        grid: { display: true, borderDash: [3, 3], drawBorder: false },
        min: 1,
        max: 500,
        ticks: {
          font: { size: 10 },
          callback: scatterTickCallback,
          autoSkip: false,
          maxRotation: 0
        }
      },
      y: {
        title: { display: true, text: t('stats.efficiency'), font: { size: 10 } },
        border: { dash: [] },
        grid: { color: 'rgba(203, 213, 225, 0.3)', borderDash: [3, 3], drawBorder: false },
        ticks: { font: { size: 10 } }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: scatterTooltipCallback } }
    },
    interaction: { mode: 'nearest', axis: 'xy', intersect: true }
  }), [t]);

  // Memoize chart data
  const lineChartData = useMemo(() => ({
    labels: monthly.map(m => m.monthLabel),
    datasets: [{
      label: 'kWh/100km',
      data: monthly.map(m => m.efficiency),
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      fill: true,
      pointBackgroundColor: '#10b981',
      tension: 0.4,
      pointRadius: 4
    }]
  }), [monthly]);

  const scatterChartData = useMemo(() => ({
    datasets: [{
      label: 'Eficiencia',
      data: effScatter,
      backgroundColor: BYD_RED,
      pointRadius: 4
    }]
  }), [effScatter]);

  // Render vertical layout
  if (isVertical) {
    return (
      <div className={isCompact ? 'space-y-3' : 'space-y-4'}>
        <div className={`grid gap-3 sm:gap-4 ${isCompact ? 'grid-cols-4 !gap-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
          <StatCard
            isVerticalMode={true}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Battery}
            label={t('stats.efficiency')}
            value={summary.avgEff}
            unit={t('units.kWh100km')}
            color="bg-green-500/20 text-green-400"
          />
          <StatCard
            isVerticalMode={true}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Zap}
            label={t('stats.consumptionPerTrip')}
            value={consumptionPerTrip}
            unit={t('units.kWh')}
            color="bg-cyan-500/20 text-cyan-400"
          />
          <StatCard
            isVerticalMode={true}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={MapPin}
            label={t('stats.avgDistance')}
            value={summary.avgKm}
            unit={t('units.km')}
            color="bg-purple-500/20 text-purple-400"
          />
          <StatCard
            isVerticalMode={true}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={TrendingUp}
            label={t('stats.avgSpeed')}
            value={summary.avgSpeed}
            unit={t('units.kmh')}
            color="bg-blue-500/20 text-blue-400"
          />
        </div>
        <div className={`grid md:grid-cols-2 gap-4 sm:gap-6 ${isCompact ? '!gap-3' : ''}`}>
          <ChartCard isCompact={isCompact} title={`📈 ${t('charts.monthlyEff')}`}>
            <div style={{ width: '100%', height: largeChartHeight }}>
              <LineJS options={lineChartOptions} data={lineChartData} />
            </div>
          </ChartCard>
          <ChartCard isCompact={isCompact} title={`📍 ${t('charts.effVsDist')}`}>
            <div style={{ width: '100%', height: largeChartHeight }}>
              <ScatterJS options={scatterChartOptions} data={scatterChartData} />
            </div>
          </ChartCard>
        </div>
      </div>
    );
  }

  // Render horizontal layout
  return (
    <div className={isCompact ? COMPACT_SPACE_Y : 'space-y-4 sm:space-y-6'}>
      <div className={`grid gap-4 ${isCompact ? 'grid-cols-4 !gap-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Battery}
          label={t('stats.efficiency')}
          value={summary.avgEff}
          unit="kWh/100km"
          color="bg-green-500/20 text-green-400"
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Zap}
          label={t('stats.consumptionPerTrip')}
          value={consumptionPerTrip}
          unit="kWh"
          color="bg-cyan-500/20 text-cyan-400"
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={MapPin}
          label={t('stats.avgDistance')}
          value={summary.avgKm}
          unit="km"
          color="bg-purple-500/20 text-purple-400"
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={TrendingUp}
          label={t('stats.avgSpeed')}
          value={summary.avgSpeed}
          unit="km/h"
          color="bg-blue-500/20 text-blue-400"
        />
      </div>
      <div className={`grid gap-4 ${isCompact ? 'grid-cols-1 lg:grid-cols-2 !gap-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
        <ChartCard isCompact={isCompact} title={`📈 ${t('charts.monthlyEff')}`}>
          <div style={{ width: '100%', height: largeChartHeight }}>
            <LineJS options={lineChartOptions} data={lineChartData} />
          </div>
        </ChartCard>
        <ChartCard isCompact={isCompact} title={`📍 ${t('charts.effVsDist')}`}>
          <div style={{ width: '100%', height: largeChartHeight }}>
            <ScatterJS options={scatterChartOptions} data={scatterChartData} />
          </div>
        </ChartCard>
      </div>
    </div>
  );
});

EfficiencyTab.displayName = 'EfficiencyTab';

export default EfficiencyTab;
