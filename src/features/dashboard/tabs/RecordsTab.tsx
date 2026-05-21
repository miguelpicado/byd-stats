import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigation, Zap, Clock, Euro } from '@components/Icons';
import StatCard from '@components/ui/StatCard';
import ChartCard from '@components/ui/ChartCard';
import { formatDate } from '@core/dateUtils';
import { useLayout } from '@/context/LayoutContext';
import { Summary, Trip } from '@/types';

interface RecordsTabProps {
  summary: Summary | null;
  top: {
    km: Trip[];
    kwh: Trip[];
    dur: Trip[];
    fuel?: Trip[];
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

  if (!summary) return null;

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

          {/* Top Fuel - Only for hybrid vehicles */}
          {summary.isHybrid && top.fuel && top.fuel.length > 0 && (
            <ChartCard isCompact={isCompact} title={`⛽ ${t('hybrid.topFuel')}`}>
              <div className="space-y-1">
                {top.fuel.map((trip, i) => (
                  <div key={i} className={`flex justify-between border-b border-amber-200 dark:border-amber-700/50 last:border-0 ${recordsItemPadding}`}>
                    <span className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[11px] truncate' : 'text-xs sm:text-sm'}`}>
                      {i + 1}. {formatDate(trip.date)}
                    </span>
                    <span className={`font-medium text-amber-600 dark:text-amber-400 ${isCompact ? 'text-[12px]' : 'text-sm sm:text-base'}`}>
                      {trip.fuel?.toFixed(2)} L
                    </span>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}
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
      <div className={`grid ${summary.isHybrid ? 'grid-cols-4' : 'grid-cols-3'} gap-3 sm:gap-6 ${isCompact ? '!gap-3' : ''}`}>
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

        {/* Top Fuel - Only for hybrid vehicles */}
        {summary.isHybrid && top.fuel && top.fuel.length > 0 && (
          <ChartCard isCompact={isCompact} title={`⛽ ${t('hybrid.topFuel')}`}>
            <div className={`flex flex-col justify-between ${recordsListHeightHorizontal}`}>
              {top.fuel.map((trip, i) => (
                <div key={i} className={`flex justify-between border-b border-amber-200 dark:border-amber-700/50 last:border-0 ${recordsItemPaddingHorizontal}`}>
                  <span className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[11px] truncate' : 'text-xs sm:text-sm'}`}>
                    {i + 1}. {formatDate(trip.date)}
                  </span>
                  <span className={`font-medium text-amber-600 dark:text-amber-400 ${isCompact ? 'text-[12px]' : 'text-sm sm:text-base'}`}>
                    {trip.fuel?.toFixed(2)} L
                  </span>
                </div>
              ))}
            </div>
          </ChartCard>
        )}
      </div>
    </div>
  );
});

RecordsTab.displayName = 'RecordsTab';

export default RecordsTab;



