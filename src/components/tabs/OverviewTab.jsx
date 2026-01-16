// BYD Stats - Overview Tab Component
import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Line as LineJS, Pie as PieJS } from 'react-chartjs-2';
import { MapPin, Zap, Car, Clock, Battery, TrendingUp, Calendar, BYD_RED } from '../Icons.jsx';
import StatCard from '../ui/StatCard';
import ChartCard from '../ui/ChartCard';
import FloatingActionButton from '../common/FloatingActionButton';
import TripInsightsModal from '../modals/TripInsightsModal'; // NEW
import { useLayout } from '../../context/LayoutContext';

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
  smallChartHeight,

  overviewSpacing,
  onAddCharge,
  trips = [] // NEW
}) => {
  const { t } = useTranslation();
  const { isCompact, isLargerCard, isVertical } = useLayout();
  const [insightType, setInsightType] = useState(null); // NEW

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
            onClick={() => setInsightType('distance')}
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
            onClick={() => setInsightType('energy')}
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
            onClick={() => setInsightType('trips')}
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
            onClick={() => setInsightType('time')}
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
            onClick={() => setInsightType('efficiency')}
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
            onClick={() => setInsightType('speed')}
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
            onClick={() => setInsightType('avgTrip')}
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
            onClick={() => setInsightType('activeDays')}
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


        {
          isVertical && onAddCharge && (
            <FloatingActionButton
              onClick={onAddCharge}
              label={t('charges.addCharge')}
              icon={Battery}
            />
          )
        }

        <TripInsightsModal
          isOpen={!!insightType}
          onClose={() => setInsightType(null)}
          type={insightType || 'distance'}
          trips={trips}
        />
      </div >
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
          onClick={() => setInsightType('distance')}
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Zap}
          label={t('stats.energy')}
          value={summary.totalKwh}
          unit={t('units.kWh')}
          color="bg-cyan-500/20 text-cyan-400"
          onClick={() => setInsightType('energy')}
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
          onClick={() => setInsightType('trips')}
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Clock}
          label={t('stats.time')}
          value={summary.totalHours}
          unit="h"
          color="bg-purple-500/20 text-purple-400"
          onClick={() => setInsightType('time')}
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
          onClick={() => setInsightType('efficiency')}
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={TrendingUp}
          label={t('stats.speed')}
          value={summary.avgSpeed}
          unit={t('units.kmh')}
          color="bg-blue-500/20 text-blue-400"
          onClick={() => setInsightType('speed')}
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
          onClick={() => setInsightType('avgTrip')}
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Calendar}
          label={t('stats.activeDays')}
          value={summary.daysActive}
          unit=""
          color="bg-pink-500/20 text-pink-400"
          onClick={() => setInsightType('activeDays')}
        />
      </div>
      <div className={`grid gap-4 ${isCompact ? 'grid-cols-1 lg:grid-cols-2 !gap-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
        <ChartCard isCompact={isCompact} title={t('charts.monthlyDist')}>
          <div key="line-container-h" style={{ width: '100%', height: smallChartHeight }}>
            <LineJS key="overview-line-h" redraw={true} options={lineChartOptionsHorizontal} data={lineChartData} />
          </div>
        </ChartCard>
        <ChartCard isCompact={isCompact} title={t('charts.tripDist')}>
          <div className="flex flex-row items-center gap-4">
            <div className="w-1/2">
              <div key="pie-container-h" style={{ width: '100%', height: smallChartHeight }}>
                <PieJS key="overview-pie-h" redraw={true} options={PIE_CHART_OPTIONS} data={pieChartData} />
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
        onClose={() => setInsightType(null)}
        type={insightType || 'distance'}
        trips={trips}
      />
    </div>
  );
});

OverviewTab.propTypes = {
  summary: PropTypes.shape({
    totalKm: PropTypes.string,
    kmDay: PropTypes.string,
    totalKwh: PropTypes.string,
    totalTrips: PropTypes.number,
    tripsDay: PropTypes.string,
    totalHours: PropTypes.string,
    avgEff: PropTypes.string,
    avgSpeed: PropTypes.string,
    avgKm: PropTypes.string,
    avgMin: PropTypes.string,
    daysActive: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  }).isRequired,
  monthly: PropTypes.arrayOf(PropTypes.shape({
    monthLabel: PropTypes.string,
    km: PropTypes.number
  })).isRequired,
  tripDist: PropTypes.arrayOf(PropTypes.shape({
    range: PropTypes.string,
    count: PropTypes.number,
    color: PropTypes.string
  })).isRequired,
  smallChartHeight: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,

  overviewSpacing: PropTypes.string.isRequired,
  onAddCharge: PropTypes.func,
  trips: PropTypes.array // NEW
};

OverviewTab.displayName = 'OverviewTab';

export default OverviewTab;
