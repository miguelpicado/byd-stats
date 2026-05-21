// BYD Stats - CsvImportService Tests
import { describe, it, expect } from 'vitest';
import { parseCsvTrips, mergeTrips } from '../CsvImportService';
import { Trip } from '@/types';

const sampleCsv = `Inicio,Duración (min),Distancia (km),Energía (kWh)
2026-01-15 08:30,45,25.5,3.82
2026-01-15 17:15,60,30.0,4.50
2026-01-16 09:00,30,12.0,1.80`;

const semiCsv = `Inicio;Duración (min);Distancia (km);Energía (kWh)
2026-01-15 08:30;45;25.5;3.82
2026-01-15 17:15;60;30.0;4.50`;

describe('parseCsvTrips', () => {
    it('should parse comma-delimited CSV correctly', () => {
        const result = parseCsvTrips(sampleCsv);
        expect(result.lineCount).toBe(4); // header + 3 rows
        expect(result.trips).toHaveLength(3);
    });

    it('should parse semicolon-delimited CSV correctly', () => {
        const result = parseCsvTrips(semiCsv);
        expect(result.trips).toHaveLength(2);
    });

    it('should extract trip fields correctly', () => {
        const result = parseCsvTrips(sampleCsv);
        const trip = result.trips[0];

        expect(trip.trip).toBe(25.5);
        expect(trip.electricity).toBe(3.82);
        expect(trip.duration).toBe(2700); // 45 min * 60
        expect(trip.date).toBe('20260115');
        expect(trip.month).toBe('202601');
    });

    it('should return empty trips for insufficient lines', () => {
        const result = parseCsvTrips('Just a header');
        expect(result.trips).toHaveLength(0);
        expect(result.lineCount).toBe(1);
    });

    it('should handle empty input', () => {
        const result = parseCsvTrips('');
        expect(result.trips).toHaveLength(0);
        expect(result.lineCount).toBe(0);
    });

    it('should skip invalid rows', () => {
        const csv = `Inicio,Duración (min),Distancia (km),Energía (kWh)
Invalid line here
2026-01-15 08:30,45,25.5,3.82`;
        const result = parseCsvTrips(csv);
        expect(result.trips).toHaveLength(1); // Only the valid row
    });

    it('should filter out rows without timestamp', () => {
        const csv = `Inicio,Duración (min),Distancia (km),Energía (kWh)
,45,25.5,3.82
2026-01-15 08:30,45,25.5,3.82`;
        const result = parseCsvTrips(csv);
        expect(result.trips).toHaveLength(1);
    });

    it('should handle missing duration/distance/energy as 0', () => {
        const csv = `Inicio,Duración (min),Distancia (km),Energía (kWh)
2026-01-15 08:30,0,0,0`;
        const result = parseCsvTrips(csv);
        expect(result.trips).toHaveLength(1);
        const trip = result.trips[0];
        expect(trip.trip).toBe(0);
        expect(trip.electricity).toBe(0);
        expect(trip.duration).toBe(0);
    });

    it('should handle quoted fields', () => {
        const csv = `Inicio,Duración (min),Distancia (km),Energía (kWh)
"2026-01-15 08:30","45","25.5","3.82"`;
        const result = parseCsvTrips(csv);
        expect(result.trips).toHaveLength(1);
        expect(result.trips[0].trip).toBe(25.5);
    });

    it('should set month in YYYYMM format', () => {
        const result = parseCsvTrips(sampleCsv);
        expect(result.trips[0].month).toBe('202601');
    });

    it('should calculate end_timestamp from start + duration', () => {
        const result = parseCsvTrips(sampleCsv);
        const trip = result.trips[0];
        expect(trip.end_timestamp).toBe(trip.start_timestamp + trip.duration);
    });
});

describe('mergeTrips', () => {
    const makeTrip = (date: string, ts: number, dist: number): Trip => ({
        date,
        start_timestamp: ts,
        trip: dist,
        electricity: 1.0,
        duration: 600,
        end_timestamp: ts + 600,
        month: date.slice(0, 6)
    });

    it('should merge incoming into empty existing', () => {
        const incoming = [makeTrip('20260115', 1000, 25)];
        const result = mergeTrips([], incoming);
        expect(result).toHaveLength(1);
        expect(result[0].trip).toBe(25);
    });

    it('should keep existing when no new trips', () => {
        const existing = [makeTrip('20260115', 1000, 25)];
        const result = mergeTrips(existing, []);
        expect(result).toEqual(existing);
    });

    it('should overwrite duplicates by date+timestamp key', () => {
        const existing = [makeTrip('20260115', 1000, 20)];
        const incoming = [makeTrip('20260115', 1000, 30)];
        const result = mergeTrips(existing, incoming);
        expect(result).toHaveLength(1);
        expect(result[0].trip).toBe(30); // incoming wins
    });

    it('should keep non-duplicates', () => {
        const existing = [makeTrip('20260115', 1000, 20)];
        const incoming = [makeTrip('20260115', 2000, 30)];
        const result = mergeTrips(existing, incoming);
        expect(result).toHaveLength(2);
    });

    it('should sort by date then timestamp', () => {
        const trips = [
            makeTrip('20260116', 1000, 30), // later date
            makeTrip('20260115', 2000, 25), // same date, later time
            makeTrip('20260115', 1000, 20)  // earliest
        ];
        const result = mergeTrips([], trips);
        expect(result[0].trip).toBe(20);
        expect(result[1].trip).toBe(25);
        expect(result[2].trip).toBe(30);
    });
});
