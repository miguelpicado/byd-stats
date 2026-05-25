import React, { FC, useCallback, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigation, Zap, Clock, Euro } from '@components/Icons';
import StatCard from '@components/ui/StatCard';
import ChartCard from '@components/ui/ChartCard';
import { formatDate } from '@core/dateUtils';
import { useLayout } from '@/context/LayoutContext';
import { useData } from '@/providers/DataProvider';
import { Summary, Trip } from '@/types';

interface RecordsTabProps {
  summary: Summary | null;
  top: {
    km: Trip[];
    kwh: Trip[];
    dur: Trip[];
    fuel?: Trip[];
    eff?: Trip[];
    speed?: Trip[];
  };
  recordsItemPadding: string;
  recordsItemPaddingHorizontal: string;
  recordsListHeightHorizontal: string;
  isActive?: boolean;
}

const COMPACT_SPACE_Y = 'space-y-3';

/**
 * Records tab showing max/min stats and top trips
 */
const RecordsTab: FC<RecordsTabProps> = React.memo(({
  summary,
  top,
  recordsItemPadding,
  recordsItemPaddingHorizontal,
  recordsListHeightHorizontal
}) => {
  const { t } = useTranslation();
  const { isCompact, isLargerCard, isVertical } = useLayout();
  const { setSelectedTrip, openModal } = useData();

  // Clicking any record row opens the Trip Detail modal for that trip
  const handleTripClick = useCallback((trip: Trip) => {
    setSelectedTrip(trip);
    openModal('tripDetail');
  }, [setSelectedTrip, openModal]);

  // Per-record value formatters
  const valKm = (tr: Trip) => `${tr.trip?.toFixed(1)} km`;
  const valKwh = (tr: Trip) => `${tr.electricity?.toFixed(1)} kWh`;
  const valDur = (tr: Trip) => `${((tr.duration || 0) / 60).toFixed(0)} min`;
  const valEff = (tr: Trip) => `${((tr.electricity || 0) / (tr.trip || 1) * 100).toFixed(1)} ${t('units.kWh100km')}`;
  const valSpeed = (tr: Trip) => `${((tr.trip || 0) / ((tr.duration || 1) / 3600)).toFixed(0)} km/h`;
  const valFuel = (tr: Trip) => `${tr.fuel?.toFixed(2)} L`;

  const renderRow = (trip: Trip, i: number, value: ReactNode, padding: string, amber = false) => (
    <div
      key={i}
      role="button"
      tabIndex={0}
      onClick={() => handleTripClick(trip)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTripClick(trip); } }}
      className={`flex justify-between items-center border-b ${amber ? 'border-amber-200 dark:border-amber-700/50' : 'border-slate-200 dark:border-slate-700/50'} last:border-0 cursor-pointer rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-colors ${padding}`}
    >
      <span className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[11px] truncate' : 'text-xs sm:text-sm'}`}>
        {i + 1}. {formatDate(trip.date)}
      </span>
      <span className={`font-medium ${amber ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'} ${isCompact ? 'text-[12px]' : 'text-sm sm:text-base'}`}>
        {value}
      </span>
    </div>
  );

  const renderList = (title: string, trips: Trip[] | undefined, valueFn: (tr: Trip) => ReactNode, amber = false) => {
    const padding = isVertical ? recordsItemPadding : recordsItemPaddingHorizontal;
    return (
      <ChartCard isCompact={isCompact} title={title}>
        <div className={isVertical ? 'space-y-1' : `flex flex-col justify-between ${recordsListHeightHorizontal}`}>
          {(trips || []).map((trip, i) => renderRow(trip, i, valueFn(trip), padding, amber))}
        </div>
      </ChartCard>
    );
  };

  if (!summary) return null;

  // Shared set of top lists, rendered identically in both layouts
  const topLists = (
    <>
      {renderList(`🥇 ${t('charts.topDist')}`, top.km, valKm)}
      {renderList(`⚡ ${t('charts.topCons')}`, top.kwh, valKwh)}
      {renderList(`⏱️ ${t('charts.topDur')}`, top.dur, valDur)}
      {renderList(`💚 ${t('charts.topEff')}`, top.eff, valEff)}
      {renderList(`🏎️ ${t('charts.topSpeed')}`, top.speed, valSpeed)}
      {summary.isHybrid && top.fuel && top.fuel.length > 0 &&
        renderList(`⛽ ${t('hybrid.topFuel')}`, top.fuel, valFuel, true)}
    </>
  );

  // Render vertical layout
  if (isVertical) {
    return (
      <div className={`space-y-3 sm:space-y-4 ${isCompact ? COMPACT_SPACE_Y : ''}`}>
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${isCompact ? '!gap-3' : ''}`}>
          <StatCard
            isVerticalMode={true}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Navigation}
            label={t('stats.longest')}
            value={summary.maxKm}
            unit={t('units.km')}
            color="bg-red-500/20 text-red-500"
          />
          <StatCard
            isVerticalMode={true}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Zap}
            label={t('stats.maxCons')}
            value={summary.maxKwh}
            unit={t('units.kWh')}
            color="bg-cyan-500/20 text-cyan-500"
          />
          <StatCard
            isVerticalMode={true}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Clock}
            label={t('stats.maxDur')}
            value={summary.maxMin}
            unit="min"
            color="bg-amber-500/20 text-amber-500"
          />
          <StatCard
            isVerticalMode={true}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Euro}
            label={t('stats.mostExpensive')}
            value={summary.maxCost}
            unit="€"
            color="bg-purple-500/20 text-purple-500"
            sub={formatDate(summary.maxCostDate)}
          />
        </div>
        <div className={`grid ${isCompact ? 'grid-cols-3' : 'grid-cols-1'} gap-3 sm:gap-6 ${isCompact ? '!gap-3' : ''}`}>
          {topLists}
        </div>
      </div>
    );
  }

  // Render horizontal layout
  return (
    <div className={`${isCompact ? COMPACT_SPACE_Y : 'space-y-4 sm:space-y-6'}`}>
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 ${isCompact ? '!gap-3' : ''}`}>
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Navigation}
          label={t('stats.longest')}
          value={summary.maxKm}
          unit={t('units.km')}
          color="bg-red-500/20 text-red-500"
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Zap}
          label={t('stats.maxCons')}
          value={summary.maxKwh}
          unit={t('units.kWh')}
          color="bg-cyan-500/20 text-cyan-500"
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Clock}
          label={t('stats.maxDur')}
          value={summary.maxMin}
          unit="min"
          color="bg-amber-500/20 text-amber-500"
        />
        <StatCard
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Euro}
          label={t('stats.mostExpensive')}
          value={summary.maxCost}
          unit="€"
          color="bg-purple-500/20 text-purple-500"
          sub={formatDate(summary.maxCostDate)}
        />
      </div>
      <div className={`grid ${summary.isHybrid ? 'grid-cols-6' : 'grid-cols-5'} gap-3 sm:gap-6 ${isCompact ? '!gap-3' : ''}`}>
        {topLists}
      </div>
    </div>
  );
});

RecordsTab.displayName = 'RecordsTab';

export default RecordsTab;
