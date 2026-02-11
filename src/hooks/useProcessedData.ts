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
}


export const useProcessedData = (
    filteredTrips: Trip[],
    allTrips: Trip[],
    settings: Settings,
    charges: Charge[],
    language: string = 'es'
): UseProcessedDataReturn => {
    const { } = useTranslation();
    const [data, setData] = useState<ProcessedData | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAiTraining, setIsAiTraining] = useState(false);

    // AI State
    const [aiScenarios, setAiScenarios] = useState<RangeScenario[]>([]);
    const [aiLoss, setAiLoss] = useState<number | null>(null);

    // AI Cache Persistence
    const [aiCache, setAiCache] = useLocalStorage<{
        hash: string;
        scenarios: RangeScenario[];
        loss: number;
    } | null>('ai_predictions', null);

    // AI SoH State
    const [aiSoH, setAiSoH] = useState<number | null>(null);
    const [aiSoHStats, setAiSoHStats] = useState<SoHStats | null>(null);

    const [sohCache, setSohCache] = useLocalStorage<{
        hash: string;
        soh: number;
        stats: SoHStats;
    } | null>('ai_soh_predictions', null);

    const [parkingCache, setParkingCache] = useLocalStorage<{
        hash: string;
        weights: ModelWeight[];
    } | null>('ai_parking_predictions', null);


    // Recalculation Trigger
    const [recalcTrigger, setRecalcTrigger] = useState(0);

    const triggerRecalculation = () => {
        setAiCache(null);
        setSohCache(null);
        setParkingCache(null);

        setRecalcTrigger(prev => prev + 1);
        setRecalcTrigger(prev => prev + 1);
    };

    const workerRef = useRef<Comlink.Remote<DataWorkerApi> | null>(null);
    const rawWorkerRef = useRef<Worker | null>(null);

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
            // Version 8: Validating weighted median with 10% filter
            const sohHash = `${chargeHash}__${processingSettings.batterySize}__v8`;

            // Check Cache (Efficiency)
            let cacheHit = false;
            if (aiCache && aiCache.hash === currentHash && aiCache.scenarios.length > 0) {
                if (isMounted) {
                    setAiScenarios(aiCache.scenarios);
                    setAiLoss(aiCache.loss);
                    cacheHit = true;
                }
            }

            // Check SoH Cache
            let sohCacheHit = false;
            if (sohCache && sohCache.hash === sohHash && sohCache.soh > 0) {
                if (isMounted) {
                    setAiSoH(sohCache.soh);
                    setAiSoHStats(sohCache.stats);
                    sohCacheHit = true;
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

                    // Train AI Range Model
                    if (!cacheHit && allTrips.length > 5) {
                        if (isMounted) setIsAiTraining(true);

                        // Use allTrips for training to be consistent regardless of filters
                        workerRef.current.trainModel(allTrips).then(({ loss }) => {
                            if (!isMounted) return;
                            setAiLoss(loss);

                            const capacity = processingSettings.batterySize || 60;
                            const soh = processingSettings.soh || 100;

                            workerRef.current?.getRangeScenarios(capacity, soh).then(scenarios => {
                                if (!isMounted) return;
                                setAiScenarios(scenarios);
                                setAiCache({
                                    hash: currentHash,
                                    scenarios,
                                    loss
                                });
                                setIsAiTraining(false);
                            }).catch(() => {
                                if (isMounted) setIsAiTraining(false);
                            });
                        })
                            .catch(err => {
                                logger.warn('AI Training error:', err);
                                if (isMounted) setIsAiTraining(false);
                            })
                    }

                    // Train AI Parking Model
                    // Check local cache for weights
                    const parkingHash = currentHash;
                    let parkingCacheHit = false;

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
                            parkingCacheHit = true;
                        } else {
                            // Invalid format (legacy) -> Invalidate
                            setParkingCache(null);
                        }
                    }

                    // Train if Miss
                    if (!parkingCacheHit && allTrips.length > 5) {
                        workerRef.current.trainParking(allTrips)
                            .then(async () => {
                                // Save Model Weights
                                const weights = await workerRef.current!.exportParkingModel();
                                if (isMounted && weights) {
                                    // Weights are now { data: number[], shape: number[] }[] -> Serializable
                                    setParkingCache({ hash: parkingHash, weights });
                                }
                            })
                            .catch(err => logger.warn('AI Parking Training error:', err));
                    }

                    // Train AI SoH Model
                    if (!sohCacheHit && charges.length > 0) {
                        const capacity = processingSettings.batterySize;
                        workerRef.current.trainSoH(structuredClone(charges), capacity).then(({ predictedSoH }) => {
                            if (!isMounted) return;
                            setAiSoH(predictedSoH);

                            workerRef.current?.getSoHStats(structuredClone(charges), capacity).then(stats => {
                                if (!isMounted) return;
                                setAiSoHStats(stats);
                                setSohCache({
                                    hash: sohHash,
                                    soh: predictedSoH,
                                    stats
                                });
                            });
                        }).catch(err => logger.warn('AI SoH Training error:', err));
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
        forceRecalculate: triggerRecalculation
    };
};
