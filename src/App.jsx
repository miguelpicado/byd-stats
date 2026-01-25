import React, { useState, useCallback, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';


import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { formatMonth } from './utils/dateUtils';

import { logger } from './utils/logger';
import { STORAGE_KEY, TRIP_HISTORY_KEY, TAB_PADDING, COMPACT_TAB_PADDING, COMPACT_SPACE_Y } from './utils/constants';
import './utils/chartSetup'; // Register Chart.js components

import { Toaster, toast } from 'react-hot-toast';

// Components
import { Zap, Clock, TrendingUp, Activity, BarChart3, Filter, Settings, Database, HelpCircle, GitHub, Maximize, Minimize, Shield, FileText, List, Battery, BYD_RED } from './components/Icons.jsx';
import useModalState from './hooks/useModalState';
import useAppVersion from './hooks/useAppVersion'; // Default export
import { useApp } from './context/AppContext';
import { useLayout } from './context/LayoutContext';
import { useData } from './providers/DataProvider';
import VirtualizedTripList from './components/lists/VirtualizedTripList';
import VirtualizedChargeList from './components/lists/VirtualizedChargeList';

// New Extracted Hooks
import { useChartDimensions } from './hooks/useChartDimensions';
import { useTabNavigation } from './hooks/useTabNavigation';
import { useChargeImporter } from './hooks/useChargeImporter';

// Lazy load modals for code splitting
const LandingPageLazy = lazy(() => import('./pages/LandingPage'));
const PWAManagerLazy = lazy(() => import('./components/PWAManager'));

import ModalCoordinator from './components/common/ModalCoordinator';
import MainLayout from './components/layout/MainLayout';
// New Feature Components
import Header from './features/navigation/Header';
import TabNavigation from './features/navigation/TabNavigation';
import DashboardLayout from './features/dashboard/DashboardLayout';
import DesktopSidebar from './components/layout/DesktopSidebar'; // Restored

import ErrorBoundary from './components/common/ErrorBoundary';
import { useSwipeGesture } from './hooks/useSwipeGesture';
// Lazy load heavy views to optimize bundle size
const AllTripsViewLazy = lazy(() => import('./features/dashboard/AllTripsView'));
const AllChargesViewLazy = lazy(() => import('./features/dashboard/AllChargesView'));

// Helper to determine if a tab should have fade-in animation
// Removed: getTabClassName moved to TabsManager


const GitHubFooter = React.memo(() => (
  <div className="flex justify-center pb-6 pt-2">
    <a
      href="https://github.com/miguelpicado/byd-stats"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-xs"
    >
      <GitHub className="w-4 h-4" />
      <span>View source on GitHub</span>
    </a>
  </div>
));

GitHubFooter.displayName = 'GitHubFooter';

export default function BYDStatsAnalyzer() {
  const { t } = useTranslation();

  // Confirmation Modal Logic (Extracted Hook)
  // Logic will be initialized after useAppData


  // Data Management via DataProvider
  const {
    // Data State
    trips: rawTrips,
    stats: data,
    charges,
    tripHistory,

    // Filtering State
    filterType,
    setFilterType,
    selMonth,
    setSelMonth,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    months,
    filtered, // { trips, stats }

    // Actions (Direct Setters)
    setRawTrips,
    replaceCharges,
    addCharge,
    addMultipleCharges,
    deleteCharge,

    // Safe Actions
    clearData,
    saveToHistory,
    clearHistory,
    loadFromHistory,

    // Sub-Contexts
    database,
    fileHandling,
    googleSync,

    // Confirmation UI State
    confirmModalState,
    closeConfirmation,
    showConfirmation,

    // Selected items for detail modals (from useModalState via DataProvider)
    selectedTrip,
    setSelectedTrip,
    selectedCharge,
    setSelectedCharge,
    editingCharge,
    setEditingCharge
  } = useData();

  // Destructure sub-contexts for compatibility
  const { sqlReady, loading, error, initSql, processDB: processDBHook, exportDatabase: exportDBHook } = database;
  const { pendingFile, clearPendingFile, readFile } = fileHandling;

  // Wrapper for export database to show toasts
  const handleExportDatabase = useCallback(async (trips) => {
    const result = await exportDBHook(trips);
    if (result.success) {
      toast.success(t('confirmations.dbExported', 'Base de datos exportada correctamente'));
    } else {
      if (result.reason === 'no_data') {
        toast.error(t('errors.noDataFound', 'No hay datos para exportar'));
      } else {
        toast.error(t('errors.exportFailed', 'Error al exportar: ') + (result.message || 'Error desconocido'));
      }
    }
  }, [exportDBHook, t]);

  // Modal State Management (Now global in DataProvider)
  const {
    modals,
    openModal,
    closeModal,
    setLegalInitialSection,
    legalInitialSection,
    isAnyModalOpen
  } = useData();



  // Destructure for backwards compatibility with existing code
  // Modal visibility flags from global state
  const showAllTripsModal = modals.allTrips;
  const showAllChargesModal = modals.allCharges;
  const showTripDetailModal = modals.tripDetail;
  const showSettingsModal = modals.settings;

  // Helper setters for compatibility with existing code structure
  const setShowModal = useCallback((value) => value ? openModal('upload') : closeModal('upload'), [openModal, closeModal]);
  const setShowFilterModal = useCallback((value) => value ? openModal('filter') : closeModal('filter'), [openModal, closeModal]);
  const setShowAllTripsModal = useCallback((value) => value ? openModal('allTrips') : closeModal('allTrips'), [openModal, closeModal]);
  const setShowAllChargesModal = useCallback((value) => value ? openModal('allCharges') : closeModal('allCharges'), [openModal, closeModal]);
  const setShowTripDetailModal = useCallback((value) => value ? openModal('tripDetail') : closeModal('tripDetail'), [openModal, closeModal]);
  // Background load state
  const [backgroundLoad, setBackgroundLoad] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBackgroundLoad(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);



  // Selected items come from shared modal state in DataProvider (useModalState)
  // Access via: const { selectedTrip, setSelectedTrip, selectedCharge, setSelectedCharge } = useData();

  // Scroll Container Refs (Required for virtualized lists in modals)
  const allTripsScrollRef = useRef(null);
  const allChargesScrollRef = useRef(null);


  // Context state
  const { settings, updateSettings } = useApp();
  const { layoutMode, isCompact, isFullscreenBYD, isVertical } = useLayout();

  // App Version
  const { version: appVersion } = useAppVersion();

  // Calculate chart heights
  const chartDimensions = useChartDimensions({ isVertical, isFullscreenBYD, isCompact });

  const {
    smallChartHeight,
    patternsChartHeight,
    largeChartHeight,
    overviewSpacingVertical,
    overviewSpacingHorizontal,
    patternsSpacing,
    recordsItemPadding,
    recordsItemPaddingHorizontal,
    recordsListHeightHorizontal
  } = chartDimensions;

  // DEBUG LOGS
  logger.debug('[DEBUG] Mode detection:', {
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    isFullscreenBYD,
    isCompact
  });



  // All trips view states
  const [allTripsFilterType, setAllTripsFilterType] = useState('all');
  const [allTripsMonth, setAllTripsMonth] = useState('');
  const [allTripsDateFrom, setAllTripsDateFrom] = useState('');
  const [allTripsDateTo, setAllTripsDateTo] = useState('');
  const [allTripsSortBy, setAllTripsSortBy] = useState('date'); // 'date', 'efficiency', 'distance', 'consumption'
  const [allTripsSortOrder, setAllTripsSortOrder] = useState('desc'); // 'asc' or 'desc'

  // All Charges view state
  const [allChargesFilterType, setAllChargesFilterType] = useState('all');
  const [allChargesMonth, setAllChargesMonth] = useState('');
  const [allChargesDateFrom, setAllChargesDateFrom] = useState('');
  const [allChargesDateTo, setAllChargesDateTo] = useState('');
  const [allChargesSortBy, setAllChargesSortBy] = useState('date'); // 'date', 'kwh', 'cost'
  const [allChargesSortOrder, setAllChargesSortOrder] = useState('desc');

  // Swipe gesture state
  // Swipe gesture state
  // const [isTransitioning, setIsTransitioning] = useState(false); // Managed by hook now

  // Swipe gesture is now handled by useSwipeGesture hook
  // const [swipeContainer, setSwipeContainer] = useState(null); -> Removed, hook returns ref setter except when it doesn't? 
  // Wait, useSwipeGesture returns 'setSwipeContainer'. App.jsx used 'useState' for it.
  // We don't need to declare it here anymore if the hook provides it.
  // But wait, previously I said: const setSwipeContainer = useSwipeGesture(...)
  // So I removed 'useState(null)' here.




  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => {
        logger.error(`Error attempting to enable fullscreen mode: ${e.message} (${e.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, []);

  const isNative = Capacitor.isNativePlatform();

  // Handle Android back button

  // Handle Android back button
  useEffect(() => {
    if (!isNative) return;

    const backHandler = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      // Always handle the back button - prevent default Android behavior
      // Only exit app if no modals are open AND canGoBack is false

      if (showTripDetailModal) {
        // Close trip detail modal, don't exit
        setShowTripDetailModal(false);
        setSelectedTrip(null);
      } else if (showSettingsModal) {
        // Close settings modal, don't exit
        setShowSettingsModal(false);
      } else if (showAllTripsModal) {
        // Close all trips modal, don't exit
        setShowAllTripsModal(false);
      } else {
        // No modals open - only now check if we should exit
        if (!canGoBack) {
          CapacitorApp.exitApp();
        }
        // If canGoBack is true, let the default behavior happen
        // (but this shouldn't happen in a single-page app)
      }
    });

    return () => {
      backHandler.then(h => h.remove());
    };
  }, [showTripDetailModal, showSettingsModal, showAllTripsModal, isNative]);

  // Theme management moved to ThemeManager component


  // localStorage loading/saving is now handled by useAppData hook



  useEffect(() => {
    initSql();
  }, [initSql]);

  // Handle file opening and sharing (both Android native and PWA)
  useEffect(() => {
    if (!pendingFile || !sqlReady) return;

    const handleSharedFile = async () => {
      try {
        logger.debug('[FileHandling] Processing pending file from:', pendingFile.source);

        // Read file using unified handler (works for both Android and PWA)
        const file = await readFile(pendingFile);

        // Validate file
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.db') && !fileName.endsWith('.jpg') && !fileName.endsWith('.jpeg')) {
          alert(t('errors.invalidFile') || 'Archivo inválido. Solo se permiten archivos .db');
          clearPendingFile();
          return;
        }

        // Process the database file
        const trips = await processDBHook(file, rawTrips, false);
        if (trips) {
          setRawTrips(trips);
          logger.debug('[FileHandling] File processed successfully:', trips.length, 'trips');

          // Show success message
          alert(t('upload.success') || 'Archivo cargado correctamente');
        }

        clearPendingFile();
      } catch (err) {
        logger.error('[FileHandling] Error processing file:', err);
        alert(t('errors.processingFile') || 'Error al procesar el archivo: ' + err.message);
        clearPendingFile();
      }
    };

    handleSharedFile();
  }, [pendingFile, sqlReady, readFile, processDBHook, clearPendingFile, rawTrips, t]);

  // months, filtered, and data are now provided by useAppData hook



  const processDB = useCallback(async (file, merge = false) => {
    const trips = await processDBHook(file, merge ? rawTrips : [], merge);
    if (trips) {
      setRawTrips(trips);
      // Auto-sync if connected
      if (googleSync.isAuthenticated) {
        logger.debug('Auto-syncing new data to cloud...');
        googleSync.syncNow(trips);
      }
      // Close any open database modals
      closeModal('upload');
      closeModal('history');
    }
  }, [processDBHook, rawTrips, googleSync, closeModal]);



  // clearData, saveToHistory, loadFromHistory, clearHistory now provided by useAppData hook

  // Export database to EC_Database.db format
  const exportDatabase = useCallback(async () => {
    const success = await exportDBHook(filtered);
    if (success) alert(t('confirmations.dbExported'));
  }, [exportDBHook, filtered, t]);

  // Memoized modal handlers to prevent unnecessary re-renders


  const handleEditCharge = useCallback((charge) => {
    setEditingCharge(charge);
    closeModal('chargeDetail');
    openModal('addCharge');
  }, [closeModal, openModal]);

  const handleDeleteCharge = useCallback((id) => {
    deleteCharge(id);
    closeModal('chargeDetail');
    setSelectedCharge(null);
    // Auto-sync after deleting charge
    if (googleSync.isAuthenticated) {
      googleSync.syncNow();
    }
  }, [deleteCharge, closeModal, googleSync]);

  // Handler for charge selection (UI state)
  const handleChargeSelect = useCallback((charge) => {
    setSelectedCharge(charge);
    openModal('chargeDetail');
  }, [openModal]);

  /**
   * Load charges from a CSV file with REGISTRO_CARGAS.csv format
   * Auto-creates missing charger types with default values
   */
  const { loadChargeRegistry } = useChargeImporter();

  // Tab Navigation (Extracted Hook)
  // Replaces tabs definition and handleTabClick
  const {
    activeTab,
    setActiveTab,
    fadingTab,
    isTransitioning,
    handleTabClick,
    tabs
  } = useTabNavigation({ settings });


  // Swipe gesture - using extracted hook
  const setSwipeContainer = useSwipeGesture({
    activeTab,
    handleTabClick,
    isTransitioning,
    tabs,
    layoutMode,
    isModalOpen: isAnyModalOpen
  });

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAnyModalOpen]);

  // Scroll to top Effect - Reset all containers when activeTab changes
  useEffect(() => {
    const containers = document.querySelectorAll('.tab-content-container');
    containers.forEach(container => {
      container.scrollTop = 0;
    });
  }, [activeTab]);





  // TripCard imported from components/cards/TripCard.jsx



  // Open trip detail - memoized callback
  const openTripDetail = useCallback((trip) => {
    setSelectedTrip(trip);
    setShowTripDetailModal(true);
  }, []);



  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center px-4 overflow-hidden">
        <div className="text-center">
          <div className="w-16 h-16 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: BYD_RED, borderTopColor: 'transparent' }} />
          <p className="text-slate-900 dark:text-white text-lg md:text-xl">Procesando...</p>
        </div>
      </div>
    );
  }

  if (rawTrips.length === 0) {
    return (
      <>
        <Suspense fallback={null}>
          <LandingPageLazy
            isCompact={isCompact}
            sqlReady={sqlReady}
            error={error}
            googleSync={googleSync}
            isNative={isNative}
            onFileProcess={processDB}
          />
        </Suspense>

        {/* ModalContainer for Legal Modal available on Landing Page */}
        {/* ModalCoordinator - centralized modal handling with lazy loading context support */}
        <ModalCoordinator />

        {/* Privacy & Legal links in bottom-left - Fixed positioning */}
        <div className="absolute left-6 bottom-6 z-10 flex flex-col gap-1.5 items-start pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
            <Link
              to="/privacidad"
              className="text-[10px] sm:text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5 p-1"
            >
              <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
              <span>{t('footer.privacy')}</span>
            </Link>
            <div className="w-px h-3 bg-slate-800"></div>
            <Link
              to="/legal"
              className="text-[10px] sm:text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5 p-1"
            >
              <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
              <span>{t('footer.legal')}</span>
            </Link>
            <div className="w-px h-3 bg-slate-800"></div>
            <Link
              to="/faq"
              className="text-[10px] sm:text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5 p-1"
            >
              <HelpCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
              <span>{t('footer.faq')}</span>
            </Link>
          </div>
          <p className="text-[10px] text-slate-600 pl-1">BYD Stats {appVersion}</p>
        </div>

        {/* GitHub link in bottom-right - Fixed positioning */}
        <div className="absolute right-6 bottom-6 z-10 flex flex-col gap-1.5 items-end pointer-events-none">
          <a
            href="https://github.com/miguelpicado/byd-stats"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] sm:text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5 p-1 pointer-events-auto"
          >
            <span>GitHub</span>
            <GitHub className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
          </a>
          <p className="text-[10px] text-slate-600 pr-1">Open Source Project</p>
        </div>
      </>
    );
  }

  const { summary, monthly, daily, hourly, weekday, tripDist, effScatter, top } = data || {};





  // If showing all trips view, render full screen view
  if (showAllTripsModal) {
    return (
      <Suspense fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        </div>
      }>
        <AllTripsViewLazy
          rawTrips={rawTrips}
          filterType={allTripsFilterType}
          month={allTripsMonth}
          dateFrom={allTripsDateFrom}
          dateTo={allTripsDateTo}
          sortBy={allTripsSortBy}
          sortOrder={allTripsSortOrder}
          setFilterType={setAllTripsFilterType}
          setMonth={setAllTripsMonth}
          setDateFrom={setAllTripsDateFrom}
          setDateTo={setAllTripsDateTo}
          setSortBy={setAllTripsSortBy}
          setSortOrder={setAllTripsSortOrder}
          modals={modals}
          openModal={openModal}
          closeModal={closeModal}
          openTripDetail={openTripDetail}
          scrollRef={allTripsScrollRef}
          setLegalInitialSection={setLegalInitialSection}
          legalInitialSection={legalInitialSection}
          settings={settings}
          updateSettings={updateSettings}
          googleSync={googleSync}
          selectedTrip={selectedTrip}
          setSelectedTrip={setSelectedTrip}
          data={data}
          sqlReady={sqlReady}
          processDB={processDB}
          exportDatabase={exportDatabase}
          clearData={clearData}
          loadChargeRegistry={loadChargeRegistry}
          isNative={isNative}
          onFile={(e) => {
            const f = e.target.files[0];
            if (f) processDB(f, false);
          }}
          charges={charges}
        />
      </Suspense>
    );
  }

  // If showing all charges view, render full screen view
  if (showAllChargesModal) {
    return (
      <Suspense fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        </div>
      }>
        <AllChargesViewLazy
          charges={charges}
          chargerTypes={settings.chargerTypes || []}
          filterType={allChargesFilterType}
          month={allChargesMonth}
          dateFrom={allChargesDateFrom}
          dateTo={allChargesDateTo}
          sortBy={allChargesSortBy}
          sortOrder={allChargesSortOrder}
          setFilterType={setAllChargesFilterType}
          setMonth={setAllChargesMonth}
          setDateFrom={setAllChargesDateFrom}
          setDateTo={setAllChargesDateTo}
          setSortBy={setAllChargesSortBy}
          setSortOrder={setAllChargesSortOrder}
          modals={modals}
          openModal={openModal}
          closeModal={closeModal}
          setSelectedCharge={setSelectedCharge}
          selectedCharge={selectedCharge}
          scrollRef={allChargesScrollRef}
          setLegalInitialSection={setLegalInitialSection}
          legalInitialSection={legalInitialSection}
          settings={settings}
          updateSettings={updateSettings}
          googleSync={googleSync}
          rawTrips={rawTrips}
          selectedTrip={selectedTrip}
          setSelectedTrip={setSelectedTrip}
          data={data}
          sqlReady={sqlReady}
          processDB={processDB}
          exportDatabase={exportDatabase}
          clearData={clearData}
          loadChargeRegistry={loadChargeRegistry}
          isNative={isNative}
          onFile={(e) => {
            const f = e.target.files[0];
            if (f) processDB(f, false);
          }}
        />
      </Suspense>
    );
  }


  return (
    <MainLayout setSwipeContainer={setSwipeContainer}>
      <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300">

        {/* Header Feature */}
        <Header />

        {/* Content Area with Conditional Sidebar */}
        <div className="flex-1 overflow-hidden" style={{ display: layoutMode === 'horizontal' ? 'flex' : 'block' }}>

          {/* Horizontal Layout: Sidebar */}
          {layoutMode === 'horizontal' && (
            <DesktopSidebar
              tabs={tabs}
              activeTab={activeTab}
              handleTabClick={handleTabClick}
            />
          )}

          {/* Main Content (Dashboard) */}
          <div className={layoutMode === 'horizontal' ? 'flex-1 overflow-y-auto' : 'max-w-7xl mx-auto h-full w-full'}>
            <ErrorBoundary>
              <DashboardLayout
                activeTab={activeTab}
                tabs={tabs}
                isTransitioning={isTransitioning}
                fadingTab={fadingTab}
                backgroundLoad={backgroundLoad}
                onTripSelect={openTripDetail}
                onChargeSelect={handleChargeSelect}
              />
            </ErrorBoundary>
          </div>
        </div>

        {/* Vertical Layout: Bottom Navigation */}
        {layoutMode === 'vertical' && (
          <TabNavigation
            tabs={tabs}
            activeTab={activeTab}
            handleTabClick={handleTabClick}
          />
        )}

        {/* Swipe Gesture Handler (Overlay) */}
        <div
          ref={setSwipeContainer}
          className="absolute inset-0 z-30 pointer-events-none"
          style={{ touchAction: 'pan-y' }}
        />

        <Toaster position="bottom-center" />

        {/* PWA Manager */}
        <Suspense fallback={null}>
          <PWAManagerLazy />
        </Suspense>

        {/* Modal Coordinator - handles all modals centrally */}
        <ModalCoordinator />
      </div>
    </MainLayout>
  );
}
