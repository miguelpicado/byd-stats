import { createContext, useContext, ReactNode } from 'react';
import { useFilters, UseFiltersReturn } from '@hooks/useFilters';

const FilterContext = createContext<UseFiltersReturn | undefined>(undefined);

export const useFiltersContext = () => {
    const context = useContext(FilterContext);
    if (!context) {
        throw new Error('useFiltersContext must be used within a FilterProvider');
    }
    return context;
};

export function FilterProvider({ children }: { children: ReactNode }) {
    const filters = useFilters();

    return (
        <FilterContext.Provider value={filters}>
            {children}
        </FilterContext.Provider>
    );
}
