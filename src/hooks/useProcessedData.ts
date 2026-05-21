import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as Comlink from 'comlink';
import { logger } from '@core/logger';
import { Trip, Charge, Settings, ProcessedData } from '@/types';

interface DataWorkerApi {
    processData(
        trips: Trip[],
        settings: any,
        charges: Charge[],
        language: string
    ): Promise<ProcessedData>;
}

export interface UseProcessedDataReturn {
    data: ProcessedData | null;
    isProcessing: boolean;
    forceRecalculate: () => void;
}

export const useProcessedData = (
    filteredTrips: Trip[],
    settings: Settings,
    charges: Charge[]
): UseProcessedDataReturn => {
    const { i18n } = useTranslation();
    const [data, setData] = useState<ProcessedData | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const [recalcTrigger, setRecalcTrigger] = useState(0);

    const triggerRecalculation = () => {
        setRecalcTrigger(prev => prev + 1);
    };

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
            if (!filteredTrips || filteredTrips.length === 0) {
                if (isMounted) setData(null);
                return;
            }

            const processingSettings = {
                electricStrategy: settings?.electricStrategy || (settings?.electricStrategy === undefined && settings?.electricPrice ? 'custom' : 'average'),
                fuelStrategy: settings?.fuelStrategy || 'average',
                electricPrice: Number(settings?.electricPrice) || 0,
                fuelPrice: Number(settings?.fuelPrice) || 0,
                batterySize: settings?.batterySize || 0,
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

            if (workerRef.current) {
                setIsProcessing(true);
                try {
                    const result = await workerRef.current.processData(
                        filteredTrips,
                        processingSettings,
                        charges,
                        i18n.language
                    );

                    if (!isMounted) return;

                    if (result && processingSettings.odometerOffset) {
                        const baseKm = parseFloat(result.summary.totalKm);
                        if (!isNaN(baseKm)) {
                            result.summary.totalKm = (baseKm + processingSettings.odometerOffset).toFixed(1);
                        }
                    }

                    if (isMounted) setData(result);
                } catch (e) {
                    logger.error('Worker processing error:', e);
                } finally {
                    if (isMounted) setIsProcessing(false);
                }
            }
        };

        process();

    }, [filteredTrips, i18n.language, settings, charges, recalcTrigger]);

    return { data, isProcessing, forceRecalculate: triggerRecalculation };
};
