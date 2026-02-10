import { useMemo, useState } from 'react';

type SortOrder = 'asc' | 'desc';

interface UseFilteredDataProps<T> {
    data: T[];
    initialSortBy: string;
    initialSortOrder?: SortOrder;
    filterFunction: (item: T, filterType: string, month: string, dateFrom: string, dateTo: string) => boolean;
    sortFunction: (a: T, b: T, sortBy: string) => number;
}

export function useFilteredData<T>({
    data,
    initialSortBy,
    initialSortOrder = 'desc',
    filterFunction,
    sortFunction
}: UseFilteredDataProps<T>) {
    const [filterType, setFilterType] = useState<string>('all');
    const [month, setMonth] = useState<string>('');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');
    const [sortBy, setSortBy] = useState<string>(initialSortBy);
    const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder);

    const filteredData = useMemo(() => {
        let result = [...data];

        // Apply filters
        if (filterType !== 'all') {
            result = result.filter(item => filterFunction(item, filterType, month, dateFrom, dateTo));
        }

        // Sort
        result.sort((a, b) => {
            const comparison = sortFunction(a, b, sortBy);
            return sortOrder === 'asc' ? -comparison : comparison;
        });

        return result;
    }, [data, filterType, month, dateFrom, dateTo, sortBy, sortOrder, filterFunction, sortFunction]);

    return {
        filterType,
        setFilterType,
        month,
        setMonth,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,
        sortBy,
        setSortBy,
        sortOrder,
        setSortOrder,
        filteredData
    };
}
