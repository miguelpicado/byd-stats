// BYD Stats - Trends Tab Component
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar as BarJS, Line as LineJS } from 'react-chartjs-2';
import { Navigation, Battery, Zap, TrendingUp, BYD_RED } from '../Icons.jsx';
import StatCard from '../ui/StatCard';
import ChartCard from '../ui/ChartCard';

const COMPACT_SPACE_Y = 'space-y-3';

// Static chart options that don't change
const BAR_CHART_OPTIONS = {
  maintainAspectRatio: false,
  scales: {
    y: { beginAtZero: true, position: 'left', border: { dash: [] }, ticks: { color: BYD_RED }, grid: { color: 'rgba(203, 213, 225, 0.3)', borderDash: [3, 3], drawBorder: false } },
    y1: { beginAtZero: true, position: 'right', border: { dash: [] }, ticks: { color: '#06b6d4' }, grid: { drawOnChartArea: false } },
    x: { border: { dash: [] }, grid: { display: false } }
  },
  plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 10, usePointStyle: true, font: { size: 10 } } } }
};

const LINE_CHART_OPTIONS = {
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  scales: {
    y: { beginAtZero: true, border: { dash: [] }, grid: { color: 'rgba(203, 213, 225, 0.3)', borderDash: [3, 3], drawBorder: false } },
    x: { border: { dash: [] }, grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45, font: { size: 9 } } }
  },
  plugins: { legend: { display: false } },
  elements: { line: { tension: 0.4 }, point: { hitRadius: 20, hoverRadius: 5 } }
};

/**
 * Trends tab showing insights and long-term trends
 */
