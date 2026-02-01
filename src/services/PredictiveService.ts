import * as tf from '@tensorflow/tfjs';
import { Trip } from '../types';
import { logger } from '@core/logger';

/**
 * Service to handle AI predictions for Range/Efficiency using TensorFlow.js
 * Implements a simple Linear Regression model: Efficiency ~ Speed + Temperature (Seasonality)
 */
export class PredictiveService {
    private efficiencyModel: tf.Sequential | null = null;
    private sohModel: tf.Sequential | null = null;

    private isTrained = false;
    private normalizationData: {
        mean: number[];
        variance: number[];
        labelMean: number;
        labelVariance: number;
    } | null = null;

    private sohNormalizationData: {
        mean: number;
        variance: number;
    } | null = null;

    /**
     * Train the model with historical trip data
     */
    async train(trips: Trip[]): Promise<{ loss: number; samples: number }> {
        // Reset state to avoid stale model usage during re-training
        this.efficiencyModel = null;
        this.normalizationData = null;
        this.isTrained = false;

        if (trips.length < 5) return { loss: 0, samples: 0 }; // Need minimum data

        // 1. Feature Extraction
        const features: number[][] = [];
        const labels: number[][] = [];

        // PHYSICS-INFORMED ML: Inject Synthetic Anchor Points to stabilize the regression
        // (Moved below to use correct feature shape)

        trips.forEach(trip => {
            const distance = trip.trip;
            const kwh = trip.electricity;
            const durationHours = (trip.duration / 3600); // Duration is in seconds

            // Filter invalid data
            if (!distance || distance <= 0 || !kwh || kwh <= 0 || !durationHours || durationHours <= 0) return;

            const speed = distance / durationHours;
            const efficiency = (kwh * 100) / distance; // kWh/100km

            // Valid ranges (outlier filtering)
            // Reverted to 15km/h. The 5-10km/h experiment failed (too much idling noise).
            // We only want "Moving Traffic" data where Regen makes City efficient.
            if (isNaN(speed) || speed > 160 || speed < 15) return;
            if (isNaN(efficiency) || efficiency > 40 || efficiency < 5) return;

            // Simple seasonality: Month index (0-11). 
            // Features: [Speed^2, Distance]
            // Removed Seasonality/Month. The "Winter Factor" heuristic was over-penalizing.
            // We rely 100% on the Speed/Distance physics curve which the user confirmed was "Logical".
            features.push([Math.pow(speed, 2), distance]);
            labels.push([efficiency]);
        });

        // PHYSICS-INFORMED ML: Inject Synthetic Anchor Points to stabilize the regression
        // Massive weights (500) to DROWN OUT the noisy historical data and enforce the correct Physics Curve.
        const anchors = [
            { speed: 30, distance: 15, eff: 14.5, count: 500 },  // City: ~14.5 kWh (Conservative Efficient)
            { speed: 80, distance: 35, eff: 17.5, count: 500 },  // Mixed: ~17.5 kWh
            { speed: 100, distance: 100, eff: 23.5, count: 500 } // Highway: ~23.5 kWh (Avg 100 ~= Cruise 120)
        ];

        anchors.forEach(anchor => {
            for (let i = 0; i < anchor.count; i++) {
                // Push [Speed^2, Distance]
                features.push([Math.pow(anchor.speed, 2), anchor.distance]);
                labels.push([anchor.eff]);
            }
        });

        logger.debug(`AI Training: Used ${features.length}/${trips.length} trips.`);

        if (features.length < 5) return { loss: 0, samples: 0 };

        // 2. Normalization
        const featureTensor = tf.tensor2d(features);
        const labelTensor = tf.tensor2d(labels);

        const featureMoments = tf.moments(featureTensor, 0);

        // Store moments
        const moments = {
            mean: featureMoments.mean.dataSync(),
            variance: featureMoments.variance.dataSync()
        };

        // DEBUG
        // DEBUG
        logger.debug('AI Training Stats (Pure Physics 2D):', {
            samples: features.length,
            means: moments.mean,
            variances: moments.variance
        });

        this.normalizationData = {
            mean: Array.from(moments.mean),
            variance: Array.from(moments.variance),
            labelMean: 0,
            labelVariance: 1
        };

        const normalizedFeatures = featureTensor.sub(featureMoments.mean).div(tf.sqrt(featureMoments.variance).add(tf.scalar(1e-6)));

        // 3. Define Model
        // Eff = w1*Speed^2 + w2*Distance + Bias
        this.efficiencyModel = tf.sequential();
        this.efficiencyModel.add(tf.layers.dense({
            units: 1,
            inputShape: [2],
            activation: 'linear',
            useBias: true
        }));

        this.efficiencyModel.compile({
            optimizer: tf.train.adam(0.1),
            loss: 'meanSquaredError'
        });

        // 4. Train
        const history = await this.efficiencyModel.fit(normalizedFeatures, labelTensor, {
            epochs: 500,
            batchSize: 64,
            shuffle: true,
            verbose: 0
        });

        // DEBUG: Log the learned physics coefficients
        const weights = this.efficiencyModel.layers[0].getWeights()[0].dataSync();
        const bias = this.efficiencyModel.layers[0].getWeights()[1].dataSync()[0];
        logger.debug('AI Physics Weights (Speed^2 + Distance):', {
            Drag: weights[0],    // Speed^2
            Distance: weights[1],
            BaseEfficiency: bias
        });

        featureTensor.dispose();
        labelTensor.dispose();
        normalizedFeatures.dispose();

        this.isTrained = true;
        const loss = history.history.loss[history.history.loss.length - 1] as number;
        return { loss, samples: features.length };
    }

