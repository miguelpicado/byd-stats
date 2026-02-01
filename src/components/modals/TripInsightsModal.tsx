// BYD Stats - Trip Insights Modal Component
// Displays advanced statistics for trips when clicking on stat cards in Overview tab

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Zap, TrendingUp, Calendar, Battery, MapPin, Clock, Car, Fuel, LucideIcon, Info } from '../Icons'; // Added Info
import { Line } from 'react-chartjs-2';
import StatItem from '../ui/StatItem';
import ModalPortal from '../common/ModalPortal';
import SoHExplanationModal, { SoHMetricType } from './SoHExplanationModal';
import { isStationaryTrip } from '../../core/dataProcessing';
import { Trip, Settings as SettingsType } from '../../types'; // Correct import path

interface TripInsightsModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'distance' | 'energy' | 'trips' | 'time' | 'efficiency' | 'speed' | 'avgTrip' | 'activeDays' | 'stationary' | 'soh' | 'fuel' | 'range';
    trips: Trip[];
    settings?: SettingsType;
    summary?: any;
    onMfgDateClick?: () => void;
    onThermalStressClick?: () => void;
    aiSoH?: number | null;
    aiSoHStats?: { points: any[]; trend: any[] } | null;
}

/**
 * Calculate advanced trip statistics
 */
