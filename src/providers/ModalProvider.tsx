import { createContext, useContext, ReactNode } from 'react';
import useModalState from '@hooks/useModalState';

type ModalContextValue = ReturnType<typeof useModalState>;

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

export const useModalContext = () => {
    const context = useContext(ModalContext);
    if (!context) {
        throw new Error('useModalContext must be used within a ModalProvider');
    }
    return context;
};

export function ModalProvider({ children }: { children: ReactNode }) {
    const modalState = useModalState();

    return (
        <ModalContext.Provider value={modalState}>
            {children}
        </ModalContext.Provider>
    );
}
