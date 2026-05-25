// BYD Stats - TripRouteMap (premium)
// Renders a trip's GPS route with Leaflet + OpenStreetMap tiles.
// This module is lazy-loaded: Leaflet and OSM tiles are only fetched when a
// premium user actually views a trip that has route data. Open Source / non
// premium sessions never load this code, so the PWA bundle is unaffected.

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GpsCoord } from '@/types';

interface TripRouteMapProps {
    path: GpsCoord[];
    className?: string;
}

const TripRouteMap: React.FC<TripRouteMapProps> = ({ path, className }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);

    useEffect(() => {
        if (!containerRef.current || path.length < 2) return;

        const map = L.map(containerRef.current, {
            zoomControl: true,
            scrollWheelZoom: false,
        });
        mapRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        const latlngs = path.map(([lat, lng]) => L.latLng(lat, lng));
        const line = L.polyline(latlngs, { color: '#ea0029', weight: 4, opacity: 0.9 }).addTo(map);

        // Start (green) / end (red) markers — circleMarkers avoid icon-asset bundling issues
        L.circleMarker(latlngs[0], { radius: 6, color: '#fff', weight: 2, fillColor: '#10b981', fillOpacity: 1 }).addTo(map);
        L.circleMarker(latlngs[latlngs.length - 1], { radius: 6, color: '#fff', weight: 2, fillColor: '#ef4444', fillOpacity: 1 }).addTo(map);

        map.fitBounds(line.getBounds(), { padding: [20, 20] });

        // The modal animates in; recompute size once it has settled
        const sizing = setTimeout(() => map.invalidateSize(), 120);

        return () => {
            clearTimeout(sizing);
            map.remove();
            mapRef.current = null;
        };
    }, [path]);

    return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }} />;
};

export default TripRouteMap;