const useTripInsights = (trips: Trip[], electricityPrice = 0.15, settings: SettingsType = {} as SettingsType) => {
    return useMemo(() => {
        if (!trips || trips.length === 0) return null;

        // SEPARATION: Valid Trips vs Stationary Records
        // Match logic from dataProcessing.js (centralized)
        const validTrips = trips.filter(t => !isStationaryTrip(t));
        const stationaryTrips = trips.filter(isStationaryTrip);

        const len = validTrips.length;
        // const totalRecords = trips.length; // For debug or specific display if needed

        // Helper to calculate efficiency (kWh/100km)
        const getEfficiency = (t: Trip) => (t.trip && t.trip > 0) ? ((t.electricity || 0) / t.trip) * 100 : 0;
        // Helper to calculate avg speed (km/h)
        const getAvgSpeed = (t: Trip) => (t.duration && t.duration > 0) ? (t.trip || 0) / (t.duration / 3600) : 0;

        // Use validTrips for standard metrics
        const distances = validTrips.map(t => t.trip || 0);
        const energies = validTrips.map(t => t.electricity || 0); // kWh absolute
        const durations = validTrips.map(t => t.duration || 0); // seconds

        // Stationary energy
        const stationaryEnergy = stationaryTrips.reduce((acc, t) => acc + (t.electricity || 0), 0);

        // Helper: Find max and min objects (from validTrips)
        const maxDistTrip = validTrips.reduce((max, t) => ((t.trip || 0) > (max.trip || 0) ? t : max), validTrips[0] || {} as Trip);
        const maxSpeedTrip = validTrips.reduce((max, t) => (getAvgSpeed(t) > getAvgSpeed(max) ? t : max), validTrips[0] || {} as Trip);
        const maxDurationTrip = validTrips.reduce((max, t) => ((t.duration || 0) > (max.duration || 0) ? t : max), validTrips[0] || {} as Trip);

        const tripsWithDuration = validTrips.filter(t => (t.duration || 0) > 0);
        const minDurationTrip = tripsWithDuration.length > 0
            ? tripsWithDuration.reduce((min, t) => ((t.duration || 0) < (min.duration || 0) ? t : min), tripsWithDuration[0])
            : (validTrips[0] || {} as Trip);

        // Efficiency calculations
        const validTripsForEff = validTrips.filter(t => (t.trip || 0) > 1 && (t.electricity || 0) > 0);
        const efficiencies = validTripsForEff.map(t => getEfficiency(t)).sort((a, b) => a - b);
        const bestEffTrip = validTripsForEff.length > 0 ? validTripsForEff.reduce((min, t) => getEfficiency(t) < getEfficiency(min) ? t : min, validTripsForEff[0]) : null;
        const worstEffTrip = validTripsForEff.length > 0 ? validTripsForEff.reduce((max, t) => getEfficiency(t) > getEfficiency(max) ? t : max, validTripsForEff[0]) : null;

        // Median efficiency
        const medianEff = efficiencies.length > 0
            ? (efficiencies.length % 2 === 0
                ? (efficiencies[efficiencies.length / 2 - 1] + efficiencies[efficiencies.length / 2]) / 2
                : efficiencies[Math.floor(efficiencies.length / 2)])
            : 0;

        // Totals
        const totalKm = distances.reduce((a, b) => a + b, 0);
        const drivingKwh = energies.reduce((a, b) => a + b, 0); // Only valid trips energy
        const totalKwh = drivingKwh + stationaryEnergy; // Total including stationary
        const totalSeconds = durations.reduce((a, b) => a + b, 0);
        const totalHours = totalSeconds / 3600;
        const totalMinutes = totalSeconds / 60;

        // Global efficiency (same formula as summary: drivingKwh / totalKm * 100)
        // Note: StatCard uses only driving consumption for efficiency? 
        // Checking dataProcessing.js: avgEff: totalKm > 0 ? (drivingKwh / totalKm * 100)
        const globalEfficiency = totalKm > 0 ? (drivingKwh / totalKm) * 100 : 0;

        // Date calculations (Only Valid Trips for active days?)
        // dataProcessing.js uses 'uniqueDates' from VALID trips? 
        // No, dataProcessing adds uniqueDates for ALL trips, then 'daysActive' = uniqueDates.size.
        // Wait, checked dataProcessing.js: "dailyData" and "uniqueDates" are populated inside the "for (const trip of allTrips)" loop.
        // And stationary check "if (tTrip < 0.5) { ... continue; }" happens BEFORE dailyData population.
        // So daysActive ONLY counts days with VALID trips.
        const dates = validTrips.map(t => (t.date || '').substring(0, 10)).filter(d => d); // YYYY-MM-DD
        const uniqueDays = [...new Set(dates)];
        const daysActive = uniqueDays.length;

        // Calculate active days distribution (Monday-Sunday)
        const daysOfWeek = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
        validTrips.forEach(t => {
            const date = new Date(t.date);
            if (!isNaN(date.getTime())) {
                daysOfWeek[date.getDay()]++;
            }
        });
        const maxTripsOnDay = Math.max(...daysOfWeek);
        const mostActiveDayIndex = daysOfWeek.indexOf(maxTripsOnDay);

        // Find longest streak
        const sortedUniqueDays = [...uniqueDays].sort();
        let currentStreak = 1;
        let maxStreak = daysActive > 0 ? 1 : 0;

        for (let i = 1; i < sortedUniqueDays.length; i++) {
            const prevDate = new Date(sortedUniqueDays[i - 1] + 'T12:00:00');
            const currDate = new Date(sortedUniqueDays[i] + 'T12:00:00');
            const diffMs = currDate.getTime() - prevDate.getTime();
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                currentStreak++;
                if (currentStreak > maxStreak) maxStreak = currentStreak;
            } else {
                currentStreak = 1;
            }
        }

        // Average cost per trip (based on valid trips)
        // If we want total cost average, we should might need to sum costs. 
        // But here we approximate: totalKwh (Total or Driving?) -> likely Driving for Avg Trip stats.
        const avgCostPerTrip = len > 0 ? (drivingKwh / len) * electricityPrice : 0;

        const fuelTrips = validTrips.filter(t => (t.fuel || 0) > 0);
        const totalFuel = fuelTrips.reduce((acc, t) => acc + (t.fuel || 0), 0);
        const totalKmFuel = fuelTrips.reduce((acc, t) => acc + (t.trip || 0), 0);

        // Split by distance (>100km vs <=100km)
        const longTrips = fuelTrips.filter(t => (t.trip || 0) > 100);
        const shortTrips = fuelTrips.filter(t => (t.trip || 0) <= 100);

        const longTripsFuel = longTrips.reduce((acc, t) => acc + (t.fuel || 0), 0);
        const longTripsKm = longTrips.reduce((acc, t) => acc + (t.trip || 0), 0);

        const shortTripsFuel = shortTrips.reduce((acc, t) => acc + (t.fuel || 0), 0);
        const shortTripsKm = shortTrips.reduce((acc, t) => acc + (t.trip || 0), 0);

        const validSpeedTrips = validTrips.filter(t => (t.duration || 0) > 60);
        const minSpeedTrip = validSpeedTrips.length > 0 ? validSpeedTrips.reduce((min, t) => (getAvgSpeed(t) < getAvgSpeed(min) ? t : min), validSpeedTrips[0]) : null;

        return {
            distance: {
                total: totalKm,
                avg: len > 0 ? totalKm / len : 0,
                max: maxDistTrip.trip || 0,
                perDay: daysActive > 0 ? totalKm / daysActive : 0,
                maxDate: maxDistTrip.date
            },
            energy: {
                total: totalKwh,
                avgPerTrip: len > 0 ? drivingKwh / len : 0,
                perDay: daysActive > 0 ? drivingKwh / daysActive : 0,
                maxCons: Math.max(...energies, 0)
            },
            trips: {
                total: len,
                perDay: daysActive > 0 ? len / daysActive : 0,
                mostActiveDayIndex,
                maxStreak
            },
            time: {
                totalHours,
                avgMinutes: len > 0 ? totalMinutes / len : 0,
                maxDuration: (maxDurationTrip.duration || 0) / 60,
                minDuration: ((minDurationTrip?.duration || 0) / 60)
            },
            efficiency: {
                avg: globalEfficiency,
                median: medianEff,
                best: bestEffTrip ? getEfficiency(bestEffTrip) : 0,
                worst: worstEffTrip ? getEfficiency(worstEffTrip) : 0,
                bestDate: bestEffTrip ? bestEffTrip.date : ''
            },
            fuel: {
                total: totalFuel,
                avg: totalKmFuel > 0 ? (totalFuel / totalKmFuel * 100) : 0,
                longTripsAvg: longTripsKm > 0 ? (longTripsFuel / longTripsKm * 100) : 0,
                shortTripsAvg: shortTripsKm > 0 ? (shortTripsFuel / shortTripsKm * 100) : 0,
                count: fuelTrips.length,
                longCount: longTrips.length,
                shortCount: shortTrips.length
            },
            speed: {
                avg: totalSeconds > 0 ? (totalKm / (totalSeconds / 3600)) : 0,
                max: maxSpeedTrip.trip ? getAvgSpeed(maxSpeedTrip) : 0,
                min: minSpeedTrip ? getAvgSpeed(minSpeedTrip) : 0,
                fastestTripDate: maxSpeedTrip.trip ? maxSpeedTrip.date : ''
            },
            avgTrip: {
                dist: len > 0 ? totalKm / len : 0,
                kwh: len > 0 ? drivingKwh / len : 0,
                time: len > 0 ? totalMinutes / len : 0,
                cost: avgCostPerTrip
            },
            activeDays: {
                count: daysActive,
                maxStreak,
                percentage: 0
            },
            range: {
                highway: (Number(settings?.batterySize) > 0 && globalEfficiency > 0) ? (Number(settings.batterySize) * ((Number(settings.soh) || 100) / 100) / (globalEfficiency * 1.2) * 100) : 0,
                city: (Number(settings?.batterySize) > 0 && globalEfficiency > 0) ? (Number(settings.batterySize) * ((Number(settings.soh) || 100) / 100) / (globalEfficiency * 0.8) * 100) : 0
            },
            // Pass stationary data specifically if needed
            stationaryCount: stationaryTrips.length,
            stationaryEnergy: stationaryEnergy
        };
    }, [trips, electricityPrice, settings]);
};

