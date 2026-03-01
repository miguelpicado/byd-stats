import { useData } from '@/providers/DataProvider';

export function useTripsData() {
    const { trips, filteredTrips, filtered, stats, tripHistory } = useData();
    return { trips, filteredTrips, filtered, stats, tripHistory };
}
