// BYD Stats Analyzer - Refactored with Code Splitting and Lazy Loading
// Reduced from ~3011 lines to ~450 lines

import React, { useState, useCallback, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, ScatterChart, Scatter, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

// Utils
import {
  BYD_RED,
  STORAGE_KEY,
  TRIP_HISTORY_KEY,
  TAB_PADDING,
  COMPACT_TAB_PADDING,
  COMPACT_SPACE_Y
} from './utils/constants';
import { formatMonth, formatDate, formatTime } from './utils/dateUtils';
import { calculateScore, getScoreColor, formatDuration, calculatePercentile } from './utils/formatters';
import { processData } from './utils/dataProcessing';

// Hooks
import { useSettings } from './hooks/useSettings';
import { useLayoutMode } from './hooks/useLayoutMode';
import { useTheme } from './hooks/useTheme';
import { useDatabase } from './hooks/useDatabase';
import { useLocalStorage } from './hooks/useLocalStorage';

// Components
import {
  Activity, TrendingUp, Clock, Zap, BarChart3, List,
  Upload, Settings, Filter, MapPin, Battery, Calendar,
  Car, Navigation, Database, Download, Plus, HelpCircle
} from './components/icons';
import { LoadingSpinner, InlineSpinner } from './components/ui/LoadingSpinner';
import { StatCard, ChartCard, TripCard } from './components/cards';
import { ChartTip } from './components/charts';
import { GitHubFooter, TabNavigation, Sidebar } from './components/layout';

// Lazy loaded modals
const SettingsModal = lazy(() => import('./components/modals/SettingsModal'));
const FilterModal = lazy(() => import('./components/modals/FilterModal'));
const TripDetailModal = lazy(() => import('./components/modals/TripDetailModal'));
const HistoryModal = lazy(() => import('./components/modals/HistoryModal'));
const DatabaseUploadModal = lazy(() => import('./components/modals/DatabaseUploadModal'));

export default function BYDStatsAnalyzer() {
  // State
  const [rawTrips, setRawTrips] = useLocalStorage(STORAGE_KEY, []);
  const [tripHistory, setTripHistory] = useLocalStorage(TRIP_HISTORY_KEY, []);
  const [activeTab, setActiveTab] = useState('overview');
  const [dragOver, setDragOver] = useState(false);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showAllTripsModal, setShowAllTripsModal] = useState(false);
  const [showTripDetailModal, setShowTripDetailModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);

  // Filter states
  const [filterType, setFilterType] = useState('all');
  const [selMonth, setSelMonth] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Transition state
  const [isTransitioning, setIsTransitioning] = useState(false);
  const touchStartRef = useRef(null);
  const touchStartYRef = useRef(null);
  const swipeContainerRef = useRef(null);

  // Hooks
  const [settings, setSettings] = useSettings();
  const { layoutMode, isCompact } = useLayoutMode();
  useTheme(settings.theme);
  const { sqlReady, loading, error, initSql, processDB, exportDatabase, validateFile, setError } = useDatabase();

  const isNative = Capacitor.isNativePlatform();
  const isLargerCard = isCompact && layoutMode === 'horizontal';
  const minSwipeDistance = 30;
  const transitionDuration = 500;

  // Initialize SQL.js
  useEffect(() => {
    initSql();
  }, [initSql]);

  // Add global styles for Recharts
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .recharts-wrapper svg * { outline: none !important; }
      .recharts-wrapper svg *:focus { outline: none !important; }
      .recharts-surface { outline: none !important; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Android back button handler
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
    return () => backHandler.then(h => h.remove());
  }, [showTripDetailModal, showSettingsModal, showAllTripsModal, isNative]);

  // Derived data
  const months = useMemo(() =>
    [...new Set(rawTrips.map(t => t.month).filter(Boolean))].sort(),
    [rawTrips]
  );

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

  const data = useMemo(() =>
    filtered.length > 0 ? processData(filtered) : null,
    [filtered]
  );

  // Tabs configuration
  const tabs = useMemo(() => [
    { id: 'overview', label: 'Resumen', icon: Activity },
    { id: 'trends', label: 'Tendencias', icon: TrendingUp },
    { id: 'patterns', label: 'Patrones', icon: Clock },
    { id: 'efficiency', label: 'Eficiencia', icon: Zap },
    { id: 'records', label: 'Récords', icon: BarChart3 },
    { id: 'history', label: 'Histórico', icon: List }
  ], []);

  // Handlers
  const handleTabClick = useCallback((tabId) => {
    if (tabId === activeTab) return;
    if (layoutMode === 'vertical') {
      if (isTransitioning) return;
      setIsTransitioning(true);
      setActiveTab(tabId);
      setTimeout(() => setIsTransitioning(false), transitionDuration);
    } else {
      setActiveTab(tabId);
    }
  }, [activeTab, layoutMode, isTransitioning]);

  const handleFileSelect = useCallback(async (file, merge = false) => {
    if (!validateFile(file)) {
      alert('Solo se admiten archivos *.DB o *.JPG (base de datos renombrada)');
      return;
    }
    const result = await processDB(file, rawTrips, merge);
    if (result) {
      setRawTrips(result);
      setShowModal(false);
    }
  }, [validateFile, processDB, rawTrips, setRawTrips]);

  const onDrop = useCallback((e, merge) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f, merge);
  }, [handleFileSelect]);

  const onFile = useCallback((e, merge) => {
    const f = e.target.files[0];
    if (f) handleFileSelect(f, merge);
    e.target.value = '';
  }, [handleFileSelect]);

  const clearData = () => {
    if (window.confirm('¿Borrar todos los datos?')) {
      setRawTrips([]);
    }
  };

  const saveToHistory = useCallback(() => {
    if (rawTrips.length === 0) {
      alert('No hay viajes para guardar');
      return;
    }
    const map = new Map();
    tripHistory.forEach(t => map.set(t.date + '-' + t.start_timestamp, t));
    rawTrips.forEach(t => map.set(t.date + '-' + t.start_timestamp, t));
    const newHistory = Array.from(map.values()).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    setTripHistory(newHistory);
    alert(`Registro guardado: ${newHistory.length} viajes en total`);
  }, [rawTrips, tripHistory, setTripHistory]);

  const loadFromHistory = useCallback(() => {
    if (tripHistory.length === 0) {
      alert('No hay historial guardado');
      return;
    }
    if (window.confirm(`¿Cargar ${tripHistory.length} viajes del historial?`)) {
      setRawTrips(tripHistory);
    }
  }, [tripHistory, setRawTrips]);

  const clearHistory = useCallback(() => {
    if (window.confirm('¿Borrar el historial de viajes permanentemente?')) {
      setTripHistory([]);
      alert('Historial borrado');
    }
  }, [setTripHistory]);

  const openTripDetail = (trip) => {
    setSelectedTrip(trip);
    setShowTripDetailModal(true);
  };

  // Swipe gesture handling
  useEffect(() => {
    const container = swipeContainerRef.current;
    if (!container || layoutMode === 'horizontal') return;

    let swipeDirection = null;

    const handleTouchStart = (e) => {
      if (isTransitioning) return;
      const touch = e.touches[0];
      touchStartRef.current = touch.clientX;
      touchStartYRef.current = touch.clientY;
      swipeDirection = null;
    };

    const handleTouchMove = (e) => {
      if (!touchStartRef.current || isTransitioning) return;
      const touch = e.touches[0];
      const diffX = Math.abs(touch.clientX - touchStartRef.current);
      const diffY = Math.abs(touch.clientY - touchStartYRef.current);
      if (!swipeDirection) swipeDirection = diffX > diffY ? 'horizontal' : 'vertical';
      if (swipeDirection === 'horizontal' && diffX > 10) e.preventDefault();
    };

    const handleTouchEnd = (e) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const diffX = touch.clientX - touchStartRef.current;
      if (swipeDirection === 'horizontal' && Math.abs(diffX) > minSwipeDistance) {
        const currentIndex = tabs.findIndex(t => t.id === activeTab);
        if (diffX < 0 && currentIndex < tabs.length - 1) {
          handleTabClick(tabs[currentIndex + 1].id);
        } else if (diffX > 0 && currentIndex > 0) {
          handleTabClick(tabs[currentIndex - 1].id);
        }
      }
      touchStartRef.current = null;
      touchStartYRef.current = null;
      swipeDirection = null;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isTransitioning, activeTab, tabs, layoutMode, handleTabClick, minSwipeDistance]);

  // Loading state
  if (loading) {
    return <LoadingSpinner message="Procesando..." />;
  }

  // Empty state - no data loaded
  if (rawTrips.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="w-full max-w-xl">
          <div className="text-center mb-8">
            <img src="app_logo.png" className="w-32 sm:w-40 md:w-48 h-auto mx-auto mb-4 md:mb-6" alt="App Logo" />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">Estadísticas BYD</h1>
            <p className="text-sm sm:text-base text-slate-400">Analiza los datos de tu vehículo eléctrico</p>
          </div>

          {!sqlReady && !error && (
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-3 px-4 py-2 bg-white dark:bg-slate-800/50 rounded-xl">
                <InlineSpinner />
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
            className="border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer"
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
              className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
              style={{ backgroundColor: dragOver ? BYD_RED : '#334155' }}
            >
              <Upload className="w-8 h-8" style={{ color: dragOver ? 'white' : BYD_RED }} />
            </div>
            <p className="text-white text-lg sm:text-xl mb-2">
              {sqlReady ? (isNative ? 'Toca para seleccionar tu archivo' : 'Arrastra tu archivo EC_database.db') : 'Preparando...'}
            </p>
            {!isNative && <p className="text-slate-400 text-sm">o haz clic para seleccionar</p>}
            <p className="text-slate-400 text-xs mt-4">
              Selecciona el fichero EC_Database.db en la carpeta "EnergyData" de tu coche
            </p>
          </div>

          {sqlReady && (
            <p className="text-center mt-4 text-sm" style={{ color: BYD_RED }}>
              ✓ Listo para cargar datos
            </p>
          )}
        </div>
      </div>
    );
  }

  // Main app view with data
  const { summary, monthly, daily, hourly, weekday, tripDist, effScatter, top } = data || {};

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      {/* Suspense wrapper for lazy-loaded modals */}
      <Suspense fallback={null}>
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          settings={settings}
          onSettingsChange={setSettings}
        />
        <FilterModal
          isOpen={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          filterType={filterType}
          setFilterType={setFilterType}
          selMonth={selMonth}
          setSelMonth={setSelMonth}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          months={months}
          rawTripsCount={rawTrips.length}
          filteredCount={filtered.length}
        />
        <TripDetailModal
          isOpen={showTripDetailModal}
          onClose={() => { setShowTripDetailModal(false); setSelectedTrip(null); }}
          trip={selectedTrip}
          allTrips={filtered}
          summary={summary}
          settings={settings}
        />
        <HistoryModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          historyCount={tripHistory.length}
          onSave={saveToHistory}
          onLoad={loadFromHistory}
          onClear={clearHistory}
        />
        <DatabaseUploadModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          sqlReady={sqlReady}
          onFileSelect={handleFileSelect}
          onExport={() => exportDatabase(filtered)}
          onClearData={clearData}
          onShowHistory={() => setShowHistoryModal(true)}
          hasData={rawTrips.length > 0}
          isNative={isNative}
        />
      </Suspense>

      <div className="flex">
        {/* Sidebar for horizontal layout */}
        {layoutMode === 'horizontal' && (
          <Sidebar
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={handleTabClick}
            onSettings={() => setShowSettingsModal(true)}
            onDatabase={() => setShowModal(true)}
            onExport={() => exportDatabase(filtered)}
            onFilter={() => setShowFilterModal(true)}
            onHelp={() => { }}
            isCompact={isCompact}
          />
        )}

        {/* Main content */}
        <div
          ref={swipeContainerRef}
          className={`flex-1 ${layoutMode === 'horizontal' ? (isCompact ? 'ml-16' : 'ml-20') : ''}`}
        >
          <div
            className="tab-content-container overflow-y-auto"
            style={{
              padding: isCompact ? COMPACT_TAB_PADDING : TAB_PADDING,
              height: '100vh'
            }}
          >
            {data && (
              <>
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className={`${isCompact ? COMPACT_SPACE_Y : 'space-y-4 sm:space-y-6'}`}>
                    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${isCompact ? 'gap-3' : ''}`}>
                      <StatCard isLarger={isLargerCard} isCompact={isCompact} isVerticalMode={layoutMode === 'vertical'} icon={Car} label="Viajes totales" value={summary.totalTrips} unit="viajes" color="bg-red-500/20 text-red-500" sub={`${summary.tripsDay} viajes/día`} />
                      <StatCard isLarger={isLargerCard} isCompact={isCompact} isVerticalMode={layoutMode === 'vertical'} icon={MapPin} label="Distancia total" value={summary.totalKm} unit="km" color="bg-cyan-500/20 text-cyan-500" sub={`${summary.kmDay} km/día`} />
                      <StatCard isLarger={isLargerCard} isCompact={isCompact} isVerticalMode={layoutMode === 'vertical'} icon={Zap} label="Energía total" value={summary.totalKwh} unit="kWh" color="bg-amber-500/20 text-amber-500" />
                      <StatCard isLarger={isLargerCard} isCompact={isCompact} isVerticalMode={layoutMode === 'vertical'} icon={Battery} label="Eficiencia media" value={summary.avgEff} unit="kWh/100km" color="bg-green-500/20 text-green-500" />
                    </div>
                    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${isCompact ? 'gap-3' : ''}`}>
                      <StatCard isLarger={isLargerCard} isCompact={isCompact} isVerticalMode={layoutMode === 'vertical'} icon={Navigation} label="Media por viaje" value={summary.avgKm} unit="km" color="bg-purple-500/20 text-purple-500" />
                      <StatCard isLarger={isLargerCard} isCompact={isCompact} isVerticalMode={layoutMode === 'vertical'} icon={Clock} label="Duración media" value={summary.avgMin} unit="min" color="bg-blue-500/20 text-blue-500" />
                      <StatCard isLarger={isLargerCard} isCompact={isCompact} isVerticalMode={layoutMode === 'vertical'} icon={TrendingUp} label="Velocidad media" value={summary.avgSpeed} unit="km/h" color="bg-indigo-500/20 text-indigo-500" />
                      <StatCard isLarger={isLargerCard} isCompact={isCompact} isVerticalMode={layoutMode === 'vertical'} icon={Calendar} label="Días activos" value={summary.daysActive} unit={`de ${summary.totalDays}`} color="bg-pink-500/20 text-pink-500" />
                    </div>

                    <ChartCard isCompact={isCompact} title="📊 Distribución de viajes por distancia">
                      <div className={isCompact ? 'h-48' : 'h-64 sm:h-80'}>
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie data={tripDist} dataKey="count" nameKey="range" cx="50%" cy="50%" outerRadius={isCompact ? 70 : 100} labelLine={false}
                              label={({ range, percent }) => `${range}km (${(percent * 100).toFixed(0)}%)`}>
                              {tripDist.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip content={<ChartTip />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </ChartCard>
                    <GitHubFooter />
                  </div>
                )}

                {/* Trends Tab */}
                {activeTab === 'trends' && (
                  <div className={`${isCompact ? COMPACT_SPACE_Y : 'space-y-4 sm:space-y-6'}`}>
                    <ChartCard isCompact={isCompact} title="📈 Kilómetros mensuales">
                      <div className={isCompact ? 'h-48' : 'h-64 sm:h-80'}>
                        <ResponsiveContainer>
                          <BarChart data={monthly}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                            <XAxis dataKey="monthLabel" stroke="#64748b" fontSize={isCompact ? 10 : 12} interval={0} angle={-45} textAnchor="end" height={50} />
                            <YAxis stroke="#64748b" fontSize={isCompact ? 10 : 12} />
                            <Tooltip content={<ChartTip />} />
                            <Bar dataKey="km" name="Kilómetros" fill={BYD_RED} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </ChartCard>

                    <ChartCard isCompact={isCompact} title="⚡ Consumo mensual (kWh)">
                      <div className={isCompact ? 'h-48' : 'h-64 sm:h-80'}>
                        <ResponsiveContainer>
                          <AreaChart data={monthly}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                            <XAxis dataKey="monthLabel" stroke="#64748b" fontSize={isCompact ? 10 : 12} interval={0} angle={-45} textAnchor="end" height={50} />
                            <YAxis stroke="#64748b" fontSize={isCompact ? 10 : 12} />
                            <Tooltip content={<ChartTip />} />
                            <Area type="monotone" dataKey="kwh" name="kWh" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </ChartCard>
                    <GitHubFooter />
                  </div>
                )}

                {/* Patterns Tab */}
                {activeTab === 'patterns' && (
                  <div className={`${isCompact ? COMPACT_SPACE_Y : 'space-y-4 sm:space-y-6'}`}>
                    <ChartCard isCompact={isCompact} title="🕐 Viajes por hora del día">
                      <div className={isCompact ? 'h-48' : 'h-64 sm:h-80'}>
                        <ResponsiveContainer>
                          <BarChart data={hourly}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                            <XAxis dataKey="hour" stroke="#64748b" fontSize={isCompact ? 9 : 11} tickFormatter={(v) => `${v}h`} />
                            <YAxis stroke="#64748b" fontSize={isCompact ? 9 : 11} />
                            <Tooltip content={<ChartTip />} />
                            <Bar dataKey="trips" name="Viajes" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </ChartCard>

                    <ChartCard isCompact={isCompact} title="📅 Viajes por día de la semana">
                      <div className={isCompact ? 'h-48' : 'h-64 sm:h-80'}>
                        <ResponsiveContainer>
                          <RadarChart data={weekday}>
                            <PolarGrid stroke="#64748b" opacity={0.3} />
                            <PolarAngleAxis dataKey="day" stroke="#64748b" fontSize={isCompact ? 10 : 12} />
                            <PolarRadiusAxis stroke="#64748b" fontSize={isCompact ? 9 : 10} />
                            <Radar name="Viajes" dataKey="trips" stroke={BYD_RED} fill={BYD_RED} fillOpacity={0.5} />
                            <Tooltip content={<ChartTip />} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </ChartCard>
                    <GitHubFooter />
                  </div>
                )}

                {/* Efficiency Tab */}
                {activeTab === 'efficiency' && (
                  <div className={`${isCompact ? COMPACT_SPACE_Y : 'space-y-4 sm:space-y-6'}`}>
                    <ChartCard isCompact={isCompact} title="🔋 Eficiencia mensual (kWh/100km)">
                      <div className={isCompact ? 'h-48' : 'h-64 sm:h-80'}>
                        <ResponsiveContainer>
                          <LineChart data={monthly}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                            <XAxis dataKey="monthLabel" stroke="#64748b" fontSize={isCompact ? 10 : 12} interval={0} angle={-45} textAnchor="end" height={50} />
                            <YAxis stroke="#64748b" fontSize={isCompact ? 10 : 12} domain={['dataMin - 1', 'dataMax + 1']} />
                            <Tooltip content={<ChartTip />} />
                            <Line type="monotone" dataKey="efficiency" name="kWh/100km" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </ChartCard>

                    <ChartCard isCompact={isCompact} title="📍 Eficiencia vs Distancia">
                      <div className={isCompact ? 'h-48' : 'h-64 sm:h-80'}>
                        <ResponsiveContainer>
                          <ScatterChart>
                            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                            <XAxis dataKey="km" name="Distancia" stroke="#64748b" fontSize={12} type="number" scale="log" domain={['auto', 'auto']} ticks={[1, 2, 5, 10, 20, 50, 100, 200, 500]} tickFormatter={(v) => `${Math.round(v)}km`} />
                            <YAxis dataKey="eff" name="Eficiencia" stroke="#64748b" fontSize={11} domain={[0, 'dataMax + 2']} tickFormatter={(v) => `${v.toFixed(1)}`} />
                            <Tooltip content={<ChartTip />} />
                            <Scatter data={effScatter} fill={BYD_RED} />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </ChartCard>
                    <GitHubFooter />
                  </div>
                )}

                {/* Records Tab */}
                {activeTab === 'records' && (
                  <div className={`${isCompact ? COMPACT_SPACE_Y : 'space-y-4 sm:space-y-6'}`}>
                    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${isCompact ? 'gap-3' : ''}`}>
                      <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={Navigation} label="Más largo" value={summary.maxKm} unit="km" color="bg-red-500/20 text-red-500" />
                      <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={Zap} label="Mayor consumo" value={summary.maxKwh} unit="kWh" color="bg-cyan-500/20 text-cyan-500" />
                      <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={Clock} label="Más duración" value={summary.maxMin} unit="min" color="bg-amber-500/20 text-amber-500" />
                      <StatCard isLarger={isLargerCard} isCompact={isCompact} icon={MapPin} label="Más corto" value={summary.minKm} unit="km" color="bg-purple-500/20 text-purple-500" />
                    </div>
                    <div className={`grid grid-cols-3 gap-3 sm:gap-6 ${isCompact ? '!gap-3' : ''}`}>
                      <ChartCard isCompact={isCompact} title="🥇 Top Distancia">
                        <div className="space-y-1">
                          {top.km.map((t, i) => (
                            <div key={i} className={`flex justify-between border-b border-slate-200 dark:border-slate-700/50 last:border-0 ${isCompact ? 'py-[5.5px]' : 'py-2'}`}>
                              <span className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[9px] truncate' : 'text-xs sm:text-sm'}`}>{i + 1}. {formatDate(t.date)}</span>
                              <span className={`font-medium text-slate-900 dark:text-white ${isCompact ? 'text-[10px]' : 'text-sm sm:text-base'}`}>{t.trip?.toFixed(1)} km</span>
                            </div>
                          ))}
                        </div>
                      </ChartCard>
                      <ChartCard isCompact={isCompact} title="⚡ Top Consumo">
                        <div className="space-y-1">
                          {top.kwh.map((t, i) => (
                            <div key={i} className={`flex justify-between border-b border-slate-200 dark:border-slate-700/50 last:border-0 ${isCompact ? 'py-[5.5px]' : 'py-2'}`}>
                              <span className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[9px] truncate' : 'text-xs sm:text-sm'}`}>{i + 1}. {formatDate(t.date)}</span>
                              <span className={`font-medium text-slate-900 dark:text-white ${isCompact ? 'text-[10px]' : 'text-sm sm:text-base'}`}>{t.electricity?.toFixed(1)} kWh</span>
                            </div>
                          ))}
                        </div>
                      </ChartCard>
                      <ChartCard isCompact={isCompact} title="⏱️ Top Duración">
                        <div className="space-y-1">
                          {top.dur.map((t, i) => (
                            <div key={i} className={`flex justify-between border-b border-slate-200 dark:border-slate-700/50 last:border-0 ${isCompact ? 'py-[5.5px]' : 'py-2'}`}>
                              <span className={`text-slate-600 dark:text-slate-400 ${isCompact ? 'text-[9px] truncate' : 'text-xs sm:text-sm'}`}>{i + 1}. {formatDate(t.date)}</span>
                              <span className={`font-medium text-slate-900 dark:text-white ${isCompact ? 'text-[10px]' : 'text-sm sm:text-base'}`}>{((t.duration || 0) / 60).toFixed(0)} min</span>
                            </div>
                          ))}
                        </div>
                      </ChartCard>
                    </div>
                    <GitHubFooter />
                  </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                  <div className={`${isCompact ? COMPACT_SPACE_Y : 'space-y-4 sm:space-y-6'}`}>
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

                      return (
                        <div className={`grid lg:grid-cols-2 gap-4 ${isCompact ? 'gap-3' : ''}`}>
                          {last10.map((trip, i) => (
                            <TripCard
                              key={i}
                              trip={trip}
                              minEff={minEff}
                              maxEff={maxEff}
                              onClick={openTripDetail}
                              isCompact={isCompact}
                            />
                          ))}
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
                    <GitHubFooter />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Floating Filter Button */}
      <button
        onClick={() => setShowFilterModal(true)}
        className="fixed right-4 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95"
        style={{
          backgroundColor: BYD_RED,
          bottom: layoutMode === 'vertical'
            ? 'calc(5rem + env(safe-area-inset-bottom, 0px))'
            : 'calc(1rem + env(safe-area-inset-bottom, 0px))'
        }}
      >
        <Filter className="w-6 h-6 text-white" />
      </button>

      {/* Bottom Navigation Bar - Only in vertical mode */}
      {layoutMode === 'vertical' && (
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={handleTabClick}
        />
      )}
    </div>
  );
}
