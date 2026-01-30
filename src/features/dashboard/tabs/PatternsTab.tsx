import React, { useMemo, useRef, useEffect, FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar as BarJS, Radar as RadarJS } from 'react-chartjs-2';
import { Calendar, Clock, TrendingUp, BYD_RED, Car } from '@components/Icons';
import StatCard from '@components/ui/StatCard';
import ChartCard from '@components/ui/ChartCard';
import { useLayout } from '@/context/LayoutContext';
import { Summary } from '@/types';

interface PatternsTabProps {
  weekday: { day: string; trips: number; km: number }[];
  hourly: { hour: number; trips: number; km: number }[];
  summary: Summary | null;
  patternsSpacing: number;
  patternsChartHeight: number;
  isActive?: boolean;
}

const COMPACT_SPACE_Y = 'space-y-3';

// Static chart options that don't change
const BAR_CHART_OPTIONS_VERTICAL = {
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      border: { display: false, dash: [] },
      grid: { color: 'rgba(203, 213, 225, 0.3)', tickBorderDash: [3, 3] },
      ticks: { font: { size: 10 } }
    },
    x: {
      border: { display: false, dash: [] },
      grid: { tickBorderDash: [3, 3] },
      ticks: { font: { size: 10 } }
    }
  },
  plugins: { legend: { display: false } }
};

const RADAR_CHART_OPTIONS_VERTICAL = {
  maintainAspectRatio: false,
  scales: { r: { grid: { color: '#94a3b8', borderDash: [3, 3] }, ticks: { display: false }, pointLabels: { font: { size: 10 }, color: '#64748b' } } },
  plugins: { legend: { display: false } },
  interaction: { mode: 'index' as const, intersect: false }
};

const BAR_CHART_OPTIONS_HORIZONTAL = {
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      border: { display: false, dash: [] },
      grid: { color: 'rgba(203, 213, 225, 0.3)', tickBorderDash: [3, 3] },
      ticks: { font: { size: 10 } }
    },
    x: {
      border: { display: false, dash: [] },
      grid: { display: false },
      ticks: { font: { size: 10 } }
    }
  },
  plugins: { legend: { display: false } }
};

const RADAR_CHART_OPTIONS_HORIZONTAL = {
  maintainAspectRatio: false,
  scales: { r: { grid: { color: '#94a3b8', borderDash: [3, 3] }, ticks: { display: false }, pointLabels: { font: { size: 10 }, color: '#64748b' } } },
  plugins: { legend: { display: false } }
};

/**
 * Patterns tab showing usage patterns by hour and day
 */
