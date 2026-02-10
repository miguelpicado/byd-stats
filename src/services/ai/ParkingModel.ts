import * as tf from '@tensorflow/tfjs';
import { Trip } from '../../types';
import { logger } from '@core/logger';

export interface ParkingEvent {
    start: number; // timestamp
    end: number;   // timestamp
    duration: number; // hours
    dayOfWeek: number; // 0-6
    startHour: number; // 0-23.99
}

export class ParkingModel {
    private model: tf.Sequential | null = null;

    async train(trips: Trip[]): Promise<{ loss: number; samples: number }> {
        this.model = null;

        const sorted = [...trips].sort((a, b) => (a.start_timestamp || 0) - (b.start_timestamp || 0));
        const events: ParkingEvent[] = [];

        for (let i = 0; i < sorted.length - 1; i++) {
            const currentTrip = sorted[i];
            const nextTrip = sorted[i + 1];

            const endOfTrip = (currentTrip.end_timestamp || 0) * 1000;
            const startOfNext = (nextTrip.start_timestamp || 0) * 1000;

            if (endOfTrip > 0 && startOfNext > endOfTrip) {
                const durationMs = startOfNext - endOfTrip;
                const durationHours = durationMs / (1000 * 60 * 60);

                if (durationHours > 0.25 && durationHours < 24 * 14) {
                    const date = new Date(endOfTrip);
                    events.push({
                        start: endOfTrip,
                        end: startOfNext,
                        duration: durationHours,
                        dayOfWeek: date.getDay(),
                        startHour: date.getHours() + (date.getMinutes() / 60)
                    });
                }
            }
        }

        if (events.length < 5) return { loss: 0, samples: 0 };

        logger.debug(`[AI Parking] Training with ${events.length} events.`);

        const features = events.map(e => {
            const dayRad = (2 * Math.PI * e.dayOfWeek) / 7;
            const hourRad = (2 * Math.PI * e.startHour) / 24;
            const isWeekendBlock = (e.dayOfWeek === 6 || e.dayOfWeek === 0 || (e.dayOfWeek === 1 && e.startHour < 8)) ? 1 : 0;

            return [
                Math.sin(dayRad), Math.cos(dayRad),
                Math.sin(hourRad), Math.cos(hourRad),
                isWeekendBlock
            ];
        });

        const labels = events.map(e => [e.duration]);

        const featureTensor = tf.tensor2d(features);
        const labelTensor = tf.tensor2d(labels);

        this.model = tf.sequential();
        this.model.add(tf.layers.dense({
            units: 16,
            inputShape: [5],
            activation: 'relu'
        }));
        this.model.add(tf.layers.dense({
            units: 8,
            activation: 'relu'
        }));
        this.model.add(tf.layers.dense({
            units: 1,
            activation: 'linear'
        }));

        this.model.compile({
            optimizer: tf.train.adam(0.01),
            loss: 'meanSquaredError'
        });

        const history = await this.model.fit(featureTensor, labelTensor, {
            epochs: 200,
            batchSize: 32,
            shuffle: true,
            verbose: 0
        });

        const loss = history.history.loss[history.history.loss.length - 1] as number;
        featureTensor.dispose();
        labelTensor.dispose();

        return { loss, samples: events.length };
    }

    predictDeparture(startTime: number): { departureTime: number; duration: number } | null {
        if (!this.model) return null;

        const date = new Date(startTime);
        const dayOfWeek = date.getDay();
        const startHour = date.getHours() + (date.getMinutes() / 60);

        return tf.tidy(() => {
            const dayRad = (2 * Math.PI * dayOfWeek) / 7;
            const hourRad = (2 * Math.PI * startHour) / 24;
            const isWeekendBlock = (dayOfWeek === 6 || dayOfWeek === 0 || (dayOfWeek === 1 && startHour < 8)) ? 1 : 0;

            const input = [[
                Math.sin(dayRad), Math.cos(dayRad),
                Math.sin(hourRad), Math.cos(hourRad),
                isWeekendBlock
            ]];

            const inputTensor = tf.tensor2d(input);
            const output = this.model!.predict(inputTensor) as tf.Tensor;
            const duration = Math.max(0.5, output.dataSync()[0]);

            return {
                duration: duration,
                departureTime: startTime + (duration * 60 * 60 * 1000)
            };
        });
    }
}
