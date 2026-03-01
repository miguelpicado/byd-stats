import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default marker icons
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet icon fix workaround
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to update map center when location changes and fix size issues
const MapUpdater: React.FC<{ center: [number, number]; forceRefresh?: number }> = ({ center, forceRefresh }) => {
    const map = useMap();

    useEffect(() => {
        // Fix common Leaflet issue: map not rendering correctly until resize
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }, [map]);

    useEffect(() => {
        map.setView(center, map.getZoom());
        // Force invalidate size when location updates
        setTimeout(() => {
            map.invalidateSize();
        }, 50);
    }, [center, map]);

    // Force refresh when explicitly requested
    useEffect(() => {
        if (forceRefresh) {
            map.invalidateSize();
            map.setView(center, map.getZoom());
        }
    }, [forceRefresh, map, center]);

    return null;
};

interface LocationCardMapProps {
    mapCenter: [number, number];
    forceRefresh?: number;
    isDark: boolean;
}

const LocationCardMap: React.FC<LocationCardMapProps> = ({ mapCenter, forceRefresh, isDark }) => {
    return (
        <MapContainer
            center={mapCenter}
            zoom={15}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            dragging={false}      // Disable interaction for "preview" feel
            scrollWheelZoom={false}
            doubleClickZoom={false}
            touchZoom={false}
            attributionControl={false}
        >
            <TileLayer
                url={isDark
                    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                }
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            <MapUpdater center={mapCenter} forceRefresh={forceRefresh} />
            <Marker position={mapCenter} />
        </MapContainer>
    );
};

export default LocationCardMap;
