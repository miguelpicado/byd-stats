import * as tf from '@tensorflow/tfjs';
import { Trip } from '../../types';


export class EfficiencyModel {
    private model: tf.Sequential | null = null;
    private isTrained = false;
    private normalizationData: {
        mean: number[];
        variance: number[];
        labelMean: number;
        labelVariance: number;
    } | null = null;

    async train(trips: Trip[]): Promise<{ loss: number; samples: number }> {
        this.model = null;
        this.normalizationData = null;
        this.isTrained = false;

        if (trips.length < 5) return { loss: 0, samples: 0 };

        const features: number[][] = [];
        const labels: number[][] = [];

        trips.forEach(trip => {
            const distance = trip.trip;
            const kwh = trip.electricity;
            const durationHours = (trip.duration / 3600);

            if (!distance || distance <= 0 || !kwh || kwh <= 0 || !durationHours || durationHours <= 0) return;

            const speed = distance / durationHours;
            const efficiency = (kwh * 100) / distance;

            // outlier filtering
            if (isNaN(speed) || speed > 160 || speed < 15) return;
            if (isNaN(efficiency) || efficiency > 40 || efficiency < 5) return;

            features.push([Math.pow(speed, 2), distance]);
            labels.push([efficiency]);
        });

        // Synthetic Anchor Points
        const anchors = [
            { speed: 30, distance: 15, eff: 14.5, count: 500 },
            { speed: 80, distance: 35, eff: 17.5, count: 500 },
            { speed: 100, distance: 100, eff: 23.5, count: 500 }
        ];

        anchors.forEach(anchor => {
            for (let i = 0; i < anchor.count; i++) {
                features.push([Math.pow(anchor.speed, 2), anchor.distance]);
                labels.push([anchor.eff]);
            }
        });

        if (features.length < 5) return { loss: 0, samples: 0 };

        const featureTensor = tf.tensor2d(features);
        const labelTensor = tf.tensor2d(labels);

        const featureMoments = tf.moments(featureTensor, 0);
        const moments = {
            mean: featureMoments.mean.dataSync(),
            variance: featureMoments.variance.dataSync()
        };

        this.normalizationData = {
            mean: Array.from(moments.mean),
            variance: Array.from(moments.variance),
            labelMean: 0,
            labelVariance: 1
        };

        const normalizedFeatures = featureTensor.sub(featureMoments.mean).div(tf.sqrt(featureMoments.variance).add(tf.scalar(1e-6)));

        this.model = tf.sequential();
        this.model.add(tf.layers.dense({
            units: 1,
            inputShape: [2],
            activation: 'linear',
            useBias: true
        }));

        this.model.compile({
            optimizer: tf.train.adam(0.1),
            loss: 'meanSquaredError'
        });

        const history = await this.model.fit(normalizedFeatures, labelTensor, {
            epochs: 500,
            batchSize: 64,
            shuffle: true,
            verbose: 0
        });

        featureTensor.dispose();
        labelTensor.dispose();
        normalizedFeatures.dispose();

        this.isTrained = true;
        const loss = history.history.loss[history.history.loss.length - 1] as number;
        return { loss, samples: features.length };
    }

    predict(speed: number, distance: number = 50): number {
        if (!this.model || !this.isTrained || !this.normalizationData) {
            return 16.0;
        }

        return tf.tidy(() => {
            const { mean, variance } = this.normalizationData!;
            const safeDistance = distance || 50;
            const inputData = [Math.pow(speed, 2), safeDistance];

            const normalizedInput = inputData.map((val, i) => {
                const std = Math.sqrt(variance[i]) || 1;
                return (val - mean[i]) / (std + 1e-6);
            });

            const inputTensor = tf.tensor2d([normalizedInput]);
            const output = this.model!.predict(inputTensor) as tf.Tensor;
            const prediction = output.dataSync()[0];

            return Math.max(10, Math.min(40, prediction));
        });
    }

    getScenarios(batteryCapacity: number = 60, soh: number = 100) {
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

    isReady(): boolean {
        return this.isTrained;
    }
}
