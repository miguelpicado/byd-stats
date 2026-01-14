import React, { useState, useCallback, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';

import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Line as LineJS, Bar as BarJS, Pie as PieJS, Radar as RadarJS, Scatter as ScatterJS } from 'react-chartjs-2';

// Import extracted utilities (code splitting for utils)
import { formatMonth, formatDate, formatTime } from './utils/dateUtils';
import { processData } from './utils/dataProcessing';
// Formatters are defined locally in this file for performance
import './utils/chartSetup'; // Register Chart.js components
import { useGoogleSync } from './hooks/useGoogleSync';

// Components
import { BYDLogo, Battery, Zap, MapPin, Clock, TrendingUp, Calendar, Upload, Car, Activity, BarChart3, AlertCircle, Filter, Plus, List, Settings, Download, Database, HelpCircle, Mail, Bug, GitHub, Navigation, Maximize, Minimize, Cloud, ChevronDown, ChevronUp, ChevronLeft, Shield, FileText, X, BYD_RED } from './components/Icons.jsx';
import StatCard from './components/ui/StatCard';
import ChartCard from './components/ui/ChartCard';
import TripCard from './components/cards/TripCard';
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


// Lazy load modals for code splitting
const SettingsModalLazy = lazy(() => import('./components/modals/SettingsModal'));
const FilterModalLazy = lazy(() => import('./components/modals/FilterModal'));
const TripDetailModalLazy = lazy(() => import('./components/modals/TripDetailModal'));
const HistoryModalLazy = lazy(() => import('./components/modals/HistoryModal'));
const DatabaseUploadModalLazy = lazy(() => import('./components/modals/DatabaseUploadModal'));
const LegalModalLazy = lazy(() => import('./components/modals/LegalModal'));
const LegalPageLazy = lazy(() => import('./pages/LegalPage'));

const STORAGE_KEY = 'byd_stats_data';
const TRIP_HISTORY_KEY = 'byd_trip_history';
const TAB_PADDING = '12px 12px calc(96px + env(safe-area-inset-bottom)) 12px';
const COMPACT_TAB_PADDING = '8px 10px calc(80px + env(safe-area-inset-bottom)) 10px';
const COMPACT_SPACE_Y = 'space-y-3';


const GitHubFooter = React.memo(() => (
  <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700/50">
    <a
      href="https://github.com/miguelpicado/byd-stats"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mx-auto w-fit"
    >
      <GitHub className="w-5 h-5" />
      <span>Ver en GitHub</span>
    </a>
  </div>
));


// Tab loading fallback component
const TabFallback = () => (
  <div className="flex items-center justify-center h-48">
    <div className="animate-pulse text-slate-400 dark:text-slate-500">
      Loading...
    </div>
  </div>
);

// processData imported from utils/dataProcessing.js

// Helper functions
const calculateScore = (efficiency, minEff, maxEff) => {
  if (!efficiency || maxEff === minEff) return 5;
  // minEff is the best (lowest consumption), maxEff is the worst (highest consumption)
  // Score should be 10 when efficiency equals minEff (best)
  // Score should be 0 when efficiency equals maxEff (worst)
  const normalized = (maxEff - efficiency) / (maxEff - minEff);
  return Math.max(0, Math.min(10, normalized * 10));
};

// Get color based on score (0=red, 5=orange, 10=green)
const getScoreColor = (score) => {
  if (score >= 5) {
    // Green to orange (score 5-10)
    const ratio = (score - 5) / 5;
    const r = Math.round(255 - ratio * 155);
    const g = Math.round(165 + ratio * 90);
    return `rgb(${r}, ${g}, 0)`;
  } else {
    // Red to orange (score 0-5)
    const ratio = score / 5;
    const r = Math.round(234 + ratio * 21);
    const g = Math.round(ratio * 165);
    return `rgb(${r}, ${g}, 41)`;
  }
};



