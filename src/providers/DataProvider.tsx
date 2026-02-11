import React, { createContext, useContext, useMemo, ReactNode, useState } from 'react';
import { useApp } from '@/context/AppContext';

// Import new providers
import { FilterProvider, useFiltersContext } from './FilterProvider';
import { ChargesProvider, useChargesContext } from './ChargesProvider';
import { ModalProvider, useModalContext } from './ModalProvider';
import { SyncProvider, useSyncContext } from './SyncProvider';
import { TripsProvider, useTripsContext } from './TripsProvider';
import { Trip, Charge, ProcessedData, Settings } from '@/types';
import { useConfirmation, ConfirmModalState } from '@hooks/useConfirmation';
import { ModalsState } from '@hooks/useModalState';
import type { UseGoogleSyncReturn } from '@hooks/useGoogleSync';
import type { UseDatabaseReturn } from '@hooks/useDatabase';
import type { UseFileHandlingReturn } from '@hooks/useFileHandling';
import type { ChargeData } from '@hooks/useChargesData';

// Define context interfaces (Legacy Support)
export interface DataState {
    trips: Trip[];
    filtered: Trip[];
    filteredTrips: Trip[];
    stats: ProcessedData | null;
    charges: Charge[];
    tripHistory: Trip[];
    settings: Settings;
    googleSync: UseGoogleSyncReturn;
    database: UseDatabaseReturn;
    modals: ModalsState;
    openModal: (modalName: keyof ModalsState, props?: Record<string, unknown>) => void;
    closeModal: (modalName: keyof ModalsState) => void;
    fileHandling: UseFileHandlingReturn;
    filterType: string;
    selMonth: string;
    dateFrom: string;
    dateTo: string;
    months: string[];
    legalInitialSection: string;
    setLegalInitialSection: (section: string) => void;
    isAnyModalOpen: boolean;

    selectedTrip: Trip | null;
    setSelectedTrip: React.Dispatch<React.SetStateAction<Trip | null>>;
    selectedCharge: Charge | null;
    setSelectedCharge: React.Dispatch<React.SetStateAction<Charge | null>>;
    editingCharge: Charge | null;
    setEditingCharge: React.Dispatch<React.SetStateAction<Charge | null>>;

    // AI Data
    aiScenarios: Array<{ name: string; speed: number; efficiency: number; range: number }>;
    aiLoss: number | null;
    isAiTraining: boolean;
    aiSoH: number | null;
    aiSoHStats: { points: Array<{ x: number; y: number }>; trend: Array<{ x: number; y: number }> } | null;
    predictDeparture: (startTime: number) => Promise<{ departureTime: number; duration: number } | null>;
    findSmartChargingWindows: (trips: Trip[], settings: Settings) => Promise<{ windows: unknown[]; weeklyKwh: number; requiredHours: number; hoursFound: number; note?: string } | null>;
    forceRecalculate: () => void;

    // Anomalies
    acknowledgedAnomalies: string[];
    setAcknowledgedAnomalies: (ids: string[]) => void;
    deletedAnomalies: string[];
    setDeletedAnomalies: (ids: string[]) => void;
}

export interface DataDispatch {
    setRawTrips: (trips: Trip[]) => void;
    replaceCharges: (charges: Charge[]) => void;

    clearData: () => void;
    saveToHistory: (name: string) => void;
    loadFromHistory: () => void;
    clearHistory: () => void;

    confirmModalState: ConfirmModalState;
    closeConfirmation: () => void;
    showConfirmation: (title: string, message: string, onConfirm: () => void, isDangerous?: boolean) => void;

    loadFile: (file: File, merge?: boolean) => Promise<void>;
    exportData: () => Promise<{ success: boolean; reason?: string }>;
    loadChargeRegistry: (file: File) => Promise<void>;

    addCharge: (charge: ChargeData) => Charge;
    updateCharge: (id: string, updates: Partial<Charge>) => void;
    deleteCharge: (id: string) => void;
    addMultipleCharges: (charges: ChargeData[]) => number;
    exportCharges: () => boolean;

    setFilterType: (type: string) => void;
    setSelMonth: (month: string) => void;
    setDateFrom: (date: string) => void;
    setDateTo: (date: string) => void;

    openModal: (modalName: keyof ModalsState, props?: Record<string, unknown>) => void;
    closeModal: (modalName: keyof ModalsState) => void;
}

export type DataContextValue = DataState & DataDispatch;

const DataStateContext = createContext<DataState | undefined>(undefined);
const DataDispatchContext = createContext<DataDispatch | undefined>(undefined);

export const useDataState = (): DataState => {
    const context = useContext(DataStateContext);
    if (!context) throw new Error('useDataState must be used within a DataProvider');
    return context;
};

export const useDataDispatch = (): DataDispatch => {
    const context = useContext(DataDispatchContext);
    if (!context) throw new Error('useDataDispatch must be used within a DataProvider');
    return context;
};

export const useData = (): DataContextValue => {
    const state = useContext(DataStateContext);
    const dispatch = useContext(DataDispatchContext);

    if (!state || !dispatch) {
        throw new Error('useData must be used within a DataProvider');
    }

    return useMemo(() => ({
        ...state,
        ...dispatch
    }), [state, dispatch]);
};

