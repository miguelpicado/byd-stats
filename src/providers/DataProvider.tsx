import React, { createContext, useContext, useMemo, ReactNode, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '@core/logger';
import { toast } from 'react-hot-toast';
import { useApp } from '@/context/AppContext';
import useAppData from '@hooks/useAppData';
import { useDatabase } from '@hooks/useDatabase';
import useChargesData from '@hooks/useChargesData';
import { useGoogleSync } from '@hooks/useGoogleSync';
import { useFileHandling } from '@hooks/useFileHandling';
import { useConfirmation } from '@hooks/useConfirmation';
import { useCar } from '@/context/CarContext';
import useModalState, { ModalsState } from '@hooks/useModalState';
import { Trip, Charge, ProcessedData, Settings } from '@/types';

// Define context interfaces
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

    // ... other state
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

// Union type for legacy useData
export type DataContextValue = DataState & DataDispatch;

const DataStateContext = createContext<DataState | undefined>(undefined);
const DataDispatchContext = createContext<DataDispatch | undefined>(undefined);

export const useDataState = (): DataState => {
    const context = useContext(DataStateContext);
    if (!context) {
        throw new Error('useDataState must be used within a DataProvider');
    }
    return context;
};

export const useDataDispatch = (): DataDispatch => {
    const context = useContext(DataDispatchContext);
    if (!context) {
        throw new Error('useDataDispatch must be used within a DataProvider');
    }
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

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { t } = useTranslation();
    const { settings, updateSettings } = useApp();
    const { activeCarId, cars, updateCar, activeCar } = useCar();

    // 1. Charges Data
    const chargesData = useChargesData(activeCarId);

    const charges = chargesData.charges || [];
    const replaceCharges = chargesData.replaceCharges;
    const { charges: _c, replaceCharges: _rc, ...restChargesData } = chargesData;

    // 2. Core App Data
    const appData = useAppData(settings, charges, activeCarId);

    const rawTrips = appData.rawTrips || [];
    const setRawTrips = appData.setRawTrips;
    const tripHistory = appData.tripHistory || [];
    const filtered = appData.filtered || []; // This is Trip[] based on usage
    const data = appData.data || null;

    const rawClearData = appData.clearData;
    const rawSaveToHistory = appData.saveToHistory;
    const rawClearHistory = appData.clearHistory;
    const rawLoadFromHistory = appData.loadFromHistory;

    // AI Data from useProcessedData (via appData)
    const aiScenarios = appData.aiScenarios || [];
    const aiLoss = appData.aiLoss || null;
    const isAiTraining = appData.isAiTraining || false;
    const aiSoH = appData.aiSoH || null;
    const aiSoHStats = appData.aiSoHStats || null;

    const {
        filterType, setFilterType,
        selMonth, setSelMonth,
        dateFrom, setDateFrom,
        dateTo, setDateTo,
        months
    } = appData;

    // 3. Database Layer
    const database = useDatabase();

    // 4. Confirmation Dialogs
    const confirmation = useConfirmation({
        rawClearData,
        rawSaveToHistory,
        rawClearHistory,
        rawLoadFromHistory,
        tripHistory
    });

    // 5. File Handling
    const fileHandling = useFileHandling();

    // 6. Global Modal State
    const modalState = useModalState();

    // 7. Google Sync
    const googleSync = useGoogleSync({
        localTrips: rawTrips,
        setLocalTrips: setRawTrips,
        settings,
        setSettings: updateSettings,
        localCharges: charges,
        setLocalCharges: replaceCharges,
        activeCarId: activeCarId || '',
        totalCars: cars.length,
        openRegistryModal: modalState?.openRegistryModal,
        isRegistryModalOpen: modalState?.modals?.registryRestore,
        updateCar,
        carName: activeCar?.name || ''
    });

    // 8. Auto-Sync Effect
    useEffect(() => {
        if (!googleSync.isAuthenticated || googleSync.isSyncing) return;
        if (rawTrips?.length === 0 && charges?.length === 0) return;
        if (modalState?.modals?.registryRestore) return;

        const timer = setTimeout(() => {
            googleSync.syncNow(null);
        }, 10000);

        return () => clearTimeout(timer);
    }, [rawTrips?.length, charges?.length, settings, googleSync.isAuthenticated, modalState?.modals?.registryRestore]);

    // 9. File Loading Functions
    const loadFile = useCallback(async (file: File, merge: boolean = false) => {
        try {
            if (!database.sqlReady) {
                await database.initSql();
            }
            const newTrips = await database.processDB(file, rawTrips, merge);
            if (newTrips && newTrips.length > 0) {
                setRawTrips(newTrips);
                logger.info(`Loaded ${newTrips.length} trips (merge: ${merge})`);
                if (googleSync.isAuthenticated) {
                    googleSync.syncNow(newTrips);
                }
            }
        } catch (error: any) {
            logger.error('Error loading file:', error);
            database.setError(error.message);
        }
    }, [database, rawTrips, setRawTrips, googleSync]);

    const exportData = useCallback(async () => {
        if (!database.sqlReady) {
            await database.initSql();
        }
        return database.exportDatabase(rawTrips);
    }, [database, rawTrips]);

    const loadChargeRegistry = useCallback(async (file: File) => {
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

            // Parse each line (skip header)
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                const values = line.match(/("[^"]*"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim());

                if (!values || values.length < 8) continue;

                const [fechaHora, kmTotales, kwhFacturados, precioTotal, , tipoCargador, precioKw, porcentajeFinal] = values;

                if (!fechaHora || !fechaHora.match(/^\d{4}-\d{2}-\d{2}/)) {
                    break;
                }

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
                const count = chargesData.addMultipleCharges(chargesArray);

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
    }, [settings, updateSettings, chargesData, googleSync, t]);

    // State Value
    const stateValue: DataState = useMemo(() => ({
        trips: rawTrips,
        filtered: filtered,
        filteredTrips: filtered,
        stats: data,
        charges,
        tripHistory,
        settings,
        googleSync: {
            ...googleSync,
        },
        database,
        ...modalState, // Spread remaining modal state
        fileHandling,
        filterType, selMonth, dateFrom, dateTo, months,
        aiScenarios, aiLoss, aiSoH, aiSoHStats, isAiTraining
    }), [
        rawTrips, filtered, data, charges, tripHistory,
        settings, googleSync, database, modalState, fileHandling,
        filterType, selMonth, dateFrom, dateTo, months,
        aiScenarios, aiLoss, aiSoH, aiSoHStats, isAiTraining
    ]);

    // Dispatch Value
    const dispatchValue: DataDispatch = useMemo(() => ({
        setRawTrips,
        replaceCharges,
        ...restChargesData,

        clearData: confirmation?.clearData,
        saveToHistory: confirmation?.saveToHistory,
        loadFromHistory: confirmation?.loadFromHistory,
        clearHistory: confirmation?.clearHistory,

        confirmModalState: confirmation?.confirmModalState,
        closeConfirmation: confirmation?.closeConfirmation,
        showConfirmation: confirmation?.showConfirmation,

        loadFile,
        exportData,
        loadChargeRegistry,

        setFilterType,
        setSelMonth,
        setDateFrom,
        setDateTo,

        openModal: modalState.openModal,
        closeModal: modalState.closeModal,
    }), [
        setRawTrips, replaceCharges, restChargesData,
        confirmation,
        loadFile, exportData, loadChargeRegistry,
        setFilterType, setSelMonth, setDateFrom, setDateTo,
        modalState.openModal, modalState.closeModal
    ]);

    return (
        <DataDispatchContext.Provider value={dispatchValue}>
            <DataStateContext.Provider value={stateValue}>
                {children}
            </DataStateContext.Provider>
        </DataDispatchContext.Provider>
    );
};
