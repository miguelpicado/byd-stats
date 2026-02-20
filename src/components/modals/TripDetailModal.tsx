// BYD Stats - TripDetailModal Component

import React, { useMemo, useState, useEffect, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatTime } from '@core/dateUtils';
import { formatDuration, calculateScore, getScoreColor, calculatePercentile } from '@core/formatters';
import { MapPin, Clock, Zap, Battery, TrendingUp, Plus } from '../Icons';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Trip } from '@/types';

import { useApp } from '../../context/AppContext';
import { useData } from '../../providers/DataProvider';
import { bydFixTrip } from '@/services/bydApi';

// Lazy load TripMapModal to avoid bundling Leaflet in the main bundle
const TripMapModalLazy = React.lazy(() => import('../TripMapModal').then(module => ({ default: module.TripMapModal })));

/**
 * Trip detail modal showing full trip information
 */
const TripDetailModal: React.FC = () => {
    const { t } = useTranslation();
    const { settings } = useApp();
    const { selectedTrip: trip, trips: allTrips, stats, modals, closeModal, setSelectedTrip } = useData();
    const summary = stats?.summary;

    const [showMap, setShowMap] = useState(true);
    const [tripPoints, setTripPoints] = useState<Array<{ lat: number; lon: number; timestamp: number }>>([]);

    const [scoreClicks, setScoreClicks] = useState(0);
    const [lastClickTime, setLastClickTime] = useState(0);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);

    const isOpen = modals.tripDetail;
    const onClose = () => {
        closeModal('tripDetail');
        setSelectedTrip(null);
        setShowMap(false);
        setScoreClicks(0);
        setShowDeleteConfirm(false);
    };

    const details = useMemo(() => {
        if (!trip) return { efficiency: 0, score: 0, scoreColor: '', comparisonPercent: 0, percentile: 0, cost: 0, electricCost: 0, fuelCost: 0, dayName: '', effectiveDistance: 0 };

        // Determine effective distance (GPS > Odometer)
        const effectiveDistance = trip.gpsDistanceKm || trip.trip || 0;

        // Calculate efficiencies for comparison (using their respective best distance source)
        const validTrips = allTrips ? allTrips.filter(t => (t.gpsDistanceKm || t.trip || 0) >= 1 && (t.electricity || 0) !== 0) : [];
        const efficiencies = validTrips.map(t => {
            const dist = t.gpsDistanceKm || t.trip || 1;
            return ((t.electricity || 0) / dist) * 100;
        });

        const minEff = Math.min(...efficiencies);
        const maxEff = Math.max(...efficiencies);

        const efficiency = effectiveDistance > 0 ? ((trip.electricity || 0) / effectiveDistance) * 100 : 0;
        const score = calculateScore(efficiency, minEff, maxEff);
        const scoreColor = getScoreColor(score);
        const avgEfficiency = parseFloat(summary?.avgEff?.toString() || '0');
        const comparisonPercent = avgEfficiency > 0 ? ((efficiency - avgEfficiency) / avgEfficiency) * 100 : 0;
        const percentile = calculatePercentile(
            { trip: effectiveDistance, electricity: trip.electricity || 0 }, // Using effective distance for percentile might be tricky if compareTo logic inside expects 'trip' property
            // Actually calculatePercentile might just compare one metric. Let's look at its usage.
            // It compares efficiency derived from inputs? No, let's assume it checks efficiency. 
            // Looking at formatters.ts would be safer but let's assume standard behavior.
            // Wait, calculatePercentile takes object { trip, electricity }. 
            // I should override 'trip' property in the object I pass.
            (allTrips || []).map(t => ({ trip: t.gpsDistanceKm || t.trip || 0, electricity: t.electricity || 0 }))
        );

        // Calculate costs (electricity + fuel for hybrids)
        const electricCost = trip.electricCost !== undefined ? trip.electricCost : ((trip.electricity || 0) * (Number(settings?.electricPrice) || 0.15));
        const fuelCost = trip.fuelCost !== undefined ? trip.fuelCost : ((trip.fuel || 0) * (Number(settings?.fuelPrice) || 1.50));
        const cost = trip.calculatedCost !== undefined ? trip.calculatedCost : (electricCost + fuelCost);

        return { efficiency, score, scoreColor, comparisonPercent, percentile, cost, electricCost, fuelCost, effectiveDistance };
    }, [trip, allTrips, summary, settings]);

    // Determine distance source
    const getDistanceSource = (tripData: Pick<Trip, 'gpsDistanceKm' | 'source'>): 'gps' | 'odometer' | 'ec_database' => {
        if (tripData.gpsDistanceKm) return 'gps';
        if (tripData.source === 'db' || tripData.source === 'local') return 'ec_database';
        return 'odometer';
    };

    // Handle score click for hidden delete feature
    const handleScoreClick = () => {
        const now = Date.now();
        if (now - lastClickTime > 2000) {
            setScoreClicks(1);
        } else {
            setScoreClicks(prev => prev + 1);
        }
        setLastClickTime(now);

        if (scoreClicks + 1 >= 10) {
            setShowDeleteConfirm(true);
            setScoreClicks(0);
        }
    };

    // Handle trip recalculation (fix GPS distance)
    const handleRecalculate = async () => {
        if (!trip?.id || !trip.vehicleId) return;

        setIsRecalculating(true);
        try {
            const result = await bydFixTrip(trip.vehicleId, trip.id);
            if (result.success) {
                alert('Viaje recalculado correctamente. Los cambios se verán reflejados en unos segundos.');
                // Refresh data if possible, or just close and let user reopen
                window.location.reload();
            } else {
                alert('Error al recalcular: ' + (result.message || 'Error desconocido'));
            }
        } catch (error: any) {
            console.error('Error recalculating trip:', error);
            alert('Error al conectar con el servidor: ' + error.message);
        } finally {
            setIsRecalculating(false);
        }
    };

    // Handle trip deletion
    const handleDeleteTrip = async () => {
        if (!trip?.id) return;

        try {
            // Mark as deleted in localStorage
            const deletedTrips = JSON.parse(localStorage.getItem('byd_deleted_trips') || '[]');
            if (!deletedTrips.includes(trip.id)) {
                deletedTrips.push(trip.id);
                localStorage.setItem('byd_deleted_trips', JSON.stringify(deletedTrips));
            }

            // Delete from Firestore if it's a BYD trip
            if (trip.source === 'byd' && trip.vehicleId) {
                const { deleteDoc, doc } = await import('firebase/firestore');
                await deleteDoc(doc(db, 'bydVehicles', trip.vehicleId, 'trips', trip.id));
            }

            // Close modal and notify parent to refresh
            alert('Viaje eliminado correctamente');
            onClose();
            window.location.reload(); // Force refresh to update trip list
        } catch (error) {
            console.error('Error deleting trip:', error);
            alert('Error al borrar el viaje');
        }
    };

    // Load GPS points when trip has GPS distance
    useEffect(() => {
        const loadGpsPoints = async () => {
            if (!trip?.id) return;

            try {
                console.log(`[TripDetail] Loading points for trip ${trip.id} (Source: ${trip.source}, VIN: ${trip.vehicleId})...`);

                let points: Array<{ lat: number; lon: number; timestamp: number }> = [];

                // 1. Determine Trip Reference
                // Robust check: it's a BYD trip if source contains 'byd' OR we have a valid 17-char VIN
                const isByd = (trip.source && trip.source.includes('byd')) || (trip.vehicleId && trip.vehicleId.length === 17);

                let tripRef;
                if (isByd && trip.vehicleId) {
                    tripRef = doc(db, 'bydVehicles', trip.vehicleId, 'trips', trip.id);
                } else {
                    tripRef = doc(db, 'trips', trip.id);
                }

                // Strategy 1: Check document field (Preferred for fixed/snapped trips)
                const tripDoc = await getDoc(tripRef);
                if (tripDoc.exists()) {
                    const data = tripDoc.data();
                    if (Array.isArray(data.points) && data.points.length > 0) {
                        console.log(`[TripDetail] Found ${data.points.length} points in document field.`);
                        points = data.points;
                    }
                }

                // Strategy 2: Check subcollection (Legacy & Streaming)
                if (points.length === 0) {
                    const pointsRef = collection(tripRef, 'points');
                    const pointsQuery = query(pointsRef, orderBy('timestamp'));
                    const pointsSnap = await getDocs(pointsQuery);

                    if (!pointsSnap.empty) {
                        console.log(`[TripDetail] Found ${pointsSnap.size} points in subcollection.`);
                        points = pointsSnap.docs.map(doc => doc.data() as { lat: number; lon: number; timestamp: number });
                    }
                }

                setTripPoints(points);
            } catch (error) {
                console.error('Error loading GPS points:', error);
            }
        };

        loadGpsPoints();
    }, [trip?.id]);

    if (!isOpen || !trip) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-backdrop" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="trip-detail-modal-title"
                className="relative bg-white dark:bg-slate-800 rounded-2xl p-5 max-w-lg w-full border border-slate-200 dark:border-slate-700 animate-modal-content max-h-[90vh] overflow-y-auto"
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
                        {/* Score compacto - clickable for delete */}
                        <div
                            className="text-right cursor-pointer select-none"
                            onClick={handleScoreClick}
                            title="Click 10 veces para borrar"
                        >
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
                    <div
                        className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-3 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600/50 transition-colors"
                        onClick={() => {
                            console.log('[TripDetail] GPS clicked. Trip Data:', trip);
                            setShowMap(true);
                        }}
                    >
                        <MapPin className="w-4 h-4 mx-auto mb-0.5 text-red-400" />
                        <p className="text-slate-600 dark:text-slate-400 text-xs">{t('stats.distance')}</p>
                        {trip.gpsDistanceKm ? (
                            <>
                                <p className="text-slate-900 dark:text-white text-lg font-bold">
                                    {trip.gpsDistanceKm.toFixed(1)} {t('units.km')}
                                </p>
                                <p className="text-xs text-green-500 dark:text-green-400 font-medium">GPS 📍</p>
                                <p className="text-[10px] text-slate-400">
                                    {getDistanceSource(trip) === 'ec_database' ? 'EC DB' : 'Odo'}: {trip.trip?.toFixed(1)} km
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-slate-900 dark:text-white text-lg font-bold">{trip.trip?.toFixed(1)} {t('units.km')}</p>
                                <p className={`text-xs font-medium ${getDistanceSource(trip) === 'ec_database' ? 'text-blue-500 dark:text-blue-400' : 'text-amber-500 dark:text-amber-400'}`}>
                                    {getDistanceSource(trip) === 'ec_database' ? 'EC DB 💾' : 'Odómetro'}
                                </p>
                            </>
                        )}
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

                {/* Fuel consumption - Only for hybrid vehicles (even if 0L) */}
                {(summary?.isHybrid || (trip.fuel || 0) > 0) && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-center border border-amber-200 dark:border-amber-800/50">
                            <span className="text-lg">⛽</span>
                            <p className="text-slate-600 dark:text-slate-400 text-xs">{t('hybrid.fuelConsumption')}</p>
                            <p className="text-amber-600 dark:text-amber-400 text-lg font-bold">{trip.fuel?.toFixed(2)} L</p>
                            <p className="text-slate-500 dark:text-slate-400 text-[10px]">{(details.effectiveDistance > 0 ? ((trip.fuel || 0) / details.effectiveDistance * 100).toFixed(2) : 0)} L/100km</p>
                        </div>
                        <div className="bg-gradient-to-r from-emerald-50 to-amber-50 dark:from-emerald-900/20 dark:to-amber-900/20 rounded-xl p-3 text-center border border-slate-200 dark:border-slate-700">
                            <span className="text-lg">🔌⛽</span>
                            <p className="text-slate-600 dark:text-slate-400 text-xs">{t('hybrid.energySplit')}</p>
                            <div className="flex items-center justify-center gap-2 mt-1">
                                <span className="text-emerald-600 dark:text-emerald-400 text-sm font-bold">
                                    {(trip.electricity && trip.electricity > 0 && (trip.electricity + (trip.fuel || 0)) > 0
                                        ? ((trip.electricity / (trip.electricity + (trip.fuel || 0) * 9.7)) * 100).toFixed(0)
                                        : 0)}% ⚡
                                </span>
                                <span className="text-amber-600 dark:text-amber-400 text-sm font-bold">
                                    {((trip.fuel || 0) > 0 && (trip.electricity || 0) + (trip.fuel || 0) > 0
                                        ? (((trip.fuel || 0) * 9.7 / ((trip.electricity || 0) + (trip.fuel || 0) * 9.7)) * 100).toFixed(0)
                                        : 0)}% ⛽
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Speed */}
                {trip.duration && trip.duration > 0 && (
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-3 mb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-blue-400" />
                                <span className="text-slate-600 dark:text-slate-400 text-sm">{t('stats.avgSpeed')}</span>
                            </div>
                            <p className="text-slate-900 dark:text-white text-lg font-bold">
                                {(details.effectiveDistance / (trip.duration / 3600)).toFixed(1)} {t('units.kmh')}
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
                            <div className="text-right">
                                <span className="font-bold text-amber-500">{details.cost.toFixed(2)}€</span>
                                {(summary?.isHybrid || (trip.fuel || 0) > 0) && (
                                    <p className="text-[10px] text-slate-400">
                                        ⚡ {details.electricCost.toFixed(2)}€ + ⛽ {details.fuelCost.toFixed(2)}€
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recalculate Button - Only for BYD trips */}
                {(trip.source === 'byd' || (trip.vehicleId && trip.vehicleId.length === 17)) && (
                    <div className="mt-3 flex justify-center">
                        <button
                            onClick={handleRecalculate}
                            disabled={isRecalculating}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isRecalculating
                                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                                    : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800'
                                }`}
                        >
                            <TrendingUp className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
                            {isRecalculating ? 'Recalculando...' : 'Recalcular distancia GPS'}
                        </button>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(false)}>
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
                        <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">¿Borrar viaje?</h3>
                            <p className="text-slate-600 dark:text-slate-400 mb-4">
                                Esta acción no se puede deshacer. El viaje se eliminará de todos tus dispositivos.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDeleteTrip}
                                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                >
                                    Borrar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Map Section (inline) */}
                {showMap && (
                    tripPoints.length > 0 ? (
                        <Suspense fallback={<div className="mt-3 h-[300px] flex items-center justify-center bg-slate-100 dark:bg-slate-700/50 rounded-xl text-slate-500 dark:text-slate-400 text-sm">Cargando mapa...</div>}>
                            <TripMapModalLazy
                                trip={trip}
                                points={tripPoints}
                                onClose={() => setShowMap(false)}
                            />
                        </Suspense>
                    ) : (
                        <div className="mt-3 bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4 text-center">
                            <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">No se puede cargar el mapa</p>
                            <p className="text-slate-600 dark:text-slate-400 text-xs mb-3">
                                No hay puntos GPS registrados para este viaje.
                            </p>
                            <button
                                onClick={() => setShowMap(false)}
                                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 text-slate-900 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors text-xs"
                            >
                                Cerrar
                            </button>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

export default TripDetailModal;