// Internal component that connects the disconnected providers
const DataProviderContent: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { settings } = useApp(); // Removed unused cars/updateCar/activeCar
    // const { activeCarId, cars, updateCar, activeCar } = useCar(); // Not needed here anymore

    // Consume new contexts
    const filterContext = useFiltersContext();
    const chargesContext = useChargesContext();
    const tripsContext = useTripsContext();
    const modalContext = useModalContext();
    const syncContext = useSyncContext();

    // Local State not covered by providers (UI transient state)
    const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
    const [selectedCharge, setSelectedCharge] = useState<Charge | null>(null);
    const [editingCharge, setEditingCharge] = useState<Charge | null>(null);
    const [legalInitialSection, setLegalInitialSection] = useState<string>('');

    // Confirmation
    const confirmation = useConfirmation({
        rawClearData: tripsContext.clearData,
        rawSaveToHistory: tripsContext.saveToHistory,
        rawClearHistory: tripsContext.clearHistory,
        rawLoadFromHistory: tripsContext.loadFromHistory,
        tripHistory: tripsContext.tripHistory
    });



    // Construct State Object (Memoized)
    const stateValue: DataState = useMemo(() => ({
        trips: tripsContext.rawTrips,
        filtered: tripsContext.filteredTrips,
        filteredTrips: tripsContext.filteredTrips,
        stats: tripsContext.stats,
        charges: chargesContext.charges,
        tripHistory: tripsContext.tripHistory,
        settings,
        googleSync: syncContext.googleSync,
        database: syncContext.database,
        modals: modalContext.modals,
        openModal: modalContext.openModal,
        closeModal: modalContext.closeModal,
        isAnyModalOpen: modalContext.isAnyModalOpen,
        fileHandling: syncContext.fileHandling,
        filterType: filterContext.filterType,
        selMonth: filterContext.selMonth,
        dateFrom: filterContext.dateFrom,
        dateTo: filterContext.dateTo,
        months: tripsContext.months,
        legalInitialSection,
        setLegalInitialSection,
        selectedTrip,
        setSelectedTrip,
        selectedCharge,
        setSelectedCharge,
        editingCharge,
        setEditingCharge,

        // AI
        aiScenarios: tripsContext.aiScenarios,
        aiLoss: tripsContext.aiLoss,
        isAiTraining: tripsContext.isAiTraining,
        aiSoH: tripsContext.aiSoH,
        aiSoHStats: tripsContext.aiSoHStats,
        predictDeparture: tripsContext.predictDeparture,
        findSmartChargingWindows: tripsContext.findSmartChargingWindows,
        forceRecalculate: tripsContext.forceRecalculate,

        acknowledgedAnomalies: tripsContext.acknowledgedAnomalies,
        setAcknowledgedAnomalies: tripsContext.setAcknowledgedAnomalies,
        deletedAnomalies: tripsContext.deletedAnomalies,
        setDeletedAnomalies: tripsContext.setDeletedAnomalies,

    }), [
        tripsContext, chargesContext, settings, syncContext, modalContext, filterContext,
        legalInitialSection, selectedTrip, selectedCharge, editingCharge
    ]);

    // Construct Dispatch Object
    const dispatchValue: DataDispatch = useMemo(() => ({
        setRawTrips: tripsContext.setRawTrips,
        replaceCharges: chargesContext.replaceCharges,

        // Charges Actions
        addCharge: chargesContext.addCharge,
        updateCharge: chargesContext.updateCharge,
        deleteCharge: chargesContext.deleteCharge,
        addMultipleCharges: chargesContext.addMultipleCharges,
        exportCharges: chargesContext.exportCharges,

        loadChargeRegistry: syncContext.loadChargeRegistry,

        clearData: confirmation?.clearData,
        saveToHistory: confirmation?.saveToHistory,
        loadFromHistory: confirmation?.loadFromHistory,
        clearHistory: confirmation?.clearHistory,

        confirmModalState: confirmation?.confirmModalState,
        closeConfirmation: confirmation?.closeConfirmation,
        showConfirmation: confirmation?.showConfirmation,

        loadFile: syncContext.loadFile,
        exportData: syncContext.exportData,

        setFilterType: filterContext.setFilterType,
        setSelMonth: filterContext.setSelMonth,
        setDateFrom: filterContext.setDateFrom,
        setDateTo: filterContext.setDateTo,

        openModal: modalContext.openModal,
        closeModal: modalContext.closeModal,
    }), [
        tripsContext, chargesContext, confirmation, syncContext, filterContext, modalContext
    ]);

    return (
        <DataDispatchContext.Provider value={dispatchValue}>
            <DataStateContext.Provider value={stateValue}>
                {children}
            </DataStateContext.Provider>
        </DataDispatchContext.Provider>
    );
};

// Main Helper that wraps everything
export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <ModalProvider>
            <FilterProvider>
                <ChargesProvider>
                    <TripsProvider>
                        <SyncProvider>
                            <DataProviderContent>
                                {children}
                            </DataProviderContent>
                        </SyncProvider>
                    </TripsProvider>
                </ChargesProvider>
            </FilterProvider>
        </ModalProvider>
    );
};
