/**
 * useAppOrchestrator Hook
 *
 * Thin wrapper that composes focused sub-hooks into a unified interface
 * for the main App component. Each sub-hook owns a single responsibility:
 *
 *  - useTabOrchestration   → tab navigation, swipe, chart dimensions
 *  - useDataOrchestration  → DB operations, import/export, view sub-states
 *  - useModalOrchestration → selection state, modal open/close, charge import
 *
 * Only the cross-cutting state that doesn't belong to any single domain
 * (layout, app version, raw charges for landing detection) is read here.
 */
import useAppVersion from '@hooks/useAppVersion';
import { useApp } from '@/context/AppContext';
import { useLayout } from '@/context/LayoutContext';
import { useData } from '@/providers/DataProvider';
import { useTabOrchestration } from '@hooks/useTabOrchestration';
import { useDataOrchestration } from '@hooks/useDataOrchestration';
import { useModalOrchestration } from '@hooks/useModalOrchestration';

export const useAppOrchestrator = () => {
    // Domain sub-hooks
    const tabs = useTabOrchestration();
    const dataOrc = useDataOrchestration();
    const modalOrc = useModalOrchestration();

    // Cross-cutting state not owned by any sub-hook
    const { settings, updateSettings } = useApp();
    const { layoutMode, isCompact, isVertical, isNative } = useLayout();
    const { version: appVersion } = useAppVersion();
    const { trips: rawTrips, stats: data, charges } = useData();

    // Derived
    const isLandingPage = rawTrips.length === 0 && charges.length === 0;
    const showAllTripsModal = dataOrc.modals.allTrips;
    const showAllChargesModal = dataOrc.modals.allCharges;

    return {
        // State flags
        loading: dataOrc.loading,
        error: dataOrc.error,
        sqlReady: dataOrc.sqlReady,
        isNative,
        isLandingPage,
        appVersion,

        // Render conditions
        showAllTripsModal,
        showAllChargesModal,

        // Data & Settings
        settings,
        updateSettings,
        data,
        rawTrips,
        charges,
        googleSync: dataOrc.googleSync,
        modals: dataOrc.modals,

        // View States
        layoutMode,
        isCompact,
        isVertical,
        backgroundLoad: dataOrc.backgroundLoad,

        // Navigation (from useTabOrchestration)
        activeTab: tabs.activeTab,
        tabs: tabs.tabs,
        handleTabClick: tabs.handleTabClick,
        isTransitioning: tabs.isTransitioning,
        fadingTab: tabs.fadingTab,
        setSwipeContainer: tabs.setSwipeContainer,
        chartDimensions: tabs.chartDimensions,

        // Actions (from useDataOrchestration)
        processDB: dataOrc.processDB,
        exportDatabase: dataOrc.exportDatabase,
        clearData: dataOrc.clearData,

        // Actions (from useModalOrchestration)
        openTripDetail: modalOrc.openTripDetail,
        handleChargeSelect: modalOrc.handleChargeSelect,
        loadChargeRegistry: modalOrc.loadChargeRegistry,

        // Refs & sub-view state (from useDataOrchestration)
        allTripsScrollRef: dataOrc.allTripsScrollRef,
        allChargesScrollRef: dataOrc.allChargesScrollRef,
        allTripsState: dataOrc.allTripsState,

        // Modal helpers (from useModalOrchestration)
        openModal: modalOrc.openModal,
        closeModal: modalOrc.closeModal,
        setLegalInitialSection: modalOrc.setLegalInitialSection,
        legalInitialSection: modalOrc.legalInitialSection,
        selectedTrip: modalOrc.selectedTrip,
        setSelectedTrip: modalOrc.setSelectedTrip,
        selectedCharge: modalOrc.selectedCharge,
        setSelectedCharge: modalOrc.setSelectedCharge,
    };
};
