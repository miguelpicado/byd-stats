// BYD Stats - CSV Import Service
// Parses BYD vehicle CSV export format into Trip objects

import { Trip } from '@/types';

interface CsvImportResult {
    trips: Trip[];
    lineCount: number;
}

/**
 * Parse a single CSV row into a Trip object.
 * Expects format: [dateTime, duration_min, distance_km, energy_kwh, ...]
 * The dateTime must be "YYYY-MM-DD HH:MM" format.
 */
function parseTripRow(values: string[]): Trip | null {
    const [inicio, dur, dist, energy] = values;
    if (!inicio) return null;

    const dateMatch = inicio.match(/^(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2})/);
    if (!dateMatch) return null;

    const [year, month, day] = dateMatch[1].split('-').map(Number);
    const [hour, minute] = dateMatch[2].split(':').map(Number);

    const dateObj = new Date(year, month - 1, day, hour || 0, minute || 0);
    const timestamp = Math.floor(dateObj.getTime() / 1000);
    const durationSeconds = (parseInt(dur) || 0) * 60;

    const appDateStr = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
    const appMonthStr = `${year}${String(month).padStart(2, '0')}`;

    return {
        trip: parseFloat(dist) || 0,
        electricity: parseFloat(energy) || 0,
        duration: durationSeconds,
        date: appDateStr,
        start_timestamp: timestamp,
        month: appMonthStr,
        end_timestamp: timestamp + durationSeconds
    };
}

/**
 * Split a CSV line into values, handling quoted fields.
 * Tries comma delimiter first, falls back to semicolon.
 */
function splitCsvLine(line: string): string[] | null {
    const values = line.match(/("[^"]*"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim());
    if (values && values.length >= 4) return values;

    const semiValues = line.match(/("[^"]*"|[^;]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim());
    if (semiValues && semiValues.length >= 4) return semiValues;

    return null;
}

/**
 * Parse a CSV file's text content into an array of Trip objects.
 */
export function parseCsvTrips(text: string): CsvImportResult {
    const lines = text.split(/\r?\n/).filter(l => l.trim());

    if (lines.length < 2) {
        return { trips: [], lineCount: lines.length };
    }

    const rows = lines.slice(1)
        .map(line => {
            const values = splitCsvLine(line);
            return values ? parseTripRow(values) : null;
        })
        .filter((r): r is Trip => r !== null);

    return { trips: rows, lineCount: lines.length };
}

/**
 * Merge new trips into existing trips, deduplicating by date+timestamp key.
 */
export function mergeTrips(existing: Trip[], incoming: Trip[]): Trip[] {
    const map = new Map<string, Trip>();
    existing.forEach(t => map.set(`${t.date}-${t.start_timestamp}`, t));
    incoming.forEach(t => map.set(`${t.date}-${t.start_timestamp}`, t));

    return Array.from(map.values()).sort((a, b) => {
        const dateComp = (a.date || '').localeCompare(b.date || '');
        if (dateComp !== 0) return dateComp;
        return (a.start_timestamp || 0) - (b.start_timestamp || 0);
    });
}
