// BYD Stats - Trip Card Component

import React, { useMemo } from 'react';
import { calculateScore, getScoreColor } from '../../utils/formatters';
import { formatDate, formatTime } from '../../utils/dateUtils';

/**
 * Trip card component displaying trip details with efficiency score
 * @param {Object} props - Component props
 * @param {Object} props.trip - Trip data object
 * @param {number} props.minEff - Minimum efficiency for scoring
 * @param {number} props.maxEff - Maximum efficiency for scoring
 * @param {Function} props.onClick - Click handler
 * @param {boolean} props.isCompact - Compact mode flag
 */
const TripCard = React.memo(({ trip, minEff, maxEff, onClick, isCompact }) => {
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

    return (
        <div
            onClick={() => onClick(trip)}
            className={`bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors ${isCompact ? 'p-2' : 'p-3 sm:p-4'}`}
        >
            {isCompact ? (
                // Compact "Wide" Mode (Horizontal Layout)
                <div className="flex items-center gap-3">
                    {/* Date Section - Left */}
                    <div className="flex-shrink-0 w-24 text-left pl-1">
                        <p className="text-slate-900 dark:text-white font-bold text-sm">
                            {formatDate(trip.date)}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 text-xs">
                            {formatTime(trip.start_timestamp)}
                        </p>
                    </div>

                    {/* Stats Section - Right (Grid) */}
                    <div className="flex-1 grid grid-cols-4 gap-2 items-center">
                        <div className="text-center">
                            <p className="text-slate-900 dark:text-white font-bold text-base">{trip.trip?.toFixed(1)}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-[10px]">km</p>
                        </div>
                        <div className="text-center">
                            <p className="text-slate-900 dark:text-white font-bold text-base">{trip.electricity?.toFixed(1)}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-[10px]">kWh</p>
                        </div>
                        <div className="text-center">
                            <p className="text-slate-900 dark:text-white font-bold text-base">{efficiency.toFixed(1)}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-[10px]">kWh%</p>
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-lg" style={{ color: scoreColor }}>
                                {score.toFixed(1)}
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                // Standard Vertical/Full Mode
                <>
                    <div className="mb-3 text-center">
                        <p className="text-slate-900 dark:text-white font-semibold text-sm sm:text-base">
                            {formatDate(trip.date)} · {formatTime(trip.start_timestamp)}
                        </p>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        <div className="text-center">
                            <p className="text-slate-600 dark:text-slate-400 text-[10px] sm:text-xs mb-1">Distancia</p>
                            <p className="text-slate-900 dark:text-white font-bold text-base sm:text-xl">{trip.trip?.toFixed(1)}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-[9px] sm:text-[10px]">km</p>
                        </div>
                        <div className="text-center">
                            <p className="text-slate-600 dark:text-slate-400 text-[10px] sm:text-xs mb-1">Consumo</p>
                            <p className="text-slate-900 dark:text-white font-bold text-base sm:text-xl">{trip.electricity?.toFixed(2)}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-[9px] sm:text-[10px]">kWh</p>
                        </div>
                        <div className="text-center">
                            <p className="text-slate-600 dark:text-slate-400 text-[10px] sm:text-xs mb-1">Eficiencia</p>
                            <p className="text-slate-900 dark:text-white font-bold text-base sm:text-xl">{efficiency.toFixed(2)}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-[9px] sm:text-[10px]">kWh/100km</p>
                        </div>
                        <div className="text-center">
                            <p className="text-slate-600 dark:text-slate-400 text-[10px] sm:text-xs mb-1">Score</p>
                            <p className="font-bold text-2xl sm:text-3xl" style={{ color: scoreColor }}>
                                {score.toFixed(1)}
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
});

TripCard.displayName = 'TripCard';

export default TripCard;
