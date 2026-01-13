// BYD Stats - Overview Tab Component
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Line as LineJS, Pie as PieJS } from 'react-chartjs-2';
import { MapPin, Zap, Car, Clock, Battery, TrendingUp, Calendar, BYD_RED } from '../Icons.jsx';
import StatCard from '../ui/StatCard';
import ChartCard from '../ui/ChartCard';

// Static chart options that don't change
const LINE_CHART_OPTIONS_BASE = {
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { display: false } },
  elements: { line: { tension: 0.4 }, point: { hitRadius: 20, hoverRadius: 6 } }
};

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

/**
 * Overview tab showing main statistics and charts
 */
const OverviewTab = React.memo(({
  summary,
  monthly,
  tripDist,
  isCompact,
  isLargerCard,
  isVertical,
  isFullscreenBYD,
  smallChartHeight,
  overviewSpacing
}) => {
  const { t } = useTranslation();

  // Memoize chart options with scales
  const lineChartOptionsVertical = useMemo(() => ({
    ...LINE_CHART_OPTIONS_BASE,
    scales: {
      y: { beginAtZero: true, border: { dash: [3, 3] }, grid: { color: 'rgba(203, 213, 225, 0.3)' } },
      x: { grid: { display: false } }
    }
  }), []);

  const lineChartOptionsHorizontal = useMemo(() => ({
    ...LINE_CHART_OPTIONS_BASE,
    scales: {
      y: { beginAtZero: true, border: { dash: [] }, grid: { color: 'rgba(203, 213, 225, 0.3)', borderDash: [3, 3], drawBorder: false } },
      x: { border: { dash: [] }, grid: { display: false } }
    }
  }), []);

  // Memoize chart data
  const lineChartData = useMemo(() => ({
    labels: monthly.map(m => m.monthLabel),
    datasets: [{
      label: 'Km',
      data: monthly.map(m => m.km),
      borderColor: BYD_RED,
      backgroundColor: 'rgba(234, 0, 41, 0.1)',
      fill: true,
      pointBackgroundColor: BYD_RED,
      pointRadius: 4,
      borderWidth: 2
    }]
  }), [monthly]);

  const pieChartData = useMemo(() => ({
    labels: tripDist.map(d => `${d.range} km`),
    datasets: [{
      data: tripDist.map(d => d.count),
      backgroundColor: tripDist.map(d => d.color),
      borderWidth: 0,
      hoverOffset: 4
    }]
  }), [tripDist]);

  // Render vertical layout
  if (isVertical) {
    return (
      <div className={`${overviewSpacing}`}>
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${isCompact ? '!gap-3' : ''}`}>
          <StatCard
            isVerticalMode={true}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={MapPin}
            label={t('stats.distance')}
            value={summary.totalKm}
            unit={t('units.km')}
            color="bg-red-500/20 text-red-400"
            sub={`${summary.kmDay} ${t('units.km')}/${t('units.day')}`}
          />
          <StatCard
            isVerticalMode={true}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Zap}
            label={t('stats.energy')}
            value={summary.totalKwh}
            unit={t('units.kWh')}
            color="bg-cyan-500/20 text-cyan-400"
          />
          <StatCard
            isVerticalMode={true}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Car}
            label={t('stats.trips')}
            value={summary.totalTrips}
            unit=""
            color="bg-amber-500/20 text-amber-400"
            sub={`${summary.tripsDay}/${t('units.day')}`}
          />
          <StatCard
            isVerticalMode={true}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Clock}
            label={t('stats.time')}
            value={summary.totalHours}
            unit="h"
            color="bg-purple-500/20 text-purple-400"
          />
        </div>
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${isCompact ? '!gap-3' : ''}`}>
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
            icon={TrendingUp}
            label={t('stats.speed')}
            value={summary.avgSpeed}
            unit={t('units.kmh')}
            color="bg-blue-500/20 text-blue-400"
          />
          <StatCard
            isVerticalMode={true}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={MapPin}
            label={t('stats.avgTrip')}
            value={summary.avgKm}
            unit={t('units.km')}
            color="bg-orange-500/20 text-orange-400"
            sub={`${summary.avgMin} min`}
          />
          <StatCard
            isVerticalMode={true}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Calendar}
            label={t('stats.activeDays')}
            value={summary.daysActive}
            unit=""
            color="bg-pink-500/20 text-pink-400"
          />
        </div>
        <div className={`grid md:grid-cols-2 gap-4 sm:gap-6 ${isCompact ? '!gap-3' : ''}`}>
          <ChartCard isCompact={isCompact} title={t('charts.monthlyDist')}>
            <div style={{ width: '100%', height: smallChartHeight }}>
              <LineJS options={lineChartOptionsVertical} data={lineChartData} />
            </div>
          </ChartCard>
          <ChartCard isCompact={isCompact} title={t('charts.tripDist')}>
            <div className={`flex items-center ${isCompact ? 'flex-col' : 'md:flex-row flex-col gap-4'}`}>
              <div className={isCompact ? 'w-full' : 'md:w-1/2 w-full'}>
                <div style={{ width: '100%', height: smallChartHeight }}>
                  <PieJS options={PIE_CHART_OPTIONS} data={pieChartData} />
                </div>
              </div>
              <div className={`grid ${isCompact ? 'grid-cols-1 w-full gap-1' : 'md:grid-cols-1 md:w-1/2 grid-cols-5 w-full gap-2 mt-4'} text-center`}>
                {tripDist.map((d, i) => (
                  <div key={i} className={`flex ${isCompact ? 'flex-row items-center justify-between px-4 py-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-lg' : 'flex-col items-center'}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }}></div>
                      <p className={`text-slate-600 dark:text-slate-400 truncate ${isCompact ? 'text-[11px]' : 'text-[9px] sm:text-[10px]'}`}>{d.range}km</p>
                    </div>
                    <p className={`font-bold text-slate-900 dark:text-white ${isCompact ? 'text-sm' : 'text-xs sm:text-sm'}`}>{d.count}</p>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        </div>
      </div>
    );
  }

  // Render horizontal layout
  return (
    <div className={`${overviewSpacing}`}>
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 ${isCompact ? '!gap-3' : ''}`}>
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={MapPin}
          label={t('stats.distance')}
          value={summary.totalKm}
          unit={t('units.km')}
          color="bg-red-500/20 text-red-400"
          sub={`${summary.kmDay} ${t('units.km')}/${t('units.day')}`}
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Zap}
          label={t('stats.energy')}
          value={summary.totalKwh}
          unit={t('units.kWh')}
          color="bg-cyan-500/20 text-cyan-400"
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Car}
          label={t('stats.trips')}
          value={summary.totalTrips}
          unit=""
          color="bg-amber-500/20 text-amber-400"
          sub={`${summary.tripsDay}/${t('units.day')}`}
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Clock}
          label={t('stats.time')}
          value={summary.totalHours}
          unit="h"
          color="bg-purple-500/20 text-purple-400"
        />
      </div>
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 ${isCompact ? '!gap-3' : ''}`}>
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Battery}
          label={t('stats.efficiency')}
          value={summary.avgEff}
          unit={t('units.kWh100km')}
          color="bg-green-500/20 text-green-400"
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={TrendingUp}
          label={t('stats.speed')}
          value={summary.avgSpeed}
          unit={t('units.kmh')}
          color="bg-blue-500/20 text-blue-400"
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={MapPin}
          label={t('stats.avgTrip')}
          value={summary.avgKm}
          unit={t('units.km')}
          color="bg-orange-500/20 text-orange-400"
          sub={`${summary.avgMin} min`}
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Calendar}
          label={t('stats.activeDays')}
          value={summary.daysActive}
          unit=""
          color="bg-pink-500/20 text-pink-400"
        />
      </div>
      <div className={`grid gap-4 ${isCompact ? 'grid-cols-1 lg:grid-cols-2 !gap-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
        <ChartCard isCompact={isCompact} title={t('charts.monthlyDist')}>
          <div style={{ width: '100%', height: smallChartHeight }}>
            <LineJS options={lineChartOptionsHorizontal} data={lineChartData} />
          </div>
        </ChartCard>
        <ChartCard isCompact={isCompact} title={t('charts.tripDist')}>
          <div className="flex flex-row items-center gap-4">
            <div className="w-1/2">
              <div style={{ width: '100%', height: smallChartHeight }}>
                <PieJS options={PIE_CHART_OPTIONS} data={pieChartData} />
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
    </div>
  );
});

OverviewTab.displayName = 'OverviewTab';

export default OverviewTab;
