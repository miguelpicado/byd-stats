// BYD Stats - Battery Calculations Utility
// Implements advanced SoH estimation for LFP batteries

/**
 * Estimates Battery State of Health (SoH) based on usage patterns
 * 
 * @param {Array} charges - List of charge sessions
 * @param {string} mfgDate - Vehicle manufacturing date (YYYY-MM-DD or similar)
 * @param {number} batteryNetCapacity - Net capacity in kWh (e.g. 82.5)
 * @returns {Object} Estimated SoH data and metrics
 */
export const calculateAdvancedSoH = (charges = [], mfgDate, batteryNetCapacity = 60.48, chargerTypes = [], thermalStressFactor = 1.0) => {
    // Fallback for battery capacity if 0 is passed
    const netCapacity = parseFloat(batteryNetCapacity) || 60.48;

    if (!charges || charges.length === 0 || !mfgDate) {
        return {
            estimated_soh: 100,
            real_cycles_count: 0,
            stress_score: 1.0 * thermalStressFactor,
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
    let total_real_kwh = 0;

    const validCharges = charges.filter(charge => charge && (charge.type || 'electric') === 'electric');

    validCharges.forEach(charge => {
        // Handle kwh / kwhCharged alias
        const kwh = parseFloat(charge.kwhCharged || charge.kwh) || 0;
        const speed = parseFloat(charge.speedKw) || 0;
        const chargerType = chargerTypes.find(ct => ct.id === charge.chargerTypeId);
        const userEfficiency = chargerType?.efficiency;

        // Efficiency correction
        let efficiency;
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
        if ((charge.finalPercentage || 0) >= 99) n_charges_to_100++;
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
            const age_years = (now - mfg) / (1000 * 60 * 60 * 24 * 365.25);
            calendar_degradation = Math.max(0, age_years * 0.75);
        }
    } catch (e) {
        calendar_degradation = 0;
    }

    // 5. Total SoH
    const estimated_soh = Math.max(0, 100 - sei_drop - cycle_degradation - calendar_degradation);

    // 6. Calibration Warning
    const calibration_warning = total_sessions > 0 ? (n_charges_to_100 / total_sessions < 0.1) : false;

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

/**
 * Estimates Initial SoC based on odometer and previous charge
 * 
 * @param {Object} previousCharge - Charge object with { odometer, finalPercentage }
 * @param {number} currentOdometer - New odometer reading
 * @param {number} avgEfficiency - Average consumption kWh/100km
 * @param {number} batterySize - Battery capacity in kWh
 * @returns {number|null} Estimated Initial SoC % (0-100) or null
 */
export const estimateInitialSoC = (previousCharge, currentOdometer, avgEfficiency, batterySize) => {
    if (!previousCharge || !currentOdometer || !avgEfficiency || !batterySize) return null;

    const distance = currentOdometer - previousCharge.odometer;
    if (distance <= 0) return null;

    const estimatedConsumptionKwh = (distance * avgEfficiency) / 100;
    const socConsumed = (estimatedConsumptionKwh / batterySize) * 100;

    const estimatedInitial = Math.max(0, Math.min(100, previousCharge.finalPercentage - socConsumed));
    return Math.round(estimatedInitial);
};
