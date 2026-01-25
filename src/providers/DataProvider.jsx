import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
    const { settings, updateSettings } = useApp();

    // 1. Charges Data (Moved up to be available for AppData dynamic pricing)
    const chargesData = useChargesData();
    const {
        charges,
        replaceCharges,
        ...restChargesData
    } = chargesData;

    // 2. Core App Data (Trips, Filtering, Stats history)
    const appData = useAppData(settings, charges);
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

    // 8. File Loading Functions
    // Load file (database .db) and optionally merge with existing trips
    const loadFile = useCallback(async (file, merge = false) => {
        try {
            // Initialize SQL.js if not ready
            if (!database.sqlReady) {
                await database.initSql();
            }

            // Process the database file
            const newTrips = await database.processDB(file, rawTrips, merge);

            if (newTrips && newTrips.length > 0) {
                setRawTrips(newTrips);
                logger.info(`Loaded ${newTrips.length} trips (merge: ${merge})`);

                // Auto-sync after import if authenticated
                // IMPORTANT: Pass newTrips explicitly because React state update is async
                // If replacing data (merge=false), forcing conflict check to allow user to choose source
                if (googleSync.isAuthenticated) {
                    googleSync.syncNow(newTrips, { checkData: !merge });
                }
            }
        } catch (error) {
            logger.error('Error loading file:', error);
            database.setError(error.message);
        }
    }, [database, rawTrips, setRawTrips, googleSync]);

    // Export trips to .db file
    const exportData = useCallback(async () => {
        if (!database.sqlReady) {
            await database.initSql();
        }
        return database.exportDatabase(rawTrips);
    }, [database, rawTrips]);

    // Load charge registry from CSV file
    const loadChargeRegistry = useCallback(async (file) => {
        try {
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim());

            if (lines.length < 2) {
                alert(t('errors.noDataFound'));
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
                alert(message);

                // Auto-sync after import
                if (googleSync.isAuthenticated) {
                    googleSync.syncNow();
                }
            } else {
                alert(t('errors.noDataFound'));
            }
        } catch (error) {
            logger.error('Error loading charge registry:', error);
            alert(t('errors.processingFile') || 'Error processing file');
        }
    }, [settings, updateSettings, chargesData, googleSync, t]);

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
        loadFile, // Load .db file and optionally merge trips
        exportData, // Export trips to .db file
        loadChargeRegistry, // Load charges from CSV file
        exportCharges, // Export charges to CSV file

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
