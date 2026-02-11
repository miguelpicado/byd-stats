// PredictiveService - Thin wrapper over Web Worker
// All heavy TensorFlow logic now lives in workers/tensorflowWorker.ts
// This file is kept for backward compatibility with any direct imports

import * as Comlink from 'comlink';
import type { DataWorkerApi } from '../workers/dataWorker';
import type { Trip, Charge } from '../types';

let worker: Comlink.Remote<DataWorkerApi> | null = null;

function getWorker(): Comlink.Remote<DataWorkerApi> {
    if (!worker) {
        const w = new Worker(
            new URL('../workers/dataWorker.ts', import.meta.url),
            { type: 'module' }
        );
        worker = Comlink.wrap<DataWorkerApi>(w);
    }
    return worker;
}

/**
 * PredictiveService - Public API
 * Delegates all work to Web Workers to keep main thread free.
 * NOTE: All methods are now async since they cross worker boundaries.
 */
export class PredictiveService {
    async train(trips: Trip[]) {
        return getWorker().trainModel(trips);
    }

    async getScenarios(batteryCapacity: number, soh: number) {
        return getWorker().getRangeScenarios(batteryCapacity, soh);
    }

    async trainSoH(charges: Charge[], capacity: number) {
        return getWorker().trainSoH(charges, capacity);
    }

    async getSoHDataPoints(charges: Charge[], capacity: number) {
        return getWorker().getSoHStats(charges, capacity);
    }

    async trainParking(trips: Trip[]) {
        return getWorker().trainParking(trips);
    }

    async predictDeparture(startTime: number) {
        return getWorker().predictDeparture(startTime);
    }
}

// Singleton export for backwards compatibility
export const predictiveService = new PredictiveService();
