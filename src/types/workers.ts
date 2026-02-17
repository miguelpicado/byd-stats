// Worker API Types - Eliminates 'any' in worker communication

export interface TrainResult {
    success: boolean;
    loss?: number;
    error?: string;
}

export interface RangeScenario {
    name: string;
    speed: number;
    efficiency: number;
    range: number;
}

export interface PredictionResult {
    scenarios: RangeScenario[];
    loss: number;
}

export interface DeparturePrediction {
    departureTime: number;
    duration: number;
}

export interface SmartChargingWindow {
    day: string;
    start: string;
    end: string;
    tariffLimit: string;
    startMins: number;
    endMins: number;
}

export interface SmartChargingResult {
    windows: SmartChargingWindow[];
    weeklyKwh: number;
    requiredHours: number;
    hoursFound: number;
    note?: string;
}

export interface SoHStats {
    points: Array<{ x: string; y: number; cap?: number }>;
    trend: Array<{ x: string; y: number }>;
    samples: number;
}
