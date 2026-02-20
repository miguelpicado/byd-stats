import React from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

import type { Trip } from '@/types';

interface TripMapModalProps {
    trip: Trip;
    points: { lat: number; lon: number; timestamp: number }[];
    onClose: () => void;
}

export const TripMapModal: React.FC<TripMapModalProps> = ({ trip, points, onClose }) => {
    if (!points || points.length === 0) {
        return null;
    }

    const pathCoords = points.map(p => [p.lat, p.lon] as [number, number]);
    const center = pathCoords[Math.floor(pathCoords.length / 2)] || [41.3879, 2.1699];

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
                <MapContainer center={center} zoom={13} style={{ height: '300px', width: '100%' }}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    <Polyline positions={pathCoords} color="#2196F3" weight={4} opacity={0.7} />
                    <Marker position={pathCoords[0]}>
                        <Popup>
                            <strong>Inicio</strong><br />
                            {new Date((trip.start_timestamp || 0) * 1000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </Popup>
                    </Marker>
                    <Marker position={pathCoords[pathCoords.length - 1]}>
                        <Popup>
                            <strong>Fin</strong><br />
                            {new Date(((trip.start_timestamp || 0) + (trip.duration || 0)) * 1000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </Popup>
                    </Marker>
                </MapContainer>
            </div>
        </div>
    );
};