const TrendsTab = React.memo(({
  filtered,
  summary,
  monthly,
  daily,
  settings,
  isCompact,
  isLargerCard,
  isVertical,
  largeChartHeight
}) => {
  const { t } = useTranslation();

  // Calculate insights based on filtered data
  const insights = useMemo(() => {
    const tripData = filtered || [];
    const avgKmPerTrip = parseFloat(summary?.avgKm) || 0;
    const longTripThreshold = avgKmPerTrip * 3;
    const longTrips = tripData.filter(t => (t.trip || 0) >= longTripThreshold);
    const totalDays = summary?.totalDays || summary?.daysActive || 1;
    const daysPerLongTrip = longTrips.length > 0 ? Math.round(totalDays / longTrips.length) : 0;

    // Median efficiency
    const efficiencies = tripData
      .map(t => t.trip && t.trip > 0 && t.electricity != null ? (t.electricity / t.trip) * 100 : 0)
      .filter(e => e > 0)
      .sort((a, b) => a - b);
    const medianEfficiency = efficiencies.length > 0
      ? efficiencies[Math.floor(efficiencies.length / 2)]
      : 0;

    // Daily kWh average
    const dailyKwh = (parseFloat(summary?.totalKwh || 0) / totalDays);

    // Monthly cost
    const electricityPrice = settings?.electricityPrice || 0.15;
    const monthlyData = monthly || [];
    const avgMonthlyKwh = monthlyData.length > 0
      ? monthlyData.reduce((sum, m) => sum + (m.kwh || 0), 0) / monthlyData.length
      : 0;
    const monthlyCost = avgMonthlyKwh * electricityPrice;

    return {
      daysPerLongTrip,
      medianEfficiency,
      dailyKwh,
      monthlyCost
    };
  }, [filtered, summary, monthly, settings]);

  // Memoize chart data
  const barChartData = useMemo(() => ({
    labels: monthly.map(m => m.monthLabel),
    datasets: [
      { label: 'Km', data: monthly.map(m => m.km), backgroundColor: BYD_RED, yAxisID: 'y', borderRadius: 4 },
      { label: 'kWh', data: monthly.map(m => m.kwh), backgroundColor: '#06b6d4', yAxisID: 'y1', borderRadius: 4 }
    ]
  }), [monthly]);

  const lineChartData = useMemo(() => ({
    labels: daily.slice(-60).map(d => d.dateLabel),
    datasets: [{
      label: 'Km',
      data: daily.slice(-60).map(d => d.km),
      borderColor: BYD_RED,
      backgroundColor: 'rgba(234, 0, 41, 0.1)',
      fill: true,
      pointRadius: 0,
      pointHoverRadius: 5,
      borderWidth: 2
    }]
  }), [daily]);

  // Render vertical layout
  if (isVertical) {
    return (
      <div className={isCompact ? 'space-y-3' : 'space-y-4'}>
        <div className={`grid gap-3 sm:gap-4 ${isCompact ? 'grid-cols-4 !gap-3' : 'grid-cols-2 md:grid-cols-4'}`}>
          <StatCard
            isVerticalMode={true}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Navigation}
            label={t('stats.longTripEvery')}
            value={insights.daysPerLongTrip}
            unit={t('units.days')}
            color="bg-purple-500/20 text-purple-400"
          />
          <StatCard
            isVerticalMode={true}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Battery}
            label={t('stats.medianEff')}
            value={insights.medianEfficiency.toFixed(2)}
            unit={t('units.kWh100km')}
            color="bg-green-500/20 text-green-400"
          />
          <StatCard
            isVerticalMode={true}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Zap}
            label={t('stats.dailyCharge')}
            value={insights.dailyKwh.toFixed(2)}
            unit={t('units.kWhDay')}
            color="bg-cyan-500/20 text-cyan-400"
          />
          <StatCard
            isVerticalMode={true}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={TrendingUp}
            label={t('stats.monthlyCost')}
            value={insights.monthlyCost.toFixed(2)}
            unit="€/mes"
            color="bg-amber-500/20 text-amber-400"
          />
        </div>
        <div className={`grid md:grid-cols-2 gap-4 sm:gap-6 ${isCompact ? '!gap-3' : ''}`}>
          <ChartCard isCompact={isCompact} title={t('charts.monthlyKmKwh')}>
            <div style={{ width: '100%', height: largeChartHeight }}>
              <BarJS options={BAR_CHART_OPTIONS} data={barChartData} />
            </div>
          </ChartCard>
          <ChartCard isCompact={isCompact} title={t('charts.last60Days')}>
            <div style={{ width: '100%', height: largeChartHeight }}>
              <LineJS options={LINE_CHART_OPTIONS} data={lineChartData} />
            </div>
          </ChartCard>
        </div>
      </div>
    );
  }

  // Render horizontal layout
  return (
    <div className={isCompact ? COMPACT_SPACE_Y : 'space-y-4 sm:space-y-6'}>
      <div className={`grid gap-4 ${isCompact ? 'grid-cols-4 !gap-3' : 'grid-cols-2 md:grid-cols-4'}`}>
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Navigation}
          label={t('stats.longTripEvery')}
          value={insights.daysPerLongTrip}
          unit={t('units.days')}
          color="bg-purple-500/20 text-purple-400"
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Battery}
          label={t('stats.medianEff')}
          value={insights.medianEfficiency.toFixed(2)}
          unit={t('units.kWh100km')}
          color="bg-green-500/20 text-green-400"
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Zap}
          label={t('stats.dailyCharge')}
          value={insights.dailyKwh.toFixed(2)}
          unit={t('units.kWhDay')}
          color="bg-cyan-500/20 text-cyan-400"
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={TrendingUp}
          label={t('stats.monthlyCost')}
          value={insights.monthlyCost.toFixed(2)}
          unit="€/mes"
          color="bg-amber-500/20 text-amber-400"
        />
      </div>
      <div className={`grid gap-4 ${isCompact ? 'grid-cols-1 lg:grid-cols-2 !gap-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
        <ChartCard isCompact={isCompact} title={t('charts.monthlyKmKwh')}>
          <div style={{ width: '100%', height: largeChartHeight }}>
            <BarJS options={BAR_CHART_OPTIONS} data={barChartData} />
          </div>
        </ChartCard>
        <ChartCard isCompact={isCompact} title={t('charts.last60Days')}>
          <div style={{ width: '100%', height: largeChartHeight }}>
            <LineJS options={LINE_CHART_OPTIONS} data={lineChartData} />
          </div>
        </ChartCard>
      </div>
    </div>
  );
});

TrendsTab.displayName = 'TrendsTab';

export default TrendsTab;
