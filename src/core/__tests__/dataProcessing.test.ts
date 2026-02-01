// BYD Stats - Data Processing Tests
import { describe, it, expect } from 'vitest';
import { processData } from '../dataProcessing';
import { Trip, Charge, Settings } from '@/types';

describe('dataProcessing', () => {
    describe('processData', () => {
        it('should return null for empty array', () => {
            expect(processData([])).toBeNull();
            // @ts-ignore
            expect(processData(null)).toBeNull();
            // @ts-ignore
            expect(processData(undefined)).toBeNull();
        });

        it('should handle zero distance trips as stationary consumption', () => {
            const trips = [
                { trip: 0, electricity: 1.0 },
            ] as Trip[];
            const result = processData(trips);
            expect(result).not.toBeNull();
            expect(result!.summary.stationaryConsumption).toBe('1.0');
        });

        it('should process valid trips correctly', () => {
            const trips = [
                { trip: 10, electricity: 1.2, duration: 600, month: '202501', date: '20250114', start_timestamp: 1705237200 },
                { trip: 20, electricity: 2.4, duration: 1200, month: '202501', date: '20250114', start_timestamp: 1705240800 },
            ] as Trip[];

            const result = processData(trips);
            expect(result).not.toBeNull();
            expect(result!.summary).toBeDefined();
            expect(result!.monthly).toBeDefined();
            expect(result!.daily).toBeDefined();
            expect(result!.hourly).toBeDefined();
            expect(result!.weekday).toBeDefined();
            expect(result!.tripDist).toBeDefined();
        });

        it('should calculate summary statistics correctly', () => {
            const trips = [
                { trip: 10, electricity: 1.0, duration: 600 },
                { trip: 20, electricity: 2.0, duration: 1200 },
            ] as Trip[];

            const result = processData(trips);
            expect(result!.summary.totalTrips).toBe(2);
            expect(result!.summary.totalKm).toBe('30.0');
            expect(result!.summary.totalKwh).toBe('3.0');
            expect(result!.summary.avgEff).toBe('10.00'); // (3.0 / 30.0 * 100)
        });

        it('should calculate trip distribution correctly', () => {
            const trips = [
                { trip: 3 },   // 0-5 km
                { trip: 10 },  // 5-15 km
                { trip: 25 },  // 15-30 km
                { trip: 40 },  // 30-50 km
                { trip: 60 },  // 50+ km
            ] as Trip[];

            const result = processData(trips);
            expect(result!.tripDist[0].count).toBe(1); // 0-5
            expect(result!.tripDist[1].count).toBe(1); // 5-15
            expect(result!.tripDist[2].count).toBe(1); // 15-30
            expect(result!.tripDist[3].count).toBe(1); // 30-50
            expect(result!.tripDist[4].count).toBe(1); // 50+
        });

        it('should group trips by month', () => {
            const trips = [
                { trip: 10, electricity: 1.0, month: '202501' },
                { trip: 15, electricity: 1.5, month: '202501' },
                { trip: 20, electricity: 2.0, month: '202502' },
            ] as Trip[];

            const result = processData(trips);
            expect(result!.monthly).toHaveLength(2);
            expect(result!.monthly[0].trips).toBe(2); // Two trips in Jan
            expect(result!.monthly[1].trips).toBe(1); // One trip in Feb
        });

        it('should filter efficiency scatter data', () => {
            const trips = [
                { trip: 10, electricity: 1.0 },  // Valid: 10 kWh/100km
                { trip: 10, electricity: 0 },    // Skipped: electricity = 0
                { trip: 0, electricity: 1.0 },   // Skipped: trip = 0
                { trip: 10, electricity: 6.0 },  // Skipped: 60 kWh/100km (> 50)
            ] as Trip[];

            const result = processData(trips);
            expect(result!.effScatter.length).toBe(1);
            expect(result!.effScatter[0].x).toBe(10);
            expect(result!.effScatter[0].y).toBe(10); // (1.0 / 10) * 100
        });

        it('should skip malformed trips without crashing', () => {
            const trips = [
                { trip: 10, electricity: 1.0 }, // Valid
                { invalidField: 'test' },       // Missing trip field
                null,                            // Null trip
                { trip: 'invalid' },             // Non-number trip
            ] as any[];

            const result = processData(trips);
            expect(result).not.toBeNull();
            expect(result!.summary.totalTrips).toBe(1); // Only one valid trip
        });

        // --- New Tests for Price Strategies ---

        it('should calculate cost with Custom Price strategy', () => {
            const trips = [{ trip: 100, electricity: 15 }] as Trip[];
            const settings: Settings = {
                batterySize: 60, soh: 100,
                electricStrategy: 'custom',
                electricPrice: 0.20
            };

            const result = processData(trips, settings);
            // Cost = 15 kWh * 0.20 = 3.0
            expect(result!.top.km[0].calculatedCost).toBe(3.0);
            expect(result!.summary.maxCost).toBe('3.00');
        });

        it('should calculate cost with Average Price strategy', () => {
            const trips = [{ trip: 100, electricity: 10 }] as Trip[];
            const charges = [
                { kwhCharged: 100, totalCost: 20, type: 'electric' }, // Avg = 0.20
                { kwhCharged: 50, totalCost: 25, type: 'electric' }   // Avg = 0.50 -> Total 150kWh, Cost 45 -> 0.30
            ] as Charge[];

            const settings: Settings = {
                batterySize: 60, soh: 100,
                electricStrategy: 'average'
            };

            const result = processData(trips, settings, charges);
            // Avg Price = 45 / 150 = 0.30
            // Cost = 10 kWh * 0.30 = 3.0
            expect(result!.top.km[0].calculatedCost).toBe(3.0);
        });

        it('should calculate cost with Dynamic Price strategy', () => {
            // timestamps:
            // Charge 1: 2025-01-01 10:00 -> 1735725600
            // Trip:     2025-01-01 12:00 -> 1735732800
            // Charge 2: 2025-01-01 14:00 -> 1735740000

            const trip = { trip: 100, electricity: 10, start_timestamp: 1735732800, date: '20250101' } as Trip;

            const charges = [
                { kwhCharged: 10, totalCost: 2, timestamp: 1735725600, date: '2025-01-01', time: '10:00', type: 'electric' },
                { kwhCharged: 10, totalCost: 5, timestamp: 1735740000, date: '2025-01-01', time: '14:00', type: 'electric' }
            ] as Charge[];

            const settings: Settings = {
                batterySize: 60, soh: 100,
                electricStrategy: 'dynamic'
            };

            const result = processData([trip], settings, charges);
            // Should pick Charge 1 (price 0.20)
            // Cost = 10 * 0.20 = 2.0
            expect(result!.top.km[0].calculatedCost).toBe(2.0);
        });

        it('should handle Hybrid fuel cost', () => {
            const trip = {
                trip: 100,
                electricity: 10,
                fuel: 5,
                date: '20250101'
            } as Trip;

            const settings: Settings = {
                batterySize: 60, soh: 100,
                electricStrategy: 'custom', electricPrice: 0.10,
                fuelStrategy: 'custom', fuelPrice: 1.50
            };

            const result = processData([trip], settings);

            // Elec Cost: 10 * 0.10 = 1.0
            // Fuel Cost: 5 * 1.50 = 7.5
            // Total: 8.5
            expect(result!.top.km[0].calculatedCost).toBe(8.5);
            expect(result!.top.km[0].electricCost).toBe(1.0);
            expect(result!.top.km[0].fuelCost).toBe(7.5);
            expect(result!.isHybrid).toBe(true);
            expect(result!.summary.totalFuel).toBe('5.00');
        });

        it('should accumulate hourly and weekday statistics', () => {
            // 2024-01-01 was a Monday
            const trip = {
                trip: 10,
                electricity: 1.0,
                start_timestamp: 1704106800, // 2024-01-01 11:00 AM UTC (Depends on local time env? Tests usually run in UTC or consistent timezone)
                // Let's assume input assumes local time or UTC handled consistently
                // We'll check if *bucket 11* or nearby is populated
            } as Trip;

            const result = processData([trip]);
            // Check that *some* hourly bucket has data
            const hourBin = result!.hourly.find(h => h.trips > 0);
            expect(hourBin).toBeDefined();

            // Check weekday: Mon (0) or similar
            const dayBin = result!.weekday.find(d => d.trips > 0);
            expect(dayBin).toBeDefined();
        });

        it('should handle Dynamic Price when trip is before any charge', () => {
            // Trip: 10:00
            const trip = { trip: 100, electricity: 10, start_timestamp: 1000, date: '20250101' } as Trip;
            // Charge: 12:00
            const charges = [
                { kwhCharged: 10, totalCost: 5, timestamp: 2000, date: '2025-01-01', time: '12:00', type: 'electric' }
            ] as Charge[];

            const settings: Settings = {
                batterySize: 60, soh: 100,
                electricStrategy: 'dynamic',
                electricPrice: 0.50 // Fallback custom price
            };

            const result = processData([trip], settings, charges);
            // Should fallback to custom price (0.50) => Cost 5.0
            expect(result!.top.km[0].calculatedCost).toBe(5.0);
        });

        it('should correctly sort unsorted charges for Dynamic Pricing', () => {
            // Use real timestamps to match the date parsing logic in dataProcessing
            const dateStr = '2025-01-01';
            const tripTs = new Date(`${dateStr}T15:00:00`).getTime() / 1000;
            const trip = { trip: 10, electricity: 1, start_timestamp: tripTs, date: '20250101' } as Trip;

            const charges = [
                { kwhCharged: 10, totalCost: 10, date: dateStr, time: '20:00' }, // Late: Price 1.0
                { kwhCharged: 10, totalCost: 2, date: dateStr, time: '10:00' },  // Early: Price 0.2
            ] as Charge[];

            const settings: Settings = { batterySize: 60, soh: 100, electricStrategy: 'dynamic' };

            const result = processData([trip], settings, charges);
            // Should pick the 10:00 charge (0.2)
            expect(result!.top.km[0].calculatedCost).toBe(0.2);
        });

        it('should calculate cost for stationary trips', () => {
            const trip = { trip: 0, electricity: 5, date: '20250101' } as Trip;
            const settings: Settings = {
                batterySize: 60, soh: 100,
                electricStrategy: 'custom',
                electricPrice: 1.0
            };

            const result = processData([trip], settings);
            expect(result!.summary.stationaryConsumption).toBe('5.0');
            // Max cost should track stationary trips too
            expect(result!.summary.maxCost).toBe('5.00');
        });
    });
});
