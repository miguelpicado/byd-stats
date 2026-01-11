import React, { useState, useCallback, useEffect, useMemo, useRef, Suspense, lazy } from 'react';

import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Line as LineJS, Bar as BarJS, Pie as PieJS, Radar as RadarJS, Scatter as ScatterJS } from 'react-chartjs-2';

// Import extracted utilities (code splitting for utils)
import { formatMonth, formatDate, formatTime } from './utils/dateUtils';
import { calculateScore as calculateScoreUtil, getScoreColor as getScoreColorUtil, formatDuration as formatDurationUtil, calculatePercentile as calculatePercentileUtil } from './utils/formatters';
import './utils/chartSetup'; // Register Chart.js components
import { useGoogleSync } from './hooks/useGoogleSync';

// Components
import { BYDLogo, Battery, Zap, MapPin, Clock, TrendingUp, Calendar, Upload, Car, Activity, BarChart3, AlertCircle, Filter, Plus, List, Settings, Download, Database, HelpCircle, Mail, Bug, GitHub, Navigation, Maximize, Minimize, Cloud, ChevronDown, ChevronUp, ChevronLeft, Shield, FileText, X, BYD_RED } from './components/Icons.jsx';
import StatCard from './components/ui/StatCard';
import ChartCard from './components/ui/ChartCard';
import PWAManager from './components/PWAManager';

import useDatabase from './hooks/useDatabase';
import { useApp } from './context/AppContext';


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
const dayNamesFull = { 'Lun': 'Lunes', 'Mar': 'Martes', 'Mié': 'Miércoles', 'Jue': 'Jueves', 'Vie': 'Viernes', 'Sáb': 'Sábado', 'Dom': 'Domingo' };

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



