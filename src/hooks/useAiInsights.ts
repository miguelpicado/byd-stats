/**
 * useAiInsights
 *
 * Thin semantic wrapper around useProcessedData that makes the AI/ML
 * concern explicit. TripsProvider uses this hook instead of calling
 * useProcessedData directly, making the provider's intent clearer.
 *
 * Owns: data processing pipeline, AI training state, SoH predictions,
 *       smart charging windows, departure prediction.
 */
import { useProcessedData } from '@hooks/useProcessedData';
import { Trip, Charge, Settings } from '@/types';

export const useAiInsights = (
    filteredTrips: Trip[],
    allTrips: Trip[],
    settings: Settings,
    charges: Charge[],
    language: string = 'es',
    activeCarId?: string | null
) => {
    return useProcessedData(filteredTrips, allTrips, settings, charges, language, activeCarId);
};
