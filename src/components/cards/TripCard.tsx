import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { calculateScore, getScoreColor } from '@core/formatters';
import { formatDate, formatTime } from '@core/dateUtils';
import { Trip } from '@/types';

interface TripCardProps {
    trip: Trip & { calculatedCost?: number };
    minEff: number;
    maxEff: number;
    onClick: (trip: Trip) => void;
    isCompact?: boolean;
    isFullscreenBYD?: boolean;
}

/**
 * Trip card component displaying trip details with efficiency score
 */
const TripCard: React.FC<TripCardProps> = React.memo(({ trip, minEff, maxEff, onClick, isCompact, isFullscreenBYD }) => {
    const { t } = useTranslation();

    // Determine if stationary/short trip
    const isStationary = (trip.trip || 0) < 0.5;

    const efficiency = useMemo(() => {
        if (!trip.trip || trip.trip <= 0 || trip.electricity === undefined || trip.electricity === null) {
            return 0;
        }
        return (trip.electricity / trip.trip) * 100;
    }, [trip.trip, trip.electricity]);

    const score = useMemo(() =>
        calculateScore(efficiency, minEff, maxEff),
        [efficiency, minEff, maxEff]
    );

    const scoreColor = useMemo(() =>
        getScoreColor(score),
        [score]
    );

    const paddingClass = isCompact ? 'p-[7px]' : (isFullscreenBYD ? 'p-2.5' : 'p-3 sm:p-4');
    const marginBottom = (isCompact || isFullscreenBYD) ? 'mb-1' : 'mb-3';

    // Cost logic: Use calculatedCost if available, otherwise totalCost (fallback)
    const displayCost = trip.calculatedCost !== undefined ? trip.calculatedCost : (trip.totalCost || 0);

    return (
        <div
            onClick={() => onClick(trip)}
            className={`bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors ${paddingClass}`}
        >
            <div className={`text-center ${marginBottom}`}>
                <p className={`text-slate-900 dark:text-white font-semibold ${(isCompact || isFullscreenBYD) ? 'text-xs' : 'text-sm sm:text-base'}`}>
                    {formatDate(trip.date)} · {formatTime(trip.start_timestamp)}
                </p>
            </div>
            {/* 5 Column Grid */}
            <div className="grid grid-cols-5 gap-2">
                <div className="text-center">
                    <p className={`text-slate-600 dark:text-slate-400 ${(isCompact || isFullscreenBYD) ? 'text-[9px] mb-0.5' : 'text-[10px] sm:text-xs mb-1'}`}>{t('stats.distance')}</p>
                    <p className={`text-slate-900 dark:text-white font-bold ${(isCompact || isFullscreenBYD) ? 'text-sm' : 'text-base sm:text-xl'}`}>{trip.trip?.toFixed(1)}</p>
                    <p className={`text-slate-500 dark:text-slate-400 ${(isCompact || isFullscreenBYD) ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'}`}>km</p>
                </div>
                <div className="text-center">
                    <p className={`text-slate-600 dark:text-slate-400 ${(isCompact || isFullscreenBYD) ? 'text-[9px] mb-0.5' : 'text-[10px] sm:text-xs mb-1'}`}>{t('tripDetail.consumption')}</p>
                    <p className={`text-slate-900 dark:text-white font-bold ${(isCompact || isFullscreenBYD) ? 'text-sm' : 'text-base sm:text-xl'}`}>{trip.electricity?.toFixed(2)}</p>
                    <p className={`text-slate-500 dark:text-slate-400 ${(isCompact || isFullscreenBYD) ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'}`}>kWh</p>
                </div>
                <div className="text-center">
                    <p className={`text-slate-600 dark:text-slate-400 ${(isCompact || isFullscreenBYD) ? 'text-[9px] mb-0.5' : 'text-[10px] sm:text-xs mb-1'}`}>{t('stats.efficiency')}</p>
                    {isStationary ? (
                        <p className={`text-slate-400 dark:text-slate-500 font-bold ${(isCompact || isFullscreenBYD) ? 'text-sm' : 'text-base sm:text-xl'}`}>-</p>
                    ) : (
                        <p className={`text-slate-900 dark:text-white font-bold ${(isCompact || isFullscreenBYD) ? 'text-sm' : 'text-base sm:text-xl'}`}>{efficiency.toFixed(2)}</p>
                    )}
                    <p className={`text-slate-500 dark:text-slate-400 ${(isCompact || isFullscreenBYD) ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'}`}>kWh/100km</p>
                </div>
                {/* Cost Column */}
                <div className="text-center">
                    <p className={`text-slate-600 dark:text-slate-400 ${(isCompact || isFullscreenBYD) ? 'text-[9px] mb-0.5' : 'text-[10px] sm:text-xs mb-1'}`}>{t('stats.cost') || 'Coste'}</p>
                    <p className={`text-slate-900 dark:text-white font-bold ${(isCompact || isFullscreenBYD) ? 'text-sm' : 'text-base sm:text-xl'}`}>{displayCost.toFixed(2)}</p>
                    <p className={`text-slate-500 dark:text-slate-400 ${(isCompact || isFullscreenBYD) ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'}`}>€</p>
                </div>
                <div className="text-center">
                    <p className={`text-slate-600 dark:text-slate-400 ${(isCompact || isFullscreenBYD) ? 'text-[9px] mb-0.5' : 'text-[10px] sm:text-xs mb-1'}`}>Score</p>
                    {isStationary ? (
                        <p className={`text-slate-400 dark:text-slate-500 font-bold ${(isCompact || isFullscreenBYD) ? 'text-lg' : 'text-2xl sm:text-3xl'}`}>-</p>
                    ) : (
                        <p className={`font-bold ${(isCompact || isFullscreenBYD) ? 'text-lg' : 'text-2xl sm:text-3xl'}`} style={{ color: scoreColor }}>
                            {score.toFixed(1)}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
});

TripCard.displayName = 'TripCard';

export default TripCard;



