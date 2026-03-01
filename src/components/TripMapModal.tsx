import React from 'react';
import type { Trip } from '@/types';

// Lazy load the Map component
const LazyTripMap = React.lazy(() => import('@components/maps/TripMap'));

interface TripMapModalProps {
    trip: Trip;
    points: { lat: number; lon: number; timestamp: number }[];
    onClose: () => void;
}

export const TripMapModal: React.FC<TripMapModalProps> = ({ trip, points, onClose }) => {
    if (!points || points.length === 0) {
        return null;
    }



    return (
        <div className="mt-3 w-full overflow-hidden">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Ruta del Viaje</h3>
                <button onClick={onClose} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-lg leading-none">×</button>
            </div>

            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-2 px-1">
                <span>Distancia GPS: <strong className="text-slate-900 dark:text-white">{trip.gpsDistanceKm?.toFixed(1)} km</strong></span>
                <span>{points.length} puntos GPS</span>
            </div>

            <div className="rounded-xl overflow-hidden w-full">
                <React.Suspense fallback={<div className="h-[300px] w-full bg-slate-100 dark:bg-slate-800 animate-pulse flex items-center justify-center text-slate-400">Cargando mapa...</div>}>
                    <LazyTripMap trip={trip} points={points} />
                </React.Suspense>
            </div>
        </div>
    );
};
