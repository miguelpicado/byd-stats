// TensorFlow Worker - Isolated from main thread
// All heavy TensorFlow/AI logic runs exclusively here

// Polyfill requestAnimationFrame for Worker context — TF.js model.fit()
// uses it internally via CustomCallback.nextFrame to yield between batches.
if (typeof requestAnimationFrame === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Web Worker lacks requestAnimationFrame; polyfill via globalThis
    (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Web Worker lacks cancelAnimationFrame; polyfill via globalThis
    (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
}

import * as Comlink from 'comlink';
import type { Trip, Charge } from '../types';

// TensorFlow types
type TFLib = typeof import('@tensorflow/tfjs');
type Sequential = ReturnType<TFLib['sequential']>;

// Dynamic TensorFlow loading
let tf: TFLib | null = null;

async function ensureTensorFlow() {
    if (!tf) {
        tf = await import('@tensorflow/tfjs');
        // Use 'cpu' backend in workers — 'webgl' requires DOM APIs (requestAnimationFrame)
        // that are not available in DedicatedWorkerGlobalScope.
        // CPU is fine for the small models used here (< 1000 params each).
        await tf.setBackend('cpu');
        await tf.ready();
    }
    return tf;
}

// ============================================================
// Model State
// ============================================================
let efficiencyModel: Sequential | null = null;
let efficiencyNormData: {
    mean: number[];
    variance: number[];
} | null = null;
let efficiencyTrained = false;
let lastTrainingSize = 0;

let parkingModel: Sequential | null = null;

let sohModel: Sequential | null = null;
let sohNormData: { mean: number; variance: number } | null = null;

// ============================================================
// Efficiency Model (from EfficiencyModel.ts)
// ============================================================

// Efficiency model training constants
const SPEED_MIN = 15;
const SPEED_MAX = 160;
const EFFICIENCY_MIN = 5;
const EFFICIENCY_MAX = 40;

const SYNTHETIC_ANCHORS = [
    { speed: 30, distance: 15, eff: 14.5, count: 500 },
    { speed: 80, distance: 35, eff: 17.5, count: 500 },
    { speed: 100, distance: 100, eff: 23.5, count: 500 },
] as const;

// ============================================================
// IndexedDB helpers — used only inside the Worker context
// ============================================================

async function saveModelToIDB(model: Sequential, key: string): Promise<void> {
    await model.save(`indexeddb://${key}`);
}

async function loadModelFromIDB(key: string): Promise<Sequential | null> {
    try {
        if (!tf) return null;
        return await tf.loadLayersModel(`indexeddb://${key}`) as Sequential;
    } catch (error) {
        // Ignoramos el error si no existe el modelo, pero otras fallas se propagan
        const msg = String(error);
        if (msg.includes('not found') || msg.includes('NotFoundError')) {
            return null;
        }
        console.warn(`[TF Worker] loadModelFromIDB Error loading '${key}':`, error);
        throw error;
    }
}

function openNormDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('byd-tf-meta', 1);
        req.onupgradeneeded = (e) => {
            (e.target as IDBOpenDBRequest).result.createObjectStore('meta');
        };
        req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
        req.onerror = () => reject(req.error);
    });
}

async function saveNormToIDB(norm: { mean: number[]; variance: number[] }): Promise<void> {
    try {
        const db = await openNormDB();
        await new Promise<void>((res, rej) => {
            const tx = db.transaction('meta', 'readwrite');
            tx.objectStore('meta').put(norm, 'efficiency-norm');
            tx.oncomplete = () => { db.close(); res(); };
            tx.onerror = () => { db.close(); rej(tx.error); };
        });
    } catch (error) {
        console.warn('[TF Worker] saveNormToIDB failed:', error);
        // non-fatal: prediction falls back to default
    }
}

async function loadNormFromIDB(): Promise<{ mean: number[]; variance: number[] } | null> {
    try {
        const db = await openNormDB();
        return await new Promise<{ mean: number[]; variance: number[] } | null>((res, rej) => {
            const tx = db.transaction('meta', 'readonly');
            const req = tx.objectStore('meta').get('efficiency-norm');
            req.onsuccess = () => { db.close(); res((req.result as { mean: number[]; variance: number[] }) ?? null); };
            req.onerror = () => { db.close(); rej(req.error); };
        });
    } catch (error) {
        console.warn('[TF Worker] loadNormFromIDB failed:', error);
        return null;
    }
}

