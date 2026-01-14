import React, { useState, useCallback, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';

import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { formatMonth, formatDate, formatTime } from './utils/dateUtils';
import { processData } from './utils/dataProcessing';
import { calculateScore, getScoreColor } from './utils/formatters';
import { logger } from './utils/logger';
import { STORAGE_KEY, TRIP_HISTORY_KEY, TAB_PADDING, COMPACT_TAB_PADDING, COMPACT_SPACE_Y } from './constants/layout';
import './utils/chartSetup'; // Register Chart.js components
import { useGoogleSync } from './hooks/useGoogleSync';

// Components
import { BYDLogo, Zap, Clock, TrendingUp, Upload, Activity, BarChart3, Filter, Settings, Database, HelpCircle, GitHub, Maximize, Minimize, Cloud, Shield, FileText, List, BYD_RED } from './components/Icons.jsx';
import TripCard from './components/cards/TripCard';
import TabFallback from './components/common/TabFallback';
import VirtualizedTripList from './components/lists/VirtualizedTripList';
// Keep OverviewTab static (initial tab)
import OverviewTab from './components/tabs/OverviewTab';
// Lazy load other tabs for code splitting
const HistoryTab = lazy(() => import('./components/tabs/HistoryTab'));
const RecordsTab = lazy(() => import('./components/tabs/RecordsTab'));
const TrendsTab = lazy(() => import('./components/tabs/TrendsTab'));
const PatternsTab = lazy(() => import('./components/tabs/PatternsTab'));
const EfficiencyTab = lazy(() => import('./components/tabs/EfficiencyTab'));
// PWAManager lazy loaded for code splitting
const PWAManagerLazy = lazy(() => import('./components/PWAManager'));

import useDatabase from './hooks/useDatabase';
import { useFileHandling } from './hooks/useFileHandling';
import { useApp } from './context/AppContext';
import { useLayout } from './context/LayoutContext';
import useModalState from './hooks/useModalState';
import useAppData from './hooks/useAppData';
import useAppVersion from './hooks/useAppVersion';



// Lazy load modals for code splitting
// Modals moved to ModalContainer, except LegalPage which is a page
const LegalPageLazy = lazy(() => import('./pages/LegalPage'));

import ModalContainer from './components/common/ModalContainer';
import { useSwipeGesture } from './hooks/useSwipeGesture';


export default function BYDStatsAnalyzer() {
  const { t, i18n } = useTranslation();

  // Data management hook - replaces rawTrips, filter states, and history
  const {
    rawTrips,
    setRawTrips,
    tripHistory,
    setTripHistory,
    filterType,
    setFilterType,
    selMonth,
    setSelMonth,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    months,
    filtered,
    data,
    clearData,
    saveToHistory,
    loadFromHistory,
    clearHistory
  } = useAppData();
  const { sqlReady, loading, error, setError, initSql, processDB: processDBHook, exportDatabase: exportDBHook } = useDatabase();
  const { pendingFile, clearPendingFile, readFile } = useFileHandling();
  const [activeTab, setActiveTab] = useState('overview');
  const [dragOver, setDragOver] = useState(false);
  // Centralized modal state management
  const { modals, openModal, closeModal, openLegalModal, legalInitialSection, setLegalInitialSection } = useModalState();

  // Destructure for backwards compatibility with existing code
  const showModal = modals.upload;
  const showFilterModal = modals.filter;
  const showAllTripsModal = modals.allTrips;
  const showTripDetailModal = modals.tripDetail;
  const showSettingsModal = modals.settings;
  const showHistoryModal = modals.history;
  const showHelpModal = modals.help;
  const showLegalModal = modals.legal;

  // Setter functions for backwards compatibility
  const setShowModal = useCallback((value) => value ? openModal('upload') : closeModal('upload'), [openModal, closeModal]);
  const setShowFilterModal = useCallback((value) => value ? openModal('filter') : closeModal('filter'), [openModal, closeModal]);
  const setShowAllTripsModal = useCallback((value) => value ? openModal('allTrips') : closeModal('allTrips'), [openModal, closeModal]);
  const setShowTripDetailModal = useCallback((value) => value ? openModal('tripDetail') : closeModal('tripDetail'), [openModal, closeModal]);
  const setShowSettingsModal = useCallback((value) => value ? openModal('settings') : closeModal('settings'), [openModal, closeModal]);
  const setShowHistoryModal = useCallback((value) => value ? openModal('history') : closeModal('history'), [openModal, closeModal]);
  const setShowHelpModal = useCallback((value) => value ? openModal('help') : closeModal('help'), [openModal, closeModal]);
  const setShowLegalModal = useCallback((value) => value ? openModal('legal') : closeModal('legal'), [openModal, closeModal]);
  // setLegalInitialSection comes directly from useModalState hook

  // Background load state for "Render-Hidden" strategy
  const [backgroundLoad, setBackgroundLoad] = useState(false);

  // Trigger background rendering of all tabs after initial mount
  useEffect(() => {
    const timer = setTimeout(() => {
      // This will cause all tabs to mount (hidden or off-screen)
      // handling both the network request AND component initialization
      setBackgroundLoad(true);
    }, 1500); // 1.5s delay to strictly prioritize first paint and interaction

    return () => clearTimeout(timer);
  }, []);

  // Detect paths like /legal or /privacidad
  const isLegalPath = window.location.pathname.startsWith('/legal');
  const isPrivacyPath = window.location.pathname.startsWith('/privacidad');

  if (isLegalPath || isPrivacyPath) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">{t('common.loading')}</div>}>
        <LegalPageLazy forcedTab={isPrivacyPath ? 'privacy' : 'legal'} />
      </Suspense>
    );
  }

  const [selectedTrip, setSelectedTrip] = useState(null);



  // Context state - Settings from AppContext, Layout from LayoutContext
  const { settings, updateSettings } = useApp();
  const { layoutMode, isCompact, isFullscreenBYD, isVertical, isLargerCard } = useLayout();

  // Get dynamic app version from GitHub releases
  const { version: appVersion } = useAppVersion();


  // Calculate chart heights based on mode - memoized to prevent recalculation
  const smallChartHeight = useMemo(() => {
    if (isVertical) return 350;
    if (isFullscreenBYD) return 271;
    if (isCompact) return 295;
    return 326;
  }, [isVertical, isFullscreenBYD, isCompact]);

  const patternsChartHeight = useMemo(() => {
    if (isVertical) return 350;
    if (isFullscreenBYD) return 289;
    if (isCompact) return 303;
    return 336;
  }, [isVertical, isFullscreenBYD, isCompact]);

  const largeChartHeight = useMemo(() => {
    if (isVertical) return 350;
    if (isFullscreenBYD) return 387;
    if (isCompact) return 369;
    return 442;
  }, [isVertical, isFullscreenBYD, isCompact]);

  // Spacing adjustments for different modes - memoized
  const unifiedVerticalSpacing = 'space-y-4';

  const overviewSpacingVertical = useMemo(() =>
    isVertical ? unifiedVerticalSpacing : (isFullscreenBYD ? 'space-y-[14px]' : (isCompact ? 'space-y-2.5' : 'space-y-3.5 sm:space-y-5')),
    [isVertical, isFullscreenBYD, isCompact]
  );

  const overviewSpacingHorizontal = useMemo(() =>
    isFullscreenBYD ? 'space-y-[22px]' : (isCompact ? 'space-y-2.5' : 'space-y-5 sm:space-y-6.5'),
    [isFullscreenBYD, isCompact]
  );

  const patternsSpacing = useMemo(() =>
    isVertical ? unifiedVerticalSpacing : (isFullscreenBYD ? 'space-y-[21px]' : (isCompact ? 'space-y-3' : 'space-y-[22px]')),
    [isVertical, isFullscreenBYD, isCompact]
  );

  const recordsItemPadding = useMemo(() =>
    isFullscreenBYD ? 'py-0.5' : (isCompact ? 'py-[1px]' : 'py-1.5'),
    [isFullscreenBYD, isCompact]
  );

  const recordsItemPaddingHorizontal = useMemo(() =>
    isFullscreenBYD ? 'py-1' : (isCompact ? 'py-[1.5px]' : 'py-2'),
    [isFullscreenBYD, isCompact]
  );

  const recordsListHeightHorizontal = useMemo(() =>
    isFullscreenBYD ? 'h-[389px]' : (isCompact ? 'h-[369px]' : 'h-[442px]'),
    [isFullscreenBYD, isCompact]
  );

  // DEBUG: Log to verify mode detection
  logger.debug('[DEBUG] Mode detection:', {
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    isFullscreenBYD,
    isCompact,
    smallChartHeight,
    largeChartHeight
  });

  // Google Sync Hook - Connect to Context Settings
  // Note: googleSync expects setSettings. updateSettings is compatible.
  const googleSync = useGoogleSync(rawTrips, setRawTrips, settings, updateSettings);


  // All trips view states
  const [allTripsFilterType, setAllTripsFilterType] = useState('all');
  const [allTripsMonth, setAllTripsMonth] = useState('');
  const [allTripsDateFrom, setAllTripsDateFrom] = useState('');
  const [allTripsDateTo, setAllTripsDateTo] = useState('');
  const [allTripsSortBy, setAllTripsSortBy] = useState('date'); // 'date', 'efficiency', 'distance', 'consumption'
  const [allTripsSortOrder, setAllTripsSortOrder] = useState('desc'); // 'asc' or 'desc'

  // Swipe gesture state
  const [isTransitioning, setIsTransitioning] = useState(false);
  const touchStartRef = useRef(null);
  const touchStartYRef = useRef(null);
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

  // Save settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('byd_settings', JSON.stringify(settings));
    } catch (e) {
      logger.error('Error saving settings:', e);
    }
  }, [settings]);

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

  // Theme management - UNIFIED AND ROBUST
  useEffect(() => {
    const applyTheme = (isDark) => {
      // 1. CSS Classes
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      // 2. Browser color-scheme (prevents system override)
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';

      // 2.1 Force meta tag to match active theme (critical for car systems)
      // This prevents the car's dark mode from overriding app's light theme
      let colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
      if (!colorSchemeMeta) {
        colorSchemeMeta = document.createElement('meta');
        colorSchemeMeta.name = 'color-scheme';
        document.head.appendChild(colorSchemeMeta);
      }
      // Set to ONLY the active theme, not "light dark" which allows system override
      colorSchemeMeta.content = isDark ? 'dark' : 'light';

      // 3. PWA theme-color meta tag (for status bar in PWA)
      let themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) {
        // Dark theme: dark slate background
        // Light theme: light background
        themeColorMeta.setAttribute('content', isDark ? '#0f172a' : '#f8fafc');
      }

      // 4. Native StatusBar (for Capacitor apps)
      if (isNative && window.StatusBar) {
        window.StatusBar.setStyle({ style: isDark ? 'LIGHT' : 'DARK' })
          .catch(e => logger.error('StatusBar error:', e));
      }
    };

    const getSystemTheme = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (settings.theme === 'auto') {
      // Apply initial theme
      applyTheme(getSystemTheme());

      // Listen for system changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e) => applyTheme(e.matches);

      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      // Manual theme
      applyTheme(settings.theme === 'dark');
    }
  }, [settings.theme, isNative]);

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
      setShowModal(false);
    }
  }, [processDBHook, rawTrips, googleSync]);

  const onDrop = useCallback((e, merge) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) {
      // Validate that the file is a .DB or image file (renamed .db to .jpg)
      const fileName = f.name.toLowerCase();
      if (!fileName.endsWith('.db') && !fileName.endsWith('.jpg') && !fileName.endsWith('.jpeg')) {
        alert(t('errors.invalidFile'));
        return;
      }
      processDB(f, merge);
    }
  }, [processDB, t]);

  const onFile = useCallback((e, merge) => {
    const f = e.target.files[0];
    if (f) {
      // Validate that the file is a .DB or image file (renamed .db to .jpg)
      const fileName = f.name.toLowerCase();
      if (!fileName.endsWith('.db') && !fileName.endsWith('.jpg') && !fileName.endsWith('.jpeg')) {
        alert(t('errors.invalidFile'));
        e.target.value = '';
        return;
      }
      processDB(f, merge);
    }
    e.target.value = '';
  }, [processDB, t]);

  // clearData, saveToHistory, loadFromHistory, clearHistory now provided by useAppData hook

  // Export database to EC_Database.db format
  const exportDatabase = useCallback(async () => {
    const success = await exportDBHook(filtered);
    if (success) alert(t('confirmations.dbExported'));
  }, [exportDBHook, filtered, t]);

  // Memoized modal handlers to prevent unnecessary re-renders
  const handleOpenSettingsModal = useCallback(() => setShowSettingsModal(true), []);
  const handleCloseSettingsModal = useCallback(() => setShowSettingsModal(false), []);
  const handleOpenFilterModal = useCallback(() => setShowFilterModal(true), []);
  const handleCloseFilterModal = useCallback(() => setShowFilterModal(false), []);
  // Help modal uses setShowHelpModal directly in JSX
  const handleOpenModal = useCallback(() => setShowModal(true), []);
  const handleCloseModal = useCallback(() => setShowModal(false), []);
  const handleOpenHistoryModal = useCallback(() => setShowHistoryModal(true), []);
  const handleCloseHistoryModal = useCallback(() => setShowHistoryModal(false), []);
  const handleOpenAllTripsModal = useCallback(() => setShowAllTripsModal(true), []);
  const handleCloseAllTripsModal = useCallback(() => setShowAllTripsModal(false), []);
  const handleCloseTripDetailModal = useCallback(() => {
    setShowTripDetailModal(false);
    setSelectedTrip(null);
  }, []);

  const tabs = useMemo(() => [
    { id: 'overview', label: t('tabs.overview'), icon: Activity },
    { id: 'trends', label: t('tabs.trends'), icon: TrendingUp },
    { id: 'patterns', label: t('tabs.patterns'), icon: Clock },
    { id: 'efficiency', label: t('tabs.efficiency'), icon: Zap },
    { id: 'records', label: t('tabs.records'), icon: BarChart3 },
    { id: 'history', label: t('tabs.history'), icon: List }
  ], [t]);

  const minSwipeDistance = 30; // Distancia mínima en píxeles
  const transitionDuration = 500;

  const handleTabClick = useCallback((tabId) => {
    if (tabId === activeTab) return;
    if (isTransitioning) return;

    // Use transitions for both vertical and horizontal modes
    setIsTransitioning(true);
    setActiveTab(tabId);
    setTimeout(() => {
      setIsTransitioning(false);
    }, transitionDuration);
  }, [activeTab, isTransitioning, transitionDuration]);


  // Swipe gesture - using extracted hook
  const setSwipeContainer = useSwipeGesture({
    activeTab,
    handleTabClick,
    isTransitioning,
    tabs,
    layoutMode
  });

  // Scroll to top Effect - Reset all containers when activeTab changes
  useEffect(() => {
    const containers = document.querySelectorAll('.tab-content-container');
    containers.forEach(container => {
      container.scrollTop = 0;
    });
  }, [activeTab]);





  // TripCard imported from components/cards/TripCard.jsx

  // Format duration in minutes/hours - memoized
  const formatDuration = useCallback((seconds) => {
    if (!seconds) return '0 min';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes} min`;
  }, []);

  // Calculate trip percentile - memoized
  const calculatePercentile = useCallback((trip, allTrips) => {
    if (!trip || !allTrips || allTrips.length === 0) return 50;
    const tripEfficiency = trip.trip > 0 ? (trip.electricity / trip.trip) * 100 : 999;
    const validTrips = allTrips.filter(t => t.trip >= 1 && t.electricity !== 0);
    const efficiencies = validTrips.map(t => (t.electricity / t.trip) * 100);
    const betterCount = efficiencies.filter(e => e < tripEfficiency).length;
    return Math.round((betterCount / efficiencies.length) * 100);
  }, []);

  // Open trip detail - memoized callback
  const openTripDetail = useCallback((trip) => {
    setSelectedTrip(trip);
    setShowTripDetailModal(true);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: BYD_RED, borderTopColor: 'transparent' }} />
          <p className="text-slate-900 dark:text-white text-lg md:text-xl">Procesando...</p>
        </div>
      </div>
    );
  }

  if (rawTrips.length === 0) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-start justify-center p-4 pt-8 pb-4">
        <div className="w-full max-w-xl">
          <div className="text-center mb-6">
            <img src="app_icon_v2.png" className={`h-auto mx-auto mb-3 md:mb-4 ${isCompact ? 'w-24 sm:w-32' : 'w-32 sm:w-40 md:w-48'}`} alt="App Logo" />
            <h1 className={`${isCompact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl md:text-4xl'} font-bold text-white mb-1`}>{t('landing.title')}</h1>
            <p className="text-xs sm:text-sm text-slate-400">{t('landing.subtitle')}</p>
          </div>

          {!sqlReady && !error && (
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-3 px-4 py-2 bg-white dark:bg-slate-800/50 rounded-xl">
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: BYD_RED, borderTopColor: 'transparent' }} />
                <span className="text-slate-400">{t('landing.loading')}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
              <p style={{ color: BYD_RED }}>{error}</p>
            </div>
          )}

          <div
            className={`border-2 border-dashed rounded-3xl text-center transition-all cursor-pointer ${isCompact ? 'p-6' : 'p-8 sm:p-12'}`}
            style={{
              borderColor: dragOver ? BYD_RED : '#475569',
              backgroundColor: dragOver ? 'rgba(234,0,41,0.1)' : 'transparent'
            }}
            onDragOver={(e) => { if (sqlReady && !isNative) { e.preventDefault(); setDragOver(true); } }}
            onDragLeave={() => !isNative && setDragOver(false)}
            onDrop={(e) => !isNative && sqlReady && onDrop(e, false)}
            onClick={() => sqlReady && document.getElementById('fileInput')?.click()}
          >
            <input
              id="fileInput"
              type="file"
              accept="*/*,image/*,.db,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => onFile(e, false)}
              disabled={!sqlReady}
            />
            <div
              className={`${isCompact ? 'w-12 h-12 mb-4' : 'w-16 h-16 mb-6'} rounded-2xl mx-auto flex items-center justify-center`}
              style={{ backgroundColor: dragOver ? BYD_RED : '#334155' }}
            >
              <Upload className={`${isCompact ? 'w-6 h-6' : 'w-8 h-8'}`} style={{ color: dragOver ? 'white' : BYD_RED }} />
            </div>
            <p className={`text-white mb-2 ${isCompact ? 'text-base' : 'text-lg sm:text-xl'}`}>
              {sqlReady ? (isNative ? t('landing.tapToSelect') : t('landing.clickToSelect')) : t('landing.preparing')}
            </p>
            <p className="text-slate-400 text-xs mt-4">
              {t('landing.hint')}
            </p>
            <p className="text-slate-500 text-xs mt-2">
              {t('landing.tip')}
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center w-full my-6">
            <div className="h-px bg-slate-700 flex-1 opacity-50"></div>
            <span className="px-4 text-slate-500 text-sm font-medium">{t('common.or')}</span>
            <div className="h-px bg-slate-700 flex-1 opacity-50"></div>
          </div>

          {/* Compact Cloud Sync Section */}
          <div className="flex justify-center">
            {googleSync.isAuthenticated ? (
              <button
                onClick={() => googleSync.syncNow()}
                disabled={googleSync.isSyncing}
                className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-all text-white shadow-lg"
              >
                <div className="relative">
                  {googleSync.userProfile?.imageUrl ? (
                    <img src={googleSync.userProfile.imageUrl} className="w-6 h-6 rounded-full" alt="User" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold">
                      {googleSync.userProfile?.name?.charAt(0) || 'U'}
                    </div>
                  )}
                  {googleSync.isSyncing && (
                    <div className="absolute -right-1 -bottom-1 w-3 h-3 bg-slate-800 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 border-[1.5px] border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-xs text-slate-400 leading-none mb-0.5">{t('landing.cloudConnected')}</p>
                  <p className="text-sm font-medium leading-none">{googleSync.isSyncing ? t('landing.syncing') : t('landing.syncNow')}</p>
                </div>
                {!googleSync.isSyncing && <Cloud className="w-4 h-4 text-slate-400 ml-1" />}
              </button>
            ) : (
              <button
                onClick={() => googleSync.login()}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-800 px-4 py-2 rounded-xl text-sm"
              >
                <span className="flex items-center justify-center w-5 h-5 bg-white rounded-full">
                  <img src="https://www.google.com/favicon.ico" alt="G" className="w-3 h-3" />
                </span>
                {t('landing.signInToSync')}
              </button>
            )}
          </div>

        </div>

        {/* ModalContainer for Legal Modal available on Landing Page */}
        <ModalContainer
          modals={modals}
          closeModal={closeModal}
          openModal={openModal}
          setLegalInitialSection={setLegalInitialSection}
          legalInitialSection={legalInitialSection}
          // Pass empty/null for other props not needed in landing, or pass them if safe
          // Landing page mainly needs Legal modal.
          settings={settings} // Might be needed?
          updateSettings={updateSettings}
          googleSync={googleSync}
          rawTrips={rawTrips}
          selectedTrip={null}
          setSelectedTrip={setSelectedTrip}
          data={null}
          sqlReady={sqlReady}
          processDB={processDB}
          exportDatabase={exportDatabase}
          clearData={clearData}
          saveToHistory={saveToHistory}
          clearHistory={clearHistory}
          tripHistory={tripHistory}
          isNative={isNative}
          onFile={onFile}
          setFilterType={setFilterType}
          setSelMonth={setSelMonth}
          setDateFrom={setDateFrom}
          setDateTo={setDateTo}
          filterType={filterType}
          selMonth={selMonth}
          dateFrom={dateFrom}
          dateTo={dateTo}
          months={months}
          rawTripsCount={rawTrips.length}
          filteredCount={0}
          appVersion={appVersion}
        />

        {/* Privacy & Legal links in bottom-left - Fixed positioning */}
        <div className="absolute left-6 bottom-6 z-10 flex flex-col gap-1.5 items-start">
          <div className="flex items-center gap-3">
            <a
              href="/privacidad/"
              className="text-[10px] sm:text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5 p-1"
            >
              <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
              <span>{t('footer.privacy')}</span>
            </a>
            <div className="w-px h-3 bg-slate-800"></div>
            <a
              href="/legal/"
              className="text-[10px] sm:text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5 p-1"
            >
              <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
              <span>{t('footer.legal')}</span>
            </a>
          </div>
          <p className="text-[10px] text-slate-600 pl-1">BYD Stats {appVersion}</p>
        </div>

        {/* GitHub link in bottom-right - Fixed positioning */}
        <div className="absolute right-6 bottom-6 z-10 flex flex-col gap-1.5 items-end">
          <a
            href="https://github.com/miguelpicado/byd-stats"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] sm:text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5 p-1"
          >
            <span>GitHub</span>
            <GitHub className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
          </a>
          <p className="text-[10px] text-slate-600 pr-1">Open Source Project</p>
        </div>
      </div>
    );
  }

  const { summary, monthly, daily, hourly, weekday, tripDist, effScatter, top } = data || {};

  // If showing all trips view, render full screen view
  if (showAllTripsModal) {
    // Filter and sort trips for the all trips view
    let allTripsFiltered = [...rawTrips];

    // Apply filters
    if (allTripsFilterType === 'month' && allTripsMonth) {
      allTripsFiltered = allTripsFiltered.filter(t => t.month === allTripsMonth);
    } else if (allTripsFilterType === 'range') {
      if (allTripsDateFrom) allTripsFiltered = allTripsFiltered.filter(t => t.date >= allTripsDateFrom.replace(/-/g, ''));
      if (allTripsDateTo) allTripsFiltered = allTripsFiltered.filter(t => t.date <= allTripsDateTo.replace(/-/g, ''));
    }

    // Sort trips
    allTripsFiltered.sort((a, b) => {
      let comparison = 0;

      if (allTripsSortBy === 'date') {
        const dateCompare = (b.date || '').localeCompare(a.date || '');
        if (dateCompare !== 0) {
          comparison = dateCompare;
        } else {
          comparison = (b.start_timestamp || 0) - (a.start_timestamp || 0);
        }
      } else if (allTripsSortBy === 'efficiency') {
        // Calcular eficiencia permitiendo valores negativos (regeneración)
        const effA = a.trip > 0 && a.electricity !== undefined && a.electricity !== null && a.electricity !== 0
          ? (a.electricity / a.trip) * 100
          : Infinity;
        const effB = b.trip > 0 && b.electricity !== undefined && b.electricity !== null && b.electricity !== 0
          ? (b.electricity / b.trip) * 100
          : Infinity;
        comparison = effA - effB; // Valores más bajos (incluyendo negativos) primero
      } else if (allTripsSortBy === 'distance') {
        comparison = (b.trip || 0) - (a.trip || 0); // Descending by default
      } else if (allTripsSortBy === 'consumption') {
        comparison = (b.electricity || 0) - (a.electricity || 0); // Descending by default
      }

      // Apply sort order
      return allTripsSortOrder === 'asc' ? -comparison : comparison;
    });

    // Filter trips >= 1km for scoring calculation
    // Incluir eficiencias negativas (regeneración) que son las MEJORES
    const validTrips = allTripsFiltered.filter(t => t.trip >= 1 && t.electricity !== 0);
    const efficiencies = validTrips.map(t => (t.electricity / t.trip) * 100);
    const minEff = efficiencies.length > 0 ? Math.min(...efficiencies) : 0;
    const maxEff = efficiencies.length > 0 ? Math.max(...efficiencies) : 0;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 text-slate-900 dark:text-white">
        {/* Trip Detail Modal (using ModalContainer) */}
        <ModalContainer
          modals={modals}
          closeModal={closeModal}
          openModal={openModal}
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
          saveToHistory={saveToHistory}
          clearHistory={clearHistory}
          tripHistory={tripHistory}
          isNative={isNative}
          onFile={onFile}
          setFilterType={setFilterType}
          setSelMonth={setSelMonth}
          setDateFrom={setDateFrom}
          setDateTo={setDateTo}
          filterType={filterType}
          selMonth={selMonth}
          dateFrom={dateFrom}
          dateTo={dateTo}
          months={months}
          rawTripsCount={rawTrips.length}
          filteredCount={allTripsFiltered.length}
          appVersion={appVersion}
        />

        {/* Header */}
        <div className="sticky top-0 z-40 bg-slate-100 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700/50" style={{ paddingTop: 'env(safe-area-inset-top, 24px)' }}>
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setShowAllTripsModal(false)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-900 dark:text-white hover:bg-white dark:bg-slate-800"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-sm sm:text-base md:text-lg font-bold">{t('allTrips.title')}</h1>
                  <p className="text-slate-500 dark:text-slate-500 text-xs sm:text-sm">{allTripsFiltered.length} {t('stats.trips').toLowerCase()}</p>
                </div>
              </div>
            </div>

            {/* Filters and Sort */}
            <div className="mt-4 space-y-3">
              {/* Filter Type */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => { setAllTripsFilterType('all'); setAllTripsMonth(''); setAllTripsDateFrom(''); setAllTripsDateTo(''); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor: allTripsFilterType === "all" ? BYD_RED : undefined,
                    color: allTripsFilterType === 'all' ? 'white' : '#94a3b8'
                  }}
                >
                  {t('filter.all')}
                </button>
                <button
                  onClick={() => setAllTripsFilterType('month')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor: allTripsFilterType === 'month' ? BYD_RED : undefined,
                    color: allTripsFilterType === 'month' ? 'white' : '#94a3b8'
                  }}
                >
                  {t('filter.byMonth')}
                </button>
                <button
                  onClick={() => setAllTripsFilterType('range')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor: allTripsFilterType === 'range' ? BYD_RED : undefined,
                    color: allTripsFilterType === 'range' ? 'white' : '#94a3b8'
                  }}
                >
                  {t('filter.byRange')}
                </button>
              </div>

              {/* Month Selector */}
              {allTripsFilterType === 'month' && (
                <select
                  value={allTripsMonth}
                  onChange={(e) => setAllTripsMonth(e.target.value)}
                  className="w-full bg-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-600 text-sm"
                >
                  <option value="">{t('filter.selectMonth')}</option>
                  {months.map((m) => (
                    <option key={m} value={m}>{formatMonth(m)}</option>
                  ))}
                </select>
              )}

              {/* Date Range */}
              {allTripsFilterType === 'range' && (
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={allTripsDateFrom}
                    onChange={(e) => setAllTripsDateFrom(e.target.value)}
                    className="flex-1 bg-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-600 text-sm"
                  />
                  <input
                    type="date"
                    value={allTripsDateTo}
                    onChange={(e) => setAllTripsDateTo(e.target.value)}
                    className="flex-1 bg-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-600 text-sm"
                  />
                </div>
              )}

              {/* Sort Options */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                <span className="text-xs text-slate-600 dark:text-slate-400 px-2 py-1.5">{t('sort.label')}</span>
                <button
                  onClick={() => {
                    if (allTripsSortBy === 'date') {
                      setAllTripsSortOrder(allTripsSortOrder === 'desc' ? 'asc' : 'desc');
                    } else {
                      setAllTripsSortBy('date');
                      setAllTripsSortOrder('desc');
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${allTripsSortBy === 'date'
                    ? 'text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  style={allTripsSortBy === 'date' ? { backgroundColor: BYD_RED } : {}}
                >
                  {t('allTrips.date')}
                  {allTripsSortBy === 'date' && (
                    <span>{allTripsSortOrder === 'desc' ? '↓' : '↑'}</span>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (allTripsSortBy === 'efficiency') {
                      setAllTripsSortOrder(allTripsSortOrder === 'desc' ? 'asc' : 'desc');
                    } else {
                      setAllTripsSortBy('efficiency');
                      setAllTripsSortOrder('desc');
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${allTripsSortBy === 'efficiency'
                    ? 'text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  style={allTripsSortBy === 'efficiency' ? { backgroundColor: BYD_RED } : {}}
                >
                  {t('allTrips.efficiency')}
                  {allTripsSortBy === 'efficiency' && (
                    <span>{allTripsSortOrder === 'desc' ? '↓' : '↑'}</span>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (allTripsSortBy === 'distance') {
                      setAllTripsSortOrder(allTripsSortOrder === 'desc' ? 'asc' : 'desc');
                    } else {
                      setAllTripsSortBy('distance');
                      setAllTripsSortOrder('desc');
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${allTripsSortBy === 'distance'
                    ? 'text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  style={allTripsSortBy === 'distance' ? { backgroundColor: BYD_RED } : {}}
                >
                  {t('allTrips.distance')}
                  {allTripsSortBy === 'distance' && (
                    <span>{allTripsSortOrder === 'desc' ? '↓' : '↑'}</span>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (allTripsSortBy === 'consumption') {
                      setAllTripsSortOrder(allTripsSortOrder === 'desc' ? 'asc' : 'desc');
                    } else {
                      setAllTripsSortBy('consumption');
                      setAllTripsSortOrder('desc');
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${allTripsSortBy === 'consumption'
                    ? 'text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  style={allTripsSortBy === 'consumption' ? { backgroundColor: BYD_RED } : {}}
                >
                  {t('allTrips.consumption')}
                  {allTripsSortBy === 'consumption' && (
                    <span>{allTripsSortOrder === 'desc' ? '↓' : '↑'}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Trip List - Virtualized with TanStack Virtual */}
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 pb-8">
          <VirtualizedTripList
            trips={allTripsFiltered}
            minEff={minEff}
            maxEff={maxEff}
            onTripClick={openTripDetail}
          />
        </div>
      </div >
    );
  }

  return (
    <div
      ref={setSwipeContainer}
      className="fixed inset-0 flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 text-slate-900 dark:text-slate-900 dark:text-white overflow-hidden transition-colors"
    >
      <ModalContainer
        modals={modals}
        closeModal={closeModal}
        openModal={openModal}
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
        saveToHistory={saveToHistory}
        clearHistory={clearHistory}
        tripHistory={tripHistory}
        isNative={isNative}
        onFile={onFile}
        setFilterType={setFilterType}
        setSelMonth={setSelMonth}
        setDateFrom={setDateFrom}
        setDateTo={setDateTo}
        filterType={filterType}
        selMonth={selMonth}
        dateFrom={dateFrom}
        dateTo={dateTo}
        months={months}
        rawTripsCount={rawTrips.length}
        filteredCount={filtered ? filtered.length : 0}
        appVersion={appVersion}
      />

      <div className="flex-shrink-0 sticky top-0 z-40 bg-slate-100 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700/50" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className={`${layoutMode === 'horizontal' ? 'px-3 sm:px-4' : 'max-w-7xl mx-auto px-3 sm:px-4'} py-3 sm:py-4`}>
          <div className="flex items-center justify-between">
            {/* Logo y título */}
            <div className="flex items-center gap-2 sm:gap-3">
              <img
                src="app_logo.png"
                className={`${layoutMode === 'horizontal' ? 'h-10 w-auto' : 'w-12 sm:w-16 md:w-20'} object-contain`}
                alt="BYD Logo"
              />
              <div>
                <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-white">{t('header.title')}</h1>
                <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">{t('header.trips', { count: rawTrips.length })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHelpModal(true)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors"
                title={t('tooltips.help')}
              >
                <HelpCircle className="w-5 h-5" />
              </button>
              <button
                onClick={toggleFullscreen}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors ${layoutMode === 'vertical' ? 'hidden' : ''}`}
                title={isFullscreen ? t('tooltips.exitFullscreen') : t('tooltips.fullscreen')}
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setShowHistoryModal(true)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors"
                title={t('tooltips.history')}
              >
                <Database className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowSettingsModal(true)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors"
                title={t('tooltips.settings')}
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowFilterModal(true)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors"
                title={t('tooltips.filters')}
              >
                <Filter className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden" style={{ display: layoutMode === 'horizontal' ? 'flex' : 'block' }}>
        {/* Horizontal Layout: Sidebar with tabs */}
        {layoutMode === 'horizontal' && (
          <div className="w-64 flex-shrink-0 bg-slate-100 dark:bg-slate-900/90 border-r border-slate-200 dark:border-slate-700/50 overflow-y-auto">
            <div role="tablist" aria-label="Main navigation" className="p-4 space-y-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={activeTab === t.id}
                  aria-controls={`tabpanel-${t.id}`}
                  onClick={() => handleTabClick(t.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${activeTab === t.id
                    ? 'text-white'
                    : 'text-slate-600 dark:text-slate-400'
                    }`}
                  style={{
                    backgroundColor: activeTab === t.id ? BYD_RED : 'transparent'
                  }}
                >
                  <t.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content container */}
        <div className={layoutMode === 'horizontal' ? 'flex-1 overflow-y-auto' : 'max-w-7xl mx-auto h-full'}>
          {layoutMode === 'vertical' ? (
            // Vertical layout: sliding tabs with transitions
            <div
              ref={setSwipeContainer}
              style={{
                display: 'flex',
                height: '100%',
                width: `${tabs.length * 100}%`,
                transform: `translate3d(-${tabs.findIndex(t => t.id === activeTab) * (100 / tabs.length)}%, 0, 0)`,
                transition: isTransitioning ? `transform ${transitionDuration}ms cubic-bezier(0.33, 1, 0.68, 1)` : 'none',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                perspective: 1000,
                WebkitPerspective: 1000,
                transformStyle: 'preserve-3d',
                WebkitTransformStyle: 'preserve-3d',
                userSelect: 'none',
                touchAction: 'pan-y',
                overscrollBehavior: 'none'
              }}
            >
              {!data ? (
                // Show error message on all slides
                tabs.map((tab) => (
                  <div key={tab.id} className="text-center py-12 bg-white dark:bg-slate-800/30 rounded-2xl mx-3 sm:mx-4" style={{ width: `${100 / tabs.length}%`, flexShrink: 0 }}>
                    <AlertCircle className="w-12 h-12 text-slate-500 dark:text-slate-500 mx-auto mb-4" />
                    <p className="text-slate-400">{t('common.noData')}</p>
                  </div>
                ))
              ) : (
                <>
                  {/* Slide 1: Overview */}
                  <div className="tab-content-container" style={{ width: `${100 / tabs.length}%`, flexShrink: 0, height: '100%', overflowY: 'auto', padding: isCompact ? COMPACT_TAB_PADDING : TAB_PADDING }}>
                    {(activeTab === 'overview' || backgroundLoad) && (
                      <OverviewTab
                        key={activeTab === 'overview' ? 'active' : 'bg'}
                        summary={summary}
                        monthly={monthly}
                        tripDist={tripDist}
                        smallChartHeight={smallChartHeight}
                        overviewSpacing={overviewSpacingVertical}
                      />
                    )}
                  </div>

                  {/* Slide 2: Trends */}
                  <div className="tab-content-container" style={{ width: `${100 / tabs.length}%`, flexShrink: 0, height: '100%', overflowY: 'auto', padding: isCompact ? COMPACT_TAB_PADDING : TAB_PADDING }}>
                    <Suspense fallback={<TabFallback />}>
                      {(activeTab === 'trends' || backgroundLoad) && (
                        <TrendsTab
                          key={activeTab === 'trends' ? 'active' : 'bg'}
                          filtered={filtered}
                          summary={summary}
                          monthly={monthly}
                          daily={daily}
                          settings={settings}
                          largeChartHeight={largeChartHeight}
                        />
                      )}
                    </Suspense>
                  </div>

                  {/* Slide 3: Patterns */}
                  <div className="tab-content-container" style={{ width: `${100 / tabs.length}%`, flexShrink: 0, height: '100%', overflowY: 'auto', padding: isCompact ? COMPACT_TAB_PADDING : TAB_PADDING }}>
                    <Suspense fallback={<TabFallback />}>
                      {(activeTab === 'patterns' || backgroundLoad) && (
                        <PatternsTab
                          key={activeTab === 'patterns' ? 'active' : 'bg'}
                          weekday={weekday}
                          hourly={hourly}
                          summary={summary}
                          patternsSpacing={patternsSpacing}
                          patternsChartHeight={patternsChartHeight}
                        />
                      )}
                    </Suspense>
                  </div>

                  {/* Slide 4: Efficiency */}
                  <div className="tab-content-container" style={{ width: `${100 / tabs.length}%`, flexShrink: 0, height: '100%', overflowY: 'auto', padding: isCompact ? COMPACT_TAB_PADDING : TAB_PADDING }}>
                    <Suspense fallback={<TabFallback />}>
                      {(activeTab === 'efficiency' || backgroundLoad) && (
                        <EfficiencyTab
                          key={activeTab === 'efficiency' ? 'active' : 'bg'}
                          summary={summary}
                          monthly={monthly}
                          effScatter={effScatter}
                          largeChartHeight={largeChartHeight}
                        />
                      )}
                    </Suspense>
                  </div>

                  {/* Slide 5: Records */}
                  <div className="tab-content-container" style={{ width: `${100 / tabs.length}%`, flexShrink: 0, height: '100%', overflowY: 'auto', padding: isCompact ? COMPACT_TAB_PADDING : TAB_PADDING }}>
                    <Suspense fallback={<TabFallback />}>
                      {(activeTab === 'records' || backgroundLoad) && (
                        <RecordsTab
                          key={activeTab === 'records' ? 'active' : 'bg'}
                          summary={summary}
                          top={top}
                          recordsItemPadding={recordsItemPadding}
                          recordsItemPaddingHorizontal={recordsItemPaddingHorizontal}
                          recordsListHeightHorizontal={recordsListHeightHorizontal}
                        />
                      )}
                    </Suspense>
                  </div>

                  {/* Slide 6: History */}
                  <div className="tab-content-container" style={{ width: `${100 / tabs.length}%`, flexShrink: 0, height: '100%', overflowY: 'auto', padding: isCompact ? COMPACT_TAB_PADDING : TAB_PADDING }}>
                    <Suspense fallback={<TabFallback />}>
                      {(activeTab === 'history' || backgroundLoad) && (
                        <HistoryTab
                          key={activeTab === 'history' ? 'active' : 'bg'}
                          filtered={filtered}
                          openTripDetail={openTripDetail}
                          setShowAllTripsModal={setShowAllTripsModal}
                        />
                      )}
                    </Suspense>
                  </div>
                </>
              )}
            </div>
          ) : (
            // Horizontal layout: show only active tab content (tabs unmount/remount for animations)
            <div ref={setSwipeContainer} className="tab-content-container horizontal-tab-transition" style={{ padding: isCompact ? '8px 10px' : '12px', height: '100%', overflowY: 'auto' }}>
              {!data ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800/30 rounded-2xl">
                  <AlertCircle className="w-12 h-12 text-slate-500 dark:text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-400">{t('common.noData')}</p>
                </div>
              ) : (
                <>
                  {/* Overview - Always visible when active */}
                  {(activeTab === 'overview' || backgroundLoad) && (
                    <div className="horizontal-tab-transition" style={{ display: activeTab === 'overview' ? 'block' : 'none' }}>
                      <OverviewTab
                        key={activeTab === 'overview' ? 'overview-active' : 'overview-bg'}
                        summary={summary}
                        monthly={monthly}
                        tripDist={tripDist}
                        smallChartHeight={smallChartHeight}
                        overviewSpacing={overviewSpacingHorizontal}
                      />
                    </div>
                  )}

                  {/* Trends - Background loaded */}
                  <Suspense fallback={activeTab === 'trends' ? <TabFallback /> : null}>
                    {(activeTab === 'trends' || backgroundLoad) && (
                      <div className="horizontal-tab-transition" style={{ display: activeTab === 'trends' ? 'block' : 'none' }}>
                        <TrendsTab
                          key={activeTab === 'trends' ? 'trends-active' : 'trends-bg'}
                          filtered={filtered}
                          summary={summary}
                          monthly={monthly}
                          daily={daily}
                          settings={settings}
                          largeChartHeight={largeChartHeight}
                        />
                      </div>
                    )}
                  </Suspense>

                  {/* Patterns - Background loaded */}
                  <Suspense fallback={activeTab === 'patterns' ? <TabFallback /> : null}>
                    {(activeTab === 'patterns' || backgroundLoad) && (
                      <div className="horizontal-tab-transition" style={{ display: activeTab === 'patterns' ? 'block' : 'none' }}>
                        <PatternsTab
                          key={activeTab === 'patterns' ? 'patterns-active' : 'patterns-bg'}
                          weekday={weekday}
                          hourly={hourly}
                          summary={summary}
                          patternsSpacing={patternsSpacing}
                          patternsChartHeight={patternsChartHeight}
                        />
                      </div>
                    )}
                  </Suspense>

                  {/* Efficiency - Background loaded */}
                  <Suspense fallback={activeTab === 'efficiency' ? <TabFallback /> : null}>
                    {(activeTab === 'efficiency' || backgroundLoad) && (
                      <div className="horizontal-tab-transition" style={{ display: activeTab === 'efficiency' ? 'block' : 'none' }}>
                        <EfficiencyTab
                          key={activeTab === 'efficiency' ? 'efficiency-active' : 'efficiency-bg'}
                          summary={summary}
                          monthly={monthly}
                          effScatter={effScatter}
                          largeChartHeight={largeChartHeight}
                        />
                      </div>
                    )}
                  </Suspense>

                  {/* Records - Background loaded */}
                  <Suspense fallback={activeTab === 'records' ? <TabFallback /> : null}>
                    {(activeTab === 'records' || backgroundLoad) && (
                      <div className="horizontal-tab-transition" style={{ display: activeTab === 'records' ? 'block' : 'none' }}>
                        <RecordsTab
                          key={activeTab === 'records' ? 'records-active' : 'records-bg'}
                          summary={summary}
                          top={top}
                          recordsItemPadding={recordsItemPadding}
                          recordsItemPaddingHorizontal={recordsItemPaddingHorizontal}
                          recordsListHeightHorizontal={recordsListHeightHorizontal}
                        />
                      </div>
                    )}
                  </Suspense>

                  {/* History - Background loaded */}
                  <Suspense fallback={activeTab === 'history' ? <TabFallback /> : null}>
                    {(activeTab === 'history' || backgroundLoad) && (
                      <div className="horizontal-tab-transition" style={{ display: activeTab === 'history' ? 'block' : 'none' }}>
                        <HistoryTab
                          key={activeTab === 'history' ? 'history-active' : 'history-bg'}
                          filtered={filtered}
                          openTripDetail={openTripDetail}
                          setShowAllTripsModal={setShowAllTripsModal}
                        />
                      </div>
                    )}
                  </Suspense>
                </>
              )}
            </div>
          )}

          {/* Bottom Navigation Bar - Only show in vertical mode */}
          {layoutMode === 'vertical' && (
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-100 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-700/50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
              <div className="max-w-7xl mx-auto px-2 py-2">
                <div role="tablist" aria-label="Main navigation" className="flex justify-around items-center">
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={activeTab === t.id}
                      aria-controls={`tabpanel-${t.id}`}
                      onClick={() => handleTabClick(t.id)}
                      className="flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all min-w-0 flex-1"
                      style={{
                        backgroundColor: activeTab === t.id ? BYD_RED + '20' : 'transparent',
                        color: activeTab === t.id ? BYD_RED : ''
                      }}
                    >
                      <t.icon className={`w-6 h-6 mb-1 ${activeTab !== t.id ? 'text-slate-600 dark:text-slate-400' : ''}`} />
                      <span className={`text-[10px] font-medium ${activeTab !== t.id ? 'text-slate-600 dark:text-slate-400' : ''}`}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div >
      <Suspense fallback={null}>
        <PWAManagerLazy layoutMode={layoutMode} isCompact={isCompact} />
      </Suspense>
    </div >
  );
}
