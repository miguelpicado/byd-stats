import React, { createContext, useContext, useMemo, ReactNode, useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '@core/logger';
import { toast } from 'react-hot-toast';
import { useApp } from '@/context/AppContext';
import { useCar } from '@/context/CarContext';

// Import new providers
import { FilterProvider, useFiltersContext } from './FilterProvider';
import { ChargesProvider, useChargesContext } from './ChargesProvider';
import { ModalProvider, useModalContext } from './ModalProvider';
import { TripsProvider, useTripsContext } from './TripsProvider';

import { useDatabase } from '@hooks/useDatabase';
import { useGoogleSync } from '@hooks/useGoogleSync';
import { useFileHandling } from '@hooks/useFileHandling';
import { useConfirmation } from '@hooks/useConfirmation';
import { Trip, Charge, ProcessedData, Settings } from '@/types';
import { ModalsState } from '@hooks/useModalState';

// Define context interfaces (Legacy Support)
export interface DataState {
    trips: Trip[];
    filtered: Trip[];
    filteredTrips: Trip[];
    stats: ProcessedData | null;
    charges: Charge[];
    tripHistory: Trip[];
    settings: Settings;
    googleSync: any;
    database: any;
    modals: ModalsState;
    openModal: (modalName: keyof ModalsState, props?: any) => void;
    closeModal: (modalName: keyof ModalsState) => void;
    fileHandling: any;
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
    aiSoHStats: { points: any[]; trend: any[] } | null;
    predictDeparture: (startTime: number) => Promise<{ departureTime: number; duration: number } | null>;
    findSmartChargingWindows: (trips: Trip[], settings: Settings) => Promise<any>;
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
    loadFromHistory: (item: any) => void;
    clearHistory: () => void;

    confirmModalState: any;
    closeConfirmation: () => void;
    showConfirmation: (title: string, message: string, onConfirm: () => void, isDangerous?: boolean) => void;

    loadFile: (file: File, merge?: boolean) => Promise<void>;
    exportData: () => Promise<{ success: boolean; reason?: string }>;
    loadChargeRegistry: (file: File) => Promise<void>;

    addCharge: (charge: any) => any;
    updateCharge: (id: string, updates: any) => void;
    deleteCharge: (id: string) => void;
    addMultipleCharges: (charges: any[]) => number;
    exportCharges: () => boolean;

    setFilterType: (type: string) => void;
    setSelMonth: (month: string) => void;
    setDateFrom: (date: string) => void;
    setDateTo: (date: string) => void;

    openModal: (modalName: keyof ModalsState, props?: any) => void;
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
    const { t } = useTranslation();
    const { settings, updateSettings } = useApp();
    const { activeCarId, cars, updateCar, activeCar } = useCar();

    // Consume new contexts
    const filterContext = useFiltersContext();
    const chargesContext = useChargesContext();
    const tripsContext = useTripsContext();
    const modalContext = useModalContext();

    // Local State not covered by providers (UI transient state)
    const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
    const [selectedCharge, setSelectedCharge] = useState<Charge | null>(null);
    const [editingCharge, setEditingCharge] = useState<Charge | null>(null);
    const [legalInitialSection, setLegalInitialSection] = useState<string>('');

    // Database & File Handling
    const database = useDatabase();
    const fileHandling = useFileHandling();

    // Google Sync
    const googleSync = useGoogleSync({
        localTrips: tripsContext.rawTrips,
        setLocalTrips: tripsContext.setRawTrips,
        settings,
        setSettings: updateSettings,
        localCharges: chargesContext.charges,
        setLocalCharges: chargesContext.replaceCharges,
        activeCarId: activeCarId || '',
        totalCars: cars.length,
        openRegistryModal: modalContext.openRegistryModal,
        isRegistryModalOpen: modalContext.modals?.registryRestore,
        updateCar,
        carName: activeCar?.name || ''
    });

    // Confirmation
    const confirmation = useConfirmation({
        rawClearData: tripsContext.clearData,
        rawSaveToHistory: tripsContext.saveToHistory,
        rawClearHistory: tripsContext.clearHistory,
        rawLoadFromHistory: tripsContext.loadFromHistory,
        tripHistory: tripsContext.tripHistory
    });

    // Auto-Sync Effect
    useEffect(() => {
        if (!googleSync.isAuthenticated || googleSync.isSyncing) return;
        if (tripsContext.rawTrips?.length === 0 && chargesContext.charges?.length === 0) return;
        if (modalContext.modals?.registryRestore) return;

        const timer = setTimeout(() => {
            googleSync.syncNow(null);
        }, 10000);

        return () => clearTimeout(timer);
    }, [
        tripsContext.rawTrips?.length,
        chargesContext.charges?.length,
        settings,
        googleSync.isAuthenticated,
        modalContext.modals?.registryRestore
    ]);

    // File Loading
    const loadFile = useCallback(async (file: File, merge: boolean = false) => {
        try {
            if (!database.sqlReady) {
                await database.initSql();
            }
            const newTrips = await database.processDB(file, tripsContext.rawTrips, merge);
            if (newTrips && newTrips.length > 0) {
                tripsContext.setRawTrips(newTrips);
                logger.info(`Loaded ${newTrips.length} trips (merge: ${merge})`);
                if (googleSync.isAuthenticated) {
                    googleSync.syncNow(newTrips);
                }
            }
        } catch (error: any) {
            logger.error('Error loading file:', error);
            database.setError(error.message);
        }
    }, [database, tripsContext.rawTrips, tripsContext.setRawTrips, googleSync]);

    const exportData = useCallback(async () => {
        if (!database.sqlReady) {
            await database.initSql();
        }
        return database.exportDatabase(tripsContext.rawTrips);
    }, [database, tripsContext.rawTrips]);

    const loadChargeRegistry = useCallback(async (file: File) => {
        // ... (Logic copied from previous DataProvider, keeping it here as it uses toast/settings/charges)
        // Ideally this should move to a hook or util, but I'll keep it here for now to save time
        // Just need to update references to chargesContext

        try {
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim());

            if (lines.length < 2) {
                toast.error(t('errors.noDataFound'));
                return;
            }

            const chargesArray: any[] = [];
            const newChargerTypes: any[] = [];
            const existingChargerNames = new Set(
                (settings.chargerTypes || []).map(ct => ct.name.toLowerCase())
            );

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                const values = line.match(/("[^"]*"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim());

                if (!values || values.length < 8) continue;
                const [fechaHora, kmTotales, kwhFacturados, precioTotal, , tipoCargador, precioKw, porcentajeFinal] = values;

                if (!fechaHora || !fechaHora.match(/^\d{4}-\d{2}-\d{2}/)) break;

                const dateMatch = fechaHora.match(/(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2})/);
                if (!dateMatch) continue;

                const date = dateMatch[1];
                const time = dateMatch[2];

                let chargerTypeId: string | null = null;
                const chargerName = tipoCargador?.trim();

                if (chargerName) {
                    const existing = (settings.chargerTypes || []).find(
                        ct => ct.name.toLowerCase() === chargerName.toLowerCase()
                    );

                    if (existing) {
                        chargerTypeId = existing.id;
                    } else if (!existingChargerNames.has(chargerName.toLowerCase())) {
                        const newId = `csv_${Date.now()}_${i}`;
                        newChargerTypes.push({
                            id: newId,
                            name: chargerName,
                            speedKw: 11,
                            efficiency: 1
                        });
                        chargerTypeId = newId;
                        existingChargerNames.add(chargerName.toLowerCase());
                    } else {
                        chargerTypeId = newChargerTypes.find(
                            ct => ct.name.toLowerCase() === chargerName.toLowerCase()
                        )?.id || null;
                    }
                }

                chargesArray.push({
                    date,
                    time,
                    odometer: parseFloat(kmTotales) || 0,
                    kwhCharged: parseFloat(kwhFacturados) || 0,
                    totalCost: parseFloat(precioTotal) || 0,
                    chargerTypeId,
                    pricePerKwh: parseFloat(precioKw) || 0,
                    finalPercentage: parseFloat(porcentajeFinal) || 0
                });
            }

            if (newChargerTypes.length > 0) {
                const updatedChargerTypes = [...(settings.chargerTypes || []), ...newChargerTypes];
                updateSettings({ ...settings, chargerTypes: updatedChargerTypes });
            }

            if (chargesArray.length > 0) {
                const count = chargesContext.addMultipleCharges(chargesArray);
                let message = t('charges.chargesImported', { count });
                if (newChargerTypes.length > 0) {
                    message += '\n' + t('charges.chargerTypesCreated', {
                        types: newChargerTypes.map(ct => ct.name).join(', ')
                    });
                }
                toast.success(message);
                if (googleSync.isAuthenticated) {
                    googleSync.syncNow(null);
                }
            } else {
                toast.error(t('errors.noDataFound'));
            }
        } catch (error) {
            logger.error('Error loading charge registry:', error);
            toast.error(t('errors.processingFile') || 'Error processing file');
        }
    }, [settings, updateSettings, chargesContext, googleSync, t]);

    // Construct State Object (Memoized)
    const stateValue: DataState = useMemo(() => ({
        trips: tripsContext.rawTrips,
        filtered: tripsContext.filteredTrips,
        filteredTrips: tripsContext.filteredTrips,
        stats: tripsContext.stats,
        charges: chargesContext.charges,
        tripHistory: tripsContext.tripHistory,
        settings,
        googleSync: { ...googleSync },
        database,
        modals: modalContext.modals,
        openModal: modalContext.openModal,
        closeModal: modalContext.closeModal,
        isAnyModalOpen: modalContext.isAnyModalOpen,
        fileHandling,
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
        tripsContext, chargesContext, settings, googleSync, database, modalContext, fileHandling, filterContext,
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
        loadChargeRegistry,

        clearData: confirmation?.clearData,
        saveToHistory: confirmation?.saveToHistory,
        loadFromHistory: confirmation?.loadFromHistory,
        clearHistory: confirmation?.clearHistory,

        confirmModalState: confirmation?.confirmModalState,
        closeConfirmation: confirmation?.closeConfirmation,
        showConfirmation: confirmation?.showConfirmation,

        loadFile,
        exportData,

        setFilterType: filterContext.setFilterType,
        setSelMonth: filterContext.setSelMonth,
        setDateFrom: filterContext.setDateFrom,
        setDateTo: filterContext.setDateTo,

        openModal: modalContext.openModal,
        closeModal: modalContext.closeModal,
    }), [
        tripsContext, chargesContext, confirmation, loadFile, exportData, loadChargeRegistry, filterContext, modalContext
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
                        <DataProviderContent>
                            {children}
                        </DataProviderContent>
                    </TripsProvider>
                </ChargesProvider>
            </FilterProvider>
        </ModalProvider>
    );
};