async function trainEfficiency(trips: Trip[]): Promise<{ loss: number; samples: number }> {
    const tfLib = await ensureTensorFlow();

    if (trips.length < 5) return { loss: 0, samples: 0 };

    // 1. In-session: skip if the model is already trained on the same data
    if (efficiencyModel && efficiencyTrained && trips.length === lastTrainingSize) {
        return { loss: 0, samples: trips.length };
    }

    // 2. Cross-session: try to restore from IndexedDB
    const [cached, cachedNorm] = await Promise.all([
        loadModelFromIDB('efficiency-model'),
        loadNormFromIDB(),
    ]);
    if (cached && cachedNorm) {
        efficiencyModel = cached;
        efficiencyNormData = cachedNorm;
        efficiencyTrained = true;
        lastTrainingSize = trips.length;
        return { loss: 0, samples: trips.length };
    }

    // 3. No cache — train from scratch
    efficiencyModel = null;
    efficiencyNormData = null;
    efficiencyTrained = false;

    const features: number[][] = [];
    const labels: number[][] = [];

    trips.forEach((trip) => {
        const distance = trip.trip;
        const kwh = trip.electricity;
        const durationHours = (trip.duration / 3600);

        if (!distance || distance <= 0 || !kwh || kwh <= 0 || !durationHours || durationHours <= 0) return;

        const speed = distance / durationHours;
        const efficiency = (kwh * 100) / distance;

        // Outlier filtering
        if (isNaN(speed) || speed > SPEED_MAX || speed < SPEED_MIN) return;
        if (isNaN(efficiency) || efficiency > EFFICIENCY_MAX || efficiency < EFFICIENCY_MIN) return;

        features.push([Math.pow(speed, 2), distance]);
        labels.push([efficiency]);
    });

    // Synthetic Anchor Points
    SYNTHETIC_ANCHORS.forEach(anchor => {
        for (let i = 0; i < anchor.count; i++) {
            features.push([Math.pow(anchor.speed, 2), anchor.distance]);
            labels.push([anchor.eff]);
        }
    });

    if (features.length < 5) return { loss: 0, samples: 0 };

    const featureTensor = tfLib.tensor2d(features);
    const labelTensor = tfLib.tensor2d(labels);

    const featureMoments = tfLib.moments(featureTensor, 0);
    const moments = {
        mean: featureMoments.mean.dataSync(),
        variance: featureMoments.variance.dataSync()
    };

    efficiencyNormData = {
        mean: Array.from(moments.mean),
        variance: Array.from(moments.variance)
    };

    const normalizedFeatures = featureTensor.sub(featureMoments.mean).div(
        tfLib.sqrt(featureMoments.variance).add(tfLib.scalar(1e-6))
    );

    efficiencyModel = tfLib.sequential();
    efficiencyModel.add(tfLib.layers.dense({
        units: 1,
        inputShape: [2],
        activation: 'linear',
        useBias: true
    }));

    efficiencyModel.compile({
        optimizer: tfLib.train.adam(0.1),
        loss: 'meanSquaredError'
    });

    const history = await efficiencyModel.fit(normalizedFeatures, labelTensor, {
        epochs: 500,
        batchSize: 64,
        shuffle: true,
        verbose: 0,
        yieldEvery: 'never'
    });

    featureTensor.dispose();
    labelTensor.dispose();
    normalizedFeatures.dispose();

    efficiencyTrained = true;
    const loss = history.history.loss[history.history.loss.length - 1] as number;

    // 4. Persist to IndexedDB for future sessions (non-blocking on failure)
    await saveModelToIDB(efficiencyModel!, 'efficiency-model');
    await saveNormToIDB(efficiencyNormData!);
    lastTrainingSize = trips.length;

    return { loss, samples: features.length };
}

