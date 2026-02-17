import React, { useMemo } from 'react'; // Added useMemo
import { useTranslation } from 'react-i18next';
import { VehicleStatus } from '@/hooks/useVehicleStatus';
import { MapPin } from '@/components/Icons'; // Changed imports
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
// ... (imports done)

// ... inside component ...
{
    status?.lastUpdate && (
        <span className="text-[10px] text-slate-800 dark:text-slate-300 bg-white/90 dark:bg-slate-900/80 px-2 py-0.5 rounded-full backdrop-blur-sm font-medium shadow-sm">
            {/* Timestamp logic */}
            {new Date(status.lastUpdate.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
    )
}

// Fix Leaflet default marker icons (same as in TripMapModal)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LocationCardProps {
    status: VehicleStatus | null;
}

const LocationCard: React.FC<LocationCardProps> = ({ status }) => {
    const { t } = useTranslation();

    const location = status?.lastLocation;
    const hasLocation = location?.lat && location?.lon;

    const mapCenter = useMemo(() => {
        if (hasLocation) {
            return [location.lat, location.lon] as [number, number];
        }
        return [40.4168, -3.7038] as [number, number]; // Default to Madrid if no location
    }, [location]);

    return (
        <div className="w-full flex-1 min-h-[120px] bg-white dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/30 overflow-hidden relative group shadow-sm dark:shadow-none">
            {hasLocation ? (
                <div className="h-full w-full relative z-0">
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
                            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        />
                        <Marker position={mapCenter}>
                            {/* Optional: Add custom icon or just standard marker */}
                        </Marker>
                    </MapContainer>
                    {/* Overlay gradient removed as per user request to avoid obscuring the map */}
                    {/* <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/20 dark:from-slate-900/90 dark:via-slate-900/20 to-transparent pointer-events-none z-[400]" /> */}
                </div>
            ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 z-0">
                    <span className="text-slate-500 text-sm flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {t('dashboard.mapPlaceholder', 'Map View')}
                    </span>
                </div>
            )}

            {/* Content overlay - Last Updated */}
            <div className="absolute bottom-3 left-4 right-4 z-[500] pointer-events-none">
                <div className="flex items-center justify-between">
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700/50 flex items-center gap-1.5 shadow-lg">
                        <MapPin className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                            {hasLocation ?
                                `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}` :
                                t('common.noLocation', 'Sin ubicación')
                            }
                        </span>
                    </div>

                    {status?.lastUpdate && (
                        <span className="text-[10px] text-slate-800 dark:text-slate-300 bg-white/90 dark:bg-slate-900/80 px-2 py-0.5 rounded-full backdrop-blur-sm font-medium shadow-sm">
                            {/* Timestamp logic */}
                            {new Date(status.lastUpdate.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LocationCard;
