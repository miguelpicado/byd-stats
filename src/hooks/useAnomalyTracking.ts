import { useLocalStorage } from '@hooks/useLocalStorage';

/**
 * useAnomalyTracking
 * Manages acknowledged and deleted anomaly IDs in localStorage.
 * Extracted from TripsProvider for single-responsibility.
 */
export const useAnomalyTracking = () => {
    const [acknowledgedAnomalies, setAcknowledgedAnomalies] = useLocalStorage<string[]>('acknowledged_anomalies', []);
    const [deletedAnomalies, setDeletedAnomalies] = useLocalStorage<string[]>('deleted_anomalies', []);

    return {
        acknowledgedAnomalies,
        setAcknowledgedAnomalies,
        deletedAnomalies,
        setDeletedAnomalies,
    };
};
