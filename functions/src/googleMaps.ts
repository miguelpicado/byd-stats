
import * as functions from 'firebase-functions';
import axios from 'axios';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || functions.config().google?.maps_api_key;

interface LatLng {
    lat: number;
    lon: number;
    timestamp?: number;
    type?: string;
}

interface SnappedPoint {
    location: {
        latitude: number;
        longitude: number;
    };
    originalIndex: number;
    placeId: string;
}

/**
 * Snap points to roads using Google Maps API
 * Handles pagination (max 100 points per request)
 */
export async function snapToRoads(points: LatLng[]): Promise<LatLng[]> {
    if (!GOOGLE_MAPS_API_KEY) {
        console.error('[snapToRoads] Missing Google Maps API Key');
        return points;
    }

    if (points.length < 2) {
        console.log('[snapToRoads] Not enough points to snap');
        return points;
    }

    try {
        console.log(`[snapToRoads] Processing ${points.length} points...`);
        const snappedPoints: LatLng[] = [];
        // Google Maps limit is 100 points
        const chunkSize = 100;

        for (let i = 0; i < points.length; i += chunkSize) {
            const chunk = points.slice(i, i + chunkSize);
            const path = chunk.map(p => `${p.lat},${p.lon}`).join('|');

            console.log(`[snapToRoads] Requesting chunk ${i / chunkSize + 1}, path length: ${chunk.length}`);

            try {
                const response = await axios.get('https://roads.googleapis.com/v1/snapToRoads', {
                    params: {
                        path,
                        interpolate: true,
                        key: GOOGLE_MAPS_API_KEY,
                    },
                });

                if (response.data && response.data.snappedPoints && response.data.snappedPoints.length > 0) {
                    console.log(`[snapToRoads] Chunk ${i / chunkSize + 1} success. Received ${response.data.snappedPoints.length} snapped points.`);

                    let lastKnownTimestamp = chunk[0].timestamp || Date.now();

                    // First pass: map to intermediate structure
                    const intermediatePoints = response.data.snappedPoints.map((sp: SnappedPoint) => {
                        const original = sp.originalIndex !== undefined ? chunk[sp.originalIndex] : undefined;
                        return {
                            lat: sp.location.latitude,
                            lon: sp.location.longitude,
                            timestamp: original?.timestamp, // Only present for non-interpolated
                            type: original?.type || 'snapped',
                            originalIndex: sp.originalIndex
                        };
                    });

                    // Second pass: interpolate timestamps
                    for (let j = 0; j < intermediatePoints.length; j++) {
                        if (intermediatePoints[j].timestamp) continue;

                        // Find limits for interpolation
                        let prevIdx = j - 1;
                        while (prevIdx >= 0 && !intermediatePoints[prevIdx].timestamp) prevIdx--;

                        let nextIdx = j + 1;
                        while (nextIdx < intermediatePoints.length && !intermediatePoints[nextIdx].timestamp) nextIdx++;

                        const prevTime = prevIdx >= 0 ? intermediatePoints[prevIdx].timestamp! : lastKnownTimestamp;
                        const nextTime = nextIdx < intermediatePoints.length ? intermediatePoints[nextIdx].timestamp! : (prevTime + 10000); // Fallback 10s ahead if end of chunk

                        const gapSize = nextIdx - prevIdx;
                        const timeStep = (nextTime - prevTime) / gapSize;

                        intermediatePoints[j].timestamp = Math.round(prevTime + timeStep * (j - prevIdx));
                    }

                    // Update lastKnown for next chunk
                    if (intermediatePoints.length > 0) {
                        lastKnownTimestamp = intermediatePoints[intermediatePoints.length - 1].timestamp!;
                    }

                    snappedPoints.push(...intermediatePoints.map((p: any) => ({
                        lat: p.lat,
                        lon: p.lon,
                        timestamp: p.timestamp,
                        type: p.type
                    })));
                } else {
                    // Fallback: API returned no points for this chunk (e.g. off-road)
                    console.warn(`[snapToRoads] Chunk ${i / chunkSize} API returned no snappedPoints. Response:`, JSON.stringify(response.data));
                    snappedPoints.push(...chunk);
                }
            } catch (err: any) {
                console.error(`[snapToRoads] API Error for chunk ${i}:`, err.message);
                if (err.response) {
                    console.error('[snapToRoads] API Error details:', JSON.stringify(err.response.data));
                }
                // Fallback: Error occurred, keep original points
                snappedPoints.push(...chunk);
            }
        }

        console.log(`[snapToRoads] Finished. Input: ${points.length} -> Output: ${snappedPoints.length}`);
        return snappedPoints.length > 0 ? snappedPoints : points;

    } catch (error: any) {
        console.error('[snapToRoads] Top-level error:', error.message);
        return points; // Fallback to original points
    }
}

/**
 * Calculate total distance between points in KM using Havesine formula
 */
export function calculatePathDistanceKm(points: LatLng[]): number {
    if (points.length < 2) return 0;

    let totalDist = 0;
    for (let i = 0; i < points.length - 1; i++) {
        totalDist += getDistanceFromLatLonInKm(
            points[i].lat, points[i].lon,
            points[i + 1].lat, points[i + 1].lon
        );
    }
    return Math.round(totalDist * 100) / 100;
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}
