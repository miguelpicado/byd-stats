import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EfficiencyModel } from '../EfficiencyModel';
import { Trip } from '@/types';

// Mock TensorFlow.js
vi.mock('@tensorflow/tfjs', () => {
    const dataSyncMock = vi.fn(() => [0.85]);

    const tensorMock = {
        sub: vi.fn(() => tensorMock),
        div: vi.fn(() => tensorMock),
        add: vi.fn(() => tensorMock),
        dispose: vi.fn(),
        dataSync: dataSyncMock,
    };

    return {
        sequential: vi.fn(() => ({
            add: vi.fn(),
            compile: vi.fn(),
            fit: vi.fn().mockResolvedValue({ history: { loss: [0.1] } }),
            predict: vi.fn(() => tensorMock),
        })),
        layers: {
            dense: vi.fn(() => ({})),
        },
        tensor2d: vi.fn(() => tensorMock),
        scalar: vi.fn(() => tensorMock),
        sqrt: vi.fn(() => tensorMock),
        moments: vi.fn(() => ({
            mean: tensorMock,
            variance: tensorMock
        })),
        train: {
            adam: vi.fn()
        },
        tidy: vi.fn((fn) => fn())
    };
});

describe('EfficiencyModel', () => {
    let model: EfficiencyModel;

    beforeEach(() => {
        vi.clearAllMocks();
        model = new EfficiencyModel();
    });

    it('should initialize correctly', () => {
        expect(model.isReady()).toBe(false);
    });

    it('should return loss 0 and sample 0 when less than 5 trips provided', async () => {
        const result = await model.train([]);
        expect(result.loss).toBe(0);
        expect(result.samples).toBe(0);
        expect(model.isReady()).toBe(false);
    });

    it('should train model successfully with valid trips', async () => {
        const mockTrips: Partial<Trip>[] = Array.from({ length: 10 }).map((_, i) => ({
            trip: 50 + i * 5,
            electricity: 10 + i,
            duration: 3600 // 1 hour
        }));

        const result = await model.train(mockTrips as Trip[]);

        expect(result.loss).toBe(0.1);
        expect(result.samples).toBeGreaterThan(10); // Includes artificial anchors
        expect(model.isReady()).toBe(true);
    });

    it('should predict default efficiency before training', () => {
        expect(model.predict(50)).toBe(16.0);
    });

    it('should predict efficiency after training', async () => {
        const mockTrips: Partial<Trip>[] = Array.from({ length: 10 }).map((_, i) => ({
            trip: 50,
            electricity: 10,
            duration: 3600
        }));

        await model.train(mockTrips as Trip[]);
        const prediction = model.predict(50, 20);

        // Our mock predict returns [0.85] which maps to 0.85 in dataSync(). 
        // We restricted Math.max(10, Math.min(40, prediction)) so it should be clamped to 10
        expect(prediction).toBe(10);
    });

    it('should return correct scenarios structure', async () => {
        const scenarios = model.getScenarios(60, 100);

        expect(scenarios).toHaveLength(3);
        expect(scenarios[0].name).toBe('City');
        expect(scenarios[1].name).toBe('Mixed');
        expect(scenarios[2].name).toBe('Highway');

        // Since it is not trained yet, it uses default 16.0 efficiency
        expect(scenarios[0].efficiency).toBe(16.0);

        // Range = (capacity * soh/100) / eff * 100 
        // 60 / 16.0 * 100 = 375
        expect(scenarios[0].range).toBe(375);
    });
});
