import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
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

import useModalState from '@hooks/useModalState';

// Split contexts for performance optimization (M2)
const DataStateContext = createContext();
const DataDispatchContext = createContext();

// Hook for accessing data state (trips, stats, charges, etc.)
export const useDataState = () => {
    const context = useContext(DataStateContext);
    if (!context) {
        throw new Error('useDataState must be used within a DataProvider');
    }
    return context;
};

// Hook for accessing data actions (loadFile, save, clear, etc.)
export const useDataDispatch = () => {
    const context = useContext(DataDispatchContext);
    if (!context) {
        throw new Error('useDataDispatch must be used within a DataProvider');
    }
    return context;
};

// Legacy unified hook for backward compatibility
export const useData = () => {
    const state = useContext(DataStateContext);
    const dispatch = useContext(DataDispatchContext);

    if (!state || !dispatch) {
        throw new Error('useData must be used within a DataProvider');
    }

    // Merge both for the original API surface
    return useMemo(() => ({
        ...state,
        ...dispatch
    }), [state, dispatch]);
};

export const DataProvider = ({ children }) => {
    const { t } = useTranslation();
    const { settings, updateSettings } = useApp();
    const { activeCarId, cars, updateCar, activeCar } = useCar();

    // 1. Charges Data
    const chargesData = useChargesData(activeCarId);

    // Defensive destructuring for charges
    const charges = chargesData?.charges || [];
    const replaceCharges = chargesData?.replaceCharges || (() => { });
    // restChargesData might contain other state or functions, usually just helpers. 
    // We assume mostly functions if not 'charges'.
    const { charges: _c, replaceCharges: _rc, ...restChargesData } = chargesData || {};

    // 2. Core App Data
    const appData = useAppData(settings, charges, activeCarId);

    // Defensive destructuring for appData
    const safeAppData = appData || {};
    const rawTrips = safeAppData.rawTrips || [];
    const setRawTrips = safeAppData.setRawTrips || (() => { });
    const tripHistory = safeAppData.tripHistory || [];
    const filtered = safeAppData.filtered || [];
    const data = safeAppData.data || null;

    // Extract raw actions for internal use by confirmation hook
    const rawClearData = safeAppData.clearData || (() => { });
    const rawSaveToHistory = safeAppData.saveToHistory || (() => { });
    const rawClearHistory = safeAppData.clearHistory || (() => { });
    const rawLoadFromHistory = safeAppData.loadFromHistory || (() => { });

    // Filter State & Setters from useAppData
    const {
        filterType, setFilterType,
        selMonth, setSelMonth,
        dateFrom, setDateFrom,
        dateTo, setDateTo,
        months
    } = safeAppData;

    // 3. Database Layer
    const database = useDatabase();

    // 4. Confirmation Dialogs
    // Must pass the raw actions to the hook
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
    const googleSync = useGoogleSync(
        rawTrips,
        setRawTrips,
        settings,
        updateSettings,
        charges,
        replaceCharges,
        activeCarId,
        cars.length,
        modalState?.openRegistryModal,
        modalState?.modals?.registryRestore,
        modalState?.modals?.registryRestore,
        updateCar,
        activeCar?.name // Pass current car name for backup
    );

    // 8. Auto-Sync Effect
    useEffect(() => {
        if (!googleSync.isAuthenticated || googleSync.isSyncing) return;
        if (rawTrips?.length === 0 && charges?.length === 0) return;
        if (modalState?.modals?.registryRestore) return;

        const timer = setTimeout(() => {
            googleSync.syncNow();
        }, 10000);

        return () => clearTimeout(timer);
    }, [rawTrips?.length, charges?.length, settings, googleSync.isAuthenticated, modalState?.modals?.registryRestore]);

    // 9. File Loading Functions
    const loadFile = useCallback(async (file, merge = false) => {
        try {
            if (!database.sqlReady) {
                await database.initSql();
            }
            const newTrips = await database.processDB(file, rawTrips, merge);
            if (newTrips && newTrips.length > 0) {
                setRawTrips(newTrips);
                logger.info(`Loaded ${newTrips.length} trips (merge: ${merge})`);
                if (googleSync.isAuthenticated) {
                    googleSync.syncNow(newTrips, { checkData: !merge });
                }
            }
        } catch (error) {
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

    const loadChargeRegistry = useCallback(async (file) => {
        try {
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim());

            if (lines.length < 2) {
                toast.error(t('errors.noDataFound'));
                return;
            }

            const chargesArray = [];
            const newChargerTypes = [];
            const existingChargerNames = new Set(
                (settings.chargerTypes || []).map(ct => ct.name.toLowerCase())
            );

            // Parse each line (skip header)
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                // Parse CSV respecting quoted fields
                const values = line.match(/("[^"]*"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim());

                if (!values || values.length < 8) continue;

                const [fechaHora, kmTotales, kwhFacturados, precioTotal, , tipoCargador, precioKw, porcentajeFinal] = values;

                // Validate date format - stop if we hit non-charge data
                if (!fechaHora || !fechaHora.match(/^\d{4}-\d{2}-\d{2}/)) {
                    break;
                }

                // Parse date and time
                const dateMatch = fechaHora.match(/(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2})/);
                if (!dateMatch) continue;

                const date = dateMatch[1];
                const time = dateMatch[2];

                // Find or create charger type
                let chargerTypeId = null;
                const chargerName = tipoCargador?.trim();

                if (chargerName) {
                    const existing = (settings.chargerTypes || []).find(
                        ct => ct.name.toLowerCase() === chargerName.toLowerCase()
                    );

                    if (existing) {
                        chargerTypeId = existing.id;
                    } else if (!existingChargerNames.has(chargerName.toLowerCase())) {
                        // Create new charger type
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
                        // Already queued for creation
                        chargerTypeId = newChargerTypes.find(
                            ct => ct.name.toLowerCase() === chargerName.toLowerCase()
                        )?.id;
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

            // Add new charger types to settings
            if (newChargerTypes.length > 0) {
                const updatedChargerTypes = [...(settings.chargerTypes || []), ...newChargerTypes];
                updateSettings({ ...settings, chargerTypes: updatedChargerTypes });
            }

            // Import charges
            if (chargesArray.length > 0) {
                const count = chargesData.addMultipleCharges(chargesArray);

                // Show success message
                let message = t('charges.chargesImported', { count });
                if (newChargerTypes.length > 0) {
                    message += '\n' + t('charges.chargerTypesCreated', {
                        types: newChargerTypes.map(ct => ct.name).join(', ')
                    });
                }
                toast.success(message);

                // Auto-sync after import
                if (googleSync.isAuthenticated) {
                    googleSync.syncNow();
                }
            } else {
                toast.error(t('errors.noDataFound'));
            }
        } catch (error) {
            logger.error('Error loading charge registry:', error);
            toast.error(t('errors.processingFile') || 'Error processing file');
        }
    }, [settings, updateSettings, chargesData, googleSync, t]);


    // --- Context Values Construction ---

    // State Value
    const stateValue = useMemo(() => ({
        trips: rawTrips,
        filtered,
        filteredTrips: filtered,
        stats: data,
        charges,
        tripHistory,
        // Spread the parts of appData that are state, not functions
        // Excluding direct function references (we'll capture them in dispatch)
        // However, useAppData returns a mixed bag. For safety, we include everything in state
        // that isn't explicitly an action we moved to dispatch, OR we can accept some duplication.
        // For strict M2 optimization, we should ideally separate them, but safely:
        settings, // from AppContext
        googleSync: {
            ...googleSync,
            // Optimization: googleSync has methods like syncNow. 
            // Ideally should be in dispatch, but it's an object property.
            // Keeping it here for now as it contains state like isSyncing.
        },
        database, // contains error, sqlReady state
        ...modalState, // modals, etc.
        settings, // from AppContext
        googleSync: {
            ...googleSync,
        },
        database, // contains error, sqlReady state
        ...modalState, // modals, etc.
        fileHandling,

        // Filter State
        filterType, selMonth, dateFrom, dateTo, months
    }), [
        rawTrips, filtered, data, charges, tripHistory,
        settings, googleSync, database, modalState, fileHandling,
        filterType, selMonth, dateFrom, dateTo, months
    ]);

    // Dispatch Value (Actions)
    const dispatchValue = useMemo(() => ({
        setRawTrips,
        replaceCharges,
        ...restChargesData, // helpers from useChargesData

        // Actions from useAppData
        clearData: confirmation?.clearData,
        saveToHistory: confirmation?.saveToHistory,
        loadFromHistory: confirmation?.loadFromHistory,
        clearHistory: confirmation?.clearHistory,

        // Modal actions
        confirmModalState: confirmation?.confirmModalState,
        closeConfirmation: confirmation?.closeConfirmation,
        showConfirmation: confirmation?.showConfirmation,

        // File actions
        loadFile,
        exportData,
        loadChargeRegistry,

        // Modal actions
        confirmModalState: confirmation?.confirmModalState,
        closeConfirmation: confirmation?.closeConfirmation,
        showConfirmation: confirmation?.showConfirmation,

        // File actions
        loadFile,
        exportData,
        loadChargeRegistry,

        // Filter Actions
        setFilterType,
        setSelMonth,
        setDateFrom,
        setDateTo,

        // Modal State Actions
        openModal: modalState.openModal,
        closeModal: modalState.closeModal,
        // ... any other functions from modalState? check hook.
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
