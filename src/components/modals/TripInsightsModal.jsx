// BYD Stats - Trip Insights Modal Component
// Displays advanced statistics for trips when clicking on stat cards in Overview tab

import React, { useMemo } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { X, Zap, TrendingUp, Calendar, Battery, MapPin, Clock, Car } from '../Icons.jsx';

/**
 * Reusable Stat Item Component
 */
const StatItem = ({ label, value, unit, sub, highlight, color }) => (
    <div className={`p-3 rounded-lg border ${highlight
        ? 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'
        : 'bg-transparent border-slate-100 dark:border-slate-700/50'
        }`}>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
            <span className={`text-lg font-bold ${color || 'text-slate-900 dark:text-white'}`}>
                {value}
            </span>
            {unit && <span className="text-xs text-slate-500">{unit}</span>}
        </div>
        {sub && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
    </div>
);

StatItem.propTypes = {
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    unit: PropTypes.string,
    sub: PropTypes.string,
    highlight: PropTypes.bool,
    color: PropTypes.string
};

/**
 * Calculate advanced trip statistics
 */
const useTripInsights = (trips, type) => {
    return useMemo(() => {
        if (!trips || trips.length === 0) return null;

        const len = trips.length;

        // Basic extractions
        const distances = trips.map(t => t.distance || 0);
        const consumptions = trips.map(t => t.consumption || 0); // kWh/100km
        const energies = trips.map(t => (t.consumed || 0)); // kWh absolute
        const durations = trips.map(t => t.duration || 0); // minutes
        const speeds = trips.map(t => t.avgSpeed || 0);

        // Helper: Find max and min objects
        const maxDistTrip = trips.reduce((max, t) => (t.distance > max.distance ? t : max), trips[0]);
        // const minDistTrip = trips.reduce((min, t) => (t.distance < min.distance && t.distance > 0 ? t : min), trips[0]);

        const maxSpeedTrip = trips.reduce((max, t) => (t.avgSpeed > max.avgSpeed ? t : max), trips[0]);

        const maxDurationTrip = trips.reduce((max, t) => (t.duration > max.duration ? t : max), trips[0]);
        const minDurationTrip = trips.reduce((min, t) => (t.duration < min.duration && t.duration > 0 ? t : min), trips[0]);

        // Efficiency: Min is better (lower consumption)
        const validConsumptions = trips.filter(t => t.consumption > 0 && t.distance > 1);
        const bestEffTrip = validConsumptions.length > 0 ? validConsumptions.reduce((min, t) => t.consumption < min.consumption ? t : min, validConsumptions[0]) : null;
        const worstEffTrip = validConsumptions.length > 0 ? validConsumptions.reduce((max, t) => t.consumption > max.consumption ? t : max, validConsumptions[0]) : null;

        // Totals
        const totalKm = distances.reduce((a, b) => a + b, 0);
        const totalKwh = energies.reduce((a, b) => a + b, 0);
        const totalMinutes = durations.reduce((a, b) => a + b, 0);
        const totalHours = totalMinutes / 60;

        // Date calculations
        const dates = trips.map(t => t.date.substring(0, 10)); // YYYY-MM-DD
        const uniqueDays = [...new Set(dates)];
        const daysActive = uniqueDays.length;

        // Calculate active days distribution (Monday-Sunday)
        const daysOfWeek = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat or Mon-Sun depending on locale (Date uses 0=Sun)
        trips.forEach(t => {
            const date = new Date(t.date);
            if (!isNaN(date)) {
                daysOfWeek[date.getDay()]++;
            }
        });
        // Find most active day
        const maxTripsOnDay = Math.max(...daysOfWeek);
        const mostActiveDayIndex = daysOfWeek.indexOf(maxTripsOnDay); // 0=Sun, 1=Mon...

        // Find longest streak
        const sortedUniqueDays = uniqueDays.sort();
        let currentStreak = 0;
        let maxStreak = 0;
        for (let i = 0; i < sortedUniqueDays.length; i++) {
            if (i === 0) {
                currentStreak = 1;
            } else {
                const prev = new Date(sortedUniqueDays[i - 1]);
                const curr = new Date(sortedUniqueDays[i]);
                const diffTime = Math.abs(curr - prev);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays === 1) {
                    currentStreak++;
                } else {
                    currentStreak = 1;
                }
            }
            if (currentStreak > maxStreak) maxStreak = currentStreak;
        }

        return {
            distance: {
                total: totalKm,
                avg: totalKm / len,
                max: maxDistTrip.distance,
                perDay: totalKm / daysActive,
                maxDate: maxDistTrip.date
            },
            energy: {
                total: totalKwh,
                avgPerTrip: totalKwh / len,
                perDay: totalKwh / daysActive,
                maxCons: Math.max(...energies)
            },
            trips: {
                total: len,
                perDay: len / daysActive,
                mostActiveDayIndex, // 0-6
                maxStreak
            },
            time: {
                totalHours,
                avgMinutes: totalMinutes / len,
                maxDuration: maxDurationTrip.duration,
                minDuration: minDurationTrip.duration
            },
            efficiency: {
                avg: validConsumptions.reduce((a, c) => a + c.consumption, 0) / validConsumptions.length || 0,
                best: bestEffTrip ? bestEffTrip.consumption : 0,
                worst: worstEffTrip ? worstEffTrip.consumption : 0,
                bestDate: bestEffTrip ? bestEffTrip.date : ''
            },
            speed: {
                avg: speeds.reduce((a, b) => a + b, 0) / len,
                max: maxSpeedTrip.avgSpeed, // Note: this is max avg speed of a trip, not instantaneous max
                fastestTripDate: maxSpeedTrip.date
            },
            avgTrip: {
                dist: totalKm / len,
                kwh: totalKwh / len,
                time: totalMinutes / len,
                cost: 0 // Placeholder if cost per trip isn't available easily
            },
            activeDays: {
                count: daysActive,
                maxStreak,
                percentage: 0 // Need total span days for this
            }
        };
    }, [trips]);
};