const PatternsTab: FC<PatternsTabProps> = React.memo(({
  weekday,
  hourly,
  summary,
  patternsChartHeight,
  isActive = true
}) => {
  const { t } = useTranslation();
  const { isCompact, isLargerCard, isVertical } = useLayout();

  // Refs for animation control
  const barChartRef = useRef<any>(null);
  const radarChartRef = useRef<any>(null);

  // Trigger animation on activation
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => {
        if (barChartRef.current) {
          barChartRef.current.reset();
          barChartRef.current.update();
        }
        if (radarChartRef.current) {
          radarChartRef.current.reset();
          radarChartRef.current.update();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  // Calculate top day and hour based on TRIPS
  const topDay = useMemo(() =>
    weekday.length > 0 ? weekday.reduce((a, b) => (a.trips || 0) > (b.trips || 0) ? a : b) : { day: 'mon', trips: 0 },
    [weekday]
  );

  const topHour = useMemo(() =>
    hourly.length > 0 ? hourly.reduce((a, b) => (a.trips || 0) > (b.trips || 0) ? a : b) : { hour: 0, trips: 0 },
    [hourly]
  );

  // Memoize chart data - USING TRIPS
  const barChartData = useMemo(() => ({
    labels: hourly.map(h => `${h.hour}h`),
    datasets: [{
      label: t('stats.trips'),
      data: hourly.map(h => h.trips),
      backgroundColor: '#f59e0b',
      borderRadius: 2
    }]
  }), [hourly, t]);

  const radarChartDataVertical = useMemo(() => ({
    labels: weekday.map(d => t(`daysShort.${d.day}`)),
    datasets: [{
      pointHitRadius: 50,
      label: t('stats.trips'),
      data: weekday.map(d => d.trips),
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.3)',
      borderWidth: 2,
      pointBackgroundColor: '#f59e0b',
      pointRadius: 3
    }]
  }), [weekday, t]);

  // Reuse data for horizontal layout
  const radarChartDataHorizontal = radarChartDataVertical;

  if (!summary) return null;

  if (isVertical) {
    return (
      <div className={isCompact ? 'space-y-3' : 'space-y-4'}>
        <div className={`grid gap-3 sm:gap-4 ${isCompact ? 'grid-cols-4 !gap-3' : 'grid-cols-2 md:grid-cols-4'}`}>
          <StatCard
            isVerticalMode={true}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Calendar}
            label={t('stats.freqDay')}
            value={t(`days.${topDay.day}`)}
            unit=""
            color="bg-amber-500/20 text-amber-400"
          />
          <StatCard
            isVerticalMode={true}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Clock}
            label={t('stats.peakHour')}
            value={`${topHour.hour.toString().padStart(2, '0')}:00h`}
            unit=""
            color="bg-purple-500/20 text-purple-400"
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
            sub={summary.tripsDay ? `${summary.tripsDay}/${t('units.day')}` : ''}
          />
          <StatCard
            isVerticalMode={true}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={TrendingUp}
            label={t('stats.dailyAvg')}
            value={summary.kmDay}
            unit={t('units.km')}
            color="bg-blue-500/20 text-blue-400"
          />
        </div>
        <div className={`grid md:grid-cols-2 gap-4 sm:gap-6 ${isCompact ? '!gap-3' : ''}`}>
          <ChartCard isCompact={isCompact} title={t('charts.byHour')}>
            <div style={{ width: '100%', height: patternsChartHeight }}>
              <BarJS ref={barChartRef} options={BAR_CHART_OPTIONS_VERTICAL} data={barChartData} />
            </div>
          </ChartCard>
          <ChartCard isCompact={isCompact} title={t('charts.byDay')}>
            <div style={{ width: '100%', height: patternsChartHeight }}>
              <RadarJS ref={radarChartRef} options={RADAR_CHART_OPTIONS_VERTICAL} data={radarChartDataVertical} />
            </div>
          </ChartCard>
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {weekday.map((d, i) => (
            <div key={i} className={`bg-white dark:bg-slate-800/50 rounded-lg sm:rounded-xl text-center border border-slate-200 dark:border-slate-700/50 ${isCompact ? 'p-1.5' : 'p-2 sm:p-3'}`}>
              <p className="text-slate-600 dark:text-slate-400 text-[10px] sm:text-xs">{t(`daysShort.${d.day}`)}</p>
              <p className={`font-bold text-slate-900 dark:text-white ${isCompact ? 'text-sm' : 'text-base sm:text-xl'}`}>{d.trips}</p>
              <p className="text-[9px] sm:text-xs" style={{ color: BYD_RED }}>{d.km.toFixed(0)} km</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Horizontal layout
  return (
    <div className={isCompact ? COMPACT_SPACE_Y : 'space-y-4 sm:space-y-6'}>
      <div className={`grid gap-4 ${isCompact ? 'grid-cols-4 !gap-3' : 'grid-cols-2 md:grid-cols-4'}`}>
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Calendar}
          label={t('stats.freqDay')}
          value={t(`days.${topDay.day}`)}
          unit=""
          color="bg-amber-500/20 text-amber-400"
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Clock}
          label={t('stats.peakHour')}
          value={`${topHour.hour.toString().padStart(2, '0')}:00h`}
          unit=""
          color="bg-purple-500/20 text-purple-400"
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Car}
          label={t('stats.trips')}
          value={summary.totalTrips}
          unit=""
          color="bg-amber-500/20 text-amber-400"
          sub={summary.tripsDay ? `${summary.tripsDay}/${t('units.day')}` : ''}
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={TrendingUp}
          label={t('stats.dailyAvg')}
          value={summary.kmDay}
          unit={t('units.km')}
          color="bg-blue-500/20 text-blue-400"
        />
      </div>
      <div className={`grid gap-4 ${isCompact ? 'grid-cols-1 lg:grid-cols-2 !gap-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
        <ChartCard isCompact={isCompact} title={t('charts.byHour')}>
          <div key="bar-container-h" style={{ width: '100%', height: patternsChartHeight }}>
            <BarJS ref={barChartRef} options={BAR_CHART_OPTIONS_HORIZONTAL} data={barChartData} />
          </div>
        </ChartCard>
        <ChartCard isCompact={isCompact} title={t('charts.byDay')}>
          <div key="radar-container-h" style={{ width: '100%', height: patternsChartHeight }}>
            <RadarJS ref={radarChartRef} options={RADAR_CHART_OPTIONS_HORIZONTAL} data={radarChartDataHorizontal} />
          </div>
        </ChartCard>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {weekday.map((d, i) => (
          <div key={i} className={`bg-white dark:bg-slate-800/50 rounded-lg sm:rounded-xl text-center border border-slate-200 dark:border-slate-700/50 ${isCompact ? 'p-1.5' : 'p-2 sm:p-3'}`}>
            <p className="text-slate-600 dark:text-slate-400 text-[10px] sm:text-xs">{t(`daysShort.${d.day}`)}</p>
            <p className={`font-bold text-slate-900 dark:text-white ${isCompact ? 'text-sm' : 'text-base sm:text-xl'}`}>{d.trips} {t('patterns.tripsWord')}</p>
            <p className="text-[9px] sm:text-xs" style={{ color: BYD_RED }}>{d.km.toFixed(0)} km</p>
          </div>
        ))}
      </div>
    </div>
  );
});

PatternsTab.displayName = 'PatternsTab';

export default PatternsTab;
