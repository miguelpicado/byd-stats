/**
 * useAppState
 *
 * Pure context aggregation hook — reads all contexts and returns a unified state
 * object with no derived logic or side effects beyond simple derivations.
 * Consumed by the orchestration sub-hooks.
 */
import { useTranslation } from 'react-i18next';
import useAppVersion from '@hooks/useAppVersion';
import { useApp } from '@/context/AppContext';
import { useLayout } from '@/context/LayoutContext';
import { useData } from '@/providers/DataProvider';

export const useAppState = () => {
    const { t } = useTranslation();

    const { settings, updateSettings } = useApp();
    const { layoutMode, isCompact, isFullscreenBYD, isVertical, isNative } = useLayout();
    const { version: appVersion } = useAppVersion();

    const {
        trips: rawTrips,
        stats: data,
        charges,
        setRawTrips,
        clearData,
        database,
        googleSync,
        filtered,
        importSyncData,
        modals,
        openModal,
        closeModal,
        setLegalInitialSection,
        legalInitialSection,
        isAnyModalOpen,
        selectedTrip,
        setSelectedTrip,
        selectedCharge,
        setSelectedCharge,
    } = useData();

    const { sqlReady, loading, error, initSql, processDB: processDBHook, exportDatabase: exportDBHook } = database;

    const isLandingPage = rawTrips.length === 0 && charges.length === 0;
    const showAllTripsModal = modals.allTrips;
    const showAllChargesModal = modals.allCharges;

    return {
        t,
        settings,
        updateSettings,
        layoutMode,
        isCompact,
        isFullscreenBYD,
        isVertical,
        isNative,
        appVersion,
        rawTrips,
        data,
        charges,
        setRawTrips,
        clearData,
        database,
        googleSync,
        filtered,
        importSyncData,
        modals,
        openModal,
        closeModal,
        setLegalInitialSection,
        legalInitialSection,
        isAnyModalOpen,
        selectedTrip,
        setSelectedTrip,
        selectedCharge,
        setSelectedCharge,
        sqlReady,
        loading,
        error,
        initSql,
        processDBHook,
        exportDBHook,
        isLandingPage,
        showAllTripsModal,
        showAllChargesModal,
    };
};

export type AppState = ReturnType<typeof useAppState>;
