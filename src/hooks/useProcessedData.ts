/**
 * useProcessedData Hook
 * 
 * This hook manages the main data processing pipeline for the application.
 * It coordinates:
 * 1. Data Processing: Delegating heavy computations (trips, charges, stats) to a Web Worker.
 * 2. AI & Machine Learning: Training and running inference for autonomy (Range), battery State of Health (SoH), and parking prediction.
 * 3. Caching: Persisting processed results and AI model weights to LocalStorage to ensure near-instant loads.
 */
import { useState, useEffect, useRef } from 'react';

import * as Comlink from 'comlink';
import { logger } from '@core/logger';
import { useLocalStorage } from './useLocalStorage';
import { Trip, Charge, Settings, ProcessedData, RangeScenario, SoHStats, SmartChargingResult } from '@/types';

// Model weight structure for parking model serialization
interface ModelWeight {
    data: number[];
    shape: number[];
}

// Define the worker API interface
interface DataWorkerApi {
    processData(
        trips: Trip[],
        settings: Partial<Settings>,
        charges: Charge[],
        language: string
    ): Promise<ProcessedData>;

    trainModel(trips: Trip[]): Promise<{ loss: number; samples: number }>;
    getRangeScenarios(batteryCapacity: number, soh: number): Promise<RangeScenario[]>;

    trainSoH(charges: Charge[], capacity: number): Promise<{ loss: number; samples: number; predictedSoH: number }>;
    getSoHStats(charges: Charge[], capacity: number): Promise<SoHStats>;

    trainParking(trips: Trip[]): Promise<{ loss: number; samples: number }>;
    exportParkingModel(): Promise<ModelWeight[] | null>;
    importParkingModel(weights: ModelWeight[]): Promise<void>;

    exportEfficiencyModel(): Promise<{ weights: ModelWeight[]; normData: { mean: number[]; variance: number[] } } | null>;
    importEfficiencyModel(data: { weights: ModelWeight[]; normData: { mean: number[]; variance: number[] } }): Promise<void>;

    predictDeparture(startTime: number): Promise<{ departureTime: number; duration: number } | null>;

    findSmartChargingWindows(trips: Trip[], settings: Settings): Promise<SmartChargingResult>;
}

export interface UseProcessedDataReturn {
    data: ProcessedData | null;
    isProcessing: boolean;
    aiScenarios: RangeScenario[];
    aiLoss: number | null;
    aiSoH: number | null;
    aiSoHStats: SoHStats | null;
    isAiTraining: boolean;
    predictDeparture: (startTime: number) => Promise<{ departureTime: number; duration: number } | null>;
    findSmartChargingWindows: (trips: Trip[], settings: Settings) => Promise<SmartChargingResult | null>;
    forceRecalculate: () => void;
    recalculateSoH: () => Promise<void>;
    recalculateAutonomy: () => Promise<void>;
}


