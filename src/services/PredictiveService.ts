import { Trip, Charge } from '../types';
import { EfficiencyModel } from './ai/EfficiencyModel';
import { SoHModel } from './ai/SoHModel';
import { ParkingModel } from './ai/ParkingModel';

/**
 * Service to handle AI predictions for Range/Efficiency, SoH, and Parking.
 * Composes specialized models from `src/services/ai/`.
 */
export class PredictiveService {
    private efficiencyModel = new EfficiencyModel();
    private sohModel = new SoHModel();
    private parkingModel = new ParkingModel();

    // Efficiency Delegation
    async train(trips: Trip[]): Promise<{ loss: number; samples: number }> {
        return this.efficiencyModel.train(trips);
    }

    predict(speed: number, distance: number = 50): number {
        return this.efficiencyModel.predict(speed, distance);
    }

    getScenarios(batteryCapacity: number = 60, soh: number = 100) {
        return this.efficiencyModel.getScenarios(batteryCapacity, soh);
    }

    // SoH Delegation
    async trainSoH(charges: Charge[], nominalCapacity: number): Promise<{ loss: number, samples: number, predictedSoH: number }> {
        return this.sohModel.train(charges, nominalCapacity);
    }

    getSoHDataPoints(charges: Charge[], nominalCapacity: number) {
        return this.sohModel.getDataPoints(charges, nominalCapacity);
    }

    // Parking Delegation
    async trainParking(trips: Trip[]): Promise<{ loss: number; samples: number }> {
        return this.parkingModel.train(trips);
    }

    predictDeparture(startTime: number): { departureTime: number; duration: number } | null {
        return this.parkingModel.predictDeparture(startTime);
    }
}
