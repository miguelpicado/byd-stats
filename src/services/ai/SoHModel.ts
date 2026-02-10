import * as tf from '@tensorflow/tfjs';
import { Charge } from '../../types';
import { logger } from '@core/logger';

export class SoHModel {
    private model: tf.Sequential | null = null;
    private normalizationData: {
        mean: number;
        variance: number;
    } | null = null;

    async train(charges: Charge[], nominalCapacity: number): Promise<{ loss: number, samples: number, predictedSoH: number }> {
        this.model = null;
        this.normalizationData = null;

        if (!nominalCapacity || nominalCapacity <= 0) {
            logger.warn('[AI SoH] Invalid nominal capacity for training:', nominalCapacity);
            return { loss: 0, samples: 0, predictedSoH: 100 };
        }

        const validCharges = charges.filter(c => {
            const kwh = c.kwhCharged ?? c.kwh;
            const start = c.initialPercentage;
            const end = c.finalPercentage;
            const date = c.date;

            if (kwh === undefined || start === undefined || end === undefined || !date) return false;
            // Only analyze "Deep" charges to minimize error
            return kwh > 0 && start >= 0 && end > start && (end - start) >= 5;
        });

        logger.debug(`[AI SoH] Training with ${validCharges.length}/${charges.length} charges.`);

        if (validCharges.length < 3) return { loss: 0, samples: 0, predictedSoH: 100 };

        const features: number[] = [];
        const labels: number[] = [];
        const impliedCapacities: { cap: number, weight: number }[] = [];

        validCharges.sort((a, b) => a.date.localeCompare(b.date));
        const firstDate = new Date(validCharges[0].date).getTime();

        validCharges.forEach(c => {
            const kwh = c.kwhCharged ?? c.kwh;
            if (c.finalPercentage === undefined || c.initialPercentage === undefined) return;

            const percentAddedDecimal = (c.finalPercentage - c.initialPercentage) / 100;
            if (percentAddedDecimal < 0.01) return;
            if (kwh === undefined) return;

            const impliedCapacity = kwh / percentAddedDecimal;

            // Sanity Filter
            if (impliedCapacity > nominalCapacity * 1.5 || impliedCapacity < nominalCapacity * 0.5) return;

            const days = (new Date(c.date).getTime() - firstDate) / (1000 * 3600 * 24);

            features.push(days);
            labels.push(impliedCapacity);
            impliedCapacities.push({ cap: impliedCapacity, weight: percentAddedDecimal });
        });

        if (features.length < 3) return { loss: 0, samples: 0, predictedSoH: 100 };

        // Robust Statistical Baseline (Weighted Median)
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

        // Normalization
        const featureTensor = tf.tensor2d(features, [features.length, 1]);
        const labelTensor = tf.tensor2d(labels, [labels.length, 1]);

        const featureMoments = tf.moments(featureTensor, 0);
        const mean = featureMoments.mean.dataSync()[0];
        const variance = featureMoments.variance.dataSync()[0];

        this.normalizationData = { mean, variance };
        const normalizedFeatures = featureTensor.sub(mean).div(tf.sqrt(variance).add(1e-6));

        // Model
        this.model = tf.sequential();
        this.model.add(tf.layers.dense({ units: 1, inputShape: [1] }));
        this.model.compile({ optimizer: tf.train.adam(0.1), loss: 'meanSquaredError' });

        const history = await this.model.fit(normalizedFeatures, labelTensor, {
            epochs: 300,
            verbose: 0
        });

        // Predict "Now"
        const lastDay = features[features.length - 1];
        const predCapacityAI = this.predictInternal(lastDay);

        // Hybrid Blending
        const deviation = Math.abs(predCapacityAI - medianCap) / medianCap;
        let finalCapacity = predCapacityAI;

        if (deviation > 0.05) {
            finalCapacity = (predCapacityAI * 0.1) + (medianCap * 0.9);
        } else {
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

    private predictInternal(days: number): number {
        if (!this.model || !this.normalizationData) return 60.48;

        return tf.tidy(() => {
            const { mean, variance } = this.normalizationData!;
            const normalizedInput = (days - mean) / (Math.sqrt(variance) + 1e-6);
            const output = this.model!.predict(tf.tensor2d([normalizedInput], [1, 1])) as tf.Tensor;
            return output.dataSync()[0];
        });
    }

    getDataPoints(charges: Charge[], nominalCapacity: number) {
        if (!this.model) return { points: [], trend: [] };

        const validCharges = charges.filter(c => {
            const kwh = c.kwhCharged ?? c.kwh;
            const start = c.initialPercentage;
            const end = c.finalPercentage;
            if (kwh === undefined || start === undefined || end === undefined || !c.date) return false;
            return kwh > 0 && start >= 0 && end > start && (end - start) >= 10;
        }).sort((a, b) => a.date.localeCompare(b.date));

        if (validCharges.length === 0) return { points: [], trend: [] };

        const firstDate = new Date(validCharges[0].date).getTime();
        const points = validCharges.map(c => {
            const kwh = c.kwhCharged || c.kwh;
            if (c.finalPercentage === undefined || c.initialPercentage === undefined || kwh === undefined) return null;
            const percentAddedDecimal = (c.finalPercentage - c.initialPercentage) / 100;
            if (percentAddedDecimal < 0.01) return null;
            const cap = kwh / percentAddedDecimal;
            return {
                x: c.date,
                y: (cap / nominalCapacity) * 100,
                cap: cap
            };
        }).filter(p => p !== null && p.cap > nominalCapacity * 0.5 && p.cap < nominalCapacity * 1.5) as { x: string, y: number, cap: number }[];

        const trend = points.map(p => {
            const days = (new Date(p.x).getTime() - firstDate) / (1000 * 3600 * 24);
            const predCap = this.predictInternal(days);
            return {
                x: p.x,
                y: (predCap / nominalCapacity) * 100
            };
        });

        return { points, trend };
    }
}
