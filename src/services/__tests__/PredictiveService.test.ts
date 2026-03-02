import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PredictiveService, predictiveService } from '../PredictiveService';
import type { Trip, Charge } from '../../types';

// Mock pattern as suggested in the audit plan
const state = vi.hoisted(() => ({
    mockWorker: {
        trainModel: vi.fn(),
        getRangeScenarios: vi.fn().mockResolvedValue([]),
        trainSoH: vi.fn(),
        getSoHStats: vi.fn().mockResolvedValue(null),
        trainParking: vi.fn(),
        predictDeparture: vi.fn().mockResolvedValue(null),
    }
}));

// Mock Comlink and Worker
vi.mock('comlink', () => ({
    wrap: () => state.mockWorker,
}));

// Mock the global Worker to prevent errors during test initialization
global.Worker = vi.fn() as any;

describe('PredictiveService', () => {
    let service: PredictiveService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new PredictiveService();
    });

    it('delegates train() to worker.trainModel()', async () => {
        const trips: Trip[] = [{ date: '2023-01-01', trip: 10, start_timestamp: 1, end_timestamp: 2 }] as Trip[];
        await service.train(trips);
        expect(state.mockWorker.trainModel).toHaveBeenCalledWith(trips);
    });

    it('delegates getScenarios() to worker.getRangeScenarios()', async () => {
        await service.getScenarios(60, 100);
        expect(state.mockWorker.getRangeScenarios).toHaveBeenCalledWith(60, 100);
    });

    it('delegates trainSoH() to worker.trainSoH()', async () => {
        const charges: Charge[] = [] as Charge[];
        await service.trainSoH(charges, 60);
        expect(state.mockWorker.trainSoH).toHaveBeenCalledWith(charges, 60);
    });

    it('delegates getSoHDataPoints() to worker.getSoHStats()', async () => {
        const charges: Charge[] = [] as Charge[];
        await service.getSoHDataPoints(charges, 60);
        expect(state.mockWorker.getSoHStats).toHaveBeenCalledWith(charges, 60);
    });

    it('delegates trainParking() to worker.trainParking()', async () => {
        const trips: Trip[] = [] as Trip[];
        await service.trainParking(trips);
        expect(state.mockWorker.trainParking).toHaveBeenCalledWith(trips);
    });

    it('delegates predictDeparture() to worker.predictDeparture()', async () => {
        await service.predictDeparture(1000);
        expect(state.mockWorker.predictDeparture).toHaveBeenCalledWith(1000);
    });

    it('exports a singleton instance', () => {
        expect(predictiveService).toBeInstanceOf(PredictiveService);
    });
});
