import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { logger } from '../utils/logger';
import { useApp } from '../context/AppContext';
import useAppData from '../hooks/useAppData';
import { useDatabase } from '../hooks/useDatabase';
import useChargesData from '../hooks/useChargesData';
import { useGoogleSync } from '../hooks/useGoogleSync';
import { useFileHandling } from '../hooks/useFileHandling';
import { useConfirmation } from '../hooks/useConfirmation';
import useModalState from '../hooks/useModalState';

const DataContext = createContext();

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};

export const DataProvider = ({ children }) => {
    const { settings, updateSettings } = useApp();

    // 1. Core App Data (Trips, Filtering, Stats history)
    const appData = useAppData();
    const {
        rawTrips,
        setRawTrips,
        tripHistory,
        filtered, // { filteredTrips, stats, ... }
        data, // data object with stats
        clearData: rawClearData,
        saveToHistory: rawSaveToHistory,
        clearHistory: rawClearHistory,
        loadFromHistory: rawLoadFromHistory,
        ...restAppData
    } = appData;

    // 2. Charges Data
    const chargesData = useChargesData();
    const {
        charges,
        replaceCharges,
        ...restChargesData
    } = chargesData;

    // 3. Confirmation Logic (wraps data actions)
    const confirmation = useConfirmation({
        rawClearData,
        rawSaveToHistory,
        rawClearHistory,
        rawLoadFromHistory,
        tripHistory
    });

    // 4. Database (SQL.js)
    const database = useDatabase();

    // 5. File Handling (Import/Export/Share)
    const fileHandling = useFileHandling();

    // 6. Google Sync (Side Effects & Cloud Sync)
    // Needs access to state setters to update local data from cloud
    const googleSync = useGoogleSync(
        rawTrips,
        setRawTrips,
        settings,
        updateSettings,
        charges,
        replaceCharges
    );

    // 7. Global Modal State
    const modalState = useModalState();

    // Bundle the value
    const value = {
        // Data State
        trips: rawTrips,
        filtered: filtered, // The filtered array of trips
        filteredTrips: filtered, // Alias for compatibility if needed
        stats: data, // aggregated stats
        charges,
        tripHistory,
        setRawTrips,

        // App Data Actions & State (filtering, dates, etc)
        ...restAppData,

        // Charges Actions
        replaceCharges, // needed for sync/restore
        ...restChargesData,

        // Safe Actions (Wrapped with Confirmation)
        clearData: confirmation.clearData,
        saveToHistory: confirmation.saveToHistory,
        loadFromHistory: confirmation.loadFromHistory,
        clearHistory: confirmation.clearHistory,

        // Confirmation Modal Interface (for UI to render)
        confirmModalState: confirmation.confirmModalState,
        closeConfirmation: confirmation.closeConfirmation,
        showConfirmation: confirmation.showConfirmation,

        // Database & File Interface
        database, // { sqlReady, exportDatabase, ... }
        fileHandling, // { pendingFile, readFile ... }

        // Sync Interface
        googleSync, // { isSyncing, lastSync, ... }

        // UI State (Modals)
        ...modalState,
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};