function processData(rows) {
  if (!rows || rows.length === 0) return null;
  const trips = rows.filter(r => r && typeof r.trip === 'number' && r.trip > 0);
  if (trips.length === 0) return null;

  const totalKm = trips.reduce((s, r) => s + (r.trip || 0), 0);
  const totalKwh = trips.reduce((s, r) => s + (r.electricity || 0), 0);
  const totalDuration = trips.reduce((s, r) => s + (r.duration || 0), 0);
  if (totalKm === 0) return null;

  const monthlyData = {};
  const dailyData = {};
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({ hour: i, trips: 0, km: 0 }));
  const weekdayData = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => ({ day: d, trips: 0, km: 0 }));

  trips.forEach(trip => {
    const m = trip.month || 'unknown';
    if (!monthlyData[m]) monthlyData[m] = { month: m, trips: 0, km: 0, kwh: 0 };
    monthlyData[m].trips++;
    monthlyData[m].km += trip.trip || 0;
    monthlyData[m].kwh += trip.electricity || 0;

    const d = trip.date || 'unknown';
    if (!dailyData[d]) dailyData[d] = { date: d, trips: 0, km: 0, kwh: 0 };
    dailyData[d].trips++;
    dailyData[d].km += trip.trip || 0;
    dailyData[d].kwh += trip.electricity || 0;

    if (trip.start_timestamp) {
      try {
        const dt = new Date(trip.start_timestamp * 1000);
        const h = dt.getHours();
        const w = dt.getDay();
        hourlyData[h].trips++;
        hourlyData[h].km += trip.trip || 0;
        // Reorder weekday index: 0 (Sun) -> 6, 1 (Mon) -> 0, 2 (Tue) -> 1, etc.
        const weekdayIndex = (w + 6) % 7;
        weekdayData[weekdayIndex].trips++;
        weekdayData[weekdayIndex].km += trip.trip || 0;
      } catch (e) {
        console.error('Error processing timestamp:', e);
      }
    }
  });


  const monthlyArray = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
  monthlyArray.forEach(m => {
    m.efficiency = m.km > 0 ? (m.kwh / m.km * 100) : 0;
    m.monthLabel = formatMonth(m.month);
  });

  const dailyArray = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
  dailyArray.forEach(d => {
    d.efficiency = d.km > 0 ? (d.kwh / d.km * 100) : 0;
    d.dateLabel = formatDate(d.date);
  });

  const tripDistribution = [
    { range: '0-5', count: 0, color: '#06b6d4' },
    { range: '5-15', count: 0, color: '#10b981' },
    { range: '15-30', count: 0, color: '#f59e0b' },
    { range: '30-50', count: 0, color: BYD_RED },
    { range: '50+', count: 0, color: '#8b5cf6' }
  ];
  trips.forEach(t => {
    const km = t.trip || 0;
    if (km <= 5) tripDistribution[0].count++;
    else if (km <= 15) tripDistribution[1].count++;
    else if (km <= 30) tripDistribution[2].count++;
    else if (km <= 50) tripDistribution[3].count++;
    else tripDistribution[4].count++;
  });

  const efficiencyScatter = trips
    .filter(t => t.trip > 0 && t.electricity > 0)
    .map(t => ({ x: t.trip, y: (t.electricity / t.trip) * 100 }))
    .filter(t => t.y > 0 && t.y < 50)
    .sort((a, b) => a.x - b.x);

  const sortedByKm = [...trips].sort((a, b) => (b.trip || 0) - (a.trip || 0));
  const sortedByKwh = [...trips].sort((a, b) => (b.electricity || 0) - (a.electricity || 0));
  const sortedByDur = [...trips].sort((a, b) => (b.duration || 0) - (a.duration || 0));
  const daysActive = new Set(trips.map(t => t.date).filter(Boolean)).size || 1;
  const sorted = [...trips].sort((a, b) => (a.start_timestamp || 0) - (b.start_timestamp || 0));

  // Calculate total span of days in the database using timestamps
  const firstTs = sorted[0]?.start_timestamp;
  const lastTs = sorted[sorted.length - 1]?.start_timestamp;
  const totalDays = (firstTs && lastTs)
    ? Math.max(1, Math.ceil((lastTs - firstTs) / (24 * 3600)) + 1)
    : daysActive;

  return {
    summary: {
      totalTrips: trips.length,
      totalKm: totalKm.toFixed(1),
      totalKwh: totalKwh.toFixed(1),
      totalHours: (totalDuration / 3600).toFixed(1),
      avgEff: totalKm > 0 ? (totalKwh / totalKm * 100).toFixed(2) : '0',
      avgKm: (totalKm / trips.length).toFixed(1),
      avgMin: totalDuration > 0 ? (totalDuration / trips.length / 60).toFixed(0) : '0',
      avgSpeed: totalDuration > 0 ? (totalKm / (totalDuration / 3600)).toFixed(1) : '0',
      daysActive,
      totalDays,
      dateRange: formatDate(sorted[0]?.date) + ' - ' + formatDate(sorted[sorted.length - 1]?.date),
      maxKm: sortedByKm[0]?.trip?.toFixed(1) || '0',
      minKm: sortedByKm[sortedByKm.length - 1]?.trip?.toFixed(1) || '0',
      maxKwh: sortedByKwh[0]?.electricity?.toFixed(1) || '0',
      maxMin: ((sortedByDur[0]?.duration || 0) / 60).toFixed(0),
      tripsDay: (trips.length / daysActive).toFixed(1),
      kmDay: (totalKm / daysActive).toFixed(1)
    },
    monthly: monthlyArray,
    daily: dailyArray,
    hourly: hourlyData,
    weekday: weekdayData,
    tripDist: tripDistribution,
    effScatter: efficiencyScatter,
    top: {
      km: sortedByKm.slice(0, 10),
      kwh: sortedByKwh.slice(0, 10),
      dur: sortedByDur.slice(0, 10)
    }
  };
}

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
  const [rawTrips, setRawTrips] = useState([]);
  const { sqlReady, loading, error, setError, initSql, processDB: processDBHook, exportDatabase: exportDBHook } = useDatabase();
  const [activeTab, setActiveTab] = useState('overview');
  const [dragOver, setDragOver] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showAllTripsModal, setShowAllTripsModal] = useState(false);
  const [showTripDetailModal, setShowTripDetailModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalInitialSection, setLegalInitialSection] = useState('privacy');

  // Detect paths like /legal or /privacidad
  const isLegalPath = window.location.pathname.startsWith('/legal');
  const isPrivacyPath = window.location.pathname.startsWith('/privacidad');

  if (isLegalPath || isPrivacyPath) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Cargando...</div>}>
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



  // Context state
  const { settings, updateSettings, layoutMode, isCompact } = useApp();
  const isLargerCard = isCompact && layoutMode === 'horizontal';

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
  const swipeContainerRef = useRef(null);

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
      if (showTripDetailModal) {
        setShowTripDetailModal(false);
        setSelectedTrip(null);
      } else if (showSettingsModal) {
        setShowSettingsModal(false);
      } else if (showAllTripsModal) {
        setShowAllTripsModal(false);
      } else if (!canGoBack) {
        CapacitorApp.exitApp();
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

      // 2. Browser color-scheme (prevents BYD forced dark mode)
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';

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
  }, [filtered]);

  // Efficiency range calculation for scoring (not used directly but kept for logic reference if needed, but ESLint says it is unused)
  // Removing it to satisfy ESLint
  /*
  const efficiencyRange = useMemo(() => {
    const validTrips = filtered.filter(t => t.trip >= 1 && t.electricity !== 0);
    if (validTrips.length === 0) return { min: 0, max: 0, validTrips: [] };
    const efficiencies = validTrips.map(t => (t.electricity / t.trip) * 100);
    return {
      min: Math.min(...efficiencies),
      max: Math.max(...efficiencies),
      validTrips
    };
  }, [filtered]);
  */

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
        alert('Solo se admiten archivos *.DB o *.JPG (base de datos renombrada)\nEncuentra EC_Database.db en la carpeta "Energydata" del coche');
        return;
      }
      processDB(f, merge);
    }
  }, [processDB]);

  const onFile = useCallback((e, merge) => {
    const f = e.target.files[0];
    if (f) {
      // Validate that the file is a .DB or image file (renamed .db to .jpg)
      const fileName = f.name.toLowerCase();
      if (!fileName.endsWith('.db') && !fileName.endsWith('.jpg') && !fileName.endsWith('.jpeg')) {
        alert('Solo se admiten archivos *.DB o *.JPG (base de datos renombrada)\nEncuentra EC_Database.db en la carpeta "Energydata" del coche');
        e.target.value = '';
        return;
      }
      processDB(f, merge);
    }
    e.target.value = '';
  }, [processDB]);

  const clearData = useCallback(() => {
    if (window.confirm('¿Borrar todos los datos?')) {
      setRawTrips([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Export database to EC_Database.db format
  const exportDatabase = useCallback(async () => {
    const success = await exportDBHook(filtered);
    if (success) alert('Base de datos exportada correctamente');
  }, [exportDBHook, filtered]);

  // Save current trips to history
  const saveToHistory = useCallback(() => {
    if (rawTrips.length === 0) {
      alert('No hay viajes para guardar');
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
    alert(`Registro guardado: ${newHistory.length} viajes en total (${newHistory.length - tripHistory.length} nuevos)`);
  }, [rawTrips, tripHistory]);

  // Load history as current trips
  const loadFromHistory = useCallback(() => {
    if (tripHistory.length === 0) {
      alert('No hay historial guardado');
      return;
    }

    if (window.confirm(`¿Cargar ${tripHistory.length} viajes del historial?`)) {
      setRawTrips(tripHistory);
    }
  }, [tripHistory]);

  // Clear trip history
  const clearHistory = useCallback(() => {
    if (window.confirm('¿Borrar el historial de viajes permanentemente?')) {
      setTripHistory([]);
      localStorage.removeItem(TRIP_HISTORY_KEY);
      alert('Historial borrado');
    }
  }, []);

  // Memoized modal handlers to prevent unnecessary re-renders
  const handleOpenSettingsModal = useCallback(() => setShowSettingsModal(true), []);
  const handleCloseSettingsModal = useCallback(() => setShowSettingsModal(false), []);
  const handleOpenFilterModal = useCallback(() => setShowFilterModal(true), []);
  const handleCloseFilterModal = useCallback(() => setShowFilterModal(false), []);
  const handleOpenHelpModal = useCallback(() => setShowHelpModal(true), []);
  const handleCloseHelpModal = useCallback(() => setShowHelpModal(false), []);
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
    { id: 'overview', label: 'Resumen', icon: Activity },
    { id: 'trends', label: 'Tendencias', icon: TrendingUp },
    { id: 'patterns', label: 'Patrones', icon: Clock },
    { id: 'efficiency', label: 'Eficiencia', icon: Zap },
    { id: 'records', label: 'Récords', icon: BarChart3 },
    { id: 'history', label: 'Histórico', icon: List }
  ], []);

  const minSwipeDistance = 30; // Distancia mínima en píxeles
  const transitionDuration = 500;

  const handleTabClick = useCallback((tabId) => {
    if (tabId === activeTab) return;

    // Only use transitions in vertical layout mode
    if (layoutMode === 'vertical') {
      if (isTransitioning) return;
      setIsTransitioning(true);
      setActiveTab(tabId);
      setTimeout(() => {
        setIsTransitioning(false);
      }, transitionDuration);
    } else {
      // In horizontal mode, just switch tabs immediately
      setActiveTab(tabId);
    }
  }, [activeTab, layoutMode, isTransitioning, transitionDuration]);


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
  // Only enabled in vertical layout mode
  // Uses refs to avoid re-registering listeners on every state change
  useEffect(() => {
    // Only enable swipe in vertical mode
    if (layoutMode === 'horizontal') return;

    let mounted = true;
    let retryCount = 0;
    const maxRetries = 10;

    const setupSwipeHandlers = () => {
      const container = swipeContainerRef.current;

      // If container not ready yet, retry after a short delay
      if (!container) {
        if (retryCount < maxRetries && mounted) {
          retryCount++;
          requestAnimationFrame(setupSwipeHandlers);
        }
        return null;
      }

      let swipeDirection = null;

      const handleTouchStart = (e) => {
        if (isTransitioningRef.current) return;
        const touch = e.touches[0];
        touchStartRef.current = touch.clientX;
        touchStartYRef.current = touch.clientY;
        swipeDirection = null;
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

        // Si es swipe horizontal, prevenir scroll vertical
        if (swipeDirection === 'horizontal' && diffX > 10) {
          e.preventDefault();
        }
      };

      const handleTouchEnd = (e) => {
        if (!touchStartRef.current) return;

        const touch = e.changedTouches[0];
        const diffX = touch.clientX - touchStartRef.current;

        // Solo procesar si fue swipe horizontal
        if (swipeDirection === 'horizontal' && Math.abs(diffX) > minSwipeDistance) {
          const currentIndex = tabs.findIndex(t => t.id === activeTabRef.current);

          if (diffX < 0 && currentIndex < tabs.length - 1) {
            // Swipe left - siguiente tab
            handleTabClickRef.current(tabs[currentIndex + 1].id);
          } else if (diffX > 0 && currentIndex > 0) {
            // Swipe right - tab anterior
            handleTabClickRef.current(tabs[currentIndex - 1].id);
          }
        }

        // Reset
        touchStartRef.current = null;
        touchStartYRef.current = null;
        swipeDirection = null;
      };

      // Agregar event listeners con opciones pasivas cuando sea posible
      container.addEventListener('touchstart', handleTouchStart, { passive: true });
      container.addEventListener('touchmove', handleTouchMove, { passive: false }); // No pasivo para poder usar preventDefault
      container.addEventListener('touchend', handleTouchEnd, { passive: true });

      return () => {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
      };
    };

    // Start setup with requestAnimationFrame to ensure DOM is ready
    let cleanup = null;
    requestAnimationFrame(() => {
      if (mounted) {
        cleanup = setupSwipeHandlers();
      }
    });

    return () => {
      mounted = false;
      if (cleanup) cleanup();
    };
    return () => {
      mounted = false;
      if (cleanup) cleanup();
    };
  }, [layoutMode, tabs, minSwipeDistance, loading]); // Remove "loading" if not available in scope, but it is needed here to retry when data loads

  // Scroll to top Effect - Reset all containers when activeTab changes
  useEffect(() => {
    const containers = document.querySelectorAll('.tab-content-container');
    containers.forEach(container => {
      container.scrollTop = 0;
    });
  }, [activeTab]);





  const ChartTip = React.memo(({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-800 border border-slate-600 rounded-xl p-3 shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: payload[0]?.color || BYD_RED }}></div>
            <p className="text-slate-900 dark:text-white font-medium">{label}</p>
          </div>
          {payload.map((p, i) => (
            <p key={i} style={{ color: p.color }} className="text-sm font-medium">
              {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  });



  const TripCard = React.memo(({ trip, minEff, maxEff, onClick, formatDate, formatTime, calculateScore, getScoreColor, isCompact }) => {
    const efficiency = useMemo(() => {
      if (!trip.trip || trip.trip <= 0 || trip.electricity === undefined || trip.electricity === null) {
        return 0;
      }
      return (trip.electricity / trip.trip) * 100;
    }, [trip.trip, trip.electricity]);

    const score = useMemo(() =>
      calculateScore(efficiency, minEff, maxEff),
      [efficiency, minEff, maxEff, calculateScore]
    );

    const scoreColor = useMemo(() =>
      getScoreColor(score),
      [score, getScoreColor]
    );

    return (
      <div
        onClick={() => onClick(trip)}
        className={`bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors ${isCompact ? 'p-2' : 'p-3 sm:p-4'}`}
      >
        <div className={`text-center ${isCompact ? 'mb-1' : 'mb-3'}`}>
          <p className={`text-slate-900 dark:text-white font-semibold ${isCompact ? 'text-xs' : 'text-sm sm:text-base'}`}>
            {formatDate(trip.date)} · {formatTime(trip.start_timestamp)}
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <p className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[9px] mb-0.5' : 'text-[10px] sm:text-xs mb-1'}`}>Distancia</p>
            <p className={`text-slate-900 dark:text-white font-bold ${isCompact ? 'text-sm' : 'text-base sm:text-xl'}`}>{trip.trip?.toFixed(1)}</p>
            <p className={`text-slate-500 dark:text-slate-400 ${isCompact ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'}`}>km</p>
          </div>
          <div className="text-center">
            <p className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[9px] mb-0.5' : 'text-[10px] sm:text-xs mb-1'}`}>Consumo</p>
            <p className={`text-slate-900 dark:text-white font-bold ${isCompact ? 'text-sm' : 'text-base sm:text-xl'}`}>{trip.electricity?.toFixed(2)}</p>
            <p className={`text-slate-500 dark:text-slate-400 ${isCompact ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'}`}>kWh</p>
          </div>
          <div className="text-center">
            <p className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[9px] mb-0.5' : 'text-[10px] sm:text-xs mb-1'}`}>Eficiencia</p>
            <p className={`text-slate-900 dark:text-white font-bold ${isCompact ? 'text-sm' : 'text-base sm:text-xl'}`}>{efficiency.toFixed(2)}</p>
            <p className={`text-slate-500 dark:text-slate-400 ${isCompact ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'}`}>kWh/100km</p>
          </div>
          <div className="text-center">
            <p className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[9px] mb-0.5' : 'text-[10px] sm:text-xs mb-1'}`}>Score</p>
            <p className={`font-bold ${isCompact ? 'text-lg' : 'text-2xl sm:text-3xl'}`} style={{ color: scoreColor }}>
              {score.toFixed(1)}
            </p>
          </div>
        </div>
      </div>
    );
  });

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
      <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="w-full max-w-xl">
          <div className="text-center mb-6">
            <img src="app_icon_v2.png" className={`h-auto mx-auto mb-3 md:mb-4 ${isCompact ? 'w-24 sm:w-32' : 'w-32 sm:w-40 md:w-48'}`} alt="App Logo" />
            <h1 className={`${isCompact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl md:text-4xl'} font-bold text-white mb-1`}>Estadísticas BYD</h1>
            <p className="text-xs sm:text-sm text-slate-400">Analiza los datos de tu vehículo eléctrico</p>
          </div>

          {!sqlReady && !error && (
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-3 px-4 py-2 bg-white dark:bg-slate-800/50 rounded-xl">
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: BYD_RED, borderTopColor: 'transparent' }} />
                <span className="text-slate-400">Cargando...</span>
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
              {sqlReady ? (isNative ? 'Toca para seleccionar tu archivo' : 'Haz clic para seleccionar tu archivo EC_Database.db') : 'Preparando...'}
            </p>
            <p className="text-slate-400 text-xs mt-4">
              Selecciona el fichero EC_Database.db en la carpeta "EnergyData" de tu coche
            </p>
            <p className="text-slate-500 text-xs mt-2">
              💡 Si tu navegador no muestra archivos: copia EC_Database.db a Downloads, selecciónalo, pulsa los 3 puntos y renómbralo a EC_Database.jpg
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center w-full my-6">
            <div className="h-px bg-slate-700 flex-1 opacity-50"></div>
            <span className="px-4 text-slate-500 text-sm font-medium">O</span>
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
                  <p className="text-xs text-slate-400 leading-none mb-0.5">Nube conectada</p>
                  <p className="text-sm font-medium leading-none">{googleSync.isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}</p>
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
                Inicia sesión para sincronizar
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
              <span>Privacidad</span>
            </a>
            <div className="w-px h-3 bg-slate-800"></div>
            <a
              href="/legal/"
              className="text-[10px] sm:text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5 p-1"
            >
              <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
              <span>Legal</span>
            </a>
          </div>
          <p className="text-[10px] text-slate-600 pl-1">BYD Stats v1.1.1</p>
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
        {/* Trip Detail Modal (higher z-index to appear over everything) */}
        {showTripDetailModal && selectedTrip && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 pt-24" onClick={() => { setShowTripDetailModal(false); setSelectedTrip(null); }}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Detalle del viaje</h3>
                <button onClick={() => { setShowTripDetailModal(false); setSelectedTrip(null); }} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-700">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              {(() => {
                const efficiency = selectedTrip.trip > 0 ? (selectedTrip.electricity / selectedTrip.trip) * 100 : 0;
                const avgSpeed = selectedTrip.duration > 0 ? (selectedTrip.trip / (selectedTrip.duration / 3600)) : 0;
                const endTime = selectedTrip.start_timestamp && selectedTrip.duration ? selectedTrip.start_timestamp + selectedTrip.duration : null;
                const cost = (selectedTrip.electricity || 0) * settings.electricityPrice;
                const avgEfficiency = data ? parseFloat(data.summary.avgEff) : 0;
                const comparisonPercent = avgEfficiency > 0 ? ((efficiency - avgEfficiency) / avgEfficiency * 100) : 0;
                const percentile = calculatePercentile(selectedTrip, rawTrips);

                return (
                  <div className="space-y-4">
                    {/* Fecha y hora */}
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4">
                      <p className="text-slate-600 dark:text-slate-400 text-sm mb-1">Fecha y hora</p>
                      <p className="text-slate-900 dark:text-white text-lg font-bold">{formatDate(selectedTrip.date)}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400 text-xs">Inicio</p>
                          <p className="text-slate-900 dark:text-white font-medium">{formatTime(selectedTrip.start_timestamp)}</p>
                        </div>
                        {endTime && (
                          <>
                            <span className="text-slate-600">→</span>
                            <div>
                              <p className="text-slate-600 dark:text-slate-400 text-xs">Fin</p>
                              <p className="text-slate-900 dark:text-white font-medium">{formatTime(endTime)}</p>
                            </div>
                          </>
                        )}
                        <div className="ml-auto">
                          <p className="text-slate-600 dark:text-slate-400 text-xs">Duración</p>
                          <p className="text-slate-900 dark:text-white font-medium">{formatDuration(selectedTrip.duration)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Grid de métricas */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-3">
                        <p className="text-slate-600 dark:text-slate-400 text-xs mb-1">Distancia</p>
                        <p className="text-slate-900 dark:text-white text-2xl font-bold">{selectedTrip.trip?.toFixed(1)}</p>
                        <p className="text-slate-500 dark:text-slate-500 text-xs">km</p>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-3">
                        <p className="text-slate-600 dark:text-slate-400 text-xs mb-1">Velocidad media</p>
                        <p className="text-slate-900 dark:text-white text-2xl font-bold">{avgSpeed.toFixed(0)}</p>
                        <p className="text-slate-500 dark:text-slate-500 text-xs">km/h</p>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-3">
                        <p className="text-slate-600 dark:text-slate-400 text-xs mb-1">Consumo</p>
                        <p className="text-slate-900 dark:text-white text-2xl font-bold">{selectedTrip.electricity?.toFixed(2)}</p>
                        <p className="text-slate-500 dark:text-slate-500 text-xs">kWh</p>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-3">
                        <p className="text-slate-600 dark:text-slate-400 text-xs mb-1">Eficiencia</p>
                        <p className="text-slate-900 dark:text-white text-2xl font-bold">{efficiency.toFixed(2)}</p>
                        <p className="text-slate-500 dark:text-slate-500 text-xs">kWh/100km</p>
                      </div>
                    </div>

                    {/* SOC si está disponible */}
                    {(selectedTrip.start_soc !== undefined || selectedTrip.end_soc !== undefined) && (
                      <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4">
                        <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">Estado de carga</p>
                        <div className="flex items-center gap-4">
                          {selectedTrip.start_soc !== undefined && (
                            <div className="flex-1">
                              <p className="text-xs text-slate-400">Inicial</p>
                              <p className="text-3xl font-bold text-green-400">{selectedTrip.start_soc}%</p>
                            </div>
                          )}
                          {selectedTrip.start_soc !== undefined && selectedTrip.end_soc !== undefined && (
                            <span className="text-slate-600 text-2xl">→</span>
                          )}
                          {selectedTrip.end_soc !== undefined && (
                            <div className="flex-1">
                              <p className="text-xs text-slate-400">Final</p>
                              <p className="text-3xl font-bold text-orange-400">{selectedTrip.end_soc}%</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Regeneración si está disponible */}
                    {selectedTrip.regeneration !== undefined && selectedTrip.regeneration !== null && (
                      <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4">
                        <p className="text-slate-600 dark:text-slate-400 text-sm mb-1">Energía regenerada</p>
                        <p className="text-green-400 text-2xl font-bold">{selectedTrip.regeneration?.toFixed(2)} kWh</p>
                      </div>
                    )}

                    {/* Comparación y percentil */}
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4">
                      <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">Análisis</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400 text-sm">Comparación con tu media</span>
                          <span className={`font-bold ${comparisonPercent < 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {comparisonPercent > 0 ? '+' : ''}{comparisonPercent.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400 text-sm">Percentil</span>
                          <span className="font-bold text-cyan-400">Top {percentile}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400 text-sm">Coste estimado</span>
                          <span className="font-bold text-amber-500">{cost.toFixed(2)}€</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

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
                  <h1 className="text-sm sm:text-base md:text-lg font-bold">Todos los viajes</h1>
                  <p className="text-slate-500 dark:text-slate-500 text-xs sm:text-sm">{allTripsFiltered.length} viajes</p>
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
                  Todos
                </button>
                <button
                  onClick={() => setAllTripsFilterType('month')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor: allTripsFilterType === 'month' ? BYD_RED : undefined,
                    color: allTripsFilterType === 'month' ? 'white' : '#94a3b8'
                  }}
                >
                  Por mes
                </button>
                <button
                  onClick={() => setAllTripsFilterType('range')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor: allTripsFilterType === 'range' ? BYD_RED : undefined,
                    color: allTripsFilterType === 'range' ? 'white' : '#94a3b8'
                  }}
                >
                  Rango de fechas
                </button>
              </div>

              {/* Month Selector */}
              {allTripsFilterType === 'month' && (
                <select
                  value={allTripsMonth}
                  onChange={(e) => setAllTripsMonth(e.target.value)}
                  className="w-full bg-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-600 text-sm"
                >
                  <option value="">Seleccionar mes</option>
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
                <span className="text-xs text-slate-600 dark:text-slate-400 px-2 py-1.5">Ordenar:</span>
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
                  Fecha
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
                  Eficiencia
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
                  Distancia
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
                  Consumo
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
                formatDate={formatDate}
                formatTime={formatTime}
                calculateScore={calculateScore}
                getScoreColor={getScoreColor}
                isCompact={false} // Assuming full view is not compact
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={swipeContainerRef}
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
      {showTripDetailModal && selectedTrip && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 pt-24" onClick={() => { setShowTripDetailModal(false); setSelectedTrip(null); }}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Detalle del viaje</h3>
              <button onClick={() => { setShowTripDetailModal(false); setSelectedTrip(null); }} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-700">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            {(() => {
              const efficiency = selectedTrip.trip > 0 ? (selectedTrip.electricity / selectedTrip.trip) * 100 : 0;
              const avgSpeed = selectedTrip.duration > 0 ? (selectedTrip.trip / (selectedTrip.duration / 3600)) : 0;
              const endTime = selectedTrip.start_timestamp && selectedTrip.duration ? selectedTrip.start_timestamp + selectedTrip.duration : null;
              const cost = (selectedTrip.electricity || 0) * settings.electricityPrice;
              const avgEfficiency = data ? parseFloat(data.summary.avgEff) : 0;
              const comparisonPercent = avgEfficiency > 0 ? ((efficiency - avgEfficiency) / avgEfficiency * 100) : 0;
              const percentile = calculatePercentile(selectedTrip, filtered);

              return (
                <div className="space-y-4">
                  {/* Fecha y hora */}
                  <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4">
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-1">Fecha y hora</p>
                    <p className="text-slate-900 dark:text-white text-lg font-bold">{formatDate(selectedTrip.date)}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <div>
                        <p className="text-slate-600 dark:text-slate-400 text-xs">Inicio</p>
                        <p className="text-slate-900 dark:text-white font-medium">{formatTime(selectedTrip.start_timestamp)}</p>
                      </div>
                      {endTime && (
                        <>
                          <span className="text-slate-600">→</span>
                          <div>
                            <p className="text-slate-600 dark:text-slate-400 text-xs">Fin</p>
                            <p className="text-slate-900 dark:text-white font-medium">{formatTime(endTime)}</p>
                          </div>
                        </>
                      )}
                      <div className="ml-auto">
                        <p className="text-slate-600 dark:text-slate-400 text-xs">Duración</p>
                        <p className="text-slate-900 dark:text-white font-medium">{formatDuration(selectedTrip.duration)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Grid de métricas */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-3">
                      <p className="text-slate-600 dark:text-slate-400 text-xs mb-1">Distancia</p>
                      <p className="text-slate-900 dark:text-white text-2xl font-bold">{selectedTrip.trip?.toFixed(1)}</p>
                      <p className="text-slate-500 dark:text-slate-500 text-xs">km</p>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-3">
                      <p className="text-slate-600 dark:text-slate-400 text-xs mb-1">Velocidad media</p>
                      <p className="text-slate-900 dark:text-white text-2xl font-bold">{avgSpeed.toFixed(0)}</p>
                      <p className="text-slate-500 dark:text-slate-500 text-xs">km/h</p>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-3">
                      <p className="text-slate-600 dark:text-slate-400 text-xs mb-1">Consumo</p>
                      <p className="text-slate-900 dark:text-white text-2xl font-bold">{selectedTrip.electricity?.toFixed(2)}</p>
                      <p className="text-slate-500 dark:text-slate-500 text-xs">kWh</p>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-3">
                      <p className="text-slate-600 dark:text-slate-400 text-xs mb-1">Eficiencia</p>
                      <p className="text-slate-900 dark:text-white text-2xl font-bold">{efficiency.toFixed(2)}</p>
                      <p className="text-slate-500 dark:text-slate-500 text-xs">kWh/100km</p>
                    </div>
                  </div>

                  {/* SOC si está disponible */}
                  {(selectedTrip.start_soc !== undefined || selectedTrip.end_soc !== undefined) && (
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4">
                      <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">Estado de carga</p>
                      <div className="flex items-center gap-4">
                        {selectedTrip.start_soc !== undefined && (
                          <div className="flex-1">
                            <p className="text-xs text-slate-400">Inicial</p>
                            <p className="text-3xl font-bold text-green-400">{selectedTrip.start_soc}%</p>
                          </div>
                        )}
                        {selectedTrip.start_soc !== undefined && selectedTrip.end_soc !== undefined && (
                          <span className="text-slate-600 text-2xl">→</span>
                        )}
                        {selectedTrip.end_soc !== undefined && (
                          <div className="flex-1">
                            <p className="text-xs text-slate-400">Final</p>
                            <p className="text-3xl font-bold text-orange-400">{selectedTrip.end_soc}%</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Regeneración si está disponible */}
                  {selectedTrip.regeneration !== undefined && selectedTrip.regeneration !== null && (
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4">
                      <p className="text-slate-600 dark:text-slate-400 text-sm mb-1">Energía regenerada</p>
                      <p className="text-green-400 text-2xl font-bold">{selectedTrip.regeneration?.toFixed(2)} kWh</p>
                    </div>
                  )}

                  {/* Comparación y percentil */}
                  <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4">
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">Análisis</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 text-sm">Comparación con tu media</span>
                        <span className={`font-bold ${comparisonPercent < 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {comparisonPercent > 0 ? '+' : ''}{comparisonPercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 text-sm">Percentil</span>
                        <span className="font-bold text-cyan-400">Top {percentile}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 text-sm">Coste estimado</span>
                        <span className="font-bold text-amber-500">{cost.toFixed(2)}€</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

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
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Ayuda y Soporte</h2>
              </div>
              <button onClick={() => setShowHelpModal(false)} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  ¿Encontraste un error o tienes sugerencias?
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500">
                  Puedes reportar bugs, solicitar features o contribuir al proyecto en GitHub.
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
                  Reportar Bug
                </a>

                <a
                  href="https://github.com/miguelpicado/byd-stats"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-xl font-medium text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                >
                  <GitHub className="w-5 h-5" />
                  Ver en GitHub
                </a>

                <a
                  href="mailto:contacto@bydstats.com?subject=BYD Stats - Contacto&body=Hola,%0A%0AMe gustaría contactar sobre..."
                  className="w-full py-3 rounded-xl font-medium text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Mail className="w-5 h-5" />
                  Enviar Email
                </a>

                <button
                  onClick={() => { setLegalInitialSection('privacy'); setShowLegalModal(true); }}
                  className="w-full py-3 rounded-xl font-medium text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Shield className="w-5 h-5" />
                  Información Legal
                </button>
              </div>

              <div className="text-center text-xs text-slate-500 dark:text-slate-500 pt-2">
                <p>BYD Stats Analyzer v1.1.1</p>
                <p className="mt-1">Hecho con ❤️ para la comunidad BYD</p>
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
                <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-white">Estadísticas BYD</h1>
                <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">{rawTrips.length} viajes</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHelpModal(true)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors"
                title="Ayuda y Bug Report"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
              <button
                onClick={toggleFullscreen}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors ${layoutMode === 'vertical' ? 'hidden' : ''}`}
                title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setShowHistoryModal(true)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors"
                title="Historial de viajes"
              >
                <Database className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowSettingsModal(true)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowFilterModal(true)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors"
                title="Filtros"
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
        <div className={layoutMode === 'horizontal' ? 'flex-1 overflow-y-auto tab-content-container' : 'max-w-7xl mx-auto h-full'}>
          {layoutMode === 'vertical' ? (
            // Vertical layout: sliding tabs with transitions
            <div
              ref={swipeContainerRef}
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
                    {activeTab === 'overview' && (
                      <div className={`${isCompact ? COMPACT_SPACE_Y : 'space-y-3 sm:space-y-4'}`}>
                        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${isCompact ? '!gap-3' : ''}`}>
                          <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={MapPin} label="Distancia" value={summary.totalKm} unit="km" color="bg-red-500/20 text-red-400" sub={`${summary.kmDay} km/día`} />
                          <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={Zap} label="Energía" value={summary.totalKwh} unit="kWh" color="bg-cyan-500/20 text-cyan-400" />
                          <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={Car} label="Viajes" value={summary.totalTrips} unit="" color="bg-amber-500/20 text-amber-400" sub={`${summary.tripsDay}/día`} />
                          <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={Clock} label="Tiempo" value={summary.totalHours} unit="h" color="bg-purple-500/20 text-purple-400" />
                        </div>
                        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${isCompact ? '!gap-3' : ''}`}>
                          <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={Battery} label="Eficiencia" value={summary.avgEff} unit="kWh/100km" color="bg-green-500/20 text-green-400" />
                          <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={TrendingUp} label="Velocidad" value={summary.avgSpeed} unit="km/h" color="bg-blue-500/20 text-blue-400" />
                          <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={MapPin} label="Viaje medio" value={summary.avgKm} unit="km" color="bg-orange-500/20 text-orange-400" sub={`${summary.avgMin} min`} />
                          <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={Calendar} label="Días activos" value={summary.daysActive} unit="" color="bg-pink-500/20 text-pink-400" />
                        </div>
                        <div className={`grid md:grid-cols-2 gap-4 sm:gap-6 ${isCompact ? '!gap-3' : ''}`}>
                          <ChartCard isCompact={isCompact} title="Evolución mensual (distancia)">
                            <div style={{ width: '100%', height: isCompact ? 220 : 240 }}>
                              <LineJS
                                options={{
                                  maintainAspectRatio: false,
                                  scales: {
                                    y: { beginAtZero: true, border: { dash: [3, 3] }, grid: { color: 'rgba(203, 213, 225, 0.3)' } },
                                    x: { grid: { display: false } }
                                  },
                                  plugins: { legend: { display: false } },
                                  elements: { line: { tension: 0.4 } }
                                }}
                                data={{
                                  labels: monthly.map(m => m.monthLabel),
                                  datasets: [{
                                    label: 'Km',
                                    data: monthly.map(m => m.km),
                                    borderColor: BYD_RED,
                                    backgroundColor: 'rgba(234, 0, 41, 0.1)',
                                    fill: true,
                                    pointBackgroundColor: BYD_RED,
                                    pointRadius: 3,
                                    borderWidth: 2
                                  }]
                                }}
                              />
                            </div>
                          </ChartCard>
                          <ChartCard isCompact={isCompact} title="Distribución de Viajes">
                            <div className={`flex items-center ${isCompact ? 'flex-col' : 'md:flex-row flex-col gap-4'}`}>
                              <div className={isCompact ? 'w-full' : 'md:w-1/2 w-full'}>
                                <div style={{ width: '100%', height: isCompact ? 220 : 240 }}>
                                  <PieJS
                                    options={{
                                      maintainAspectRatio: false,
                                      plugins: {
                                        legend: { display: false },
                                        tooltip: {
                                          callbacks: {
                                            label: (context) => {
                                              const label = context.label || '';
                                              const value = context.parsed;
                                              const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                              const percent = ((value / total) * 100).toFixed(0) + '%';
                                              return `${label}: ${context.raw} (${percent})`;
                                            }
                                          }
                                        }
                                      }
                                    }}
                                    data={{
                                      labels: tripDist.map(d => `${d.range} km`),
                                      datasets: [{
                                        data: tripDist.map(d => d.count),
                                        backgroundColor: tripDist.map(d => d.color),
                                        borderWidth: 0,
                                        hoverOffset: 4
                                      }]
                                    }}
                                  />
                                </div>
                              </div>
                              <div className={`grid ${isCompact ? 'grid-cols-1 w-full gap-1' : 'md:grid-cols-1 md:w-1/2 grid-cols-5 w-full gap-2 mt-4'} text-center`}>
                                {tripDist.map((d, i) => (
                                  <div key={i} className={`flex ${isCompact ? 'flex-row items-center justify-between px-4 py-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-lg' : 'flex-col items-center'}`}>
                                    <div className="flex items-center gap-2">
                                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }}></div>
                                      <p className={`text-slate-600 dark:text-slate-400 truncate ${isCompact ? 'text-[11px]' : 'text-[9px] sm:text-[10px]'}`}>{d.range}km</p>
                                    </div>
                                    <p className={`font-bold text-slate-900 dark:text-white ${isCompact ? 'text-sm' : 'text-xs sm:text-sm'}`}>{d.count}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </ChartCard>
                        </div>

                      </div>
                    )}
                  </div>

                  {/* Slide 2: Trends */}
                  <div className="tab-content-container" style={{ width: `${100 / tabs.length}%`, flexShrink: 0, height: '100%', overflowY: 'auto', padding: isCompact ? COMPACT_TAB_PADDING : TAB_PADDING }}>
                    {activeTab === 'trends' && (() => {
                      const tripData = filtered || [];
                      const avgKmPerTrip = parseFloat(summary?.avgKm) || 0;
                      const longTripThreshold = avgKmPerTrip * 3;
                      const longTrips = tripData.filter(t => (t.trip || 0) >= longTripThreshold);
                      const totalDays = summary?.totalDays || summary?.daysActive || 1;
                      const daysPerLongTrip = longTrips.length > 0 ? Math.round(totalDays / longTrips.length) : 0;
                      const efficiencies = tripData
                        .map(t => t.trip && t.trip > 0 && t.electricity != null ? (t.electricity / t.trip) * 100 : 0)
                        .filter(e => e > 0)
                        .sort((a, b) => a - b);
                      const medianEfficiency = efficiencies.length > 0 ? efficiencies[Math.floor(efficiencies.length / 2)] : 0;
                      const dailyKwh = (parseFloat(summary?.totalKwh || 0) / totalDays);
                      const electricityPrice = settings?.electricityPrice || 0.15;
                      const monthlyData = monthly || [];
                      const avgMonthlyKwh = monthlyData.length > 0 ? monthlyData.reduce((sum, m) => sum + (m.kwh || 0), 0) / monthlyData.length : 0;
                      const monthlyCost = avgMonthlyKwh * electricityPrice;

                      return (
                        <div className={isCompact ? COMPACT_SPACE_Y : 'space-y-4 sm:space-y-6'}>
                          <div className={`grid gap-3 sm:gap-4 ${isCompact ? 'grid-cols-4 !gap-3' : 'grid-cols-2 md:grid-cols-4'}`}>
                            <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={Navigation} label="Viaje largo cada" value={daysPerLongTrip} unit="días" color="bg-purple-500/20 text-purple-400" />
                            <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={Battery} label="Eficiencia mediana" value={medianEfficiency.toFixed(2)} unit="kWh/100km" color="bg-green-500/20 text-green-400" />
                            <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={Zap} label="Carga diaria" value={dailyKwh.toFixed(2)} unit="kWh/día" color="bg-cyan-500/20 text-cyan-400" />
                            <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={TrendingUp} label="Coste mensual" value={monthlyCost.toFixed(2)} unit="€/mes" color="bg-amber-500/20 text-amber-400" />
                          </div>
                          <div className={`grid md:grid-cols-2 gap-4 sm:gap-6 ${isCompact ? '!gap-3' : ''}`}>
                            <ChartCard isCompact={isCompact} title="Km y kWh Mensual">
                              <div style={{ width: '100%', height: isCompact ? 220 : 240 }}>
                                <BarJS
                                  options={{
                                    maintainAspectRatio: false,
                                    scales: {
                                      y: { beginAtZero: true, position: 'left', border: { dash: [] }, ticks: { color: BYD_RED }, grid: { color: 'rgba(203, 213, 225, 0.3)', borderDash: [3, 3], drawBorder: false } },
                                      y1: { beginAtZero: true, position: 'right', border: { dash: [] }, ticks: { color: '#06b6d4' }, grid: { drawOnChartArea: false } },
                                      x: { border: { dash: [] }, grid: { display: false } }
                                    },
                                    plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 10, usePointStyle: true, font: { size: 10 } } } }
                                  }}
                                  data={{
                                    labels: monthly.map(m => m.monthLabel),
                                    datasets: [
                                      { label: 'Km', data: monthly.map(m => m.km), backgroundColor: BYD_RED, yAxisID: 'y', borderRadius: 4 },
                                      { label: 'kWh', data: monthly.map(m => m.kwh), backgroundColor: '#06b6d4', yAxisID: 'y1', borderRadius: 4 }
                                    ]
                                  }}
                                />
                              </div>
                            </ChartCard>
                            <ChartCard isCompact={isCompact} title="Km recorridos en últimos 60 días">
                              <div style={{ width: '100%', height: isCompact ? 220 : 240 }}>
                                <LineJS
                                  options={{
                                    maintainAspectRatio: false,
                                    scales: {
                                      y: { beginAtZero: true, border: { dash: [] }, grid: { color: 'rgba(203, 213, 225, 0.3)', borderDash: [3, 3], drawBorder: false } },
                                      x: { border: { dash: [] }, grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45, font: { size: 9 } } }
                                    },
                                    plugins: { legend: { display: false } },
                                    elements: { line: { tension: 0.4 } }
                                  }}
                                  data={{
                                    labels: daily.slice(-60).map(d => d.dateLabel),
                                    datasets: [{
                                      label: 'Km',
                                      data: daily.slice(-60).map(d => d.km),
                                      borderColor: BYD_RED,
                                      backgroundColor: 'rgba(234, 0, 41, 0.1)',
                                      fill: true,
                                      pointRadius: 0,
                                      pointHoverRadius: 4,
                                      borderWidth: 2
                                    }]
                                  }}
                                />
                              </div>
                            </ChartCard>
                          </div>

                        </div>
                      );
                    })()}
                  </div>

                  {/* Slide 3: Patterns */}
                  <div className="tab-content-container" style={{ width: `${100 / tabs.length}%`, flexShrink: 0, height: '100%', overflowY: 'auto', padding: isCompact ? COMPACT_TAB_PADDING : TAB_PADDING }}>
                    {activeTab === 'patterns' && (() => {
                      const topDay = weekday.reduce((a, b) => (a.trips || 0) > (b.trips || 0) ? a : b);
                      const topHour = hourly.reduce((a, b) => (a.trips || 0) > (b.trips || 0) ? a : b);
                      return (
                        <div className={isCompact ? COMPACT_SPACE_Y : 'space-y-4 sm:space-y-6'}>
                          <div className={`grid gap-3 sm:gap-4 ${isCompact ? 'grid-cols-4 !gap-3' : 'grid-cols-2 md:grid-cols-4'}`}>
                            <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={Calendar} label="Día frecuente" value={dayNamesFull[topDay.day] || topDay.day} unit="" color="bg-amber-500/20 text-amber-400" />
                            <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={Clock} label="Hora pico" value={`${topHour.hour.toString().padStart(2, '0')}:00h`} unit="" color="bg-purple-500/20 text-purple-400" />
                            <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={MapPin} label="Km totales" value={summary.totalKm} unit="km" color="bg-red-500/20 text-red-400" />
                            <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={TrendingUp} label="Media día" value={summary.kmDay} unit="km" color="bg-blue-500/20 text-blue-400" />
                          </div>
                          <div className={`grid md:grid-cols-2 gap-4 sm:gap-6 ${isCompact ? '!gap-3' : ''}`}>
                            <ChartCard isCompact={isCompact} title="Por Hora">
                              <div style={{ width: '100%', height: isCompact ? 220 : 240 }}>
                                <BarJS
                                  options={{
                                    maintainAspectRatio: false,
                                    scales: {
                                      y: { beginAtZero: true, border: { dash: [] }, grid: { color: 'rgba(203, 213, 225, 0.3)', borderDash: [3, 3], drawBorder: false }, ticks: { font: { size: 10 } } },
                                      x: { border: { dash: [] }, grid: { borderDash: [3, 3], drawBorder: false }, ticks: { font: { size: 10 } } }
                                    },
                                    plugins: { legend: { display: false } }
                                  }}
                                  data={{
                                    labels: hourly.map(h => `${h.hour}h`),
                                    datasets: [{ label: 'Viajes', data: hourly.map(h => h.trips), backgroundColor: '#f59e0b', borderRadius: 2 }]
                                  }}
                                />
                              </div>
                            </ChartCard>
                            <ChartCard isCompact={isCompact} title="Por Día">
                              <div style={{ width: '100%', height: isCompact ? 220 : 240 }}>
                                <RadarJS
                                  options={{
                                    maintainAspectRatio: false,
                                    scales: { r: { grid: { color: '#94a3b8', borderDash: [3, 3] }, ticks: { display: false }, pointLabels: { font: { size: 10 }, color: '#64748b' } } },
                                    plugins: { legend: { display: false } },
                                    interaction: { mode: 'index', intersect: false }
                                  }}
                                  data={{
                                    labels: weekday.map(d => d.day),
                                    datasets: [{
                                      pointHitRadius: 50, // Massive touch target
                                      label: 'Viajes',
                                      data: weekday.map(d => d.trips),
                                      borderColor: '#f59e0b',
                                      backgroundColor: 'rgba(245, 158, 11, 0.3)',
                                      borderWidth: 2,
                                      pointBackgroundColor: '#f59e0b',
                                      pointRadius: 3
                                    }]
                                  }}
                                />
                              </div>
                            </ChartCard>
                          </div>
                          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                            {weekday.map((d, i) => (
                              <div key={i} className={`bg-white dark:bg-slate-800/50 rounded-lg sm:rounded-xl text-center border border-slate-200 dark:border-slate-700/50 ${isCompact ? 'p-1.5' : 'p-2 sm:p-3'}`}>
                                <p className="text-slate-600 dark:text-slate-400 text-[10px] sm:text-xs">{d.day}</p>
                                <p className={`font-bold text-slate-900 dark:text-white ${isCompact ? 'text-sm' : 'text-base sm:text-xl'}`}>{d.trips}</p>
                                <p className="text-[9px] sm:text-xs" style={{ color: BYD_RED }}>{d.km.toFixed(0)} km</p>
                              </div>
                            ))}
                          </div>

                        </div>
                      );
                    })()}
                  </div>

                  {/* Slide 4: Efficiency */}
                  <div className="tab-content-container" style={{ width: `${100 / tabs.length}%`, flexShrink: 0, height: '100%', overflowY: 'auto', padding: isCompact ? COMPACT_TAB_PADDING : TAB_PADDING }}>
                    {activeTab === 'efficiency' && (
                      <div className={`${isCompact ? COMPACT_SPACE_Y : 'space-y-3 sm:space-y-4'}`}>
                        <div className={`grid gap-3 sm:gap-4 ${isCompact ? 'grid-cols-4 !gap-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
                          <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={Battery} label="Eficiencia" value={summary.avgEff} unit="kWh/100km" color="bg-green-500/20 text-green-400" />
                          <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={Zap} label="Consumo/viaje" value={(parseFloat(summary.totalKwh) / summary.totalTrips).toFixed(2)} unit="kWh" color="bg-cyan-500/20 text-cyan-400" />
                          <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={MapPin} label="Distancia media" value={summary.avgKm} unit="km" color="bg-purple-500/20 text-purple-400" />
                          <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={TrendingUp} label="Velocidad media" value={summary.avgSpeed} unit="km/h" color="bg-blue-500/20 text-blue-400" />
                        </div>
                        <div className={`grid md:grid-cols-2 gap-4 sm:gap-6 ${isCompact ? '!gap-3' : ''}`}>
                          <ChartCard isCompact={isCompact} title="📈 Evolución Eficiencia Mensual">
                            <div style={{ width: '100%', height: isCompact ? 220 : 240 }}>
                              <LineJS
                                options={{
                                  maintainAspectRatio: false,
                                  scales: {
                                    y: {
                                      beginAtZero: false,
                                      min: Math.floor(Math.min(...monthly.map(m => m.efficiency || 999))) - 1,
                                      max: Math.ceil(Math.max(...monthly.map(m => m.efficiency || 0))) + 1,
                                      border: { dash: [] }, grid: { color: 'rgba(203, 213, 225, 0.3)', borderDash: [3, 3], drawBorder: false },
                                      ticks: { font: { size: 10 } }
                                    },
                                    x: { border: { dash: [] }, grid: { display: false }, ticks: { font: { size: 10 } } }
                                  },
                                  plugins: { legend: { display: false } }
                                }}
                                data={{
                                  labels: monthly.map(m => m.monthLabel),
                                  datasets: [{
                                    label: 'kWh/100km',
                                    data: monthly.map(m => m.efficiency),
                                    borderColor: '#10b981',
                                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                    fill: true,
                                    pointBackgroundColor: '#10b981',
                                    tension: 0.4,
                                    pointRadius: 3
                                  }]
                                }}
                              />
                            </div>
                          </ChartCard>
                          <ChartCard isCompact={isCompact} title="📍 Eficiencia vs Distancia">
                            <div style={{ width: '100%', height: isCompact ? 220 : 240 }}>
                              <ScatterJS
                                options={{
                                  maintainAspectRatio: false,
                                  scales: {
                                    x: {
                                      type: 'logarithmic',
                                      position: 'bottom',
                                      title: { display: true, text: 'Distancia (km)', font: { size: 10 } },
                                      border: { dash: [] }, grid: { display: true, borderDash: [3, 3], drawBorder: false },
                                      min: 1,
                                      max: 500,
                                      ticks: {
                                        font: { size: 10 },
                                        callback: function (value) {
                                          const allowed = [1, 2, 5, 10, 50, 200, 500];
                                          return allowed.includes(value) ? value : '';
                                        },
                                        autoSkip: false,
                                        maxRotation: 0
                                      }
                                    },
                                    y: {
                                      title: { display: true, text: 'Eficiencia', font: { size: 10 } },
                                      border: { dash: [] }, grid: { color: 'rgba(203, 213, 225, 0.3)', borderDash: [3, 3], drawBorder: false },
                                      ticks: { font: { size: 10 } }
                                    }
                                  },
                                  plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `Dist: ${c.raw.x.toFixed(1)}km, Eff: ${c.raw.y.toFixed(1)}` } } },
                                  interaction: { mode: 'nearest', axis: 'xy', intersect: true }
                                }}
                                data={{
                                  datasets: [{
                                    label: 'Eficiencia',
                                    data: effScatter,
                                    backgroundColor: BYD_RED,
                                    pointRadius: 4
                                  }]
                                }}
                              />
                            </div>
                          </ChartCard>
                        </div>

                      </div>
                    )}
                  </div>

                  {/* Slide 5: Records */}
                  <div className="tab-content-container" style={{ width: `${100 / tabs.length}%`, flexShrink: 0, height: '100%', overflowY: 'auto', padding: isCompact ? COMPACT_TAB_PADDING : TAB_PADDING }}>
                    {activeTab === 'records' && (
                      <div className={`space-y-3 sm:space-y-4 ${isCompact ? COMPACT_SPACE_Y : ''}`}>
                        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${isCompact ? '!gap-3' : ''}`}>
                          <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={Navigation} label="Más largo" value={summary.maxKm} unit="km" color="bg-red-500/20 text-red-500" />
                          <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={Zap} label="Mayor consumo" value={summary.maxKwh} unit="kWh" color="bg-cyan-500/20 text-cyan-500" />
                          <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={Clock} label="Más duración" value={summary.maxMin} unit="min" color="bg-amber-500/20 text-amber-500" />
                          <StatCard isVerticalMode={true} isLarger={isLargerCard} isCompact={isCompact} icon={MapPin} label="Más corto" value={summary.minKm} unit="km" color="bg-purple-500/20 text-purple-500" />
                        </div>
                        <div className={`grid ${isCompact ? 'grid-cols-3' : 'grid-cols-1'} gap-3 sm:gap-6 ${isCompact ? '!gap-3' : ''}`}>
                          <ChartCard isCompact={isCompact} title="🥇 Top Distancia">
                            <div className="space-y-1">
                              {top.km.map((t, i) => (
                                <div key={i} className={`flex justify-between border-b border-slate-200 dark:border-slate-700/50 last:border-0 ${isCompact ? 'py-[3.5px]' : 'py-1.5'}`}>
                                  <span className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[9px] truncate' : 'text-xs sm:text-sm'}`}>{i + 1}. {formatDate(t.date)}</span>
                                  <span className={`font-medium text-slate-900 dark:text-white ${isCompact ? 'text-[10px]' : 'text-sm sm:text-base'}`}>{t.trip?.toFixed(1)} km</span>
                                </div>
                              ))}
                            </div>
                          </ChartCard>
                          <ChartCard isCompact={isCompact} title="⚡ Top Consumo">
                            <div className="space-y-1">
                              {top.kwh.map((t, i) => (
                                <div key={i} className={`flex justify-between border-b border-slate-200 dark:border-slate-700/50 last:border-0 ${isCompact ? 'py-[3.5px]' : 'py-1.5'}`}>
                                  <span className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[9px] truncate' : 'text-xs sm:text-sm'}`}>{i + 1}. {formatDate(t.date)}</span>
                                  <span className={`font-medium text-slate-900 dark:text-white ${isCompact ? 'text-[10px]' : 'text-sm sm:text-base'}`}>{t.electricity?.toFixed(1)} kWh</span>
                                </div>
                              ))}
                            </div>
                          </ChartCard>
                          <ChartCard isCompact={isCompact} title="⏱️ Top Duración">
                            <div className="space-y-1">
                              {top.dur.map((t, i) => (
                                <div key={i} className={`flex justify-between border-b border-slate-200 dark:border-slate-700/50 last:border-0 ${isCompact ? 'py-[3.5px]' : 'py-1.5'}`}>
                                  <span className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[9px] truncate' : 'text-xs sm:text-sm'}`}>{i + 1}. {formatDate(t.date)}</span>
                                  <span className={`font-medium text-slate-900 dark:text-white ${isCompact ? 'text-[10px]' : 'text-sm sm:text-base'}`}>{((t.duration || 0) / 60).toFixed(0)} min</span>
                                </div>
                              ))}
                            </div>
                          </ChartCard>
                        </div>

                      </div>
                    )}
                  </div>

                  {/* Slide 6: History */}
                  <div className="tab-content-container" style={{ width: `${100 / tabs.length}%`, flexShrink: 0, height: '100%', overflowY: 'auto', padding: isCompact ? COMPACT_TAB_PADDING : TAB_PADDING }}>
                    <div className={`${isCompact ? COMPACT_SPACE_Y : 'space-y-4 sm:space-y-6'}`}>
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Últimos 10 viajes</h2>
                      <div className="space-y-3">
                        {(() => {
                          const allTrips = [...filtered].sort((a, b) => {
                            const dateCompare = (b.date || '').localeCompare(a.date || '');
                            if (dateCompare !== 0) return dateCompare;
                            return (b.start_timestamp || 0) - (a.start_timestamp || 0);
                          });

                          // Filter trips >= 1km for scoring calculation
                          // Incluir eficiencias negativas (regeneración) que son las MEJORES
                          const validTrips = allTrips.filter(t => t.trip >= 1 && t.electricity !== 0);
                          const efficiencies = validTrips.map(t => (t.electricity / t.trip) * 100);
                          const minEff = Math.min(...efficiencies);
                          const maxEff = Math.max(...efficiencies);

                          return allTrips.slice(0, 10).map((trip) => (
                            <TripCard
                              isCompact={isCompact}
                              key={trip.date + '-' + trip.start_timestamp}
                              trip={trip}
                              minEff={minEff}
                              maxEff={maxEff}
                              onClick={openTripDetail}
                              formatDate={formatDate}
                              formatTime={formatTime}
                              calculateScore={calculateScore}
                              getScoreColor={getScoreColor}
                            />
                          ));
                        })()}
                      </div>
                      <button
                        onClick={() => setShowAllTripsModal(true)}
                        className="w-full py-3 rounded-xl font-medium text-white"
                        style={{ backgroundColor: BYD_RED }}
                      >
                        Mostrar todo
                      </button>

                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            // Horizontal layout: show only active tab content
            <div ref={swipeContainerRef} className="tab-content-container" style={{ padding: isCompact ? '8px 10px' : '12px', height: '100%', overflowY: activeTab === 'history' ? 'auto' : 'hidden' }}>
              {!data ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800/30 rounded-2xl">
                  <AlertCircle className="w-12 h-12 text-slate-500 dark:text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-400">No hay datos para mostrar</p>
                </div>
              ) : (
                <>
                  {activeTab === 'overview' && (
                    <div className={`${isCompact ? COMPACT_SPACE_Y : 'space-y-4 sm:space-y-6'}`}>

                      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 ${isCompact ? '!gap-3' : ''}`}>
                        <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={MapPin} label="Distancia" value={summary.totalKm} unit="km" color="bg-red-500/20 text-red-400" sub={`${summary.kmDay} km/día`} />
                        <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={Zap} label="Energía" value={summary.totalKwh} unit="kWh" color="bg-cyan-500/20 text-cyan-400" />
                        <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={Car} label="Viajes" value={summary.totalTrips} unit="" color="bg-amber-500/20 text-amber-400" sub={`${summary.tripsDay}/día`} />
                        <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={Clock} label="Tiempo" value={summary.totalHours} unit="h" color="bg-purple-500/20 text-purple-400" />
                      </div>
                      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 ${isCompact ? '!gap-3' : ''}`}>
                        <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={Battery} label="Eficiencia" value={summary.avgEff} unit="kWh/100km" color="bg-green-500/20 text-green-400" />
                        <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={TrendingUp} label="Velocidad" value={summary.avgSpeed} unit="km/h" color="bg-blue-500/20 text-blue-400" />
                        <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={MapPin} label="Viaje medio" value={summary.avgKm} unit="km" color="bg-orange-500/20 text-orange-400" sub={`${summary.avgMin} min`} />
                        <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={Calendar} label="Días activos" value={summary.daysActive} unit="" color="bg-pink-500/20 text-pink-400" />
                      </div>
                      <div className={`grid gap-4 ${isCompact ? 'grid-cols-1 lg:grid-cols-2 !gap-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
                        <ChartCard isCompact={isCompact} title="Evolución mensual (distancia)">
                          <div style={{ width: '100%', height: isCompact ? 275 : 326 }}>
                            <LineJS
                              options={{
                                maintainAspectRatio: false,
                                scales: {
                                  y: { beginAtZero: true, border: { dash: [] }, grid: { color: 'rgba(203, 213, 225, 0.3)', borderDash: [3, 3], drawBorder: false } },
                                  x: { border: { dash: [] }, grid: { display: false } }
                                },
                                plugins: { legend: { display: false } },
                                elements: { line: { tension: 0.4 } }
                              }}
                              data={{
                                labels: monthly.map(m => m.monthLabel),
                                datasets: [{
                                  label: 'Km',
                                  data: monthly.map(m => m.km),
                                  borderColor: BYD_RED,
                                  backgroundColor: 'rgba(234, 0, 41, 0.1)',
                                  fill: true,
                                  pointBackgroundColor: BYD_RED,
                                  pointRadius: 4,
                                  pointHoverRadius: 6,
                                  borderWidth: 2
                                }]
                              }}
                            />
                          </div>
                        </ChartCard>
                        <ChartCard isCompact={isCompact} title="Distribución de Viajes">
                          <div className="flex flex-row items-center gap-4">
                            <div className="w-1/2">
                              <div style={{ width: '100%', height: isCompact ? 273 : 326 }}>
                                <PieJS
                                  options={{
                                    maintainAspectRatio: false,
                                    plugins: {
                                      legend: { display: false },
                                      tooltip: {
                                        callbacks: {
                                          label: (context) => {
                                            const label = context.label || '';
                                            const value = context.parsed;
                                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                            const percent = ((value / total) * 100).toFixed(0) + '%';
                                            return `${label}: ${context.raw} (${percent})`;
                                          }
                                        }
                                      }
                                    }
                                  }}
                                  data={{
                                    labels: tripDist.map(d => `${d.range} km`),
                                    datasets: [{
                                      data: tripDist.map(d => d.count),
                                      backgroundColor: tripDist.map(d => d.color),
                                      borderWidth: 0,
                                      hoverOffset: 4
                                    }]
                                  }}
                                />
                              </div>
                            </div>
                            <div className="w-1/2 grid grid-cols-1 gap-1 text-center">
                              {tripDist.map((d, i) => (
                                <div key={i} className={`flex flex-row items-center justify-between px-2 py-1 bg-slate-100 dark:bg-slate-700/50 rounded-lg`}>
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }}></div>
                                    <p className="text-slate-600 dark:text-slate-400 truncate text-[9px]">{d.range}km</p>
                                  </div>
                                  <p className="font-bold text-slate-900 dark:text-white text-[11px]">{d.count}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </ChartCard>
                      </div>

                    </div>
                  )}
                  {activeTab === 'trends' && (() => {
                    // Calculate insights
                    const tripData = filtered || [];
                    const avgKmPerTrip = parseFloat(summary?.avgKm) || 0;
                    const longTripThreshold = avgKmPerTrip * 3;
                    const longTrips = tripData.filter(t => (t.trip || 0) >= longTripThreshold);
                    const totalDays = summary?.totalDays || summary?.daysActive || 1;
                    const daysPerLongTrip = longTrips.length > 0 ? Math.round(totalDays / longTrips.length) : 0;

                    // Median efficiency
                    const efficiencies = tripData
                      .map(t => t.trip && t.trip > 0 && t.electricity != null ? (t.electricity / t.trip) * 100 : 0)
                      .filter(e => e > 0)
                      .sort((a, b) => a - b);
                    const medianEfficiency = efficiencies.length > 0
                      ? efficiencies[Math.floor(efficiencies.length / 2)]
                      : 0;

                    // Daily kWh average
                    const dailyKwh = (parseFloat(summary?.totalKwh || 0) / totalDays);

                    // Monthly cost
                    const electricityPrice = settings?.electricityPrice || 0.15;
                    const monthlyData = monthly || [];
                    const avgMonthlyKwh = monthlyData.length > 0
                      ? monthlyData.reduce((sum, m) => sum + (m.kwh || 0), 0) / monthlyData.length
                      : 0;
                    const monthlyCost = avgMonthlyKwh * electricityPrice;

                    return (
                      <div className={isCompact ? COMPACT_SPACE_Y : 'space-y-4 sm:space-y-6'}>
                        <div className={`grid gap-4 ${isCompact ? 'grid-cols-4 !gap-3' : 'grid-cols-2 md:grid-cols-4'}`}>
                          <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={Navigation} label="Viaje largo cada" value={daysPerLongTrip} unit="días" color="bg-purple-500/20 text-purple-400" />
                          <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={Battery} label="Eficiencia mediana" value={medianEfficiency.toFixed(2)} unit="kWh/100km" color="bg-green-500/20 text-green-400" />
                          <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={Zap} label="Carga diaria" value={dailyKwh.toFixed(2)} unit="kWh/día" color="bg-cyan-500/20 text-cyan-400" />
                          <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={TrendingUp} label="Coste mensual" value={monthlyCost.toFixed(2)} unit="€/mes" color="bg-amber-500/20 text-amber-400" />
                        </div>
                        <div className={`grid gap-4 ${isCompact ? 'grid-cols-1 lg:grid-cols-2 !gap-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
                          <ChartCard isCompact={isCompact} title="Km y kWh Mensual">
                            <div style={{ width: '100%', height: isCompact ? 350 : 450 }}>
                              <BarJS
                                options={{
                                  maintainAspectRatio: false,
                                  scales: {
                                    y: { beginAtZero: true, position: 'left', border: { dash: [] }, ticks: { color: BYD_RED }, grid: { color: 'rgba(203, 213, 225, 0.3)', borderDash: [3, 3], drawBorder: false } },
                                    y1: { beginAtZero: true, position: 'right', border: { dash: [] }, ticks: { color: '#06b6d4' }, grid: { drawOnChartArea: false } },
                                    x: { border: { dash: [] }, grid: { display: false } }
                                  },
                                  plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 10, usePointStyle: true, font: { size: 10 } } } }
                                }}
                                data={{
                                  labels: monthly.map(m => m.monthLabel),
                                  datasets: [
                                    { label: 'Km', data: monthly.map(m => m.km), backgroundColor: BYD_RED, yAxisID: 'y', borderRadius: 4 },
                                    { label: 'kWh', data: monthly.map(m => m.kwh), backgroundColor: '#06b6d4', yAxisID: 'y1', borderRadius: 4 }
                                  ]
                                }}
                              />
                            </div>
                          </ChartCard>
                          <ChartCard isCompact={isCompact} title="Km recorridos en últimos 60 días">
                            <div style={{ width: '100%', height: isCompact ? 350 : 450 }}>
                              <LineJS
                                options={{
                                  maintainAspectRatio: false,
                                  scales: {
                                    y: { beginAtZero: true, border: { dash: [] }, grid: { color: 'rgba(203, 213, 225, 0.3)', borderDash: [3, 3], drawBorder: false } },
                                    x: { border: { dash: [] }, grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45, font: { size: 9 } } }
                                  },
                                  plugins: { legend: { display: false } },
                                  elements: { line: { tension: 0.4 } }
                                }}
                                data={{
                                  labels: daily.slice(-60).map(d => d.dateLabel),
                                  datasets: [{
                                    label: 'Km',
                                    data: daily.slice(-60).map(d => d.km),
                                    borderColor: BYD_RED,
                                    backgroundColor: 'rgba(234, 0, 41, 0.1)',
                                    fill: true,
                                    pointRadius: 0,
                                    pointHoverRadius: 4,
                                    borderWidth: 2
                                  }]
                                }}
                              />
                            </div>
                          </ChartCard>
                        </div>

                      </div>
                    );
                  })()}
                  {activeTab === 'patterns' && (() => {
                    const topDay = weekday.reduce((a, b) => (a.trips || 0) > (b.trips || 0) ? a : b);
                    const topHour = hourly.reduce((a, b) => (a.trips || 0) > (b.trips || 0) ? a : b);
                    return (
                      <div className={isCompact ? COMPACT_SPACE_Y : 'space-y-4 sm:space-y-6'}>
                        <div className={`grid gap-4 ${isCompact ? 'grid-cols-4 !gap-3' : 'grid-cols-2 md:grid-cols-4'}`}>
                          <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={Calendar} label="Día frecuente" value={dayNamesFull[topDay.day] || topDay.day} unit="" color="bg-amber-500/20 text-amber-400" />
                          <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={Clock} label="Hora pico" value={`${topHour.hour.toString().padStart(2, '0')}:00h`} unit="" color="bg-purple-500/20 text-purple-400" />
                          <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={MapPin} label="Km totales" value={summary.totalKm} unit="km" color="bg-red-500/20 text-red-400" />
                          <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={TrendingUp} label="Media día" value={summary.kmDay} unit="km" color="bg-blue-500/20 text-blue-400" />
                        </div>
                        <div className={`grid gap-4 ${isCompact ? 'grid-cols-1 lg:grid-cols-2 !gap-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
                          <ChartCard isCompact={isCompact} title="Por Hora">
                            <div style={{ width: '100%', height: isCompact ? 284 : 340 }}>
                              <BarJS
                                options={{
                                  maintainAspectRatio: false,
                                  scales: {
                                    y: { beginAtZero: true, border: { dash: [] }, grid: { color: 'rgba(203, 213, 225, 0.3)', borderDash: [3, 3], drawBorder: false }, ticks: { font: { size: 10 } } },
                                    x: { border: { dash: [] }, grid: { display: false }, ticks: { font: { size: 10 } } }
                                  },
                                  plugins: { legend: { display: false } }
                                }}
                                data={{
                                  labels: hourly.map(h => `${h.hour}h`),
                                  datasets: [{ label: 'Viajes', data: hourly.map(h => h.trips), backgroundColor: '#f59e0b', borderRadius: 2 }]
                                }}
                              />
                            </div>
                          </ChartCard>
                          <ChartCard isCompact={isCompact} title="Por Día">
                            <div style={{ width: '100%', height: isCompact ? 284 : 340 }}>
                              <RadarJS
                                options={{
                                  maintainAspectRatio: false,
                                  scales: { r: { grid: { color: '#94a3b8', borderDash: [3, 3] }, ticks: { display: false }, pointLabels: { font: { size: 10 }, color: '#64748b' } } },
                                  plugins: { legend: { display: false } }
                                }}
                                data={{
                                  labels: weekday.map(d => d.day),
                                  datasets: [{
                                    label: 'Viajes',
                                    data: weekday.map(d => d.trips),
                                    borderColor: '#f59e0b',
                                    backgroundColor: 'rgba(245, 158, 11, 0.3)',
                                    borderWidth: 2,
                                    pointBackgroundColor: '#f59e0b',
                                    pointRadius: 3
                                  }]
                                }}
                              />
                            </div>
                          </ChartCard>
                        </div>
                        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                          {weekday.map((d, i) => (
                            <div key={i} className={`bg-white dark:bg-slate-800/50 rounded-lg sm:rounded-xl text-center border border-slate-200 dark:border-slate-700/50 ${isCompact ? 'p-1.5' : 'p-2 sm:p-3'}`}>
                              <p className="text-slate-600 dark:text-slate-400 text-[10px] sm:text-xs">{dayNamesFull[d.day] || d.day}</p>
                              <p className={`font-bold text-slate-900 dark:text-white ${isCompact ? 'text-sm' : 'text-base sm:text-xl'}`}>{d.trips} viajes</p>
                              <p className="text-[9px] sm:text-xs" style={{ color: BYD_RED }}>{d.km.toFixed(0)} km</p>
                            </div>
                          ))}
                        </div>

                      </div>
                    );
                  })()}
                  {activeTab === 'efficiency' && (
                    <div className={isCompact ? COMPACT_SPACE_Y : 'space-y-4 sm:space-y-6'}>
                      <div className={`grid gap-4 ${isCompact ? 'grid-cols-4 !gap-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
                        <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={Battery} label="Eficiencia" value={summary.avgEff} unit="kWh/100km" color="bg-green-500/20 text-green-400" />
                        <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={Zap} label="Consumo/viaje" value={(parseFloat(summary.totalKwh) / summary.totalTrips).toFixed(2)} unit="kWh" color="bg-cyan-500/20 text-cyan-400" />
                        <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={MapPin} label="Distancia media" value={summary.avgKm} unit="km" color="bg-purple-500/20 text-purple-400" />
                        <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={TrendingUp} label="Velocidad media" value={summary.avgSpeed} unit="km/h" color="bg-blue-500/20 text-blue-400" />
                      </div>
                      <div className={`grid gap-4 ${isCompact ? 'grid-cols-1 lg:grid-cols-2 !gap-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
                        <ChartCard isCompact={isCompact} title="📈 Evolución Eficiencia Mensual">
                          <div style={{ width: '100%', height: isCompact ? 350 : 450 }}>
                            <LineJS
                              options={{
                                maintainAspectRatio: false,
                                scales: {
                                  y: {
                                    beginAtZero: false,
                                    min: Math.floor(Math.min(...monthly.map(m => m.efficiency || 999))) - 1,
                                    max: Math.ceil(Math.max(...monthly.map(m => m.efficiency || 0))) + 1,
                                    border: { dash: [] }, grid: { color: 'rgba(203, 213, 225, 0.3)', borderDash: [3, 3], drawBorder: false },
                                    ticks: { font: { size: 10 } }
                                  },
                                  x: { border: { dash: [] }, grid: { display: false }, ticks: { font: { size: 10 } } }
                                },
                                plugins: { legend: { display: false } }
                              }}
                              data={{
                                labels: monthly.map(m => m.monthLabel),
                                datasets: [{
                                  label: 'kWh/100km',
                                  data: monthly.map(m => m.efficiency),
                                  borderColor: '#10b981',
                                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                  fill: true,
                                  pointBackgroundColor: '#10b981',
                                  tension: 0.4,
                                  pointRadius: 3
                                }]
                              }}
                            />
                          </div>
                        </ChartCard>
                        <ChartCard isCompact={isCompact} title="📍 Eficiencia vs Distancia">
                          <div style={{ width: '100%', height: isCompact ? 350 : 450 }}>
                            <ScatterJS
                              options={{
                                maintainAspectRatio: false,
                                scales: {
                                  x: {
                                    type: 'logarithmic',
                                    position: 'bottom',
                                    title: { display: true, text: 'Distancia (km)', font: { size: 10 } },
                                    border: { dash: [] }, grid: { display: true, borderDash: [3, 3], drawBorder: false },
                                    min: 1,
                                    max: 500,
                                    ticks: {
                                      font: { size: 10 },
                                      callback: function (value) {
                                        const allowed = [1, 2, 5, 10, 50, 200, 500];
                                        return allowed.includes(value) ? value : '';
                                      },
                                      autoSkip: false,
                                      maxRotation: 0
                                    }
                                  },
                                  y: {
                                    title: { display: true, text: 'Eficiencia', font: { size: 10 } },
                                    border: { dash: [] }, grid: { color: 'rgba(203, 213, 225, 0.3)', borderDash: [3, 3], drawBorder: false },
                                    ticks: { font: { size: 10 } }
                                  }
                                },
                                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `Dist: ${c.raw.x.toFixed(1)}km, Eff: ${c.raw.y.toFixed(1)}` } } }
                              }}
                              data={{
                                datasets: [{
                                  label: 'Eficiencia',
                                  data: effScatter,
                                  backgroundColor: BYD_RED,
                                  pointRadius: 4
                                }]
                              }}
                            />
                          </div>
                        </ChartCard>
                      </div>

                    </div>
                  )}
                  {activeTab === 'records' && (
                    <div className={`${isCompact ? COMPACT_SPACE_Y : 'space-y-4 sm:space-y-6'}`}>
                      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 ${isCompact ? '!gap-3' : ''}`}>
                        <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={Navigation} label="Más largo" value={summary.maxKm} unit="km" color="bg-red-500/20 text-red-500" />
                        <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={Zap} label="Mayor consumo" value={summary.maxKwh} unit="kWh" color="bg-cyan-500/20 text-cyan-500" />
                        <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={Clock} label="Más duración" value={summary.maxMin} unit="min" color="bg-amber-500/20 text-amber-500" />
                        <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={MapPin} label="Más corto" value={summary.minKm} unit="km" color="bg-purple-500/20 text-purple-500" />
                      </div>
                      <div className={`grid grid-cols-3 gap-3 sm:gap-6 ${isCompact ? '!gap-3' : ''}`}>
                        <ChartCard isCompact={isCompact} title="🥇 Top Distancia">
                          <div className={`flex flex-col justify-between ${isCompact ? 'h-[350px]' : 'h-[450px]'}`}>
                            {top.km.map((t, i) => (
                              <div key={i} className={`flex justify-between border-b border-slate-200 dark:border-slate-700/50 last:border-0 ${isCompact ? 'py-[5.5px]' : 'py-2'}`}>
                                <span className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[9px] truncate' : 'text-xs sm:text-sm'}`}>{i + 1}. {formatDate(t.date)}</span>
                                <span className={`font-medium text-slate-900 dark:text-white ${isCompact ? 'text-[10px]' : 'text-sm sm:text-base'}`}>{t.trip?.toFixed(1)} km</span>
                              </div>
                            ))}
                          </div>
                        </ChartCard>
                        <ChartCard isCompact={isCompact} title="⚡ Top Consumo">
                          <div className={`flex flex-col justify-between ${isCompact ? 'h-[350px]' : 'h-[450px]'}`}>
                            {top.kwh.map((t, i) => (
                              <div key={i} className={`flex justify-between border-b border-slate-200 dark:border-slate-700/50 last:border-0 ${isCompact ? 'py-[5.5px]' : 'py-2'}`}>
                                <span className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[9px] truncate' : 'text-xs sm:text-sm'}`}>{i + 1}. {formatDate(t.date)}</span>
                                <span className={`font-medium text-slate-900 dark:text-white ${isCompact ? 'text-[10px]' : 'text-sm sm:text-base'}`}>{t.electricity?.toFixed(1)} kWh</span>
                              </div>
                            ))}
                          </div>
                        </ChartCard>
                        <ChartCard isCompact={isCompact} title="⏱️ Top Duración">
                          <div className={`flex flex-col justify-between ${isCompact ? 'h-[350px]' : 'h-[450px]'}`}>
                            {top.dur.map((t, i) => (
                              <div key={i} className={`flex justify-between border-b border-slate-200 dark:border-slate-700/50 last:border-0 ${isCompact ? 'py-[5.5px]' : 'py-2'}`}>
                                <span className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[9px] truncate' : 'text-xs sm:text-sm'}`}>{i + 1}. {formatDate(t.date)}</span>
                                <span className={`font-medium text-slate-900 dark:text-white ${isCompact ? 'text-[10px]' : 'text-sm sm:text-base'}`}>{((t.duration || 0) / 60).toFixed(0)} min</span>
                              </div>
                            ))}
                          </div>
                        </ChartCard>
                      </div>

                    </div>
                  )}
                  {activeTab === 'history' && (
                    <div className={`${isCompact ? COMPACT_SPACE_Y : 'space-y-4 sm:space-y-6'}`}>
                      <div className={`grid lg:grid-cols-8 gap-6 ${isCompact ? 'gap-4' : ''}`}>
                        <div className={`lg:col-span-6 space-y-4 ${isCompact ? 'space-y-3' : ''}`}>
                          <h2 className={`font-bold text-slate-900 dark:text-white ${isCompact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`}>Últimos 10 viajes</h2>
                          {(() => {
                            const allTrips = [...filtered].sort((a, b) => {
                              const dateCompare = (b.date || '').localeCompare(a.date || '');
                              if (dateCompare !== 0) return dateCompare;
                              return (b.start_timestamp || 0) - (a.start_timestamp || 0);
                            });

                            const validTrips = allTrips.filter(t => t.trip >= 1 && t.electricity !== 0);
                            const efficiencies = validTrips.map(t => (t.electricity / t.trip) * 100);
                            const minEff = Math.min(...efficiencies);
                            const maxEff = Math.max(...efficiencies);

                            const last10 = allTrips.slice(0, 10);
                            const firstColumn = last10.slice(0, 5);
                            const secondColumn = last10.slice(5, 10);

                            return (
                              <div className={`grid lg:grid-cols-2 gap-4 ${isCompact ? 'gap-3' : ''}`}>
                                <div className={`space-y-3 ${isCompact ? 'space-y-3' : ''}`}>
                                  {firstColumn.map((trip, i) => (
                                    <TripCard
                                      key={i}
                                      trip={trip}
                                      minEff={minEff}
                                      maxEff={maxEff}
                                      onClick={openTripDetail}
                                      formatDate={formatDate}
                                      formatTime={formatTime}
                                      calculateScore={calculateScore}
                                      getScoreColor={getScoreColor}
                                    />
                                  ))}
                                </div>
                                <div className={`space-y-3 ${isCompact ? 'space-y-3' : ''}`}>
                                  {secondColumn.map((trip, j) => (
                                    <TripCard
                                      key={j + 5}
                                      trip={trip}
                                      minEff={minEff}
                                      maxEff={maxEff}
                                      onClick={openTripDetail}
                                      formatDate={formatDate}
                                      formatTime={formatTime}
                                      calculateScore={calculateScore}
                                      getScoreColor={getScoreColor}
                                    />
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                          <button
                            onClick={() => setShowAllTripsModal(true)}
                            className="w-full py-3 rounded-xl font-medium text-white"
                            style={{ backgroundColor: BYD_RED }}
                          >
                            Mostrar todo
                          </button>
                        </div>

                        <div className={`lg:col-span-2 space-y-4 ${isCompact ? 'space-y-3' : ''}`}>
                          <h2 className={`font-bold text-slate-900 dark:text-white ${isCompact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`}>Promedio últimos 10 viajes</h2>
                          {(() => {
                            const allTrips = [...filtered].sort((a, b) => {
                              const dateCompare = (b.date || '').localeCompare(a.date || '');
                              if (dateCompare !== 0) return dateCompare;
                              return (b.start_timestamp || 0) - (a.start_timestamp || 0);
                            });
                            const last10 = allTrips.slice(0, 10);

                            const avgDistance = last10.reduce((sum, t) => sum + (t.trip || 0), 0) / last10.length || 0;
                            const avgConsumption = last10.reduce((sum, t) => sum + (t.electricity || 0), 0) / last10.length || 0;
                            const avgEfficiency = last10.reduce((sum, t) => {
                              if (t.trip > 0 && t.electricity !== undefined) {
                                return sum + ((t.electricity / t.trip) * 100);
                              }
                              return sum;
                            }, 0) / last10.length || 0;
                            const avgDuration = last10.reduce((sum, t) => sum + ((t.duration || 0) / 60), 0) / last10.length || 0;
                            const avgSpeedFiltered = last10.filter(t => t.duration > 0 && t.trip > 0);
                            const avgSpeed = avgSpeedFiltered.length > 0
                              ? avgSpeedFiltered.reduce((sum, t) => sum + (t.trip / ((t.duration || 0) / 3600)), 0) / avgSpeedFiltered.length
                              : 0;

                            return (
                              <div className={`space-y-3 ${isCompact ? 'space-y-2' : ''}`}>
                                <div className={`bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 ${isCompact ? 'p-2' : 'p-4'}`}>
                                  <div className="flex flex-col items-center text-center gap-2">
                                    <div className={`rounded-lg bg-red-500/20 flex items-center justify-center ${isCompact ? 'w-8 h-8' : 'w-10 h-10'}`}>
                                      <MapPin className={`text-red-400 ${isCompact ? 'w-4 h-4' : 'w-5 h-5'}`} />
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-600 dark:text-slate-400">Distancia promedio</p>
                                      <p className={`font-bold text-slate-900 dark:text-white ${isCompact ? 'text-xl' : 'text-2xl'}`}>
                                        {avgDistance.toFixed(1)} <span className="text-sm text-slate-500 dark:text-slate-400">km</span>
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className={`bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 ${isCompact ? 'p-2' : 'p-4'}`}>
                                  <div className="flex flex-col items-center text-center gap-2">
                                    <div className={`rounded-lg bg-cyan-500/20 flex items-center justify-center ${isCompact ? 'w-8 h-8' : 'w-10 h-10'}`}>
                                      <Zap className={`text-cyan-400 ${isCompact ? 'w-4 h-4' : 'w-5 h-5'}`} />
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-600 dark:text-slate-400">Consumo promedio</p>
                                      <p className={`font-bold text-slate-900 dark:text-white ${isCompact ? 'text-xl' : 'text-2xl'}`}>
                                        {avgConsumption.toFixed(2)} <span className="text-sm text-slate-500 dark:text-slate-400">kWh</span>
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className={`bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 ${isCompact ? 'p-2' : 'p-4'}`}>
                                  <div className="flex flex-col items-center text-center gap-2">
                                    <div className={`rounded-lg bg-green-500/20 flex items-center justify-center ${isCompact ? 'w-8 h-8' : 'w-10 h-10'}`}>
                                      <Battery className={`text-green-400 ${isCompact ? 'w-4 h-4' : 'w-5 h-5'}`} />
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-600 dark:text-slate-400">Eficiencia promedio</p>
                                      <p className={`font-bold text-slate-900 dark:text-white ${isCompact ? 'text-xl' : 'text-2xl'}`}>
                                        {avgEfficiency.toFixed(2)} <span className="text-sm text-slate-500 dark:text-slate-400">kWh/100km</span>
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className={`bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 ${isCompact ? 'p-2' : 'p-4'}`}>
                                  <div className="flex flex-col items-center text-center gap-2">
                                    <div className={`rounded-lg bg-amber-500/20 flex items-center justify-center ${isCompact ? 'w-8 h-8' : 'w-10 h-10'}`}>
                                      <Clock className={`text-amber-400 ${isCompact ? 'w-4 h-4' : 'w-5 h-5'}`} />
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-600 dark:text-slate-400">Duración promedio</p>
                                      <p className={`font-bold text-slate-900 dark:text-white ${isCompact ? 'text-xl' : 'text-2xl'}`}>
                                        {avgDuration.toFixed(0)} <span className="text-sm text-slate-500 dark:text-slate-400">min</span>
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className={`bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 ${isCompact ? 'p-2' : 'p-4'}`}>
                                  <div className="flex flex-col items-center text-center gap-2">
                                    <div className={`rounded-lg bg-blue-500/20 flex items-center justify-center ${isCompact ? 'w-8 h-8' : 'w-10 h-10'}`}>
                                      <TrendingUp className={`text-blue-400 ${isCompact ? 'w-4 h-4' : 'w-5 h-5'}`} />
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-600 dark:text-slate-400">Velocidad promedio</p>
                                      <p className={`font-bold text-slate-900 dark:text-white ${isCompact ? 'text-xl' : 'text-2xl'}`}>
                                        {avgSpeed.toFixed(1)} <span className="text-sm text-slate-500 dark:text-slate-400">km/h</span>
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                    </div>
                  )}
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
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Filtrar viajes</h2>
                  </div>
                  <button onClick={() => setShowFilterModal(false)} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Filter Type Buttons */}
                  <div className="space-y-2">
                    <label className="text-slate-600 dark:text-slate-400 text-sm">Tipo de filtro:</label>
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
                        📊 Todos los viajes ({rawTrips.length})
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
                        📅 Por mes
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
                        📆 Rango de fechas
                      </button>
                    </div>
                  </div>

                  {/* Month Selector */}
                  {filterType === 'month' && (
                    <div className="space-y-2">
                      <label className="text-slate-600 dark:text-slate-400 text-sm">Seleccionar mes:</label>
                      <select
                        value={selMonth}
                        onChange={(e) => setSelMonth(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-600 text-sm"
                      >
                        <option value="">Todos los meses</option>
                        {months.map((m) => (
                          <option key={m} value={m}>{formatMonth(m)}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Date Range Selector */}
                  {filterType === 'range' && (
                    <div className="space-y-2">
                      <label className="text-slate-600 dark:text-slate-400 text-sm">Rango de fechas:</label>
                      <div className="flex flex-col gap-2">
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-600 text-sm"
                          placeholder="Desde"
                        />
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-600 text-sm"
                          placeholder="Hasta"
                        />
                      </div>
                    </div>
                  )}

                  {/* Results Count */}
                  {filtered.length !== rawTrips.length && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-center text-sm">
                        <span className="text-slate-400">Mostrando </span>
                        <span className="font-bold" style={{ color: BYD_RED }}>{filtered.length}</span>
                        <span className="text-slate-400"> de {rawTrips.length} viajes</span>
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
                  Aplicar filtro
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
      <PWAManager layoutMode={layoutMode} />
    </div >
  );
}
