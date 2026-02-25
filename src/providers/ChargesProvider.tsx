import { createContext, useContext, ReactNode } from 'react';
import useChargesData from '@hooks/useChargesData';
import { useCar } from '@/context/CarContext';
import { useApp } from '@/context/AppContext';

// TypeScript helper since the interface isn't exported from the hook file
type UseChargesDataReturn = ReturnType<typeof useChargesData>;

const ChargesContext = createContext<UseChargesDataReturn | undefined>(undefined);

export const useChargesContext = () => {
    const context = useContext(ChargesContext);
    if (!context) {
        throw new Error('useChargesContext must be used within a ChargesProvider');
    }
    return context;
};

export function ChargesProvider({ children }: { children: ReactNode }) {
    const { activeCarId } = useCar();
    const { settings } = useApp();
    const chargesData = useChargesData(activeCarId, settings.chargerTypes || []);

    return (
        <ChargesContext.Provider value={chargesData}>
            {children}
        </ChargesContext.Provider>
    );
}