const TripInsightsModal = ({
    isOpen,
    onClose,
    type, // 'distance' | 'energy' | 'trips' | 'time' | 'efficiency' | 'speed' | 'avgTrip' | 'activeDays'
    trips
}) => {
    const { t } = useTranslation();
    const insights = useTripInsights(trips, type);

    if (!isOpen || !insights) return null;

    // Configuration for each insight type (title, icon, colors)
    const config = {
        distance: { title: t('tripInsights.distanceTitle', 'Insights de Distancia'), icon: MapPin, color: 'text-red-500', bgColor: 'bg-red-100 dark:bg-red-900/30' },
        energy: { title: t('tripInsights.energyTitle', 'Insights de Energía'), icon: Zap, color: 'text-cyan-500', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30' },
        trips: { title: t('tripInsights.tripsTitle', 'Insights de Viajes'), icon: Car, color: 'text-amber-500', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
        time: { title: t('tripInsights.timeTitle', 'Insights de Tiempo'), icon: Clock, color: 'text-purple-500', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
        efficiency: { title: t('tripInsights.efficiencyTitle', 'Insights de Eficiencia'), icon: Battery, color: 'text-green-500', bgColor: 'bg-green-100 dark:bg-green-900/30' },
        speed: { title: t('tripInsights.speedTitle', 'Insights de Velocidad'), icon: TrendingUp, color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
        avgTrip: { title: t('tripInsights.avgTripTitle', 'Insights de Viaje Medio'), icon: MapPin, color: 'text-orange-500', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
        activeDays: { title: t('tripInsights.activeDaysTitle', 'Insights de Actividad'), icon: Calendar, color: 'text-pink-500', bgColor: 'bg-pink-100 dark:bg-pink-900/30' }
    };

    const currentConfig = config[type] || config.distance;
    const Icon = currentConfig.icon;

    // Helper to get day name
    const getDayName = (dayIndex) => {
        const days = [
            t('days.sun', 'Domingo'),
            t('days.mon', 'Lunes'),
            t('days.tue', 'Martes'),
            t('days.wed', 'Miércoles'),
            t('days.thu', 'Jueves'),
            t('days.fri', 'Viernes'),
            t('days.sat', 'Sábado')
        ];
        return days[dayIndex];
    };

    const renderContent = () => {
        switch (type) {
            case 'distance':
                return (
                    <div className="grid grid-cols-2 gap-3">
                        <StatItem label={t('tripInsights.totalKm', 'Total Km')} value={insights.distance.total.toFixed(0)} unit="km" highlight />
                        <StatItem label={t('tripInsights.kmPerDay', 'Km/día activo')} value={insights.distance.perDay.toFixed(1)} unit="km" />
                        <StatItem label={t('tripInsights.avgPerTrip', 'Media/viaje')} value={insights.distance.avg.toFixed(1)} unit="km" />
                        <StatItem label={t('tripInsights.maxDistance', 'Récord viaje')} value={insights.distance.max.toFixed(1)} unit="km" />
                    </div>
                );
            case 'energy':
                return (
                    <div className="grid grid-cols-2 gap-3">
                        <StatItem label={t('tripInsights.totalKwh', 'Total kWh')} value={insights.energy.total.toFixed(0)} unit="kWh" highlight />
                        <StatItem label={t('tripInsights.kwhPerDay', 'kWh/día activo')} value={insights.energy.perDay.toFixed(1)} unit="kWh" />
                        <StatItem label={t('tripInsights.avgPerTrip', 'Media/viaje')} value={insights.energy.avgPerTrip.toFixed(2)} unit="kWh" />
                        <StatItem label={t('tripInsights.max consumption', 'Max consumo')} value={insights.energy.maxCons.toFixed(1)} unit="kWh" />
                    </div>
                );
            case 'trips':
                return (
                    <div className="grid grid-cols-2 gap-3">
                        <StatItem label={t('tripInsights.totalTrips', 'Total viajes')} value={insights.trips.total} highlight />
                        <StatItem label={t('tripInsights.tripsPerDay', 'Viajes/día activo')} value={insights.trips.perDay.toFixed(1)} />
                        <StatItem label={t('tripInsights.activeDay', 'Día más activo')} value={getDayName(insights.trips.mostActiveDayIndex)} className="text-sm" />
                        <StatItem label={t('tripInsights.streak', 'Racha días')} value={insights.trips.maxStreak} unit={t('units.days', 'días')} />
                    </div>
                );
            case 'time':
                return (
                    <div className="grid grid-cols-2 gap-3">
                        <StatItem label={t('tripInsights.totalHours', 'Total horas')} value={insights.time.totalHours.toFixed(1)} unit="h" highlight />
                        <StatItem label={t('tripInsights.avgDuration', 'Duración media')} value={insights.time.avgMinutes.toFixed(0)} unit="min" />
                        <StatItem label={t('tripInsights.longestTrip', 'Más largo')} value={insights.time.maxDuration.toFixed(0)} unit="min" />
                        <StatItem label={t('tripInsights.shortestTrip', 'Más corto')} value={insights.time.minDuration.toFixed(0)} unit="min" />
                    </div>
                );
            case 'efficiency':
                return (
                    <div className="grid grid-cols-2 gap-3">
                        <StatItem label={t('tripInsights.avgEff', 'Media')} value={insights.efficiency.avg.toFixed(1)} unit="kWh/100" highlight />
                        <StatItem label={t('tripInsights.bestEff', 'Mejor')} value={insights.efficiency.best.toFixed(1)} unit="kWh/100" color="text-green-500" />
                        <StatItem label={t('tripInsights.worstEff', 'Peor')} value={insights.efficiency.worst.toFixed(1)} unit="kWh/100" color="text-red-500" />
                    </div>
                );
            case 'speed':
                return (
                    <div className="grid grid-cols-2 gap-3">
                        <StatItem label={t('tripInsights.avgSpeed', 'Media')} value={insights.speed.avg.toFixed(1)} unit="km/h" highlight />
                        <StatItem label={t('tripInsights.maxAvgSpeed', 'Máx media viaje')} value={insights.speed.max.toFixed(1)} unit="km/h" />
                    </div>
                );
            case 'avgTrip':
                return (
                    <div className="grid grid-cols-2 gap-3">
                        <StatItem label={t('tripInsights.avgDist', 'Distancia')} value={insights.avgTrip.dist.toFixed(1)} unit="km" />
                        <StatItem label={t('tripInsights.avgTime', 'Tiempo')} value={insights.avgTrip.time.toFixed(0)} unit="min" />
                        <StatItem label={t('tripInsights.avgCons', 'Consumo')} value={insights.avgTrip.kwh.toFixed(1)} unit="kWh" />
                    </div>
                );
            case 'activeDays':
                return (
                    <div className="grid grid-cols-2 gap-3">
                        <StatItem label={t('tripInsights.totalDays', 'Días activos')} value={insights.activeDays.count} highlight />
                        <StatItem label={t('tripInsights.streak', 'Racha')} value={insights.activeDays.maxStreak} unit={t('units.days', 'días')} />
                    </div>
                );
            default:
                return null;
        }
    };

    // Render using Portal to avoid z-index/transform issues
    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

            <div
                role="dialog"
                aria-modal="true"
                className="relative bg-white dark:bg-slate-800 rounded-2xl p-0 max-w-sm w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${currentConfig.bgColor}`}>
                            <Icon className={`w-5 h-5 ${currentConfig.color}`} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                            {currentConfig.title}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5">
                    {renderContent()}
                </div>
            </div>
        </div>,
        document.body
    );
};

TripInsightsModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    type: PropTypes.oneOf(['distance', 'energy', 'trips', 'time', 'efficiency', 'speed', 'avgTrip', 'activeDays']).isRequired,
    trips: PropTypes.array.isRequired
};

export default TripInsightsModal;