function predictEfficiency(speed: number, distance: number = 50): number {
    if (!efficiencyModel || !efficiencyTrained || !efficiencyNormData || !tf) {
        return 16.0;
    }

    return tf.tidy(() => {
        const { mean, variance } = efficiencyNormData!;
        const safeDistance = distance || 50;
        const inputData = [Math.pow(speed, 2), safeDistance];

        const normalizedInput = inputData.map((val, i) => {
            const std = Math.sqrt(variance[i]) || 1;
            return (val - mean[i]) / (std + 1e-6);
        });

        const inputTensor = tf!.tensor2d([normalizedInput]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TF.js predict() returns Tensor|Tensor[]; cast needed to call dataSync()
        const output = efficiencyModel!.predict(inputTensor) as any;
        const prediction = output.dataSync()[0];

        return Math.max(10, Math.min(40, prediction));
    });
}

// ============================================================
// Parking Model (from ParkingModel.ts)
// ============================================================
async function trainParking(trips: Trip[]): Promise<{ loss: number; samples: number }> {
    const tfLib = await ensureTensorFlow();

    parkingModel = null;

    const sorted = [...trips].sort((a, b) => (a.start_timestamp || 0) - (b.start_timestamp || 0));
    const events: { start: number; end: number; duration: number; dayOfWeek: number; startHour: number }[] = [];

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

    const labelArr = events.map(e => [e.duration]);

    const featureTensor = tfLib.tensor2d(features);
    const labelTensor = tfLib.tensor2d(labelArr);

    parkingModel = tfLib.sequential();
    parkingModel.add(tfLib.layers.dense({
        units: 16,
        inputShape: [5],
        activation: 'relu'
    }));
    parkingModel.add(tfLib.layers.dense({
        units: 8,
        activation: 'relu'
    }));
    parkingModel.add(tfLib.layers.dense({
        units: 1,
        activation: 'linear'
    }));

    parkingModel.compile({
        optimizer: tfLib.train.adam(0.01),
        loss: 'meanSquaredError'
    });

    const history = await parkingModel.fit(featureTensor, labelTensor, {
        epochs: 200,
        batchSize: 32,
        shuffle: true,
        verbose: 0,
        yieldEvery: 'never'
    });

    const loss = history.history.loss[history.history.loss.length - 1] as number;
    featureTensor.dispose();
    labelTensor.dispose();

    return { loss, samples: events.length };
}

function predictDeparture(startTime: number): { departureTime: number; duration: number } | null {
    if (!parkingModel || !tf) return null;

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

        const inputTensor = tf!.tensor2d(input);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TF.js predict() returns Tensor|Tensor[]; cast needed to call dataSync()
        const output = parkingModel!.predict(inputTensor) as any;
        const duration = Math.max(0.5, output.dataSync()[0]);

        return {
            duration: duration,
            departureTime: startTime + (duration * 60 * 60 * 1000)
        };
    });
}