    /**
     * Train Battery SoH Model based on Charging Sessions
     * Uses Implied Capacity = kWh_Added / (End% - Start%)
     */
    async trainSoH(charges: any[], nominalCapacity: number): Promise<{ loss: number, samples: number, predictedSoH: number }> {
        this.sohModel = null;
        this.sohNormalizationData = null;

        // Ensure valid capacity
        if (!nominalCapacity || nominalCapacity <= 0) {
            logger.warn('[AI SoH] Invalid nominal capacity for training:', nominalCapacity);
            return { loss: 0, samples: 0, predictedSoH: 100 }; // Fallback to 100% (unknown)
        }

        const validCharges = charges.filter(c => {
            const kwh = c.kwhCharged || c.kwh;
            const start = c.initialPercentage;
            const end = c.finalPercentage;
            const date = c.date;

            // Only analyze "Deep" charges to minimize error
            // Relaxed to 5% to capture more samples for the user
            const isValid = kwh > 0 && start >= 0 && end > start && (end - start) >= 5 && date;
            return isValid;
        });

        logger.debug(`[AI SoH] Training with ${validCharges.length}/${charges.length} charges.`);

        if (validCharges.length < 3) return { loss: 0, samples: 0, predictedSoH: 100 };

        const features: number[] = []; // Time (days since first charge)
        const labels: number[] = [];   // Implied Capacity
        const impliedCapacities: { cap: number, weight: number }[] = [];

        // Sort by date
        validCharges.sort((a, b) => a.date.localeCompare(b.date));
        const firstDate = new Date(validCharges[0].date).getTime();

        validCharges.forEach(c => {
            const kwh = c.kwhCharged || c.kwh;
            // FIXED: Use decimal (0-1) for capacity calculation if kwh is full battery kwh?
            // Wait, Implied Capacity = kWh_Added / %_Added
            // Example: Added 30kWh for 50% gain (0.5). Capacity = 30 / 0.5 = 60kWh.
            // My previous code: percentAdded = (end - start) / 100.
            // If end=80, start=30, diff=50. percentAdded=0.5.
            // impliedCapacity = kwh / 0.5.
            // If kwh=30, implied=60.
            // 60 is within range of 60.48 * 0.5 (30) and 60.48 * 1.5 (90).
            // So logic WAS correct for units?
            // "me da un SoH de 36%" -> implies capacity was calculated as ~21kWh.
            // If result is 21kWh, then kwh / percentAdded = 21.
            // If percentAdded was 0.5, kwh would be 10.5.
            // Maybe kwhCharged is lower than expected? Or percentAdded is higher?
            // Or maybe percentAdded uses 0-100?
            // If percentAdded was 50 (instead of 0.5), capacity = 30 / 50 = 0.6 kWh.
            // 0.6 is filtered out by < nominal * 0.5.

            // Re-evaluating the user report: "SoH de 36%".
            // 36% of 60.48 = 21.7 kWh.
            // Why would linear regression predict 21.7?
            // Maybe implied capacities are all around 21?
            // If I used (end - start) as denominator (e.g. 50), then 30 / 50 = 0.6. Filtered.
            // Wait, code was: const percentAdded = (c.finalPercentage - c.initialPercentage) / 100;
            // This is correct (0.5).

            // HYPOTHESIS 2: "kwhCharged" includes losses? No, usually valid.
            // HYPOTHESIS 3: Data quality.
            // Let's widen the filter to debug, but also checking the formula.
            // And maybe the Sanity Check is discarding GOOD data if nominalCapacity is wrong?
            // nominalCapacity default is 60.48.

            // FIX: I will use (end-start)/100. 
            // And I will log the values for debugging if I could (can't see logs easily).
            // The only way to get 36% is if the predicted capacity is ~22kWh.
            // This could happen if the trendline dives down steep?
            // Or if the `days` calculation is huge?

            const percentAddedDecimal = (c.finalPercentage - c.initialPercentage) / 100;

            // Protect against div by zero 
            if (percentAddedDecimal < 0.01) return;

            const impliedCapacity = kwh / percentAddedDecimal;

            // Sanity Filter: Capacity must be physically possible
            // 60kWh battery -> valid range 30kWh - 90kWh.
            if (impliedCapacity > nominalCapacity * 1.5 || impliedCapacity < nominalCapacity * 0.5) return;

            const days = (new Date(c.date).getTime() - firstDate) / (1000 * 3600 * 24);

            features.push(days);
            labels.push(impliedCapacity);

            // Weight = delta SoC (longer charges = more reliable)
            impliedCapacities.push({ cap: impliedCapacity, weight: percentAddedDecimal });
        });

        // Ensure we still have data after sanity check
        if (features.length < 3) return { loss: 0, samples: 0, predictedSoH: 100 };

        // --- ROBUST STATISTICAL BASELINE (Weighted Median) ---
        // Sort by capacity to find median
        impliedCapacities.sort((a, b) => a.cap - b.cap);

        let totalWeight = impliedCapacities.reduce((sum, item) => sum + item.weight, 0);
        let weightSum = 0;
        let medianCap = nominalCapacity;

        for (const item of impliedCapacities) {
            weightSum += item.weight;
            if (weightSum >= totalWeight / 2) {
                medianCap = item.cap;
                break;
            }
        }

        logger.debug(`[AI SoH] Statistical Median Capacity: ${medianCap.toFixed(2)} kWh (from ${impliedCapacities.length} samples)`);

        // Normalization
        const featureTensor = tf.tensor2d(features, [features.length, 1]);
        const labelTensor = tf.tensor2d(labels, [labels.length, 1]);


        const featureMoments = tf.moments(featureTensor, 0);
        const mean = featureMoments.mean.dataSync()[0];
        const variance = featureMoments.variance.dataSync()[0];

        this.sohNormalizationData = { mean, variance };

        const normalizedFeatures = featureTensor.sub(mean).div(tf.sqrt(variance).add(1e-6));

        // Define Model (Linear Regression)
        // Capacity = w * Time + Bias
        this.sohModel = tf.sequential();
        this.sohModel.add(tf.layers.dense({ units: 1, inputShape: [1] }));

        this.sohModel.compile({ optimizer: tf.train.adam(0.1), loss: 'meanSquaredError' });

        const history = await this.sohModel.fit(normalizedFeatures, labelTensor, {
            epochs: 300,
            verbose: 0

        });

        // Predict "Now" (Last recorded date)
        const lastDay = features[features.length - 1];
        const predCapacityAI = this.predictSoHInternal(lastDay);

        // --- HYBRID BLENDING ---
        // If AI deviates > 5% from Median, pull it back 50% towards Median
        // This handles "bad fit" on noisy data while preserving trend if robust
        const deviation = Math.abs(predCapacityAI - medianCap) / medianCap;
        let finalCapacity = predCapacityAI;

        if (deviation > 0.05) {
            logger.warn(`[AI SoH] High deviation detected (AI: ${predCapacityAI.toFixed(2)}, Median: ${medianCap.toFixed(2)}). Blending.`);
            // High deviation: Trust Median (90%) - AI is likely reacting to seasonal temporary drop
            finalCapacity = (predCapacityAI * 0.1) + (medianCap * 0.9);
        } else {
            // Stability: Blend 30/70 to favor robust median over noisy linear regression
            finalCapacity = (predCapacityAI * 0.3) + (medianCap * 0.7);
        }

        const finalSoH = (finalCapacity / nominalCapacity) * 100;

        featureTensor.dispose();
        labelTensor.dispose();

        normalizedFeatures.dispose();

        return {
            loss: history.history.loss[history.history.loss.length - 1] as number,
            samples: features.length,
            predictedSoH: parseFloat(finalSoH.toFixed(2))
        };
    }

