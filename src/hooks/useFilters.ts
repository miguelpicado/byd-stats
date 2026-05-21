import { useState } from 'react';

export interface UseFiltersReturn {
    filterType: string;
    setFilterType: React.Dispatch<React.SetStateAction<string>>;
    selMonth: string;
    setSelMonth: React.Dispatch<React.SetStateAction<string>>;
    dateFrom: string;
    setDateFrom: React.Dispatch<React.SetStateAction<string>>;
    dateTo: string;
    setDateTo: React.Dispatch<React.SetStateAction<string>>;
}

export const useFilters = (): UseFiltersReturn => {
    const [filterType, setFilterType] = useState<string>('all');
    const [selMonth, setSelMonth] = useState<string>('');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');

    return {
        filterType,
        setFilterType,
        selMonth,
        setSelMonth,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo
    };
};
