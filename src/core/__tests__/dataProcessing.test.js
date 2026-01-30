// BYD Stats - Data Processing Tests
import { describe, it, expect } from 'vitest';
import { processData } from '../dataProcessing';

describe('dataProcessing', () => {
    describe('processData', () => {
        it('should return null for empty array', () => {
            expect(processData([])).toBeNull();
            expect(processData(null)).toBeNull();
            expect(processData(undefined)).toBeNull();
        });

        it('should handle zero distance trips as stationary consumption', () => {
            const trips = [
                { trip: 0, electricity: 1.0 },
            ];
            const result = processData(trips);
            expect(result).not.toBeNull();
            expect(result.summary.stationaryConsumption).toBe('1.0');
        });

        it('should process valid trips correctly', () => {
            const trips = [
                { trip: 10, electricity: 1.2, duration: 600, month: '202501', date: '20250114', start_timestamp: 1705237200 },
                { trip: 20, electricity: 2.4, duration: 1200, month: '202501', date: '20250114', start_timestamp: 1705240800 },
            ];

            const result = processData(trips);
            expect(result).not.toBeNull();
            expect(result.summary).toBeDefined();
            expect(result.monthly).toBeDefined();
            expect(result.daily).toBeDefined();
            expect(result.hourly).toBeDefined();
            expect(result.weekday).toBeDefined();
            expect(result.tripDist).toBeDefined();
        });

        it('should calculate summary statistics correctly', () => {
            const trips = [
                { trip: 10, electricity: 1.0, duration: 600 },
                { trip: 20, electricity: 2.0, duration: 1200 },
            ];

            const result = processData(trips);
            expect(result.summary.totalTrips).toBe(2);
            expect(result.summary.totalKm).toBe('30.0');
            expect(result.summary.totalKwh).toBe('3.0');
            expect(result.summary.avgEff).toBe('10.00'); // (3.0 / 30.0 * 100)
        });

        it('should handle trips with missing fields gracefully', () => {
            const trips = [
                { trip: 10 }, // Missing other fields
                { trip: 20, electricity: 2.0 },
            ];

            const result = processData(trips);
            expect(result).not.toBeNull();
            expect(result.summary.totalTrips).toBe(2);
        });

        it('should calculate trip distribution correctly', () => {
            const trips = [
                { trip: 3 },   // 0-5 km
                { trip: 10 },  // 5-15 km
                { trip: 25 },  // 15-30 km
                { trip: 40 },  // 30-50 km
                { trip: 60 },  // 50+ km
            ];

            const result = processData(trips);
            expect(result.tripDist[0].count).toBe(1); // 0-5
            expect(result.tripDist[1].count).toBe(1); // 5-15
            expect(result.tripDist[2].count).toBe(1); // 15-30
            expect(result.tripDist[3].count).toBe(1); // 30-50
            expect(result.tripDist[4].count).toBe(1); // 50+
        });

        it('should group trips by month', () => {
            const trips = [
                { trip: 10, electricity: 1.0, month: '202501' },
                { trip: 15, electricity: 1.5, month: '202501' },
                { trip: 20, electricity: 2.0, month: '202502' },
            ];

            const result = processData(trips);
            expect(result.monthly).toHaveLength(2);
            expect(result.monthly[0].trips).toBe(2); // Two trips in Jan
            expect(result.monthly[1].trips).toBe(1); // One trip in Feb
        });

        it('should group trips by day', () => {
            const trips = [
                { trip: 10, electricity: 1.0, date: '20250114' },
                { trip: 15, electricity: 1.5, date: '20250114' },
                { trip: 20, electricity: 2.0, date: '20250115' },
            ];

            const result = processData(trips);
            expect(result.daily).toHaveLength(2);
            expect(result.daily[0].trips).toBe(2); // Two trips on 14th
            expect(result.daily[1].trips).toBe(1); // One trip on 15th
        });

        it('should calculate hourly distribution', () => {
            const trips = [
                { trip: 10, start_timestamp: 1705237200 }, // Some hour
            ];

            const result = processData(trips);
            expect(result.hourly).toHaveLength(24);
            expect(result.hourly.every(h => 'hour' in h && 'trips' in h && 'km' in h)).toBe(true);
        });

        it('should calculate weekday distribution', () => {
            const trips = [
                { trip: 10, start_timestamp: 1705237200 }, // Some weekday
            ];

            const result = processData(trips);
            expect(result.weekday).toHaveLength(7);
            expect(result.weekday.every(w => 'day' in w && 'trips' in w && 'km' in w)).toBe(true);
        });

        it('should filter efficiency scatter data', () => {
            const trips = [
                { trip: 10, electricity: 1.0 },  // Valid: 10 kWh/100km
                { trip: 10, electricity: 0 },    // Skipped: electricity = 0
                { trip: 0, electricity: 1.0 },   // Skipped: trip = 0
                { trip: 10, electricity: 6.0 },  // Skipped: 60 kWh/100km (> 50)
            ];

            const result = processData(trips);
            expect(result.effScatter.length).toBe(1);
            expect(result.effScatter[0].x).toBe(10);
            expect(result.effScatter[0].y).toBe(10); // (1.0 / 10) * 100
        });

        it('should calculate top trips correctly', () => {
            const trips = [
                { trip: 50, electricity: 5.0, duration: 3000 },
                { trip: 30, electricity: 3.0, duration: 2000 },
                { trip: 10, electricity: 1.0, duration: 1000 },
            ];

            const result = processData(trips);
            expect(result.top.km[0].trip).toBe(50);
            expect(result.top.kwh[0].electricity).toBe(5.0);
            expect(result.top.dur[0].duration).toBe(3000);
        });

        it('should handle zero totalKm as stationary consumption only', () => {
            const trips = [
                { trip: 0, electricity: 1.0 }, // All zero trips
            ];
            const result = processData(trips);
            expect(result).not.toBeNull();
            expect(result.summary.totalKm).toBe('0.0');
            expect(result.summary.stationaryConsumption).toBe('1.0');
        });

        it('should skip malformed trips without crashing', () => {
            const trips = [
                { trip: 10, electricity: 1.0 }, // Valid
                { invalidField: 'test' },       // Missing trip field
                null,                            // Null trip
                { trip: 'invalid' },             // Non-number trip
            ];

            const result = processData(trips);
            expect(result).not.toBeNull();
            expect(result.summary.totalTrips).toBe(1); // Only one valid trip
        });
    });
});

