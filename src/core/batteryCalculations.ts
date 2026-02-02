// BYD Stats - Battery Calculations Utility
// Implements advanced SoH estimation for LFP batteries

import { Charge, SoHData, ChargerType } from '../types';

/**
 * Estimates Battery State of Health (SoH) based on usage patterns
 */
export const calculateAdvancedSoH = (
    charges: Charge[] = [],
    mfgDate: string,
    batteryNetCapacity: number | string = 60.48,
    chargerTypes: ChargerType[] = [],
    thermalStressFactor: number = 1.0
): SoHData => {
    // Fallback for battery capacity if 0 is passed
    const netCapacity = (typeof batteryNetCapacity === 'string' ? parseFloat(batteryNetCapacity) : batteryNetCapacity) || 60.48;

    if (!charges || charges.length === 0 || !mfgDate) {
        return {
            estimated_soh: 100,
            real_cycles_count: 0,
            stress_score: 1.0 * thermalStressFactor,
            charging_stress: 1.0,
            thermal_stress: thermalStressFactor,
            calibration_warning: false,
            degradation: { sei: 0, cycle: 0, calendar: 0 }
        };
    }

    // 1. Categorize charges and calculate Real kWh
    let n_slow_8a = 0;
    let n_ac_11kw = 0;
    let n_dc_42kw = 0;
    let n_hpc_150kw = 0;
    let n_charges_to_100 = 0;
    let last_calibration_time = 0;
    let total_real_kwh = 0;

    const validCharges = charges.filter(charge => charge && (charge.type || 'electric') === 'electric');

    validCharges.forEach(charge => {
        // Handle kwh / kwhCharged alias
        const kwh = checkNum(charge.kwhCharged) || checkNum(charge.kwh);
        const speed = checkNum(charge.speedKw);
        const chargerType = chargerTypes.find(ct => ct.id === charge.chargerTypeId);
        const userEfficiency = chargerType?.efficiency;

        // Efficiency correction
        let efficiency = 1.0;
        if (userEfficiency !== undefined && userEfficiency < 1.0 && userEfficiency > 0) {
            efficiency = userEfficiency;
        } else {
            const isSlow = speed > 0 && speed < 3.5;
            efficiency = isSlow ? 0.85 : 0.95;
        }

        total_real_kwh += kwh * efficiency;

        // Categorize for stress factor
        if (speed <= 3.5) n_slow_8a++;
        else if (speed <= 22) n_ac_11kw++;
        else if (speed <= 70) n_dc_42kw++;
        else n_hpc_150kw++;

        // Calibration check
        if ((charge.finalPercentage || 0) >= 99) {
            n_charges_to_100++;
            // Parse date
            if (charge.date) {
                const ts = new Date(charge.date).getTime();
                if (!isNaN(ts) && ts > last_calibration_time) {
                    last_calibration_time = ts;
                }
            }
        }
    });

    const total_sessions = validCharges.length;

    // 2. Real Cycles
    const real_cycles = total_real_kwh / netCapacity;

    // 3. Stress Factor (F_stress)
    // Coeffs: Slow: 0.9, AC: 1.0, DC: 1.2, HPC: 2.8
    // Now multiplied by global thermalStressFactor (city temperature context)
    let charging_stress = total_sessions > 0 ? (
        (n_slow_8a * 0.9) +
        (n_ac_11kw * 1.0) +
        (n_dc_42kw * 1.2) +
        (n_hpc_150kw * 2.8)
    ) / total_sessions : 1.0;

    const stress_score = charging_stress * thermalStressFactor;

    // 4. Degradation Components

    // SEI Formation: Linear drop 0-2% over first 50 cycles
    const sei_drop = Math.min(2.0, (real_cycles / 50) * 2.0);

    // Cycle Aging: cycles * 0.005% * F_stress
    const cycle_degradation = real_cycles * 0.00005 * stress_score * 100;

    // Calendar Aging: age_years * 0.75%
    // More robust date parsing
    let calendar_degradation = 0;
    try {
        const mfg = new Date(mfgDate);
        if (!isNaN(mfg.getTime())) {
            const now = new Date();
            const age_years = (now.getTime() - mfg.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
            calendar_degradation = Math.max(0, age_years * 0.75);
        }
    } catch (e) {
        calendar_degradation = 0;
    }

    // 5. Total SoH
    const estimated_soh = Math.max(0, 100 - sei_drop - cycle_degradation - calendar_degradation);

    // 6. Calibration Warning
    // Logic: Warning if ratio < 10% UNLESS a calibration occurred recently (e.g. last 15 days)
    // Also requires at least a few sessions to evaluate
    const now = new Date().getTime();
    const days_since_cal = (now - last_calibration_time) / (1000 * 3600 * 24);

    // If calibrated recently (< 10 days), NO WARNING regardless of ratio.
    // Otherwise, use ratio or strict "not calibrated in 45 days"
    let calibration_warning = false;
    if (total_sessions > 5) {
        if (last_calibration_time > 0 && days_since_cal <= 10) {
            calibration_warning = false;
        } else {
            // If not recently calibrated, check ratio OR long time
            if (n_charges_to_100 / total_sessions < 0.1) calibration_warning = true;
            // Optional: Force warning if > 60 days? Maybe too strict for now.
        }
    }

    return {
        estimated_soh: parseFloat(estimated_soh.toFixed(2)),
        real_cycles_count: parseFloat(real_cycles.toFixed(2)),
        stress_score: parseFloat(stress_score.toFixed(2)),
        charging_stress: parseFloat(charging_stress.toFixed(2)),
        thermal_stress: thermalStressFactor,
        calibration_warning,
        degradation: {
            sei: parseFloat(sei_drop.toFixed(2)),
            cycle: parseFloat(cycle_degradation.toFixed(2)),
            calendar: parseFloat(calendar_degradation.toFixed(2))
        }
    };
};

function checkNum(val: any): number {
    return typeof val === 'number' ? val : 0;
}

/**
 * Estimates Initial SoC based on odometer and previous charge
 */
export const estimateInitialSoC = (
    previousCharge: { odometer?: number; finalPercentage?: number },
    currentOdometer: number,
    avgEfficiency: number,
    batterySize: number
): number | null => {
    if (!previousCharge || !currentOdometer || !avgEfficiency || !batterySize) return null;
    if (typeof previousCharge.odometer !== 'number' || typeof previousCharge.finalPercentage !== 'number') return null;

    const distance = currentOdometer - previousCharge.odometer;
    if (distance <= 0) return null;

    const estimatedConsumptionKwh = (distance * avgEfficiency) / 100;
    const socConsumed = (estimatedConsumptionKwh / batterySize) * 100;

    const estimatedInitial = Math.max(0, Math.min(100, previousCharge.finalPercentage - socConsumed));
    return Math.round(estimatedInitial);
};
