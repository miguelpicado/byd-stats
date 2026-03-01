import { useData } from '@/providers/DataProvider';

export function useChargesContextData() {
    const { charges } = useData();
    return { charges };
}
