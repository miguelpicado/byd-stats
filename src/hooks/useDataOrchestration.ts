import { useState, useEffect, useCallback, useRef } from 'react';
import { useData } from '@/providers/DataProvider';
import { deduplicatedQuery } from '@services/firebase';
import { Trip } from '@/types';

/**
 * useDataOrchestration
 * Handles data loading, processing, import/export flows and DB operations.
 * Extracted from useAppOrchestrator for single-responsibility.
 */
export const useDataOrchestration = () => {
    const {
        trips: rawTrips,
        setRawTrips,
        clearData,
        database,
        googleSync,
        importSyncData,
        modals,
        openModal,
        closeModal,
    } = useData();

    const { sqlReady, loading, error, initSql, processDB: processDBHook, exportDatabase: exportDBHook } = database;

    const [backgroundLoad, setBackgroundLoad] = useState(false);

    // Initial load
    useEffect(() => {
        initSql();
        const timer = setTimeout(() => setBackgroundLoad(true), 1500);
        return () => clearTimeout(timer);
    }, [initSql]);

    const processDB = useCallback(async (file: File, merge = false) => {
        if (file.name.toLowerCase().endsWith('.json')) {
            const isSyncData = await database.isJsonSyncData(file);
            if (isSyncData) {
                await importSyncData(file, merge);
                closeModal('upload');
                closeModal('history');
                return;
            }
        }

        const trips = await processDBHook(file, merge ? rawTrips : [], merge);
        if (trips) {
            setRawTrips(trips);
            if (googleSync.isAuthenticated) {
                googleSync.syncNow(trips);
            }
            closeModal('upload');
            closeModal('history');
        }
    }, [database, importSyncData, processDBHook, rawTrips, googleSync, closeModal, setRawTrips]);

    const exportDatabase = useCallback(async (filtered: Parameters<typeof exportDBHook>[0]) => {
        return exportDBHook(filtered);
    }, [exportDBHook]);

    // All Trips View sub-state
    const [allTripsFilterType, setAllTripsFilterType] = useState('all');
    const [allTripsMonth, setAllTripsMonth] = useState('');
    const [allTripsDateFrom, setAllTripsDateFrom] = useState('');
    const [allTripsDateTo, setAllTripsDateTo] = useState('');
    const [allTripsSortBy, setAllTripsSortBy] = useState('date');
    const [allTripsSortOrder, setAllTripsSortOrder] = useState('desc');
    const allTripsScrollRef = useRef<null>(null);
    const allChargesScrollRef = useRef<null>(null);

    return {
        sqlReady, loading, error,
        rawTrips,
        backgroundLoad,
        processDB,
        exportDatabase,
        clearData,
        googleSync,
        modals,
        openModal,
        closeModal,
        allTripsScrollRef,
        allChargesScrollRef,
        allTripsState: {
            filterType: allTripsFilterType, setFilterType: setAllTripsFilterType,
            month: allTripsMonth, setMonth: setAllTripsMonth,
            dateFrom: allTripsDateFrom, setDateFrom: setAllTripsDateFrom,
            dateTo: allTripsDateTo, setDateTo: setAllTripsDateTo,
            sortBy: allTripsSortBy, setSortBy: setAllTripsSortBy,
            sortOrder: allTripsSortOrder, setSortOrder: setAllTripsSortOrder,
        },
    };
};

// Re-export deduplicatedQuery for convenience in other hooks/pages
export { deduplicatedQuery };
