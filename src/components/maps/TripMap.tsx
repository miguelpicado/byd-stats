import React from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Trip } from '@/types';

// Fix Leaflet default marker icons
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet icon fix workaround
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface TripMapProps {
    trip: Trip;
    points: { lat: number; lon: number; timestamp: number }[];
}

const TripMap: React.FC<TripMapProps> = ({ trip, points }) => {
    const pathCoords = points.map(p => [p.lat, p.lon] as [number, number]);
    const center = pathCoords[Math.floor(pathCoords.length / 2)] || [41.3879, 2.1699];

    return (
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
    );
};

export default TripMap;