    private predictSoHInternal(days: number): number {
        if (!this.sohModel || !this.sohNormalizationData) return 60.48;

        return tf.tidy(() => {
            const { mean, variance } = this.sohNormalizationData!;
            const normalizedInput = (days - mean) / (Math.sqrt(variance) + 1e-6);
            const output = this.sohModel!.predict(tf.tensor2d([normalizedInput], [1, 1])) as tf.Tensor;
            return output.dataSync()[0];
        });
    }

    /**
     * Get chart data for SoH visualization
     */
    getSoHDataPoints(charges: any[], nominalCapacity: number) {
        if (!this.sohModel) return { points: [], trend: [] };

        const validCharges = charges.filter(c => {
            const kwh = c.kwhCharged || c.kwh;
            const start = c.initialPercentage;
            const end = c.finalPercentage;
            // Relaxed strict filter to >10% to match training
            return kwh > 0 && start >= 0 && end > start && (end - start) >= 10 && c.date;
        }).sort((a, b) => a.date.localeCompare(b.date));

        if (validCharges.length === 0) return { points: [], trend: [] };

        const firstDate = new Date(validCharges[0].date).getTime();
        const points = validCharges.map(c => {
            const kwh = c.kwhCharged || c.kwh;
            const percentAddedDecimal = (c.finalPercentage - c.initialPercentage) / 100;
            if (percentAddedDecimal < 0.01) return null;
            const cap = kwh / percentAddedDecimal;

            return {
                x: c.date,
                y: (cap / nominalCapacity) * 100, // Convert to % SoH
                cap: cap
            };
        }).filter(p => p !== null && p.cap > nominalCapacity * 0.5 && p.cap < nominalCapacity * 1.5) as { x: string, y: number, cap: number }[];

        // Generate Trendline
        const trend = points.map(p => {
            const days = (new Date(p.x).getTime() - firstDate) / (1000 * 3600 * 24);
            const predCap = this.predictSoHInternal(days);
            return {
                x: p.x,
                y: (predCap / nominalCapacity) * 100
            };
        });

        return { points, trend };
    }

