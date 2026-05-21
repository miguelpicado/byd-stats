export interface Trip {
    date: string; // YYYYMMDD
    trip: number; // Distance in km
    electricity: number; // kWh
    fuel?: number; // Liters (hybrid)
    duration: number; // minutes
    start_timestamp: number; // Unix timestamp
    end_timestamp: number; // Unix timestamp
    month?: string; // YYYYMM
    start_soc?: number;
    end_soc?: number;
    calculatedCost?: number;
    electricCost?: number;
    fuelCost?: number;
    totalCost?: number;
    regeneration?: number;
    id?: string;
    startTime?: string;
}

export interface Charge {
    id: string;
    date: string; // YYYYMMDD
    time: string; // HH:MM
    kwhCharged: number;
    kwh?: number; // Legacy alias/fallback
    totalCost: number;
    pricePerKwh: number;
    chargerTypeId: string;
    initialPercentage?: number;
    finalPercentage?: number;
    odometer?: number;
    type?: 'electric' | 'fuel';
    litersCharged?: number;
    speedKw?: number;
    timestamp?: number;
    effectivePrice?: number;
    pricePerLiter?: number;
    isSOCEstimated?: boolean;
    location?: string;
}

export interface Car {
    id: string;
    name: string;
    type: 'ev' | 'phev' | 'hybrid'; // normalized types
    isHybrid: boolean;
    vin?: string;
    plate?: string;
    model?: string;
    lastSync?: string;
    fileId?: string;
}

export interface Settings {
    // Car specific
    carModel?: string;
    licensePlate?: string;
    insurancePolicy?: string;

    // Battery & Calculations
    batterySize: string | number;
    soh: string | number;
    mfgDate?: string;
    mfgDateDisplay?: string;
    sohMode?: 'manual' | 'calculated';
    odometerOffset?: number | string;

    // Prices & Strategies
    chargerTypes?: ChargerType[];
    thermalStressFactor?: number;
    electricStrategy?: 'custom' | 'average' | 'dynamic';
    fuelStrategy?: 'custom' | 'average' | 'dynamic';
    electricPrice?: string | number;
    fuelPrice?: string | number;
    useCalculatedPrice?: boolean;
    useCalculatedFuelPrice?: boolean;
    priceStrategy?: string; // legacy support
    fuelPriceStrategy?: string; // legacy support

    // Home Charging Settings
    homeChargerRating?: number; // Amps (default 8)
    offPeakEnabled?: boolean;
    offPeakStart?: string; // HH:MM
    offPeakEnd?: string; // HH:MM
    offPeakStartWeekend?: string; // HH:MM
    offPeakEndWeekend?: string; // HH:MM
    offPeakPrice?: number; // Price per kWh

    // AI / Smart Charging Preferences (HITL)
    smartChargingPreferences?: ChargingPreference[];

    // UI
    theme?: 'auto' | 'dark' | 'light' | 'system';
    hiddenTabs?: string[];
}

export interface ChargingPreference {
    id: string; // Unique ID
    day: string; // 'Lunes', 'Martes', etc.
    start: string; // HH:MM
    end: string; // HH:MM
    active: boolean; // Is this override enabled?
}

export interface ChargerType {
    id: string;
    name: string;
    speedKw: number;
    efficiency: number;
}

export interface MonthlyData {
    month: string;
    trips: number;
    km: number;
    kwh: number;
    fuel: number;
    efficiency?: number;
    fuelEfficiency?: number;
    monthLabel?: string;
}

export interface DailyData {
    date: string;
    trips: number;
    km: number;
    kwh: number;
    fuel: number;
    efficiency?: number;
    fuelEfficiency?: number;
    dateLabel?: string;
}

export interface Summary {
    totalTrips: number;
    totalKm: string;
    totalKwh: string;
    drivingKwh: string;
    stationaryConsumption: string;
    totalHours: string;
    avgEff: string;
    estimatedRange: string;
    estimatedRangeHighway: string;
    estimatedRangeCity: string;
    avgKm: string;
    avgMin: string;
    avgSpeed: string;
    daysActive: number;
    totalDays: number;
    dateRange: string;
    maxKm: string;
    minKm: string;
    maxKwh: string;
    maxMin: string;
    tripsDay: string;
    kmDay: string;
    isHybrid: boolean;
    totalFuel: string;
    avgFuelEff: string;
    electricPercentage: string;
    fuelPercentage: string;
    electricOnlyTrips: number;
    fuelUsedTrips: number;
    evModeUsage: string;
    maxFuel: string;
    maxCost: string;
    maxCostDate: string;
    soh: number;
    sohData: SoHData | null;
}

export interface SoHData {
    estimated_soh: number;
    real_cycles_count: number;
    stress_score: number;
    charging_stress: number;
    thermal_stress: number;
    calibration_warning: boolean;
    degradation: {
        sei: number;
        cycle: number;
        calendar: number;
    };
}

export type TripInsightType = 'distance' | 'energy' | 'trips' | 'time' | 'efficiency' | 'speed' | 'avgTrip' | 'activeDays' | 'stationary' | 'soh' | 'fuel' | 'range';

export interface ProcessedData {
    summary: Summary;
    monthly: MonthlyData[];
    daily: DailyData[];
    hourly: { hour: number; trips: number; km: number }[];
    weekday: { day: string; trips: number; km: number }[];
    tripDist: { range: string; count: number; color: string }[];
    effScatter: { x: number; y: number; fuel: number }[];
    top: {
        km: Trip[];
        kwh: Trip[];
        dur: Trip[];
        fuel: Trip[];
    };
    isHybrid: boolean;
}