const TripInsightsModal: React.FC<TripInsightsModalProps> = ({
    isOpen,
    onClose,
    type, // 'distance' | 'energy' | 'trips' | 'time' | 'efficiency' | 'speed' | 'avgTrip' | 'activeDays'
    trips,
    settings = {} as SettingsType,
    summary,
    onMfgDateClick,
    onThermalStressClick,
    aiSoH,
    aiSoHStats
}) => {
    const { t } = useTranslation();
    const electricityPrice = Number(settings?.electricPrice) || 0.15;
    const insights = useTripInsights(trips, electricityPrice, settings);

    // State for sub-modal
    const [explanationType, setExplanationType] = useState<SoHMetricType | null>(null);

    if (!isOpen) return null;

    interface InsightConfig {
        title: string;
        icon: LucideIcon;
        color: string;
        bgColor: string;
    }

    // Configuration for each insight type (title, icon, colors)
    const config: Record<string, InsightConfig> = {
        distance: { title: t('tripInsights.distanceTitle', 'Insights de Distancia'), icon: MapPin, color: 'text-red-500', bgColor: 'bg-red-100 dark:bg-red-900/30' },
        energy: { title: t('tripInsights.energyTitle', 'Insights de Energía'), icon: Zap, color: 'text-cyan-500', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30' },
        trips: { title: t('tripInsights.tripsTitle', 'Insights de Viajes'), icon: Car, color: 'text-amber-500', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
        time: { title: t('tripInsights.timeTitle', 'Insights de Tiempo'), icon: Clock, color: 'text-purple-500', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
        efficiency: { title: t('tripInsights.efficiencyTitle', 'Insights de Eficiencia'), icon: Battery, color: 'text-green-500', bgColor: 'bg-green-100 dark:bg-green-900/30' },
        fuel: { title: t('tripInsights.fuelTitle', 'Insights de Gasolina'), icon: Fuel, color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
        speed: { title: t('tripInsights.speedTitle', 'Insights de Velocidad'), icon: TrendingUp, color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
        avgTrip: { title: t('tripInsights.avgTripTitle', 'Insights de Viaje Medio'), icon: MapPin, color: 'text-orange-500', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
        activeDays: { title: t('tripInsights.activeDaysTitle', 'Insights de Actividad'), icon: Calendar, color: 'text-pink-500', bgColor: 'bg-pink-100 dark:bg-pink-900/30' },
        stationary: { title: t('tripInsights.stationaryTitle', 'Consumo en Parado'), icon: Zap, color: 'text-yellow-500', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
        range: { title: t('tripInsights.rangeTitle', 'Detalle de Autonomía'), icon: Battery, color: 'text-amber-500', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
        soh: { title: t('tripInsights.sohTitle', 'Salud de la Batería (SoH)'), icon: Battery, color: 'text-emerald-500', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' }
    };

    const currentConfig = config[type] || config.distance;
    const Icon = currentConfig.icon;

    // Helper to get day name
    const getDayName = (dayIndex: number) => {
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
        if (!insights) {
            return (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <Car className="w-12 h-12 mb-3 opacity-20" />
                    <p>{t('common.noData', 'No hay datos disponibles')}</p>
                </div>
            );
        }

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
                        <StatItem label={t('tripInsights.avgEff', 'Media')} value={insights.efficiency.avg.toFixed(2)} unit="kWh/100" highlight />
                        <StatItem label={t('tripInsights.medianEff', 'Mediana')} value={insights.efficiency.median.toFixed(2)} unit="kWh/100" />
                        <StatItem label={t('tripInsights.bestEff', 'Mejor')} value={insights.efficiency.best.toFixed(2)} unit="kWh/100" color="text-green-500" />
                        <StatItem label={t('tripInsights.worstEff', 'Peor')} value={insights.efficiency.worst.toFixed(2)} unit="kWh/100" color="text-red-500" />
                    </div>
                );
            case 'fuel':
                return (
                    <div className="grid grid-cols-1 gap-4">
                        <div className="grid grid-cols-2 gap-3">
                            <StatItem
                                label={t('tripInsights.avgFuelEff', 'Media General')}
                                value={insights.fuel.avg.toFixed(2)}
                                unit="L/100"
                                highlight
                                color="text-amber-600"
                            />
                            <StatItem
                                label={t('tripInsights.totalFuel', 'Total Litros')}
                                value={insights.fuel.total.toFixed(1)}
                                unit="L"
                            />
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3 space-y-3">
                            <div className="border-b border-slate-200 dark:border-slate-600 pb-2 mb-2">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('tripInsights.byDistance', 'Por Distancia')}</h4>
                            </div>

                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-xs text-slate-500">{t('tripInsights.shortTrips', 'Viajes < 100km')}</p>
                                    <p className="text--[10px] text-slate-400">{insights.fuel.shortCount} {t('common.trips', 'viajes')}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-slate-700 dark:text-slate-300">
                                        {insights.fuel.shortTripsAvg.toFixed(2)} <span className="text-xs font-normal text-slate-500">L/100</span>
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-xs text-slate-500">{t('tripInsights.longTrips', 'Viajes > 100km')}</p>
                                    <p className="text-[10px] text-slate-400">{insights.fuel.longCount} {t('common.trips', 'viajes')}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-slate-700 dark:text-slate-300">
                                        {insights.fuel.longTripsAvg.toFixed(2)} <span className="text-xs font-normal text-slate-500">L/100</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'speed':
                return (
                    <div className="grid grid-cols-2 gap-3">
                        <StatItem label={t('tripInsights.avgSpeed', 'Media')} value={insights.speed.avg.toFixed(1)} unit="km/h" highlight />
                        {/* We use specific keys if available, or fallback */}
                        <StatItem label={t('tripInsights.maxAvgSpeed', 'Máx media viaje')} value={insights.speed.max.toFixed(1)} unit="km/h" />
                        <StatItem label={t('tripInsights.minAvgSpeed', 'Mín media viaje')} value={insights.speed.min.toFixed(1)} unit="km/h" />
                    </div>
                );
            case 'avgTrip':
                return (
                    <div className="grid grid-cols-2 gap-3">
                        <StatItem label={t('tripInsights.avgDist', 'Distancia')} value={insights.avgTrip.dist.toFixed(1)} unit="km" />
                        <StatItem label={t('tripInsights.avgTime', 'Tiempo')} value={insights.avgTrip.time.toFixed(0)} unit="min" />
                        <StatItem label={t('tripInsights.avgCons', 'Consumo')} value={insights.avgTrip.kwh.toFixed(2)} unit="kWh" />
                        <StatItem label={t('tripInsights.avgCost', 'Coste medio')} value={insights.avgTrip.cost.toFixed(2)} unit="€" />
                    </div>
                );
            case 'activeDays':
                return (
                    <div className="grid grid-cols-2 gap-3">
                        <StatItem label={t('tripInsights.totalDays', 'Días activos')} value={insights.activeDays.count} highlight />
                        <StatItem label={t('tripInsights.streak', 'Racha')} value={insights.activeDays.maxStreak} unit={t('units.days', 'días')} />
                    </div>
                );
            case 'range':
                return (
                    <div className="flex flex-col gap-6">
                        <div className="text-center bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                {t('tripInsights.rangeDesc')}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <StatItem
                                label={t('tripInsights.rangeHighway')}
                                value={insights.range.highway.toFixed(0)}
                                unit="km"
                                highlight
                                color="text-amber-500"
                            />
                            <StatItem
                                label={t('tripInsights.rangeCity')}
                                value={insights.range.city.toFixed(0)}
                                unit="km"
                                highlight
                                color="text-green-500"
                            />
                        </div>
                    </div>
                );
            case 'soh':
                const sohData = summary?.sohData;
                return (
                    <div className="flex flex-col gap-3">
                        {aiSoH && (
                            <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30 p-3">
                                <div className="flex items-center gap-2 mb-3">
                                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                        {t('modals.batteryHealth.aiAnalysisTitle', 'Análisis de SoH con IA')}
                                    </h4>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <button
                                        onClick={() => setExplanationType('ai_soh')}
                                        className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-emerald-100 dark:border-emerald-900/50 flex flex-col items-center justify-center text-center hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                                    >
                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase flex items-center gap-1">
                                            {t('modals.batteryHealth.realSoH', 'SoH Real')}
                                            <Info className="w-2.5 h-2.5 opacity-50" />
                                        </span>
                                        <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                                            {aiSoH.toFixed(1)}%
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => setExplanationType('samples')}
                                        className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        <span className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1">
                                            {t('modals.batteryHealth.samples', 'Muestras')}
                                            <Info className="w-2.5 h-2.5 opacity-50" />
                                        </span>
                                        <span className="text-xl font-black text-slate-700 dark:text-slate-300">
                                            {aiSoHStats?.points.length || 0}
                                        </span>
                                    </button>
                                </div>

                                <div className="h-40 w-full bg-white dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800 p-2">
                                    {aiSoHStats && (
                                        <Line
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: { legend: { display: false } },
                                                scales: {
                                                    x: {
                                                        display: true,
                                                        grid: { display: false },
                                                        ticks: { display: false } // Hide x labels for cleanliness, or keep simple
                                                    },
                                                    y: {
                                                        min: 80,
                                                        max: 110,
                                                        display: true,
                                                        grid: { color: 'rgba(0,0,0,0.05)' }
                                                    }
                                                },
                                                elements: {
                                                    point: { radius: 2, hoverRadius: 4 },
                                                }
                                            }}
                                            data={{
                                                datasets: [
                                                    {
                                                        type: 'scatter' as const,
                                                        label: 'Points',
                                                        data: aiSoHStats.points.map(p => ({ x: p.x, y: p.y })),
                                                        backgroundColor: 'rgba(16, 185, 129, 0.4)'
                                                    },
                                                    {
                                                        type: 'line' as const,
                                                        label: 'Trend',
                                                        data: aiSoHStats.trend.map(p => ({ x: p.x, y: p.y })),
                                                        borderColor: '#10b981',
                                                        borderWidth: 2,
                                                        pointRadius: 0,
                                                        tension: 0.4
                                                    }
                                                ]
                                            } as any}
                                        />
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col items-center justify-center py-2">
                            <button
                                onClick={() => setExplanationType('formula')}
                                className="group w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl p-4 flex flex-col items-center transition-all hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-[1.02] active:scale-95 shadow-sm"
                            >
                                <div className="text-4xl font-black text-slate-800 dark:text-white tracking-tight flex items-baseline group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {(100 - ((sohData?.degradation?.sei ?? 0) + (sohData?.degradation?.cycle ?? 0) + (sohData?.degradation?.calendar ?? 0))).toFixed(2)}
                                    <span className="text-xl ml-1 text-slate-400 group-hover:text-blue-400/70">%</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 group-hover:text-blue-500 transition-colors">
                                    SoH Calculado
                                    <Info className="w-3 h-3" />
                                </div>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-2 mt-2">
                            {/* Header removed as per request */}
                            <div className="grid grid-cols-3 gap-2">
                                <StatItem
                                    label="SEI"
                                    value={`${(sohData?.degradation?.sei ?? 0).toFixed(2)}%`}
                                    color="text-amber-500"
                                    onClick={() => setExplanationType('sei')}
                                    center
                                />
                                <StatItem
                                    label="Ciclos"
                                    value={`${(sohData?.degradation?.cycle ?? 0).toFixed(2)}%`}
                                    color="text-orange-500"
                                    onClick={() => setExplanationType('cycle')}
                                    center
                                />
                                <StatItem
                                    label="Tiempo"
                                    value={`${(sohData?.degradation?.calendar ?? 0).toFixed(2)}%`}
                                    color="text-red-500"
                                    onClick={() => setExplanationType('calendar')}
                                    center
                                />
                            </div>
                        </div>

                        <div
                            className="p-3 bg-slate-100 dark:bg-slate-700/30 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors"
                            onClick={() => setExplanationType('calibration')}
                        >
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500">{t('tripInsights.sohCalibration')}</span>
                                <span className={`font-bold ${sohData?.calibration_warning ? 'text-amber-500' : 'text-emerald-500'}`}>
                                    {sohData?.calibration_warning ? t('settings.calibrationWarning') : 'OK'}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={onMfgDateClick}
                                className="flex flex-col items-center justify-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 hover:border-slate-400 transition-colors"
                            >
                                <span className="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">{t('settings.mfgDate')}</span>
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                    {settings.mfgDateDisplay || '-'}
                                </span>
                            </button>

                            <button
                                onClick={onThermalStressClick}
                                className="flex flex-col items-center justify-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 hover:border-slate-400 transition-colors"
                            >
                                <span className="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">{t('tripInsights.stressFactor', 'Factor Estrés')}</span>
                                <span className={`text-xs font-bold ${summary?.sohData?.thermal_stress > 1.0 ? 'text-orange-500' : 'text-slate-600 dark:text-slate-300'}`}>
                                    {summary?.sohData?.thermal_stress ? `${summary.sohData.thermal_stress}x` : '1.0x'}
                                </span>
                            </button>
                        </div>

                        <SoHExplanationModal
                            isOpen={!!explanationType}
                            onClose={() => setExplanationType(null)}
                            type={explanationType}
                        />
                    </div>
                );
            case 'stationary':
                return (
                    <div className="flex flex-col gap-4 text-center py-4">
                        <p className="text-slate-600 dark:text-slate-300">
                            {t('tripInsights.stationaryDesc', 'Aquí se contabiliza todo el consumo de energía de aquellos viajes registrados con una distancia menor a 0.5km (como encendidos remotos, climatización en parado, etc).')}
                        </p>
                        <div className="grid grid-cols-1 gap-3 mt-2">
                            <StatItem label={t('stats.consumption', 'Consumo Total')} value={insights.stationaryEnergy.toFixed(1)} unit="kWh" highlight />
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    // Render using Portal
    return (
        <ModalPortal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-backdrop" onClick={onClose}>
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

                <div
                    role="dialog"
                    aria-modal="true"
                    className="relative bg-white dark:bg-slate-800 rounded-2xl p-0 max-w-sm w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700 shadow-2xl animate-modal-content"
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
            </div>
        </ModalPortal>
    );
};

export default TripInsightsModal;