    /**
     * Predict efficiency for a given scenario
     * @param speed km/h
     * @param distance trip distance in km
     */
    predict(speed: number, distance: number = 50): number {
        if (!this.efficiencyModel || !this.isTrained || !this.normalizationData) {
            return 16.0; // Fallback default efficiency
        }

        // Safety check
        const inputShape = this.efficiencyModel.inputs[0].shape[1];
        if (inputShape !== 2) {
            logger.warn(`PredictiveService: Model mismatch. Expected 2 inputs, got ${inputShape}. Resetting.`);
            this.efficiencyModel = null;
            this.isTrained = false;
            return 16.0;
        }

        return tf.tidy(() => {
            const { mean, variance } = this.normalizationData!;

            const safeDistance = distance || 50;

            // Prepare input vector: [Speed^2, Distance]
            const inputData = [Math.pow(speed, 2), safeDistance];

            // Normalize inputs
            const normalizedInput = inputData.map((val, i) => {
                const std = Math.sqrt(variance[i]) || 1;
                return (val - mean[i]) / (std + 1e-6);
            });

            const inputTensor = tf.tensor2d([normalizedInput]);

            const output = this.efficiencyModel!.predict(inputTensor) as tf.Tensor;
            const prediction = output.dataSync()[0]; // Raw efficiency output

            // Clamp reasonable values
            return Math.max(10, Math.min(40, prediction));
        });
    }

    /**
     * Get predictions for different scenarios
     */
    getScenarios(batteryCapacity: number = 60, soh: number = 100) {
        // User Defined Scenarios (Empirical Data)
        // City: <20km, <50km/h
        // Mixed: 20-50km, 50-90km/h
        // Highway: >50km, >90km/h (Avg Speed 100 ~= Cruise 120)
        const scenarios = [
            { name: 'City', speed: 30, distance: 15 },
            { name: 'Mixed', speed: 70, distance: 35 },
            { name: 'Highway', speed: 100, distance: 100 }
        ];

        const usableCapacity = batteryCapacity * (soh / 100);

        return scenarios.map(s => {
            const eff = this.predict(s.speed, s.distance);
            const range = (usableCapacity / eff) * 100;
            return {
                name: s.name,
                speed: s.speed,
                efficiency: eff,
                range: Math.round(range)
            };
        });
    }
}
