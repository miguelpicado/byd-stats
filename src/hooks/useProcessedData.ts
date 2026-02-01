import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as Comlink from 'comlink';
import { logger } from '@core/logger';
import { useLocalStorage } from './useLocalStorage';
import { Trip, Charge, Settings, ProcessedData } from '@/types';

// Define the worker API interface
interface DataWorkerApi {
    processData(
        trips: Trip[],
        settings: any,
        charges: Charge[],
        language: string
    ): Promise<ProcessedData>;

    trainModel(trips: Trip[]): Promise<{ loss: number; samples: number }>;
    getRangeScenarios(batteryCapacity: number, soh: number): Promise<Array<{ name: string; speed: number; efficiency: number; range: number }>>;

    trainSoH(charges: Charge[], capacity: number): Promise<{ loss: number; samples: number; predictedSoH: number }>;
    getSoHStats(charges: Charge[], capacity: number): Promise<{ points: any[]; trend: any[] }>;
}

export interface UseProcessedDataReturn {
    data: ProcessedData | null;
    isProcessing: boolean;
    aiScenarios: Array<{ name: string; speed: number; efficiency: number; range: number }>;
    aiLoss: number | null;
    aiSoH: number | null;
    aiSoHStats: { points: any[]; trend: any[] } | null;
}

export const useProcessedData = (
    filteredTrips: Trip[],
    settings: Settings,
    charges: Charge[]
): UseProcessedDataReturn => {
    const { i18n } = useTranslation();
    const [data, setData] = useState<ProcessedData | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // AI State
    const [aiScenarios, setAiScenarios] = useState<any[]>([]);
    const [aiLoss, setAiLoss] = useState<number | null>(null);

    // AI Cache Persistence
    const [aiCache, setAiCache] = useLocalStorage<{
        hash: string;
        scenarios: any[];
        loss: number;
    } | null>('ai_predictions', null);

    // AI SoH State
    const [aiSoH, setAiSoH] = useState<number | null>(null);
    const [aiSoHStats, setAiSoHStats] = useState<{ points: any[]; trend: any[] } | null>(null);

    const [sohCache, setSohCache] = useLocalStorage<{
        hash: string;
        soh: number;
        stats: { points: any[]; trend: any[] };
    } | null>('ai_soh_predictions', null);

    const workerRef = useRef<Comlink.Remote<DataWorkerApi> | null>(null);

    useEffect(() => {
        if (!workerRef.current) {
            const worker = new Worker(new URL('../workers/dataWorker.js', import.meta.url), { type: 'module' });
            workerRef.current = Comlink.wrap<DataWorkerApi>(worker);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;

        const process = async () => {
            // Processing logic remains same...
            if (!filteredTrips || filteredTrips.length === 0) {
                if (isMounted) setData(null);
                return;
            }

            setIsProcessing(true);
            try {
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

                const rawSettings: any = settings || {};
                processingSettings.odometerOffset = parseFloat(rawSettings.odometerOffset) || 0;

                if (rawSettings.priceStrategy) processingSettings.electricStrategy = rawSettings.priceStrategy;
                if (rawSettings.useCalculatedPrice) processingSettings.electricStrategy = 'average';

                // --- AI Caching Logic ---
                // Hash: TripsSignature + SettingsSignature
                const tripsHash = `${filteredTrips.length}_${filteredTrips[0]?.date || ''}`;
                const settingsHash = `${processingSettings.batterySize}_${processingSettings.soh}`;
                const currentHash = `${tripsHash}__${settingsHash}`;

                const chargeHash = `${charges.length}_${charges[0]?.date || ''}`;
                // Version 6: Validating weighted median with 10% filter
                const sohHash = `${chargeHash}__${processingSettings.batterySize}__v8`;

                // Check Cache
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
                    const result = await workerRef.current.processData(
                        filteredTrips,
                        JSON.parse(JSON.stringify(processingSettings)),
                        JSON.parse(JSON.stringify(charges)),
                        i18n.language
                    );

                    if (result && processingSettings.odometerOffset) {
                        const baseKm = parseFloat(result.summary.totalKm);
                        if (!isNaN(baseKm)) {
                            result.summary.totalKm = (baseKm + processingSettings.odometerOffset).toFixed(1);
                        }
                    }

                    // Train AI Range Model
                    if (!cacheHit && filteredTrips.length > 5) {
                        workerRef.current.trainModel(filteredTrips).then(({ loss }) => {
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
                            });
                        }).catch(err => logger.warn('AI Training error:', err));
                    }

                    // Train AI SoH Model
                    if (!sohCacheHit && charges.length > 0) {
                        const capacity = processingSettings.batterySize;
                        workerRef.current.trainSoH(JSON.parse(JSON.stringify(charges)), capacity).then(({ predictedSoH }) => {
                            if (!isMounted) return;
                            setAiSoH(predictedSoH);

                            workerRef.current?.getSoHStats(JSON.parse(JSON.stringify(charges)), capacity).then(stats => {
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

                    if (isMounted) setData(result);
                }
            } catch (e) {
                logger.error('Worker processing error:', e);
            } finally {
                if (isMounted) setIsProcessing(false);
            }
        };

        process();

        return () => { isMounted = false; };
    }, [filteredTrips, i18n.language, settings, charges]);

    return { data, isProcessing, aiScenarios, aiLoss, aiSoH, aiSoHStats };
};
