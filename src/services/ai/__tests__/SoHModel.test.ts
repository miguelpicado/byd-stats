import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoHModel } from '../SoHModel';
import { Charge } from '@/types';

vi.mock('@core/logger', () => ({
    logger: {
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    }
}));

// Mock TensorFlow.js
vi.mock('@tensorflow/tfjs', () => {
    const dataSyncMock = vi.fn(() => [60]); // Mock 60kWh capacity predicted

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
            fit: vi.fn().mockResolvedValue({ history: { loss: [0.05] } }),
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

describe('SoHModel', () => {
    let model: SoHModel;

    beforeEach(() => {
        vi.clearAllMocks();
        model = new SoHModel();
    });

    it('should return default SoH 100 when invalid nominal capacity provided', async () => {
        const result = await model.train([], 0);
        expect(result.loss).toBe(0);
        expect(result.samples).toBe(0);
        expect(result.predictedSoH).toBe(100);
    });

    it('should return default SoH 100 when less than 3 valid deep charges provided', async () => {
        const mockCharges: Partial<Charge>[] = [
            { kwhCharged: 20, initialPercentage: 10, finalPercentage: 80, date: '2023-01-01' },
            { kwhCharged: 15, initialPercentage: 20, finalPercentage: 60, date: '2023-01-02' }
        ];

        const result = await model.train(mockCharges as Charge[], 60.48);
        expect(result.loss).toBe(0);
        expect(result.samples).toBe(0);
        expect(result.predictedSoH).toBe(100);
    });

    it('should train model successfully with valid deep charges', async () => {
        const mockCharges: Partial<Charge>[] = Array.from({ length: 10 }).map((_, i) => ({
            kwhCharged: 30, // 50% of 60kWh battery
            initialPercentage: 20,
            finalPercentage: 70,
            date: `2023-01-${(i + 1).toString().padStart(2, '0')}`
        }));

        const result = await model.train(mockCharges as Charge[], 60.48);

        expect(result.loss).toBe(0.05);
        expect(result.samples).toBe(10);
        // 60 / 60.48 = ~99.2% SoH (mock predicts 60)
        expect(result.predictedSoH).toBeGreaterThan(95);
        expect(result.predictedSoH).toBeLessThan(105);
    });

    it('should filter out invalid or shallow charges', async () => {
        const mockCharges: Partial<Charge>[] = [
            { kwhCharged: 30, initialPercentage: 20, finalPercentage: 70, date: '2023-01-01' },
            { kwhCharged: 30, initialPercentage: 20, finalPercentage: 70, date: '2023-01-02' },
            { kwhCharged: 30, initialPercentage: 20, finalPercentage: 70, date: '2023-01-03' },
            // invalid
            { kwhCharged: 2, initialPercentage: 50, finalPercentage: 52, date: '2023-01-04' }, // shallow
            { kwhCharged: undefined, initialPercentage: 20, finalPercentage: 70, date: '2023-01-05' }
        ];

        const result = await model.train(mockCharges as Charge[], 60.48);
        expect(result.samples).toBe(3); // only 3 valid 
    });

});
