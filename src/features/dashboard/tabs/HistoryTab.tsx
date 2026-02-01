import React, { useMemo, useCallback, FC } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Zap, Battery, Clock, TrendingUp, BYD_RED, IconProps } from '@components/Icons';
import TripCard from '@components/cards/TripCard';
import { useLayout } from '@/context/LayoutContext';
import { Trip } from '@/types';

interface HistoryTabProps {
  filtered: Trip[];
  openTripDetail: (trip: Trip) => void;
  setShowAllTripsModal: (show: boolean) => void;
  isActive?: boolean;
}

/**
 * History tab showing last 10 trips and averages
 */
const HistoryTab: FC<HistoryTabProps> = React.memo(({
  filtered,
  openTripDetail,
  setShowAllTripsModal
}) => {
  const { t } = useTranslation();
  const { isCompact, isVertical, isFullscreenBYD } = useLayout();

  // Memoize all calculations to avoid recalculating on every render
  const {
    minEff,
    maxEff,
    firstColumn,
    secondColumn,
    avgDistance,
    avgConsumption,
    avgEfficiency,
    avgDuration,
    avgSpeed
  } = useMemo(() => {
    // Sort all trips by date and timestamp
    const sorted = [...filtered].sort((a, b) => {
      const dateCompare = (b.date || '').localeCompare(a.date || '');
      if (dateCompare !== 0) return dateCompare;
      return (b.start_timestamp || 0) - (a.start_timestamp || 0);
    });

    // Calculate min/max efficiency in a single pass
    let minE = Infinity;
    let maxE = -Infinity;
    for (const trip of sorted) {
      if (trip.trip >= 1 && trip.electricity !== 0) {
        const eff = (trip.electricity / trip.trip) * 100;
        if (eff < minE) minE = eff;
        if (eff > maxE) maxE = eff;
      }
    }

    // Get last 10 trips split into columns
    const last10 = sorted.slice(0, 10);
    const first = last10.slice(0, 5);
    const second = last10.slice(5, 10);

    // Calculate averages for last 10 trips
    const len = last10.length || 1;
    const avgDist = last10.reduce((sum, trip) => sum + (trip.trip || 0), 0) / len;
    const avgCons = last10.reduce((sum, trip) => sum + (trip.electricity || 0), 0) / len;
    const avgEffVal = last10.reduce((sum, trip) => {
      if (trip.trip > 0 && trip.electricity !== undefined) {
        return sum + ((trip.electricity / trip.trip) * 100);
      }
      return sum;
    }, 0) / len;
    const avgDur = last10.reduce((sum, trip) => sum + ((trip.duration || 0) / 60), 0) / len;

    const speedFiltered = last10.filter(trip => trip.duration > 0 && trip.trip > 0);
    const avgSpd = speedFiltered.length > 0
      ? speedFiltered.reduce((sum, trip) => sum + (trip.trip / ((trip.duration || 0) / 3600)), 0) / speedFiltered.length
      : 0;

    return {
      allTrips: sorted,
      minEff: minE === Infinity ? 0 : minE,
      maxEff: maxE === -Infinity ? 0 : maxE,
      firstColumn: first,
      secondColumn: second,
      avgDistance: avgDist,
      avgConsumption: avgCons,
      avgEfficiency: avgEffVal,
      avgDuration: avgDur,
      avgSpeed: avgSpd
    };
  }, [filtered]);

  // Stat card visual config
  const statPadding = isCompact ? 'p-1.5' : (isFullscreenBYD ? 'p-2' : 'p-4');
  const statIconSize = isCompact ? 'w-7 h-7' : (isFullscreenBYD ? 'w-8 h-8' : 'w-10 h-10');
  const statIconInner = isCompact ? 'w-3.5 h-3.5' : (isFullscreenBYD ? 'w-4 h-4' : 'w-5 h-5');
  const statLabelText = isCompact ? 'text-[10px]' : (isFullscreenBYD ? 'text-[10px]' : 'text-xs');
  const statValueText = isCompact ? 'text-lg' : (isFullscreenBYD ? 'text-xl' : 'text-2xl');
  const statUnitText = isCompact ? 'text-[10px]' : (isFullscreenBYD ? 'text-xs' : 'text-sm');

  // Memoized helper function to render a stat card
  const renderStatCard = useCallback((icon: FC<IconProps>, label: string, value: string, unit: string, color: string) => (
    <div className={`bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 flex flex-col items-center justify-center h-full ${statPadding}`}>
      <div className="flex flex-col items-center text-center gap-1">
        <div className={`rounded-lg ${color} flex items-center justify-center ${statIconSize}`}>
          {React.createElement(icon, { className: statIconInner })}
        </div>
        <div>
          <p className={`text-slate-600 dark:text-slate-400 ${statLabelText}`}>{label}</p>
          <p className={`font-bold text-slate-900 dark:text-white ${statValueText}`}>
            {value} <span className={`text-slate-500 dark:text-slate-400 ${statUnitText}`}>{unit}</span>
          </p>
        </div>
      </div>
    </div>
  ), [statPadding, statIconSize, statIconInner, statLabelText, statValueText, statUnitText]);

  // Render vertical layout
  if (isVertical) {
    return (
      <div className="space-y-4">
        {/* Header with title */}
        <h2 className="font-bold text-slate-900 dark:text-white text-xl">
          {t('history.last10Trips')}
        </h2>

        {/* Stats grid - no header */}
        <div className="grid grid-cols-2 gap-3">
          {renderStatCard(MapPin, t('history.avgDistance'), avgDistance.toFixed(1), 'km', 'bg-red-500/20 text-red-400')}
          {renderStatCard(Zap, t('history.avgConsumption'), avgConsumption.toFixed(2), 'kWh', 'bg-cyan-500/20 text-cyan-400')}
          {renderStatCard(Battery, t('history.avgEfficiency'), avgEfficiency.toFixed(2), 'kWh/100km', 'bg-green-500/20 text-green-400')}
          {renderStatCard(Clock, t('history.avgDuration'), avgDuration.toFixed(0), 'min', 'bg-amber-500/20 text-amber-400')}
        </div>

        {/* Third row: speed card */}
        <div className="grid grid-cols-1">
          {renderStatCard(TrendingUp, t('history.avgSpeed'), avgSpeed.toFixed(1), 'km/h', 'bg-blue-500/20 text-blue-400')}
        </div>

        {/* Trip list */}
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-3">
            {firstColumn.map((trip, i) => (
              <TripCard key={i} trip={trip} minEff={minEff} maxEff={maxEff} onClick={openTripDetail} isCompact={isCompact} />
            ))}
          </div>
          <div className="space-y-3">
            {secondColumn.map((trip, j) => (
              <TripCard key={j + 5} trip={trip} minEff={minEff} maxEff={maxEff} onClick={openTripDetail} isCompact={isCompact} />
            ))}
          </div>
        </div>

        {/* Show all button */}
        <button
          onClick={() => setShowAllTripsModal(true)}
          className="w-full py-3 rounded-xl font-medium text-white"
          style={{ backgroundColor: BYD_RED }}
        >
          {t('common.showAll')}
        </button>
      </div>
    );
  }

  // Spacing config
  const cardGap = isCompact ? 'gap-1.5' : (isFullscreenBYD ? 'gap-2.5' : 'gap-3');
  const columnGap = isCompact ? 'gap-3' : 'gap-4';
  const verticalSpace = isCompact ? 'space-y-2' : (isFullscreenBYD ? 'space-y-3' : 'space-y-4');
  const headerMargin = isCompact ? 'mb-2' : (isFullscreenBYD ? 'mb-2' : 'mb-3');
  const buttonPadding = isCompact ? 'py-2' : (isFullscreenBYD ? 'py-2.5' : 'py-3');
  const listSpaceY = isCompact ? 'space-y-1.5' : (isFullscreenBYD ? 'space-y-2' : 'space-y-3');

  return (
    <div className={verticalSpace}>
      {/* Title */}
      <h2 className={`font-bold text-slate-900 dark:text-white ${(isCompact || isFullscreenBYD) ? 'text-lg' : 'text-xl'} ${headerMargin}`}>
        {t('history.last10Trips')}
      </h2>

      <div className={`grid lg:grid-cols-8 ${columnGap}`}>
        {/* Left column: Trips + Button (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          {/* Trips grid */}
          <div className={`grid lg:grid-cols-2 ${cardGap}`}>
            <div className={listSpaceY}>
              {firstColumn.map((trip, i) => (
                <TripCard key={i} trip={trip} minEff={minEff} maxEff={maxEff} onClick={openTripDetail} isCompact={isCompact} isFullscreenBYD={isFullscreenBYD} />
              ))}
            </div>
            <div className={listSpaceY}>
              {secondColumn.map((trip, j) => (
                <TripCard key={j + 5} trip={trip} minEff={minEff} maxEff={maxEff} onClick={openTripDetail} isCompact={isCompact} isFullscreenBYD={isFullscreenBYD} />
              ))}
            </div>
          </div>

          {/* Show all button */}
          <button
            onClick={() => setShowAllTripsModal(true)}
            className={`w-full rounded-xl font-medium text-white flex-shrink-0 ${buttonPadding}`}
            style={{ backgroundColor: BYD_RED }}
          >
            {t('common.showAll')}
          </button>
        </div>

        {/* Right column: Stats (2 cols) - flex column to fill height */}
        <div className={`lg:col-span-2 flex flex-col ${cardGap} h-full`}>
          <div className="flex-1">
            {renderStatCard(MapPin, t('history.avgDistance'), avgDistance.toFixed(1), 'km', 'bg-red-500/20 text-red-400')}
          </div>
          <div className="flex-1">
            {renderStatCard(Zap, t('history.avgConsumption'), avgConsumption.toFixed(2), 'kWh', 'bg-cyan-500/20 text-cyan-400')}
          </div>
          <div className="flex-1">
            {renderStatCard(Battery, t('history.avgEfficiency'), avgEfficiency.toFixed(2), 'kWh/100km', 'bg-green-500/20 text-green-400')}
          </div>
          <div className="flex-1">
            {renderStatCard(Clock, t('history.avgDuration'), avgDuration.toFixed(0), 'min', 'bg-amber-500/20 text-amber-400')}
          </div>
          <div className="flex-1">
            {renderStatCard(TrendingUp, t('history.avgSpeed'), avgSpeed.toFixed(1), 'km/h', 'bg-blue-500/20 text-blue-400')}
          </div>
        </div>
      </div>
    </div>
  );
});

HistoryTab.displayName = 'HistoryTab';

export default HistoryTab;


