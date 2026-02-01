import { ProcessedData, Charge, Trip, Settings, Summary } from '../types';

export interface Anomaly {
    id: string;
    type: 'battery' | 'drain' | 'charging' | 'efficiency';
    severity: 'info' | 'warning' | 'critical';
    title: string;
    description: string;
    value?: string;
    timestamp?: number;
}

export const AnomalyService = {
    /**
     * Run all system health checks
     */
    checkSystemHealth: (data: ProcessedData, settings: Settings, charges: Charge[], trips: Trip[]): Anomaly[] => {
        const anomalies: Anomaly[] = [];

        // 1. Battery Health Check
        const batteryAnomalies = checkBatteryHealth(data, settings);
        anomalies.push(...batteryAnomalies);

        // 2. Phantom Drain Check
        // Use provided trips list
        const drainAnomalies = AnomalyService.analyzePhantomDrain(trips, settings);
        anomalies.push(...drainAnomalies);

        // 3. Charging Efficiency Check
        const chargeAnomalies = AnomalyService.analyzeCharges(charges, settings, trips);
        anomalies.push(...chargeAnomalies);

        // 4. Tire/Efficiency Health
        const tireAnomalies = AnomalyService.analyzeTireHealth(trips, data.summary);
        anomalies.push(...tireAnomalies);

        return anomalies;
    },

    analyzeCharges: (charges: Charge[], settings: Settings, trips: Trip[]): Anomaly[] => {
        const anomalies: Anomaly[] = [];
        const batteryCapacity = parseFloat(settings.batterySize.toString()) || 60; // Default 60kWh

        // Sort by date desc
        const recentCharges = [...charges].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

        recentCharges.forEach(charge => {
            if (charge.kwhCharged > 0 && charge.initialPercentage !== undefined && charge.finalPercentage !== undefined) {
                const addedPct = (charge.finalPercentage - charge.initialPercentage) / 100;
                const addedKwhBattery = addedPct * batteryCapacity;

                // Efficiency
                const efficiency = (addedKwhBattery / charge.kwhCharged);

                // --- INFRASTRUCTURE INFERENCE ---
                // Estimate power based on Parking Duration
                let durationHours = 0;
                let chargeTime = 0;

                // Parse Charge Time
                if (charge.time && charge.date) {
                    const dStr = charge.date.replace(/-/g, '');
                    if (dStr.length === 8) {
                        const y = parseInt(dStr.substring(0, 4));
                        const m = parseInt(dStr.substring(4, 6)) - 1;
                        const d = parseInt(dStr.substring(6, 8));
                        const [h, min] = charge.time.split(':').map(Number);

                        chargeTime = new Date(y, m, d, h, min).getTime();

                        // Find gap in trips
                        // Sort trips by start time
                        const sortedTrips = [...trips].sort((a, b) => a.start_timestamp - b.start_timestamp);

                        // Find trip ending BEFORE charge
                        for (let i = 0; i < sortedTrips.length; i++) {
                            const t = sortedTrips[i];
                            const nextT = sortedTrips[i + 1];

                            // Check if charge happened after this trip
                            if (t.end_timestamp < chargeTime && (!nextT || nextT.start_timestamp > chargeTime)) {
                                if (nextT) {
                                    const gapMs = nextT.start_timestamp - t.end_timestamp;
                                    durationHours = gapMs / (1000 * 60 * 60);
                                }
                                break;
                            }
                        }

                        // Fallback Heuristic: End Time 07:00-09:00 -> 8h (Midnight start)
                        // This handles cases where trips might be missing or not synced perfectly
                        if (durationHours === 0 && h >= 7 && h <= 9) {
                            durationHours = 8;
                        }
                    }
                }

                let inferredPower = 0;
                if (durationHours > 0) {
                    inferredPower = charge.kwhCharged / durationHours;
                }

                // Contexts
                // < 4.0 kW implies 240V/16A or lower (Schuko) + margin
                const isSlowPower = (inferredPower > 0 && inferredPower < 4.0);

                let isValley = false;
                if (charge.time) {
                    const h = parseInt(charge.time.split(':')[0]);
                    // Standard Valley ends 08:00 strict
                    isValley = (h >= 0 && h < 8);
                }

                // Dynamic Threshold
                // Slow/Valley = 70% threshold (High standby losses relative to input)
                // Fast = 80% threshold
                const threshold = (isSlowPower || isValley) ? 0.70 : 0.80;

                // Ignore erratic data (>1.1 or < 0.45)
                if (efficiency < threshold && efficiency > 0.45 && efficiency < 1.1) {
                    anomalies.push({
                        id: `eff_${charge.id}`,
                        type: 'charging',
                        severity: efficiency < (threshold - 0.1) ? 'warning' : 'info',
                        title: (isSlowPower || isValley) ? 'Eficiencia (Carga Lenta/Valle)' : 'Baja Eficiencia de Carga',
                        description: `Carga del ${charge.date}: Eficiencia ${Math.round(efficiency * 100)}%. ${(isSlowPower || isValley)
                                ? `Al cargar a baja potencia (${inferredPower ? '~' + inferredPower.toFixed(1) + 'kW' : 'Lenta'}) es normal tener una eficiencia menor.`
                                : `Podría indicar pérdidas resistivas o climáticas en carga rápida.`
                            }`,
                        value: `${(efficiency * 100).toFixed(0)}%`,
                        timestamp: chargeTime || new Date().getTime()
                    });
                }
            }
        });

        return anomalies;
    },

    analyzePhantomDrain: (trips: Trip[], settings: Settings): Anomaly[] => {
        const anomalies: Anomaly[] = [];
        // Sort trips chronologically
        const sortedTrips = [...trips].sort((a, b) => a.start_timestamp - b.start_timestamp);

        const batteryCapacity = parseFloat(settings.batterySize.toString()) || 60;

        for (let i = 0; i < sortedTrips.length - 1; i++) {
            const currentTrip = sortedTrips[i];
            const nextTrip = sortedTrips[i + 1];

            // Gap between trips
            const gapMs = nextTrip.start_timestamp - currentTrip.end_timestamp;
            const gapHours = gapMs / (1000 * 60 * 60);

            // Check only if parked for > 12 hours
            if (gapHours > 12) {
                // Check SoC Drop
                const endSoc = currentTrip.end_soc;
                const startSoc = nextTrip.start_soc;

                if (endSoc !== undefined && startSoc !== undefined && startSoc < endSoc) {
                    const dropPct = endSoc - startSoc;
                    const dropKwh = (dropPct / 100) * batteryCapacity;

                    // Allow 1% drop per 24h as "normal" (BMS consumption, telemetry)
                    // If drop is > 2% per 24h equivalent, flag it.
                    const dropPer24h = (dropPct / gapHours) * 24;

                    if (dropPer24h > 2.0) {
                        anomalies.push({
                            id: `drain_${currentTrip.date}`,
                            type: 'drain',
                            severity: dropPer24h > 4.0 ? 'warning' : 'info',
                            title: 'Drenaje Fantasma Detectado',
                            description: `Entre el ${currentTrip.date} y ${nextTrip.date}, el coche perdió un ${dropPct.toFixed(1)}% de batería (${dropKwh.toFixed(1)} kWh) en ${gapHours.toFixed(0)} horas.`,
                            value: `-${dropPer24h.toFixed(1)}%/día`,
                            timestamp: nextTrip.start_timestamp
                        });
                        // Break after finding the most recent significant one to avoid spam
                        break;
                    }
                }
            }
        }
        return anomalies;
    },

    analyzeTireHealth: (trips: Trip[], summary: Summary): Anomaly[] => {
        const anomalies: Anomaly[] = [];

        const avgConsumption = parseFloat(summary.avgEff); // kWh/100km
        if (!avgConsumption) return anomalies;

        // Check last 5 trips
        const recentTrips = trips.slice(0, 5);
        let highConsumptionCount = 0;

        recentTrips.forEach(t => {
            const tripConsumption = (t.electricity / t.trip) * 100;
            if (tripConsumption > avgConsumption * 1.25) { // 25% higher than average
                highConsumptionCount++;
            }
        });

        if (highConsumptionCount >= 3) {
            anomalies.push({
                id: 'tire_pressure',
                type: 'efficiency',
                severity: 'info',
                title: 'Revisar Presión de Neumáticos',
                description: 'Tus últimos trayectos muestran un consumo un 25% superior a tu media histórica. Una presión baja en los neumáticos podría ser la causa.',
                value: 'Consumo Alto'
            });
        }

        return anomalies;
    }
};

const checkBatteryHealth = (data: ProcessedData, settings: Settings): Anomaly[] => {
    const anomalies: Anomaly[] = [];
    const currentSoH = data.summary.soh;

    // 1. Critical SoH
    if (currentSoH < 75) {
        anomalies.push({
            id: 'soh_critical',
            type: 'battery',
            severity: 'critical',
            title: 'Salud de Batería Crítica',
            description: 'La salud de tu batería (SoH) ha caído por debajo del 75%.',
            value: `${currentSoH.toFixed(1)}%`
        });
    } else if (currentSoH < 85) {
        anomalies.push({
            id: 'soh_warning',
            type: 'battery',
            severity: 'warning',
            title: 'Degradación de Batería',
            description: 'El SoH está por debajo del 85%. Vigila el estado de salud.',
            value: `${currentSoH.toFixed(1)}%`
        });
    }

    return anomalies;
};
