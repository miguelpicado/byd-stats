// BYD Stats - Trip Detail Modal Component

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BYD_RED, dayNamesFull } from '../../utils/constants';
import { formatDate, formatTime } from '../../utils/dateUtils';
import { formatDuration, calculateScore, getScoreColor, calculatePercentile } from '../../utils/formatters';
import { MapPin, Clock, Zap, Battery, TrendingUp, Plus } from '../Icons.jsx';

/**
 * Trip detail modal showing full trip information
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Modal visibility
 * @param {Function} props.onClose - Close handler
 * @param {Object} props.trip - Trip data object
 * @param {Array} props.allTrips - All trips for comparison
 * @param {Object} props.summary - Summary statistics
 * @param {Object} props.settings - App settings
 */
const TripDetailModal = ({ isOpen, onClose, trip, allTrips, summary, settings }) => {
    const { t } = useTranslation();

    const details = useMemo(() => {
        if (!trip) return { efficiency: 0, score: 0, scoreColor: '', comparisonPercent: 0, percentile: 0, cost: 0, dayName: '' };

        const validTrips = allTrips ? allTrips.filter(t => t.trip >= 1 && t.electricity !== 0) : [];
        const efficiencies = validTrips.map(t => (t.electricity / t.trip) * 100);
        const minEff = Math.min(...efficiencies);
        const maxEff = Math.max(...efficiencies);

        const efficiency = trip.trip > 0 ? (trip.electricity / trip.trip) * 100 : 0;
        const score = calculateScore(efficiency, minEff, maxEff);
        const scoreColor = getScoreColor(score);
        const avgEfficiency = parseFloat(summary?.avgEff || 0);
        const comparisonPercent = avgEfficiency > 0 ? ((efficiency - avgEfficiency) / avgEfficiency) * 100 : 0;
        const percentile = calculatePercentile(trip, allTrips || []);
        const cost = (trip.electricity || 0) * (settings?.electricityPrice || 0.15);

        return { efficiency, score, scoreColor, comparisonPercent, percentile, cost };
    }, [trip, allTrips, summary, settings]);

    if (!isOpen || !trip) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
            <div
                className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('tripDetail.title')}</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            {formatDate(trip.date)} · {formatTime(trip.start_timestamp)}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                        <Plus className="w-6 h-6 rotate-45" />
                    </button>
                </div>

                {/* Score prominente */}
                <div className="text-center py-6">
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-2">{t('tripDetail.title')}</p>
                    <p className="text-6xl font-black" style={{ color: details.scoreColor }}>
                        {details.score.toFixed(1)}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">/ 10</p>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4 text-center">
                        <MapPin className="w-5 h-5 mx-auto mb-1 text-red-400" />
                        <p className="text-slate-600 dark:text-slate-400 text-xs mb-1">{t('stats.distance')}</p>
                        <p className="text-slate-900 dark:text-white text-xl font-bold">{trip.trip?.toFixed(1)} {t('units.km')}</p>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4 text-center">
                        <Clock className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                        <p className="text-slate-600 dark:text-slate-400 text-xs mb-1">{t('tripDetail.duration')}</p>
                        <p className="text-slate-900 dark:text-white text-xl font-bold">{formatDuration(trip.duration)}</p>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4 text-center">
                        <Zap className="w-5 h-5 mx-auto mb-1 text-cyan-400" />
                        <p className="text-slate-600 dark:text-slate-400 text-xs mb-1">{t('tripDetail.consumption')}</p>
                        <p className="text-slate-900 dark:text-white text-xl font-bold">{trip.electricity?.toFixed(2)} {t('units.kWh')}</p>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4 text-center">
                        <Battery className="w-5 h-5 mx-auto mb-1 text-green-400" />
                        <p className="text-slate-600 dark:text-slate-400 text-xs mb-1">{t('stats.efficiency')}</p>
                        <p className="text-slate-900 dark:text-white text-xl font-bold">{details.efficiency.toFixed(2)}</p>
                        <p className="text-slate-500 dark:text-slate-400 text-[10px]">{t('units.kWh100km')}</p>
                    </div>
                </div>

                {/* Speed */}
                {trip.duration > 0 && (
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4 mb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-blue-400" />
                                <span className="text-slate-600 dark:text-slate-400 text-sm">{t('stats.avgSpeed')}</span>
                            </div>
                            <p className="text-slate-900 dark:text-white text-xl font-bold">
                                {(trip.trip / (trip.duration / 3600)).toFixed(1)} {t('units.kmh')}
                            </p>
                        </div>
                    </div>
                )}

                {/* Regeneration if available */}
                {trip.regeneration !== undefined && trip.regeneration !== null && (
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4 mb-4">
                        <p className="text-slate-600 dark:text-slate-400 text-sm mb-1">{t('tripDetail.energyRecovered')}</p>
                        <p className="text-green-400 text-2xl font-bold">{trip.regeneration?.toFixed(2)} {t('units.kWh')}</p>
                    </div>
                )}

                {/* Comparison and percentile */}
                <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4">
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">{t('tripDetail.analysis')}</p>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400 text-sm">{t('tripDetail.comparedToAvg')}</span>
                            <span className={`font-bold ${details.comparisonPercent < 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {details.comparisonPercent > 0 ? '+' : ''}{details.comparisonPercent.toFixed(1)}%
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400 text-sm">{t('tripDetail.percentile')}</span>
                            <span className="font-bold text-cyan-400">Top {details.percentile}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400 text-sm">{t('tripDetail.cost')}</span>
                            <span className="font-bold text-amber-500">{details.cost.toFixed(2)}€</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TripDetailModal;
