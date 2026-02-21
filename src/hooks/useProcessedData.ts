import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
    const { } = useTranslation();
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


    // Recalculation Trigger
    const [recalcTrigger, setRecalcTrigger] = useState(0);

    const triggerRecalculation = () => {
        setAiCache(null);
        setSohCache(null);
        setParkingCache(null);

        setRecalcTrigger(prev => prev + 1);
    };

    const workerRef = useRef<Comlink.Remote<DataWorkerApi> | null>(null);
    const rawWorkerRef = useRef<Worker | null>(null);

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
            // Train parking as a side effect when trips update, but don't block
            recalculateParking(allTrips);
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

            // Check Cache (Efficiency)
            if (aiCache && aiCache.hash === currentHash && aiCache.scenarios.length > 0) {
                if (isMounted) {
                    setAiScenarios(aiCache.scenarios);
                    setAiLoss(aiCache.loss);
                }
            }

            // Check SoH Cache
            if (sohCache && sohCache.hash === sohHash && sohCache.soh > 0) {
                if (isMounted) {
                    setAiSoH(sohCache.soh);
                    setAiSoHStats(sohCache.stats);
                    // Apply AI mode
                    if (processingSettings.sohMode === 'ai') {
                        processingSettings.soh = sohCache.soh;
                    }
                    // logger.debug('[useProcessedData] SoH Cache HIT');
                }
            } else {
                // logger.debug('[useProcessedData] SoH Cache MISS or INVALID', { cacheHash: sohCache?.hash, reqHash: sohHash });
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

                    // We NO LONGER train automatically on miss. We only LOAD cache.
                    // Recalculations are triggered explicitly via `recalculateAutonomy()` or `recalculateSoH()`

                    // Train AI Parking Model
                    // Check local cache for weights
                    const parkingHash = currentHash;

                    if (parkingCache && parkingCache.hash === parkingHash && parkingCache.weights && parkingCache.weights.length > 0) {
                        // Validate Cache Format (v2: { data, shape })
                        const isValid = (parkingCache.weights[0] as any).data && (parkingCache.weights[0] as any).shape;

                        if (isValid) {
                            // Restore Model from Cache
                            workerRef.current.importParkingModel(parkingCache.weights).then(() => {
                                // logger.debug('[AI Parking] Model Restored from Cache');
                            }).catch(err => {
                                logger.warn('Failed to restore parking model', err);
                                setParkingCache(null); // Corrupt cache
                            });
                        } else {
                            // Invalid format (legacy) -> Invalidate
                            setParkingCache(null);
                        }
                    }

                    // Parking Training is also explicit now via `recalculateAutonomy` hooks
                    // But we still attempt to load it from cache if valid

                    // NO LONGER Train AI SoH Model automatically
                    // Triggered explicitly via `recalculateSoH()`

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
