import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import { logger } from '@core/logger';
import useAppVersion from '@hooks/useAppVersion';
import { useApp } from '@/context/AppContext';
import { useLayout } from '@/context/LayoutContext';
import { useData } from '@/providers/DataProvider';
import { useChartDimensions } from '@hooks/useChartDimensions';
import { useTabNavigation } from '@hooks/useTabNavigation';
import { useChargeImporter } from '@hooks/useChargeImporter';
import { useSwipeGesture } from '@hooks/useSwipeGesture';
import { Trip, Charge } from '@/types';

export const useAppOrchestrator = () => {
    const { t } = useTranslation();
    const isNative = Capacitor.isNativePlatform();

    // Contexts
    const { settings, updateSettings } = useApp();
    const { layoutMode, isCompact, isFullscreenBYD, isVertical } = useLayout();
    const { version: appVersion } = useAppVersion();

    // Data Context
    const {
        trips: rawTrips,
        stats: data,
        charges,

        // Actions
        setRawTrips,
        replaceCharges,
        addCharge,
        deleteCharge,
        clearData,

        // Sub-Contexts
        database,
        googleSync,
        filtered, // { trips, stats }

        // Modal State (Global)
        modals,
        openModal,
        closeModal,
        setLegalInitialSection,
        legalInitialSection,
        isAnyModalOpen,

        // Selection State
        selectedTrip,
        setSelectedTrip,
        selectedCharge,
        setSelectedCharge,
        setEditingCharge
    } = useData();

    const { sqlReady, loading, error, initSql, processDB: processDBHook, exportDatabase: exportDBHook } = database;

    // View State (Local to orchestrator, lifting up from App.jsx)
    const [backgroundLoad, setBackgroundLoad] = useState(false);

    // All Trips View State
    const [allTripsFilterType, setAllTripsFilterType] = useState('all');
    const [allTripsMonth, setAllTripsMonth] = useState('');
    const [allTripsDateFrom, setAllTripsDateFrom] = useState('');
    const [allTripsDateTo, setAllTripsDateTo] = useState('');
    const [allTripsSortBy, setAllTripsSortBy] = useState('date');
    const [allTripsSortOrder, setAllTripsSortOrder] = useState('desc');
    const allTripsScrollRef = useRef(null);

    // All Charges View State
    const [allChargesFilterType, setAllChargesFilterType] = useState('all');
    const [allChargesMonth, setAllChargesMonth] = useState('');
    const [allChargesDateFrom, setAllChargesDateFrom] = useState('');
    const [allChargesDateTo, setAllChargesDateTo] = useState('');
    const [allChargesSortBy, setAllChargesSortBy] = useState('date');
    const [allChargesSortOrder, setAllChargesSortOrder] = useState('desc');
    const allChargesScrollRef = useRef(null);

    // Initial load effect
    useEffect(() => {
        initSql();
        const timer = setTimeout(() => {
            setBackgroundLoad(true);
        }, 1500);
        return () => clearTimeout(timer);
    }, [initSql]);

    // Derived Logic
    const showAllTripsModal = modals.allTrips;
    const showAllChargesModal = modals.allCharges;
    const isLandingPage = rawTrips.length === 0 && charges.length === 0;

    // Handlers
    const processDB = useCallback(async (file: File, merge = false) => {
        const trips = await processDBHook(file, merge ? rawTrips : [], merge);
        if (trips) {
            setRawTrips(trips);
            if (googleSync.isAuthenticated) {
                googleSync.syncNow(trips);
            }
            closeModal('upload');
            closeModal('history');
        }
    }, [processDBHook, rawTrips, googleSync, closeModal, setRawTrips]);

    const exportDatabase = useCallback(async () => {
        const success = await exportDBHook(filtered);
        if (success) alert(t('confirmations.dbExported'));
    }, [exportDBHook, filtered, t]);

    const handleChargeSelect = useCallback((charge: Charge) => {
        setSelectedCharge(charge);
        openModal('chargeDetail');
    }, [openModal, setSelectedCharge]);

    const openTripDetail = useCallback((trip: Trip) => {
        setSelectedTrip(trip);
        openModal('tripDetail'); // Using openModal instead of local state
    }, [openModal, setSelectedTrip]);

    const { loadChargeRegistry } = useChargeImporter();

    // Tab Navigation
    const {
        activeTab,
        fadingTab,
        isTransitioning,
        handleTabClick,
        tabs
    } = useTabNavigation({ settings });

    // Swipe Gesture
    const setSwipeContainer = useSwipeGesture({
        activeTab,
        handleTabClick,
        isTransitioning,
        tabs,
        layoutMode,
        isModalOpen: isAnyModalOpen
    });

    // Chart Dimensions (pass through)
    const chartDimensions = useChartDimensions({ isVertical, isFullscreenBYD, isCompact });


    return {
        // State
        loading,
        error,
        sqlReady,
        isNative,
        isLandingPage,
        appVersion,

        // Render Conditions
        showAllTripsModal,
        showAllChargesModal,

        // Data & Settings
        settings,
        updateSettings,
        data,
        rawTrips,
        charges,
        googleSync,
        modals,

        // View States
        layoutMode,
        isCompact,
        backgroundLoad,
        isVertical,

        // Navigation
        activeTab,
        tabs,
        handleTabClick,
        isTransitioning,
        fadingTab,
        setSwipeContainer,

        // Actions
        processDB,
        exportDatabase,
        clearData,
        loadChargeRegistry,
        openTripDetail,
        handleChargeSelect,

        // Refs
        allTripsScrollRef,
        allChargesScrollRef,

        // Sub-view States (All Trips/Charges)
        allTripsState: {
            filterType: allTripsFilterType, setFilterType: setAllTripsFilterType,
            month: allTripsMonth, setMonth: setAllTripsMonth,
            dateFrom: allTripsDateFrom, setDateFrom: setAllTripsDateFrom,
            dateTo: allTripsDateTo, setDateTo: setAllTripsDateTo,
            sortBy: allTripsSortBy, setSortBy: setAllTripsSortBy,
            sortOrder: allTripsSortOrder, setSortOrder: setAllTripsSortOrder
        },
        allChargesState: {
            filterType: allChargesFilterType, setFilterType: setAllChargesFilterType,
            month: allChargesMonth, setMonth: setAllChargesMonth,
            dateFrom: allChargesDateFrom, setDateFrom: setAllChargesDateFrom,
            dateTo: allChargesDateTo, setDateTo: setAllChargesDateTo,
            sortBy: allChargesSortBy, setSortBy: setAllChargesSortBy,
            sortOrder: allChargesSortOrder, setSortOrder: setAllChargesSortOrder
        },

        // Modal Helpers
        openModal,
        closeModal,
        setLegalInitialSection,
        legalInitialSection,
        selectedTrip,
        setSelectedTrip,
        selectedCharge,
        setSelectedCharge,

        // Chart Dimensions
        chartDimensions
    };
};