export default function BYDStatsAnalyzer() {
  const { t, i18n } = useTranslation();

  const [rawTrips, setRawTrips] = useState([]);
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
  const [filterType, setFilterType] = useState('all');
  const [selMonth, setSelMonth] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [tripHistory, setTripHistory] = useState([]);



  // Context state - Settings from AppContext, Layout from LayoutContext
  const { settings, updateSettings } = useApp();
  const { layoutMode, isCompact, isFullscreenBYD, isVertical, isLargerCard } = useLayout();

  // Calculate chart heights based on mode
  // Different tabs use different heights to maintain proper proportions

  // Small charts for Resumen: originally 275/326
  let smallChartHeight;
  if (isVertical) smallChartHeight = 350;
  else if (isFullscreenBYD) smallChartHeight = 271;
  else if (isCompact) smallChartHeight = 295;
  else smallChartHeight = 326;

  // Charts for Patrones (viajes por día): need more height
  let patternsChartHeight;
  if (isVertical) patternsChartHeight = 350;
  else if (isFullscreenBYD) patternsChartHeight = 289;
  else if (isCompact) patternsChartHeight = 303;
  else patternsChartHeight = 336;

  // Large charts (Tendencias, Eficiencia): originally 350/450
  let largeChartHeight;
  if (isVertical) largeChartHeight = 350;
  else if (isFullscreenBYD) largeChartHeight = 387;
  else if (isCompact) largeChartHeight = 369;
  else largeChartHeight = 442;

  // Spacing adjustments for different modes
  const unifiedVerticalSpacing = 'space-y-4';

  // Overview/Resumen spacing (vertical mode): fullscreenBYD +2px, compact +1px, normal +2px
  const overviewSpacingVertical = isVertical ? unifiedVerticalSpacing : (isFullscreenBYD ? 'space-y-[14px]' : (isCompact ? 'space-y-2.5' : 'space-y-3.5 sm:space-y-5'));
  // Overview/Resumen spacing (horizontal mode): fullscreenBYD +2px, compact +1px, normal +2px
  const overviewSpacingHorizontal = isFullscreenBYD ? 'space-y-[22px]' : (isCompact ? 'space-y-2.5' : 'space-y-5 sm:space-y-6.5');

  // Patterns spacing: fullscreenBYD +10px, normal +7px (was +5px, now +2px more)
  const patternsSpacing = isVertical ? unifiedVerticalSpacing : (isFullscreenBYD ? 'space-y-[21px]' : (isCompact ? 'space-y-3' : 'space-y-[22px]'));

  // Records list item padding
  const recordsItemPadding = isFullscreenBYD ? 'py-0.5' : (isCompact ? 'py-[1px]' : 'py-1.5');
  const recordsItemPaddingHorizontal = isFullscreenBYD ? 'py-1' : (isCompact ? 'py-[1.5px]' : 'py-2');
  const recordsListHeightHorizontal = isFullscreenBYD ? 'h-[389px]' : (isCompact ? 'h-[369px]' : 'h-[442px]');

  // DEBUG: Log to verify mode detection
  console.log('[DEBUG] Mode detection:', {
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
  // Use state callback ref to safely detect when the container is mounted/unmounted
  const [swipeContainer, setSwipeContainer] = useState(null);



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
        console.error(`Error attempting to enable fullscreen mode: ${e.message} (${e.name})`);
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
      console.error('Error saving settings:', e);
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
          .catch(e => console.error('StatusBar error:', e));
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

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) {
        const p = JSON.parse(s);
        if (Array.isArray(p) && p.length > 0) {
          setRawTrips(p);
        }
      }

      // Load trip history
      const h = localStorage.getItem(TRIP_HISTORY_KEY);
      if (h) {
        const history = JSON.parse(h);
        if (Array.isArray(history)) setTripHistory(history);
      }
    } catch (e) {
      console.error('Error loading from localStorage:', e);
    }
  }, []);

  useEffect(() => {
    if (rawTrips.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rawTrips));
      } catch (e) {
        console.error('Error saving to localStorage:', e);
      }
    }
  }, [rawTrips]);

  // Save trip history to localStorage
  useEffect(() => {
    if (tripHistory.length > 0) {
      try {
        localStorage.setItem(TRIP_HISTORY_KEY, JSON.stringify(tripHistory));
      } catch (e) {
        console.error('Error saving trip history:', e);
      }
    }
  }, [tripHistory]);



  useEffect(() => {
    initSql();
  }, [initSql]);

  // Handle file opening and sharing (both Android native and PWA)
  useEffect(() => {
    if (!pendingFile || !sqlReady) return;

    const handleSharedFile = async () => {
      try {
        console.log('[FileHandling] Processing pending file from:', pendingFile.source);

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
          console.log('[FileHandling] File processed successfully:', trips.length, 'trips');

          // Show success message
          alert(t('upload.success') || 'Archivo cargado correctamente');
        }

        clearPendingFile();
      } catch (err) {
        console.error('[FileHandling] Error processing file:', err);
        alert(t('errors.processingFile') || 'Error al procesar el archivo: ' + err.message);
        clearPendingFile();
      }
    };

    handleSharedFile();
  }, [pendingFile, sqlReady, readFile, processDBHook, clearPendingFile, rawTrips, t]);

  const months = useMemo(() => {
    return [...new Set(rawTrips.map(t => t.month).filter(Boolean))].sort();
  }, [rawTrips]);

  const filtered = useMemo(() => {
    if (rawTrips.length === 0) return [];
    if (filterType === 'month' && selMonth) {
      return rawTrips.filter(t => t.month === selMonth);
    }
    if (filterType === 'range') {
      let r = [...rawTrips];
      if (dateFrom) r = r.filter(t => t.date >= dateFrom.replace(/-/g, ''));
      if (dateTo) r = r.filter(t => t.date <= dateTo.replace(/-/g, ''));
      return r;
    }
    return rawTrips;
  }, [rawTrips, filterType, selMonth, dateFrom, dateTo]);

  const data = useMemo(() => {
    return filtered.length > 0 ? processData(filtered) : null;
  }, [filtered, i18n.language]);



  const processDB = useCallback(async (file, merge = false) => {
    const trips = await processDBHook(file, merge ? rawTrips : [], merge);
    if (trips) {
      setRawTrips(trips);
      // Auto-sync if connected
      if (googleSync.isAuthenticated) {
        console.log("Auto-syncing new data to cloud...");
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

  const clearData = useCallback(() => {
    if (window.confirm(t('confirmations.deleteAllData'))) {
      setRawTrips([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [t]);

  // Export database to EC_Database.db format
  const exportDatabase = useCallback(async () => {
    const success = await exportDBHook(filtered);
    if (success) alert(t('confirmations.dbExported'));
  }, [exportDBHook, filtered, t]);

  // Save current trips to history
  const saveToHistory = useCallback(() => {
    if (rawTrips.length === 0) {
      alert(t('confirmations.noTripsToSave'));
      return;
    }

    // Merge current trips with existing history using unique key
    const map = new Map();

    // Add existing history
    tripHistory.forEach(t => map.set(t.date + '-' + t.start_timestamp, t));

    // Add current trips
    rawTrips.forEach(t => map.set(t.date + '-' + t.start_timestamp, t));

    const newHistory = Array.from(map.values()).sort((a, b) =>
      (a.date || '').localeCompare(b.date || '')
    );

    setTripHistory(newHistory);
    alert(t('confirmations.historySaved', { total: newHistory.length, new: newHistory.length - tripHistory.length }));
  }, [rawTrips, tripHistory, t]);

  // Load history as current trips
  const loadFromHistory = useCallback(() => {
    if (tripHistory.length === 0) {
      alert(t('confirmations.noHistory'));
      return;
    }

    if (window.confirm(t('confirmations.loadHistory', { count: tripHistory.length }))) {
      setRawTrips(tripHistory);
    }
  }, [tripHistory, t]);

  // Clear trip history
  const clearHistory = useCallback(() => {
    if (window.confirm(t('confirmations.clearHistory'))) {
      setTripHistory([]);
      localStorage.removeItem(TRIP_HISTORY_KEY);
      alert(t('confirmations.historyCleared'));
    }
  }, [t]);

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


  // Swipe gesture - completely rewritten with refs


  // Refs to hold latest values for swipe handlers (avoid re-registering listeners)
  const activeTabRef = useRef(activeTab);
  const isTransitioningRef = useRef(isTransitioning);
  const handleTabClickRef = useRef(handleTabClick);

  // Keep refs updated
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { isTransitioningRef.current = isTransitioning; }, [isTransitioning]);
  useEffect(() => { handleTabClickRef.current = handleTabClick; }, [handleTabClick]);

  // Swipe detection using native event listeners for better performance
  // Enabled for both modes: horizontal swipe for vertical mode, vertical swipe for horizontal mode
  // Uses refs to avoid re-registering listeners on every state change
  const layoutModeRef = useRef(layoutMode);
  useEffect(() => { layoutModeRef.current = layoutMode; }, [layoutMode]);

  useEffect(() => {
    // Require container to be available
    if (!swipeContainer) return;

    const container = swipeContainer;
    let swipeDirection = null;
    let initialScrollTop = 0;
    const isHorizontalMode = layoutModeRef.current === 'horizontal';

    const handleTouchStart = (e) => {
      if (isTransitioningRef.current) return;
      const touch = e.touches[0];
      touchStartRef.current = touch.clientX;
      touchStartYRef.current = touch.clientY;
      swipeDirection = null;
      // Capture initial scroll position at start of touch
      initialScrollTop = container.scrollTop;
    };

    const handleTouchMove = (e) => {
      if (!touchStartRef.current || isTransitioningRef.current) return;

      const touch = e.touches[0];
      const diffX = Math.abs(touch.clientX - touchStartRef.current);
      const diffY = Math.abs(touch.clientY - touchStartYRef.current);

      // Detectar dirección solo una vez
      if (!swipeDirection) {
        swipeDirection = diffX > diffY ? 'horizontal' : 'vertical';
      }

      const currentMode = layoutModeRef.current;

      // En modo vertical: prevenir scroll si swipe horizontal (para cambio de tabs)
      if (currentMode === 'vertical' && swipeDirection === 'horizontal' && diffX > 10) {
        if (e.cancelable) e.preventDefault();
      }
      // En modo horizontal: SOLO prevenir scroll nativo si:
      // 1. Estamos en el tope del scroll (scrollTop <= 5)
      // 2. El gesto es hacia ABAJO (swipe down = ir a tab anterior)
      // En todos los demás casos, permitir scroll nativo
      else if (currentMode === 'horizontal' && swipeDirection === 'vertical') {
        const actualDiffY = touch.clientY - touchStartYRef.current;
        const isSwipingDown = actualDiffY > 0;
        const wasAtTop = initialScrollTop <= 5;

        // Solo prevenir si estábamos en el top Y vamos hacia abajo (tab anterior)
        if (wasAtTop && isSwipingDown && diffY > 10) {
          if (e.cancelable) e.preventDefault();
        }
        // Si no se cumplen las condiciones, el scroll nativo funciona normalmente
      }
    };

    const handleTouchEnd = (e) => {
      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      const diffX = touch.clientX - touchStartRef.current;
      const diffY = touch.clientY - touchStartYRef.current;
      const currentMode = layoutModeRef.current;

      const currentIndex = tabs.findIndex(t => t.id === activeTabRef.current);

      if (currentMode === 'vertical') {
        // Modo vertical: swipe horizontal para cambiar tabs
        if (swipeDirection === 'horizontal' && Math.abs(diffX) > minSwipeDistance) {
          if (diffX < 0 && currentIndex < tabs.length - 1) {
            // Swipe left - siguiente tab
            handleTabClickRef.current(tabs[currentIndex + 1].id);
          } else if (diffX > 0 && currentIndex > 0) {
            // Swipe right - tab anterior
            handleTabClickRef.current(tabs[currentIndex - 1].id);
          }
        }
      } else {
        // Modo horizontal: swipe vertical para cambiar tabs
        // PRIORIDAD: scroll nativo siempre funciona
        // Solo cambiar tab cuando:
        // - Swipe DOWN + scroll en el TOP = ir a tab anterior
        // - Swipe UP + scroll en el BOTTOM = ir a siguiente tab
        if (swipeDirection === 'vertical' && Math.abs(diffY) > minSwipeDistance) {
          const wasAtTop = initialScrollTop <= 5;
          const scrollHeight = container.scrollHeight;
          const clientHeight = container.clientHeight;
          const wasAtBottom = initialScrollTop + clientHeight >= scrollHeight - 5;

          if (diffY > 0 && currentIndex > 0 && wasAtTop) {
            // Swipe down + en el top = ir a tab anterior
            handleTabClickRef.current(tabs[currentIndex - 1].id);
          } else if (diffY < 0 && currentIndex < tabs.length - 1 && wasAtBottom) {
            // Swipe up + en el bottom = ir a siguiente tab
            handleTabClickRef.current(tabs[currentIndex + 1].id);
          }
          // En cualquier otra posición, el scroll nativo funciona
        }
      }

      // Reset
      touchStartRef.current = null;
      touchStartYRef.current = null;
      swipeDirection = null;
      initialScrollTop = 0;
    };

    // Agregar event listeners
    // Usamos non-passive en touchmove para poder prevenir el scroll nativo cuando sea necesario
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [layoutMode, tabs, minSwipeDistance, swipeContainer]);

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

        {/* Legal Modal available on Landing Page */}
        <Suspense fallback={null}>
          <LegalModalLazy
            isOpen={showLegalModal}
            onClose={() => setShowLegalModal(false)}
            initialSection={legalInitialSection}
          />
        </Suspense>

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
          <p className="text-[10px] text-slate-600 pl-1">BYD Stats v1.2</p>
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
        {/* Trip Detail Modal */}
        <Suspense fallback={null}>
          <TripDetailModalLazy
            isOpen={showTripDetailModal}
            onClose={() => { setShowTripDetailModal(false); setSelectedTrip(null); }}
            trip={selectedTrip}
            allTrips={rawTrips}
            summary={data?.summary}
            settings={settings}
          />
        </Suspense>

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

        {/* Trip List */}
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 pb-8">
          <div className="space-y-3">
            {allTripsFiltered.map((trip, i) => (
              <TripCard
                key={i}
                trip={trip}
                minEff={minEff}
                maxEff={maxEff}
                onClick={openTripDetail}
                isCompact={false}
              />
            ))}
          </div>
        </div>
      </div >
    );
  }

  return (
    <div
      ref={setSwipeContainer}
      className="fixed inset-0 flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 text-slate-900 dark:text-slate-900 dark:text-white overflow-hidden transition-colors"
    >
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Actualizar datos</h3>
            <div className="space-y-3">
              <label className="block cursor-pointer border-2 border-dashed border-slate-600 rounded-xl p-6 text-center hover:border-green-500 transition-colors">
                <input type="file" accept="*/*,image/*,.db,.jpg,.jpeg" className="hidden" onChange={(e) => onFile(e, true)} />
                <Plus className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-slate-900 dark:text-white">Combinar con existentes</p>
              </label>
              <label className="block cursor-pointer border-2 border-dashed border-slate-600 rounded-xl p-6 text-center hover:border-amber-500 transition-colors">
                <input type="file" accept="*/*,image/*,.db,.jpg,.jpeg" className="hidden" onChange={(e) => onFile(e, false)} />
                <Upload className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p className="text-slate-900 dark:text-white">Reemplazar todo</p>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600">Cancelar</button>
              <button onClick={clearData} className="py-2 px-4 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30">Borrar todo</button>
            </div>
          </div>
        </div>
      )}

      {/* Trip Detail Modal */}
      <Suspense fallback={null}>
        <TripDetailModalLazy
          isOpen={showTripDetailModal}
          onClose={() => { setShowTripDetailModal(false); setSelectedTrip(null); }}
          trip={selectedTrip}
          allTrips={rawTrips}
          summary={data?.summary}
          settings={settings}
        />
      </Suspense>

      {/* Settings Modal */}
      <Suspense fallback={null}>
        <SettingsModalLazy
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          settings={settings}
          onSettingsChange={updateSettings}
          googleSync={googleSync}
        />
      </Suspense>

      {/* Database Management Modal (Unified) */}
      <DatabaseUploadModalLazy
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        sqlReady={sqlReady}
        onFileSelect={processDB}
        onExport={exportDatabase}
        onClearData={() => {
          setRawTrips([]);
          localStorage.removeItem(STORAGE_KEY);
        }}
        onShowHistory={() => { }}
        onSaveToHistory={saveToHistory}
        onClearHistory={clearHistory}
        hasData={rawTrips.length > 0}
        historyCount={tripHistory.length}
        isNative={isNative}
      />

      {/* History Modal */}


      <Suspense fallback={null}>
        <LegalModalLazy
          isOpen={showLegalModal}
          onClose={() => setShowLegalModal(false)}
          initialSection={legalInitialSection}
        />
      </Suspense>

      {/* Help/Bug Report Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowHelpModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('help.title')}</h2>
              </div>
              <button onClick={() => setShowHelpModal(false)} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  {t('help.subtitle')}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500">
                  {t('help.description')}
                </p>
              </div>

              <div className="space-y-2">
                <a
                  href="https://github.com/miguelpicado/byd-stats/issues/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-xl font-medium text-white flex items-center justify-center gap-2"
                  style={{ backgroundColor: BYD_RED }}
                >
                  <Bug className="w-5 h-5" />
                  {t('help.reportBug')}
                </a>

                <a
                  href="https://github.com/miguelpicado/byd-stats"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-xl font-medium text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                >
                  <GitHub className="w-5 h-5" />
                  {t('footer.github')}
                </a>

                <a
                  href="mailto:contacto@bydstats.com?subject=BYD Stats - Contacto&body=Hola,%0A%0AMe gustaría contactar sobre..."
                  className="w-full py-3 rounded-xl font-medium text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Mail className="w-5 h-5" />
                  {t('footer.email')}
                </a>

                <button
                  onClick={() => { setLegalInitialSection('privacy'); setShowLegalModal(true); }}
                  className="w-full py-3 rounded-xl font-medium text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Shield className="w-5 h-5" />
                  {t('footer.legal')}
                </button>
              </div>

              <div className="text-center text-xs text-slate-500 dark:text-slate-500 pt-2">
                <p>BYD Stats Analyzer v1.2</p>
                <p className="mt-1">{t('footer.madeWith')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

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
            <div className="p-4 space-y-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
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
                    <p className="text-slate-400">No hay datos para mostrar</p>
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
            // Horizontal layout: show only active tab content
            // Removed key={activeTab} to prevent unmounting when switching tabs
            <div ref={setSwipeContainer} className="tab-content-container horizontal-tab-transition" style={{ padding: isCompact ? '8px 10px' : '12px', height: '100%', overflowY: 'auto' }}>
              {!data ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800/30 rounded-2xl">
                  <AlertCircle className="w-12 h-12 text-slate-500 dark:text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-400">No hay datos para mostrar</p>
                </div>
              ) : (
                <>
                  <div style={{ display: activeTab === 'overview' ? 'block' : 'none' }}>
                    {(activeTab === 'overview' || backgroundLoad) && (
                      <OverviewTab
                        key={activeTab === 'overview' ? 'active' : 'bg'}
                        summary={summary}
                        monthly={monthly}
                        tripDist={tripDist}
                        smallChartHeight={smallChartHeight}
                        overviewSpacing={overviewSpacingHorizontal}
                      />
                    )}
                  </div>

                  <Suspense fallback={<TabFallback />}>
                    <div style={{ display: activeTab === 'trends' ? 'block' : 'none' }}>
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
                    </div>
                  </Suspense>

                  <Suspense fallback={<TabFallback />}>
                    <div style={{ display: activeTab === 'patterns' ? 'block' : 'none' }}>
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
                    </div>
                  </Suspense>

                  <Suspense fallback={<TabFallback />}>
                    <div style={{ display: activeTab === 'efficiency' ? 'block' : 'none' }}>
                      {(activeTab === 'efficiency' || backgroundLoad) && (
                        <EfficiencyTab
                          key={activeTab === 'efficiency' ? 'active' : 'bg'}
                          summary={summary}
                          monthly={monthly}
                          effScatter={effScatter}
                          largeChartHeight={largeChartHeight}
                        />
                      )}
                    </div>
                  </Suspense>

                  <Suspense fallback={<TabFallback />}>
                    <div style={{ display: activeTab === 'records' ? 'block' : 'none' }}>
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
                    </div>
                  </Suspense>

                  <Suspense fallback={<TabFallback />}>
                    <div style={{ display: activeTab === 'history' ? 'block' : 'none' }}>
                      {(activeTab === 'history' || backgroundLoad) && (
                        <HistoryTab
                          key={activeTab === 'history' ? 'active' : 'bg'}
                          filtered={filtered}
                          openTripDetail={openTripDetail}
                          setShowAllTripsModal={setShowAllTripsModal}
                        />
                      )}
                    </div>
                  </Suspense>
                </>
              )}
            </div>
          )}

          {/* Filter Modal */}
          {showFilterModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowFilterModal(false)}>
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
              <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('filter.title')}</h2>
                  </div>
                  <button onClick={() => setShowFilterModal(false)} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Filter Type Buttons */}
                  <div className="space-y-2">
                    <label className="text-slate-600 dark:text-slate-400 text-sm">{t('filter.type')}:</label>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => { setFilterType('all'); setSelMonth(''); setDateFrom(''); setDateTo(''); }}
                        className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left ${filterType === 'all'
                          ? 'text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                          }`}
                        style={{
                          backgroundColor: filterType === 'all' ? BYD_RED : ''
                        }}
                      >
                        📊 {t('filter.all')} ({rawTrips.length})
                      </button>
                      <button
                        onClick={() => setFilterType('month')}
                        className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left ${filterType === 'month'
                          ? 'text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                          }`}
                        style={{
                          backgroundColor: filterType === 'month' ? BYD_RED : ''
                        }}
                      >
                        📅 {t('filter.byMonth')}
                      </button>
                      <button
                        onClick={() => setFilterType('range')}
                        className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left ${filterType === 'range'
                          ? 'text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                          }`}
                        style={{
                          backgroundColor: filterType === 'range' ? BYD_RED : ''
                        }}
                      >
                        📆 {t('filter.byRange')}
                      </button>
                    </div>
                  </div>

                  {/* Month Selector */}
                  {filterType === 'month' && (
                    <div className="space-y-2">
                      <label className="text-slate-600 dark:text-slate-400 text-sm">{t('filter.selectMonth')}:</label>
                      <select
                        value={selMonth}
                        onChange={(e) => setSelMonth(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-600 text-sm"
                      >
                        <option value="">{t('filter.allMonths')}</option>
                        {months.map((m) => (
                          <option key={m} value={m}>{formatMonth(m)}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Date Range Selector */}
                  {filterType === 'range' && (
                    <div className="space-y-2">
                      <label className="text-slate-600 dark:text-slate-400 text-sm">{t('filter.byRange')}:</label>
                      <div className="flex flex-col gap-2">
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-600 text-sm"
                          placeholder={t('filter.from')}
                        />
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-600 text-sm"
                          placeholder={t('filter.to')}
                        />
                      </div>
                    </div>
                  )}

                  {/* Results Count */}
                  {filtered.length !== rawTrips.length && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-center text-sm">
                        <span className="text-slate-400">{t('filter.showing')} </span>
                        <span className="font-bold" style={{ color: BYD_RED }}>{filtered.length}</span>
                        <span className="text-slate-400"> {t('filter.of')} {rawTrips.length} {t('stats.trips').toLowerCase()}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Apply Button */}
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="w-full mt-6 py-3 rounded-xl font-medium text-white"
                  style={{ backgroundColor: BYD_RED }}
                >
                  {t('filter.apply')}
                </button>
              </div>
            </div>
          )}

          {/* Bottom Navigation Bar - Only show in vertical mode */}
          {layoutMode === 'vertical' && (
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-100 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-700/50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
              <div className="max-w-7xl mx-auto px-2 py-2">
                <div className="flex justify-around items-center">
                  {tabs.map((t) => (
                    <button
                      key={t.id}
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