// ============================================================
// SoH Model (from SoHModel.ts)
// ============================================================
async function trainSoH(charges: Charge[], nominalCapacity: number): Promise<{ loss: number; samples: number; predictedSoH: number }> {
    const tfLib = await ensureTensorFlow();

    sohModel = null;
    sohNormData = null;

    if (!nominalCapacity || nominalCapacity <= 0) {
        console.warn('[TF Worker] Invalid nominal capacity for training:', nominalCapacity);
        return { loss: 0, samples: 0, predictedSoH: 100 };
    }

    const validCharges = charges.filter((c) => {
        const kwh = c.kwhCharged ?? c.kwh;
        const start = c.initialPercentage;
        const end = c.finalPercentage;
        const date = c.date;

        if (kwh === undefined || start === undefined || end === undefined || !date) return false;
        // Relaxed from 5% to 3% to include more samples for training
        return kwh > 0 && start >= 0 && end > start && (end - start) >= 3;
    });

    if (validCharges.length < 3) {
        if (charges.length > 0) {
            console.warn('[TF Worker] Too few valid charges for SoH training. Reasons for rejection:');
            charges.slice(0, 5).forEach(c => {
                const kwh = c.kwhCharged ?? c.kwh;
                const delta = (c.finalPercentage || 0) - (c.initialPercentage || 0);
                console.warn(` - Charge ${c.id}: kwh=${kwh}, delta=${delta}%, hasDate=${!!c.date}`);
            });
        }
        return { loss: 0, samples: 0, predictedSoH: 100 };
    }


    const features: number[] = [];
    const labels: number[] = [];
    const impliedCapacities: { cap: number; weight: number }[] = [];

    validCharges.sort((a, b) => a.date.localeCompare(b.date));
    const firstDate = new Date(validCharges[0].date).getTime();

    let rejectedByCapacity = 0;
    validCharges.forEach((c) => {
        const kwh = c.kwhCharged ?? c.kwh;
        if (c.finalPercentage === undefined || c.initialPercentage === undefined) return;

        const percentAddedDecimal = (c.finalPercentage - c.initialPercentage) / 100;
        if (percentAddedDecimal < 0.01) return;
        if (kwh === undefined) return;

        const impliedCapacity = kwh / percentAddedDecimal;

        // Sanity Filter
        if (impliedCapacity > nominalCapacity * 1.5 || impliedCapacity < nominalCapacity * 0.5) {
            rejectedByCapacity++;
            return;
        }

        const days = (new Date(c.date).getTime() - firstDate) / (1000 * 3600 * 24);

        features.push(days);
        labels.push(impliedCapacity);
        impliedCapacities.push({ cap: impliedCapacity, weight: percentAddedDecimal });
    });

    if (features.length < 3) {
        console.warn(`[TF Worker] Too few samples after sanity filter (${features.length}). Need at least 3.`);
        return { loss: 0, samples: 0, predictedSoH: 100 };
    }

    // Robust Statistical Baseline (Weighted Median)
    impliedCapacities.sort((a, b) => a.cap - b.cap);
    const totalWeight = impliedCapacities.reduce((sum, item) => sum + item.weight, 0);
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
    const featureTensor = tfLib.tensor2d(features, [features.length, 1]);
    const labelTensor = tfLib.tensor2d(labels, [labels.length, 1]);

    const featureMoments = tfLib.moments(featureTensor, 0);
    const mean = featureMoments.mean.dataSync()[0];
    const variance = featureMoments.variance.dataSync()[0];

    sohNormData = { mean, variance };
    const normalizedFeatures = featureTensor.sub(mean).div(tfLib.sqrt(variance).add(1e-6));

    // Model
    sohModel = tfLib.sequential();
    sohModel.add(tfLib.layers.dense({ units: 1, inputShape: [1] }));
    sohModel.compile({ optimizer: tfLib.train.adam(0.1), loss: 'meanSquaredError' });

    const history = await sohModel.fit(normalizedFeatures, labelTensor, {
        epochs: 300,
        verbose: 0,
        yieldEvery: 'never'
    });

    // Predict "Now"
    const lastDay = features[features.length - 1];
    const predCapacityAI = sohPredictInternal(lastDay);

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

function sohPredictInternal(days: number): number {
    if (!sohModel || !sohNormData || !tf) return 60.48;

    return tf.tidy(() => {
        const { mean, variance } = sohNormData!;
        const normalizedInput = (days - mean) / (Math.sqrt(variance) + 1e-6);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TF.js predict() returns Tensor|Tensor[]; cast needed to call dataSync()
        const output = sohModel!.predict(tf!.tensor2d([normalizedInput], [1, 1])) as any;
        return output.dataSync()[0];
    });
}

interface SoHPoint { x: string; y: number; cap: number }
interface SoHTrend { x: string; y: number }

function getSoHStats(charges: Charge[], nominalCapacity: number): { points: SoHPoint[]; trend: SoHTrend[]; samples: number } {
    if (!sohModel) {
        console.warn('[TF Worker] getSoHStats: No SoH model available');
        return { points: [], trend: [], samples: 0 };
    }

    const validCharges = charges.filter((c) => {
        const kwh = c.kwhCharged ?? c.kwh;
        const start = c.initialPercentage;
        const end = c.finalPercentage;
        if (kwh === undefined || start === undefined || end === undefined || !c.date) return false;
        // Aligned with trainSoH (3% delta) to ensure consistent sample reporting
        return kwh > 0 && start >= 0 && end > start && (end - start) >= 3;
    }).sort((a, b) => a.date.localeCompare(b.date));

    if (validCharges.length === 0) {
        console.warn('[TF Worker] getSoHStats: No valid charges');
        return { points: [], trend: [], samples: 0 };
    }

    const firstDate = new Date(validCharges[0].date).getTime();
    const points = validCharges.map((c): SoHPoint | null => {
        const kwh = c.kwhCharged || c.kwh;
        if (c.finalPercentage === undefined || c.initialPercentage === undefined || kwh === undefined) return null;
        const percentAddedDecimal = (c.finalPercentage - c.initialPercentage) / 100;
        if (percentAddedDecimal < 0.01) return null;
        const cap = kwh / percentAddedDecimal;
        return {
            x: c.date,
            y: parseFloat(((cap / nominalCapacity) * 100).toFixed(2)),
            cap: parseFloat(cap.toFixed(2))
        };
    }).filter((p): p is SoHPoint => p !== null && p.cap > nominalCapacity * 0.5 && p.cap < nominalCapacity * 1.5);

    const trend = points.map(p => {
        const days = (new Date(p.x).getTime() - firstDate) / (1000 * 3600 * 24);
        const predCap = sohPredictInternal(days);
        return {
            x: p.x,
            y: parseFloat(((predCap / nominalCapacity) * 100).toFixed(2))
        };
    });

    return { points, trend, samples: points.length };
}

// ============================================================
// Public API
// ============================================================
const api = {
    trainEfficiency,

    getRangeScenarios(batteryCapacity: number = 60, soh: number = 100) {
        const scenarios = [
            { name: 'City', speed: 30, distance: 15 },
            { name: 'Mixed', speed: 70, distance: 35 },
            { name: 'Highway', speed: 100, distance: 100 }
        ];

        const usableCapacity = batteryCapacity * (soh / 100);

        return scenarios.map(s => {
            const eff = predictEfficiency(s.speed, s.distance);
            const range = (usableCapacity / eff) * 100;
            return {
                name: s.name,
                speed: s.speed,
                efficiency: eff,
                range: Math.round(range)
            };
        });
    },

    trainParking,
    predictDeparture,

    async exportParkingModel(): Promise<{ data: number[], shape: number[] }[] | null> {
        if (!parkingModel) return null;
        // Return weights with shape
        return parkingModel.getWeights().map((w) => ({
            data: Array.from(w.dataSync() as Float32Array),
            shape: w.shape as number[]
        }));
    },

    async importParkingModel(weights: { data: number[], shape: number[] }[]): Promise<void> {
        const tfLib = await ensureTensorFlow();
        if (!weights || weights.length === 0) return;

        // Reconstruct model topology
        parkingModel = tfLib.sequential();
        parkingModel.add(tfLib.layers.dense({
            units: 16,
            inputShape: [5],
            activation: 'relu'
        }));
        parkingModel.add(tfLib.layers.dense({
            units: 8,
            activation: 'relu'
        }));
        parkingModel.add(tfLib.layers.dense({
            units: 1,
            activation: 'linear'
        }));

        parkingModel.compile({
            optimizer: tfLib.train.adam(0.01),
            loss: 'meanSquaredError'
        });

        // Set weights with correct shapes
        const tensors = weights.map(w => tfLib.tensor(w.data, w.shape));
        parkingModel.setWeights(tensors);
        tensors.forEach((t) => t.dispose());
    },

    async exportEfficiencyModel(): Promise<{ weights: { data: number[], shape: number[] }[]; normData: { mean: number[], variance: number[] } } | null> {
        if (!efficiencyModel || !efficiencyNormData) return null;
        return {
            weights: efficiencyModel.getWeights().map((w) => ({
                data: Array.from(w.dataSync() as Float32Array),
                shape: w.shape as number[]
            })),
            normData: efficiencyNormData
        };
    },

    async importEfficiencyModel(data: { weights: { data: number[], shape: number[] }[]; normData: { mean: number[], variance: number[] } }): Promise<void> {
        const tfLib = await ensureTensorFlow();
        if (!data || !data.weights || !data.normData) return;

        efficiencyModel = tfLib.sequential();
        efficiencyModel.add(tfLib.layers.dense({
            units: 1,
            inputShape: [2],
            activation: 'linear',
            useBias: true
        }));

        efficiencyModel.compile({
            optimizer: tfLib.train.adam(0.1),
            loss: 'meanSquaredError'
        });

        const tensors = data.weights.map(w => tfLib.tensor(w.data, w.shape));
        efficiencyModel.setWeights(tensors);
        tensors.forEach((t) => t.dispose());

        efficiencyNormData = data.normData;
        efficiencyTrained = true;
    },

    trainSoH,
    getSoHStats,

    async dispose(): Promise<void> {
        if (efficiencyModel) { efficiencyModel.dispose(); efficiencyModel = null; }
        if (parkingModel) { parkingModel.dispose(); parkingModel = null; }
        if (sohModel) { sohModel.dispose(); sohModel = null; }
        efficiencyNormData = null;
        sohNormData = null;
        efficiencyTrained = false;
    }
};

Comlink.expose(api);

export type TensorFlowWorkerApi = typeof api;