export const useProcessedData = (
    filteredTrips: Trip[],
    allTrips: Trip[],
    settings: Settings,
    charges: Charge[],
    language: string = 'es',
    activeCarId?: string | null
): UseProcessedDataReturn => {
    const [data, setData] = useState<ProcessedData | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAiTraining, setIsAiTraining] = useState(false);

    // AI State
    const [aiScenarios, setAiScenarios] = useState<RangeScenario[]>([]);
    const [aiLoss, setAiLoss] = useState<number | null>(null);

    // AI Cache Persistence - Scope by activeCarId
    const aiCacheKey = activeCarId ? `ai_predictions_${activeCarId}` : 'ai_predictions';
    const [aiCache, setAiCache] = useLocalStorage<{
        hash: string;
        scenarios: RangeScenario[];
        loss: number;
    } | null>(aiCacheKey, null);

    // AI SoH State
    const [aiSoH, setAiSoH] = useState<number | null>(null);
    const [aiSoHStats, setAiSoHStats] = useState<SoHStats | null>(null);

    const sohCacheKey = activeCarId ? `ai_soh_predictions_${activeCarId}` : 'ai_soh_predictions';
    const [sohCache, setSohCache] = useLocalStorage<{
        hash: string;
        soh: number;
        stats: SoHStats;
    } | null>(sohCacheKey, null);

    const parkingCacheKey = activeCarId ? `ai_parking_predictions_${activeCarId}` : 'ai_parking_predictions';
    const [parkingCache, setParkingCache] = useLocalStorage<{
        hash: string;
        weights: ModelWeight[];
    } | null>(parkingCacheKey, null);

    const efficiencyCacheKey = activeCarId ? `ai_efficiency_predictions_${activeCarId}` : 'ai_efficiency_predictions';
    const [efficiencyCache, setEfficiencyCache] = useLocalStorage<{
        hash: string;
        data: { weights: ModelWeight[]; normData: { mean: number[]; variance: number[] } };
    } | null>(efficiencyCacheKey, null);


    // Recalculation Trigger
    const [recalcTrigger, setRecalcTrigger] = useState(0);

    const triggerRecalculation = () => {
        setAiCache(null);
        setSohCache(null);
        setParkingCache(null);
        setEfficiencyCache(null);

        setRecalcTrigger(prev => prev + 1);
    };

    const workerRef = useRef<Comlink.Remote<DataWorkerApi> | null>(null);
    const rawWorkerRef = useRef<Worker | null>(null);
    // Ref-based mutex to prevent double training within a single effect closure.
    // Using a ref instead of isAiTraining state to avoid stale closure issues.
    const isTrainingRef = useRef(false);

    // --- Explicit Recalculation Triggers ---
    const recalculateSoH = async () => {
        if (!workerRef.current || charges.length === 0) return;

        setIsProcessing(true);
        try {
            const capacity = Number(settings?.batterySize) || 60;
            const { predictedSoH } = await workerRef.current.trainSoH(structuredClone(charges), capacity);

            setAiSoH(predictedSoH);

            const stats = await workerRef.current.getSoHStats(structuredClone(charges), capacity);
            setAiSoHStats(stats);

            const safeStats = { ...stats };
            if (safeStats.points && safeStats.points.length > 200) {
                logger.warn(`[useProcessedData] Truncating SoH points from ${safeStats.points.length} to 200 for APK cache`);
                safeStats.points = safeStats.points.slice(-200);
                safeStats.trend = safeStats.trend.slice(-200);
            }

            const chargeHash = `${charges.length}_${charges[0]?.date || ''}`;
            const sohHash = `${chargeHash}__${capacity}__v9`;

            setSohCache({
                hash: sohHash,
                soh: predictedSoH,
                stats: safeStats
            });

            logger.info('[useProcessedData] Explicit SoH recalculation completed');
        } catch (error) {
            logger.error('[useProcessedData] Error recalculating SoH:', error);
        } finally {
            setIsProcessing(false);
            setRecalcTrigger(prev => prev + 1); // Trigger UI update for main process
        }
    };

    const recalculateAutonomy = async () => {
        if (!workerRef.current || allTrips.length <= 5) return;

        setIsAiTraining(true);
        try {
            const { loss } = await workerRef.current.trainModel(allTrips);
            setAiLoss(loss);

            const capacity = Number(settings?.batterySize) || 60;
            const soh = Number(settings?.soh) || 100;

            const scenarios = await workerRef.current.getRangeScenarios(capacity, soh);
            setAiScenarios(scenarios);

            const len = allTrips.length;
            const lastTs = allTrips[len - 1].start_timestamp;
            const firstTs = allTrips[0].start_timestamp;
            const currentHash = `count:${len}|first:${firstTs}|last:${lastTs}|v:2`;

            setAiCache({
                hash: currentHash,
                scenarios,
                loss
            });

            logger.info('[useProcessedData] Explicit Autonomy recalculation completed');
        } catch (error) {
            logger.error('[useProcessedData] Error recalculating Autonomy:', error);
        } finally {
            setIsAiTraining(false);
            // Train side effect models when trips update, but don't block
            recalculateParking(allTrips);
            recalculateEfficiency(allTrips);
        }
    };

    const recalculateEfficiency = async (trips: Trip[]) => {
        if (!workerRef.current || trips.length <= 5) return;
        try {
            await workerRef.current.trainModel(trips); // This triggers trainEfficiency in worker
            const modelData = await workerRef.current.exportEfficiencyModel();
            if (modelData) {
                const len = trips.length;
                const currentHash = `count:${len}|first:${trips[0].start_timestamp}|last:${trips[len - 1].start_timestamp}|v:2`;
                setEfficiencyCache({ hash: currentHash, data: modelData });
            }
        } catch (error) {
            logger.error('[useProcessedData] Error recalculating Efficiency:', error);
        }
    };

    const recalculateParking = async (trips: Trip[]) => {
        if (!workerRef.current || trips.length <= 5) return;
        try {
            await workerRef.current.trainParking(trips);
            const weights = await workerRef.current.exportParkingModel();
            if (weights) {
                const len = trips.length;
                const currentHash = `count:${len}|first:${trips[0].start_timestamp}|last:${trips[len - 1].start_timestamp}|v:2`;
                setParkingCache({ hash: currentHash, weights });
            }
        } catch (error) {
            logger.error('[useProcessedData] Error recalculating Parking:', error);
        }
    };


    useEffect(() => {
        if (!workerRef.current) {
            const worker = new Worker(new URL('../workers/dataWorker.ts', import.meta.url), { type: 'module' });
            rawWorkerRef.current = worker;
            workerRef.current = Comlink.wrap<DataWorkerApi>(worker);
        }

        // Cleanup: terminate worker on unmount
        return () => {
            if (rawWorkerRef.current) {
                rawWorkerRef.current.terminate();
                rawWorkerRef.current = null;
                workerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        const process = async () => {
            if (!filteredTrips || filteredTrips.length === 0) {
                if (isMounted) setData(null);
                return;
            }

            // Create settings object for processing
            const processingSettings = {
                electricStrategy: settings?.electricStrategy || (settings?.electricStrategy === undefined && settings?.electricPrice ? 'custom' : 'average'),
                fuelStrategy: settings?.fuelStrategy || 'average',
                electricPrice: Number(settings?.electricPrice) || 0,
                fuelPrice: Number(settings?.fuelPrice) || 0,
                batterySize: Number(settings?.batterySize) || 0,
                soh: Number(settings?.soh) || 100,
                sohMode: settings?.sohMode || 'manual',
                mfgDate: settings?.mfgDate,
                chargerTypes: settings?.chargerTypes || [],
                thermalStressFactor: parseFloat(String(settings?.thermalStressFactor)) || 1.0,
                odometerOffset: 0
            };

            const rawSettings = settings as Settings & { priceStrategy?: 'custom' | 'average' | 'dynamic'; useCalculatedPrice?: boolean };
            processingSettings.odometerOffset = parseFloat(String(rawSettings.odometerOffset)) || 0;

            if (rawSettings.priceStrategy) processingSettings.electricStrategy = rawSettings.priceStrategy;
            if (rawSettings.useCalculatedPrice) processingSettings.electricStrategy = 'average';

            // --- AI Caching Logic ---
            // Hash for Training (ALL trips)
            const currentHash = (() => {
                if (!allTrips || allTrips.length === 0) return '';
                const len = allTrips.length;
                const lastTs = allTrips[len - 1].start_timestamp;
                const firstTs = allTrips[0].start_timestamp;
                return `count:${len}|first:${firstTs}|last:${lastTs}|v:2`;
            })();

            // Hash for SoH: ChargesSignature + BatteryCapacity + Version
            const chargeHash = `${charges.length}_${charges[0]?.date || ''}`;
            // Version 9: Aligning filters to 3% for both training and stats
            const sohHash = `${chargeHash}__${processingSettings.batterySize}__v9`;

            // Track if we need to train AI models
            let needsAutonomyTraining = false;
            let needsSoHTraining = false;

            // Check Cache (Efficiency/Autonomy)
            const hasAutonomyCache = aiCache && aiCache.hash === currentHash && aiCache.scenarios.length > 0;
            if (hasAutonomyCache) {
                if (isMounted) {
                    setAiScenarios(aiCache.scenarios);
                    setAiLoss(aiCache.loss);
                    logger.debug('[useProcessedData] Autonomy Cache HIT');
                }
            } else {
                // Cache MISS or data changed - need to train
                needsAutonomyTraining = allTrips.length >= 5;
                if (needsAutonomyTraining) {
                    logger.info(`[useProcessedData] Autonomy Cache MISS - will train with ${allTrips.length} trips`);
                }
            }

            // Check SoH Cache
            const hasSoHCache = sohCache && sohCache.hash === sohHash && sohCache.soh > 0;
            if (hasSoHCache) {
                if (isMounted) {
                    setAiSoH(sohCache.soh);
                    setAiSoHStats(sohCache.stats);
                    // Apply AI mode
                    if (processingSettings.sohMode === 'ai') {
                        processingSettings.soh = sohCache.soh;
                    }
                    logger.debug('[useProcessedData] SoH Cache HIT');
                }
            } else {
                // Cache MISS or data changed - need to train
                needsSoHTraining = charges.length >= 3;
                if (needsSoHTraining) {
                    logger.info(`[useProcessedData] SoH Cache MISS - will train with ${charges.length} charges`);
                }
            }

            if (workerRef.current) {
                setIsProcessing(true);
                try {
                    const result = await workerRef.current.processData(
                        filteredTrips,
                        structuredClone(processingSettings),
                        structuredClone(charges),
                        language
                    );

                    if (!isMounted) return;

                    if (result && processingSettings.odometerOffset) {
                        const baseKm = parseFloat(result.summary.totalKm);
                        if (!isNaN(baseKm)) {
                            result.summary.totalKm = (baseKm + processingSettings.odometerOffset).toFixed(1);
                        }
                    }

                    if (isMounted) setData(result);

                    // ============================================================
                    // AUTOMATIC AI TRAINING (when cache is invalid or missing)
                    // ============================================================

                    // Train Autonomy Model (Range Analysis) if needed
                    if (needsAutonomyTraining && !isTrainingRef.current) {
                        isTrainingRef.current = true;
                        setIsAiTraining(true);
                        logger.info('[useProcessedData] Auto-training Autonomy model...');

                        let capturedLoss = 0;
                        workerRef.current.trainModel(allTrips)
                            .then(({ loss }) => {
                                capturedLoss = loss;
                                setAiLoss(loss);
                                return workerRef.current!.getRangeScenarios(
                                    Number(processingSettings.batterySize) || 60,
                                    Number(processingSettings.soh) || 100
                                );
                            })
                            .then((scenarios) => {
                                if (isMounted) {
                                    setAiScenarios(scenarios);
                                    setAiCache({
                                        hash: currentHash,
                                        scenarios,
                                        loss: capturedLoss
                                    });
                                    logger.info('[useProcessedData] Autonomy model trained and cached');
                                }
                            })
                            .catch((err) => {
                                logger.error('[useProcessedData] Error training Autonomy:', err);
                            })
                            .finally(() => {
                                isTrainingRef.current = false;
                                if (isMounted) setIsAiTraining(false);
                                // Train side-effect models
                                if (allTrips.length >= 5) {
                                    recalculateParking(allTrips);
                                    recalculateEfficiency(allTrips);
                                }
                            });
                    }

                    // Train SoH Model if needed
                    if (needsSoHTraining && !isProcessing) {
                        logger.info('[useProcessedData] Auto-training SoH model...');

                        let capturedSoH = 100;
                        workerRef.current.trainSoH(structuredClone(charges), Number(processingSettings.batterySize) || 60)
                            .then(({ predictedSoH }) => {
                                capturedSoH = predictedSoH;
                                if (isMounted) {
                                    setAiSoH(predictedSoH);
                                }
                                return workerRef.current!.getSoHStats(
                                    structuredClone(charges),
                                    Number(processingSettings.batterySize) || 60
                                );
                            })
                            .then((stats) => {
                                if (isMounted) {
                                    setAiSoHStats(stats);

                                    // Truncate for APK cache
                                    const safeStats = { ...stats };
                                    if (safeStats.points && safeStats.points.length > 200) {
                                        logger.warn(`[useProcessedData] Truncating SoH points from ${safeStats.points.length} to 200 for APK cache`);
                                        safeStats.points = safeStats.points.slice(-200);
                                        safeStats.trend = safeStats.trend.slice(-200);
                                    }

                                    setSohCache({
                                        hash: sohHash,
                                        soh: capturedSoH,
                                        stats: safeStats
                                    });
                                    logger.info('[useProcessedData] SoH model trained and cached');
                                }
                            })
                            .catch((err) => {
                                logger.error('[useProcessedData] Error training SoH:', err);
                            });
                    }

                    // Train AI Parking Model (restore from cache or train if needed)
                    const parkingHash = currentHash;
                    const hasParkingCache = parkingCache && parkingCache.hash === parkingHash &&
                        parkingCache.weights && parkingCache.weights.length > 0;

                    if (hasParkingCache) {
                        // Validate Cache Format (v2: { data, shape })
                        const w0 = parkingCache.weights[0] as Record<string, unknown>;
                        const isValid = w0 && 'data' in w0 && w0.data && 'shape' in w0 && w0.shape;

                        if (isValid) {
                            // Restore Model from Cache
                            workerRef.current.importParkingModel(parkingCache.weights).then(() => {
                                logger.debug('[AI Parking] Model Restored from Cache');
                            }).catch(err => {
                                logger.warn('Failed to restore parking model', err);
                                setParkingCache(null); // Corrupt cache
                            });
                        } else {
                            // Invalid format (legacy) -> Invalidate and retrain
                            setParkingCache(null);
                            if (allTrips.length >= 5) {
                                recalculateParking(allTrips);
                            }
                        }
                    } else if (allTrips.length >= 5) {
                        // No cache - train parking model
                        recalculateParking(allTrips);
                    }

                    // RESTORE AI EFFICIENCY MODEL
                    // The autonomy scenarios calculate logic also depends on this model
                    const hasEfficiencyCache = efficiencyCache && efficiencyCache.hash === currentHash &&
                        efficiencyCache.data && efficiencyCache.data.weights && efficiencyCache.data.normData;

                    if (hasEfficiencyCache && !needsAutonomyTraining) { // Only restore if scenarios didn't force a retrain
                        const ew0 = efficiencyCache.data.weights[0] as Record<string, unknown>;
                        const isValid = ew0 && 'data' in ew0 && ew0.data && efficiencyCache.data.normData.mean;

                        if (isValid) {
                            workerRef.current.importEfficiencyModel(efficiencyCache.data).then(() => {
                                logger.debug('[AI Efficiency] Model Restored from Cache');
                            }).catch(err => {
                                logger.warn('Failed to restore efficiency model', err);
                                setEfficiencyCache(null);
                            });
                        } else {
                            setEfficiencyCache(null);
                            if (allTrips.length >= 5) recalculateEfficiency(allTrips);
                        }
                    } else if (allTrips.length >= 5 && !needsAutonomyTraining) {
                        // Needed if scenarios were cached but model weight export wasn't
                        recalculateEfficiency(allTrips);
                    }

                } catch (e) {
                    logger.error('Worker processing error:', e);
                } finally {
                    if (isMounted) setIsProcessing(false);
                }
            }
        };

        process();

    }, [filteredTrips, allTrips, language, settings, charges, recalcTrigger]);

    const predictDeparture = async (startTime: number) => {
        if (!workerRef.current) return null;
        return await workerRef.current.predictDeparture(startTime);
    };

    const findSmartChargingWindows = async (trips: Trip[], settings: Settings) => {
        if (!workerRef.current) return null;
        return await workerRef.current.findSmartChargingWindows(trips, settings);
    };

    return {
        data,
        isProcessing,
        isAiTraining,
        aiScenarios,
        aiLoss,
        aiSoH,
        aiSoHStats,
        predictDeparture,
        findSmartChargingWindows,
        forceRecalculate: triggerRecalculation,
        recalculateSoH,
        recalculateAutonomy
    };
};
