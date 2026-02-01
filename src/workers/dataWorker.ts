// BYD Stats - Data Processing Worker (v19)
import * as Comlink from 'comlink';
import { processData } from '../core/dataProcessing';
import { PredictiveService } from '../services/PredictiveService';

const predictiveService = new PredictiveService();

const api = {
    processData,

    // AI Methods
    trainModel: (trips: any[]) => predictiveService.train(trips),
    getRangeScenarios: (batteryCapacity: number, soh: number) => predictiveService.getScenarios(batteryCapacity, soh),

    // AI SoH Methods
    trainSoH: (charges: any[], capacity: number) => predictiveService.trainSoH(charges, capacity),

    getSoHStats: (charges: any[], capacity: number) => predictiveService.getSoHDataPoints(charges, capacity),

    // AI Parking Methods
    trainParking: (trips: any[]) => predictiveService.trainParking(trips),
    predictDeparture: (startTime: number) => predictiveService.predictDeparture(startTime)
};

// Expose the API to the main thread
Comlink.expose(api);
