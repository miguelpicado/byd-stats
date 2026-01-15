// BYD Stats - Records Tab Component
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Navigation, Zap, Clock, MapPin } from '../Icons.jsx';
import StatCard from '../ui/StatCard';
import ChartCard from '../ui/ChartCard';
import { formatDate } from '../../utils/dateUtils';

const COMPACT_SPACE_Y = 'space-y-3';

/**
 * Records tab showing max/min stats and top trips
 */
const RecordsTab = React.memo(({
  summary,
  top,
  isCompact,
  isLargerCard,
  isVertical,
  isFullscreenBYD,
  recordsItemPadding,
  recordsItemPaddingHorizontal,
  recordsListHeightHorizontal
}) => {
  const { t } = useTranslation();

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
            icon={MapPin}
            label={t('stats.shortest')}
            value={summary.minKm}
            unit={t('units.km')}
            color="bg-purple-500/20 text-purple-500"
          />
        </div>
        <div className={`grid ${isCompact ? 'grid-cols-3' : 'grid-cols-1'} gap-3 sm:gap-6 ${isCompact ? '!gap-3' : ''}`}>
          <ChartCard isCompact={isCompact} title={`🥇 ${t('charts.topDist')}`}>
            <div className="space-y-1">
              {top.km.map((trip, i) => (
                <div key={i} className={`flex justify-between border-b border-slate-200 dark:border-slate-700/50 last:border-0 ${recordsItemPadding}`}>
                  <span className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[11px] truncate' : 'text-xs sm:text-sm'}`}>
                    {i + 1}. {formatDate(trip.date)}
                  </span>
                  <span className={`font-medium text-slate-900 dark:text-white ${isCompact ? 'text-[12px]' : 'text-sm sm:text-base'}`}>
                    {trip.trip?.toFixed(1)} km
                  </span>
                </div>
              ))}
            </div>
          </ChartCard>
          <ChartCard isCompact={isCompact} title={`⚡ ${t('charts.topCons')}`}>
            <div className="space-y-1">
              {top.kwh.map((trip, i) => (
                <div key={i} className={`flex justify-between border-b border-slate-200 dark:border-slate-700/50 last:border-0 ${recordsItemPadding}`}>
                  <span className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[11px] truncate' : 'text-xs sm:text-sm'}`}>
                    {i + 1}. {formatDate(trip.date)}
                  </span>
                  <span className={`font-medium text-slate-900 dark:text-white ${isCompact ? 'text-[12px]' : 'text-sm sm:text-base'}`}>
                    {trip.electricity?.toFixed(1)} kWh
                  </span>
                </div>
              ))}
            </div>
          </ChartCard>
          <ChartCard isCompact={isCompact} title={`⏱️ ${t('charts.topDur')}`}>
            <div className="space-y-1">
              {top.dur.map((trip, i) => (
                <div key={i} className={`flex justify-between border-b border-slate-200 dark:border-slate-700/50 last:border-0 ${recordsItemPadding}`}>
                  <span className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[11px] truncate' : 'text-xs sm:text-sm'}`}>
                    {i + 1}. {formatDate(trip.date)}
                  </span>
                  <span className={`font-medium text-slate-900 dark:text-white ${isCompact ? 'text-[12px]' : 'text-sm sm:text-base'}`}>
                    {((trip.duration || 0) / 60).toFixed(0)} min
                  </span>
                </div>
              ))}
            </div>
          </ChartCard>
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
          icon={MapPin}
          label={t('stats.shortest')}
          value={summary.minKm}
          unit={t('units.km')}
          color="bg-purple-500/20 text-purple-500"
        />
      </div>
      <div className={`grid grid-cols-3 gap-3 sm:gap-6 ${isCompact ? '!gap-3' : ''}`}>
        <ChartCard isCompact={isCompact} title={`🥇 ${t('charts.topDist')}`}>
          <div className={`flex flex-col justify-between ${recordsListHeightHorizontal}`}>
            {top.km.map((trip, i) => (
              <div key={i} className={`flex justify-between border-b border-slate-200 dark:border-slate-700/50 last:border-0 ${recordsItemPaddingHorizontal}`}>
                <span className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[11px] truncate' : 'text-xs sm:text-sm'}`}>
                  {i + 1}. {formatDate(trip.date)}
                </span>
                <span className={`font-medium text-slate-900 dark:text-white ${isCompact ? 'text-[12px]' : 'text-sm sm:text-base'}`}>
                  {trip.trip?.toFixed(1)} km
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
        <ChartCard isCompact={isCompact} title={`⚡ ${t('charts.topCons')}`}>
          <div className={`flex flex-col justify-between ${recordsListHeightHorizontal}`}>
            {top.kwh.map((trip, i) => (
              <div key={i} className={`flex justify-between border-b border-slate-200 dark:border-slate-700/50 last:border-0 ${recordsItemPaddingHorizontal}`}>
                <span className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[11px] truncate' : 'text-xs sm:text-sm'}`}>
                  {i + 1}. {formatDate(trip.date)}
                </span>
                <span className={`font-medium text-slate-900 dark:text-white ${isCompact ? 'text-[12px]' : 'text-sm sm:text-base'}`}>
                  {trip.electricity?.toFixed(1)} kWh
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
        <ChartCard isCompact={isCompact} title={`⏱️ ${t('charts.topDur')}`}>
          <div className={`flex flex-col justify-between ${recordsListHeightHorizontal}`}>
            {top.dur.map((trip, i) => (
              <div key={i} className={`flex justify-between border-b border-slate-200 dark:border-slate-700/50 last:border-0 ${recordsItemPaddingHorizontal}`}>
                <span className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[11px] truncate' : 'text-xs sm:text-sm'}`}>
                  {i + 1}. {formatDate(trip.date)}
                </span>
                <span className={`font-medium text-slate-900 dark:text-white ${isCompact ? 'text-[12px]' : 'text-sm sm:text-base'}`}>
                  {((trip.duration || 0) / 60).toFixed(0)} min
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
});

RecordsTab.displayName = 'RecordsTab';

export default RecordsTab;
