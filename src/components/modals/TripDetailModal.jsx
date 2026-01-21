// BYD Stats - TripDetailModal Component

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { BYD_RED } from '../../utils/constants';
import { formatDate, formatTime } from '../../utils/dateUtils';
import { formatDuration, calculateScore, getScoreColor, calculatePercentile } from '../../utils/formatters';
import { MapPin, Clock, Zap, Battery, TrendingUp, Plus } from '../Icons.jsx';

import { useApp } from '../../context/AppContext';
import { useData } from '../../providers/DataProvider';

/**
 * Trip detail modal showing full trip information
 */
const TripDetailModal = () => {
    const { t } = useTranslation();
    const { settings } = useApp();
    const { selectedTrip: trip, trips: allTrips, stats, modals, closeModal, setSelectedTrip } = useData();
    const summary = stats?.summary;

    const isOpen = modals.tripDetail;
    const onClose = () => {
        closeModal('tripDetail');
        setSelectedTrip(null);
    };

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
                role="dialog"
                aria-modal="true"
                aria-labelledby="trip-detail-modal-title"
                className="relative bg-white dark:bg-slate-800 rounded-2xl p-5 max-w-lg w-full border border-slate-200 dark:border-slate-700"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header con título, fecha y score en la misma fila */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <div>
                            <h2 id="trip-detail-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">{t('tripDetail.title')}</h2>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                {formatDate(trip.date)} · {formatTime(trip.start_timestamp)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Score compacto */}
                        <div className="text-right">
                            <p className="text-3xl font-black" style={{ color: details.scoreColor }}>
                                {details.score.toFixed(1)}
                            </p>
                            <p className="text-slate-500 dark:text-slate-400 text-xs">/ 10</p>
                        </div>
                        <button onClick={onClose} aria-label="Close trip detail" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white ml-2">
                            <Plus className="w-6 h-6 rotate-45" />
                        </button>
                    </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-3 text-center">
                        <MapPin className="w-4 h-4 mx-auto mb-0.5 text-red-400" />
                        <p className="text-slate-600 dark:text-slate-400 text-xs">{t('stats.distance')}</p>
                        <p className="text-slate-900 dark:text-white text-lg font-bold">{trip.trip?.toFixed(1)} {t('units.km')}</p>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-3 text-center">
                        <Clock className="w-4 h-4 mx-auto mb-0.5 text-amber-400" />
                        <p className="text-slate-600 dark:text-slate-400 text-xs">{t('tripDetail.duration')}</p>
                        <p className="text-slate-900 dark:text-white text-lg font-bold">{formatDuration(trip.duration)}</p>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-3 text-center">
                        <Zap className="w-4 h-4 mx-auto mb-0.5 text-cyan-400" />
                        <p className="text-slate-600 dark:text-slate-400 text-xs">{t('tripDetail.consumption')}</p>
                        <p className="text-slate-900 dark:text-white text-lg font-bold">{trip.electricity?.toFixed(2)} {t('units.kWh')}</p>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-3 text-center">
                        <Battery className="w-4 h-4 mx-auto mb-0.5 text-green-400" />
                        <p className="text-slate-600 dark:text-slate-400 text-xs">{t('stats.efficiency')}</p>
                        <p className="text-slate-900 dark:text-white text-lg font-bold">{details.efficiency.toFixed(2)}</p>
                        <p className="text-slate-500 dark:text-slate-400 text-[10px]">{t('units.kWh100km')}</p>
                    </div>
                </div>

                {/* Speed */}
                {trip.duration > 0 && (
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-3 mb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-blue-400" />
                                <span className="text-slate-600 dark:text-slate-400 text-sm">{t('stats.avgSpeed')}</span>
                            </div>
                            <p className="text-slate-900 dark:text-white text-lg font-bold">
                                {(trip.trip / (trip.duration / 3600)).toFixed(1)} {t('units.kmh')}
                            </p>
                        </div>
                    </div>
                )}

                {/* Regeneration if available */}
                {trip.regeneration !== undefined && trip.regeneration !== null && (
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-3 mb-3">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-600 dark:text-slate-400 text-sm">{t('tripDetail.energyRecovered')}</span>
                            <span className="text-green-400 text-lg font-bold">{trip.regeneration?.toFixed(2)} {t('units.kWh')}</span>
                        </div>
                    </div>
                )}

                {/* Comparison and percentile - sin título "análisis" */}
                <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-3">
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400 text-sm">{t('tripDetail.comparedToAvg')}</span>
                            <span className={`font - bold ${details.comparisonPercent < 0 ? 'text-green-400' : 'text-red-400'} `}>
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

TripDetailModal.propTypes = {};

export default TripDetailModal;
