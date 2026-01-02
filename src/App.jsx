import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, ScatterChart, Scatter, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

const BYD_RED = '#EA0029';

const BYDLogo = ({ className }) => (
  <svg className={className} viewBox="0 0 200 60" fill={BYD_RED}>
    <rect x="0" y="0" width="8" height="60" rx="2" />
    <rect x="0" y="0" width="45" height="8" rx="2" />
    <rect x="0" y="26" width="40" height="8" rx="2" />
    <rect x="0" y="52" width="45" height="8" rx="2" />
    <path d="M37 0 H45 Q55 0 55 13 Q55 26 45 26 H37 V18 H43 Q47 18 47 13 Q47 8 43 8 H37 Z" />
    <path d="M32 26 H45 Q55 26 55 39 Q55 52 45 52 H32 V44 H43 Q47 44 47 39 Q47 34 43 34 H32 Z" />
    <path d="M70 0 L85 25 L100 0 H110 L90 35 V60 H80 V35 L60 0 Z" />
    <rect x="120" y="0" width="8" height="60" rx="2" />
    <path d="M120 0 H155 Q180 0 180 30 Q180 60 155 60 H120 V52 H153 Q170 52 170 30 Q170 8 153 8 H120 Z" />
  </svg>
);

const Battery = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="6" width="18" height="12" rx="2" /><line x1="23" y1="10" x2="23" y2="14" /></svg>;
const Zap = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
const MapPin = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>;
const Clock = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
const TrendingUp = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;
const Calendar = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
const Upload = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>;
const Car = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2" /><circle cx="6.5" cy="16.5" r="2.5" /><circle cx="16.5" cy="16.5" r="2.5" /></svg>;
const Activity = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
const BarChart3 = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg>;
const AlertCircle = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>;
const Filter = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>;
const Plus = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
const List = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>;
const Settings = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>;

const STORAGE_KEY = 'byd_stats_data';

const formatMonth = (m) => {
  if (!m || m.length < 6) return m || '';
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return months[parseInt(m.slice(4, 6), 10) - 1] + ' ' + m.slice(0, 4);
};

const formatDate = (d) => {
  if (!d || d.length < 8) return d || '';
  return d.slice(6, 8) + '/' + d.slice(4, 6) + '/' + d.slice(0, 4);
};

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
    .map(t => ({ km: t.trip, eff: (t.electricity / t.trip) * 100 }))
    .filter(t => t.eff > 0 && t.eff < 50)
    .sort((a, b) => a.km - b.km);

  const sortedByKm = [...trips].sort((a, b) => (b.trip || 0) - (a.trip || 0));
  const sortedByKwh = [...trips].sort((a, b) => (b.electricity || 0) - (a.electricity || 0));
  const sortedByDur = [...trips].sort((a, b) => (b.duration || 0) - (a.duration || 0));
  const daysActive = new Set(trips.map(t => t.date).filter(Boolean)).size || 1;
  const sorted = [...trips].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

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
      km: sortedByKm.slice(0, 5),
      kwh: sortedByKwh.slice(0, 5),
      dur: sortedByDur.slice(0, 5)
    }
  };
}

export default function BYDStatsAnalyzer() {
  const [rawTrips, setRawTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sqlReady, setSqlReady] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [dragOver, setDragOver] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showAllTripsModal, setShowAllTripsModal] = useState(false);
  const [showTripDetailModal, setShowTripDetailModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [selMonth, setSelMonth] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Settings state
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('byd_settings');
      return saved ? JSON.parse(saved) : {
        carModel: '',
        licensePlate: '',
        insurancePolicy: '',
        batterySize: 60.48,
        soh: 100,
        electricityPrice: 0.15,
        theme: 'auto'
      };
    } catch {
      return {
        carModel: '',
        licensePlate: '',
        insurancePolicy: '',
        batterySize: 60.48,
        soh: 100,
        electricityPrice: 0.15,
        theme: 'auto'
      };
    }
  });

  // Add global styles to remove outlines but keep active elements visible
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .recharts-wrapper svg * {
        outline: none !important;
      }
      .recharts-wrapper svg *:focus {
        outline: none !important;
      }
      .recharts-surface {
        outline: none !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

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

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) {
        const p = JSON.parse(s);
        if (Array.isArray(p) && p.length > 0) setRawTrips(p);
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

  useEffect(() => {
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.min.js';
    sc.onload = async () => {
      try {
        window.SQL = await window.initSqlJs({
          locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${f}`
        });
        setSqlReady(true);
      } catch (e) {
        setError('Error cargando SQL.js');
        console.error('SQL.js load error:', e);
      }
    };
    sc.onerror = () => {
      setError('Error cargando SQL.js');
    };
    document.head.appendChild(sc);

    return () => {
      if (sc.parentNode) {
        sc.parentNode.removeChild(sc);
      }
    };
  }, []);

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

  const processDB = useCallback(async (file, merge = false) => {
    if (!window.SQL) {
      setError('SQL no está listo');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const db = new window.SQL.Database(new Uint8Array(buf));
      const t = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='EnergyConsumption'");
      if (!t.length || !t[0].values.length) throw new Error('Tabla no encontrada');
      const res = db.exec("SELECT * FROM EnergyConsumption WHERE is_deleted = 0 ORDER BY date, start_timestamp");
      if (res.length && res[0].values.length) {
        const cols = res[0].columns;
        const rows = res[0].values.map(r => {
          const o = {};
          cols.forEach((c, i) => { o[c] = r[i]; });
          return o;
        });

        if (merge && rawTrips.length) {
          const map = new Map();
          rawTrips.forEach(t => map.set(t.date + '-' + t.start_timestamp, t));
          rows.forEach(t => map.set(t.date + '-' + t.start_timestamp, t));
          setRawTrips(Array.from(map.values()).sort((a, b) => (a.date || '').localeCompare(b.date || '')));
        } else {
          setRawTrips(rows);
        }
        setShowModal(false);
      } else {
        throw new Error('Sin datos');
      }
      db.close();
    } catch (e) {
      setError(e.message);
      console.error('Database processing error:', e);
    } finally {
      setLoading(false);
    }
  }, [rawTrips]);

  const onDrop = useCallback((e, merge) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) processDB(f, merge);
  }, [processDB]);

  const onFile = useCallback((e, merge) => {
    const f = e.target.files[0];
    if (f) processDB(f, merge);
    e.target.value = '';
  }, [processDB]);

  const clearData = () => {
    if (window.confirm('¿Borrar todos los datos?')) {
      setRawTrips([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Resumen', icon: Activity },
    { id: 'trends', label: 'Tendencias', icon: TrendingUp },
    { id: 'patterns', label: 'Patrones', icon: Clock },
    { id: 'efficiency', label: 'Eficiencia', icon: Zap },
    { id: 'records', label: 'Récords', icon: BarChart3 },
    { id: 'history', label: 'Histórico', icon: List }
  ];

  // Swipe gesture - completely rewritten with refs
  const minSwipeDistance = 30; // Distancia mínima en píxeles
  const transitionDuration = 500;

  // Swipe detection using native event listeners for better performance
  useEffect(() => {
    const container = swipeContainerRef.current;
    if (!container) return;

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
      const diffY = Math.abs(touch.clientY - touchStartYRef.current);

      // Solo procesar si fue swipe horizontal
      if (swipeDirection === 'horizontal' && Math.abs(diffX) > minSwipeDistance) {
        const currentIndex = tabs.findIndex(t => t.id === activeTab);

        if (diffX < 0 && currentIndex < tabs.length - 1) {
          // Swipe left - siguiente tab
          handleTabClick(tabs[currentIndex + 1].id);
        } else if (diffX > 0 && currentIndex > 0) {
          // Swipe right - tab anterior
          handleTabClick(tabs[currentIndex - 1].id);
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
  }, [isTransitioning, activeTab, tabs]);

  const handleTabClick = (tabId) => {
    if (tabId === activeTab || isTransitioning) return;

    setIsTransitioning(true);
    setActiveTab(tabId);

    // Scroll to top al cambiar de tab
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
      setIsTransitioning(false);
    }, transitionDuration);
  };

  const StatCard = ({ icon: Icon, label, value, unit, color, sub }) => (
    <div className="bg-slate-800/50 rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-slate-700/50">
      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center mb-2 sm:mb-3 ${color}`} >
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
      <p className="text-slate-400 text-xs sm:text-sm">{label}</p>
      <p className="text-xl sm:text-2xl font-bold text-white">
        {value}
        <span className="text-slate-500 text-sm sm:text-lg ml-1">{unit}</span>
      </p>
      {sub && <p className="text-xs sm:text-sm mt-1" style={{ color: BYD_RED }}>{sub}</p>}
    </div>
  );

  const ChartTip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-600 rounded-xl p-3 shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: payload[0]?.color || BYD_RED }}></div>
            <p className="text-white font-medium">{label}</p>
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
  };

  // Calculate efficiency score (0-10) based on consumption
  // LOWER kWh/100km = BETTER efficiency = HIGHER score (10)
  // HIGHER kWh/100km = WORSE efficiency = LOWER score (0)
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

  // Format time from timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  // Format duration in minutes/hours
  const formatDuration = (seconds) => {
    if (!seconds) return '0 min';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes} min`;
  };

  // Calculate trip percentile
  const calculatePercentile = (trip, allTrips) => {
    if (!trip || !allTrips || allTrips.length === 0) return 50;
    const tripEfficiency = trip.trip > 0 ? (trip.electricity / trip.trip) * 100 : 999;
    const validTrips = allTrips.filter(t => t.trip >= 1 && t.electricity !== 0);
    const efficiencies = validTrips.map(t => (t.electricity / t.trip) * 100);
    const betterCount = efficiencies.filter(e => e < tripEfficiency).length;
    return Math.round((betterCount / efficiencies.length) * 100);
  };

  // Open trip detail
  const openTripDetail = (trip) => {
    setSelectedTrip(trip);
    setShowTripDetailModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: BYD_RED, borderTopColor: 'transparent' }} />
          <p className="text-white text-lg md:text-xl">Procesando...</p>
        </div>
      </div>
    );
  }

  if (rawTrips.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="w-full max-w-xl">
          <div className="text-center mb-8">
            <img src="byd_logo.png" className="w-32 sm:w-40 md:w-48 h-auto mx-auto mb-4 md:mb-6" alt="BYD Logo" />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">Estadísticas BYD</h1>
            <p className="text-sm sm:text-base text-slate-400">Analiza los datos de tu vehículo eléctrico</p>
          </div>

          {!sqlReady && !error && (
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-3 px-4 py-2 bg-slate-800/50 rounded-xl">
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
              accept=".db"
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
            {!isNative && <p className="text-slate-500 text-sm">o haz clic para seleccionar</p>}
            <p className="text-slate-600 text-xs mt-4">
              {isNative
                ? 'Busca el archivo EC_Database.db en el almacenamiento de tu dispositivo'
                : 'Puedes encontrar este archivo en la carpeta EnergyData de tu coche'}
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
        {/* Trip Detail Modal (higher z-index to appear over everything) */}
        {showTripDetailModal && selectedTrip && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60 p-4" onClick={() => { setShowTripDetailModal(false); setSelectedTrip(null); }}>
            <div className="bg-slate-800 rounded-2xl p-6 max-w-lg w-full border border-slate-700 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Detalle del viaje</h3>
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
                    <div className="bg-slate-700/50 rounded-xl p-4">
                      <p className="text-slate-400 text-sm mb-1">Fecha y hora</p>
                      <p className="text-white text-lg font-bold">{formatDate(selectedTrip.date)}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <div>
                          <p className="text-slate-400 text-xs">Inicio</p>
                          <p className="text-white font-medium">{formatTime(selectedTrip.start_timestamp)}</p>
                        </div>
                        {endTime && (
                          <>
                            <span className="text-slate-600">→</span>
                            <div>
                              <p className="text-slate-400 text-xs">Fin</p>
                              <p className="text-white font-medium">{formatTime(endTime)}</p>
                            </div>
                          </>
                        )}
                        <div className="ml-auto">
                          <p className="text-slate-400 text-xs">Duración</p>
                          <p className="text-white font-medium">{formatDuration(selectedTrip.duration)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Grid de métricas */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-700/50 rounded-xl p-3">
                        <p className="text-slate-400 text-xs mb-1">Distancia</p>
                        <p className="text-white text-2xl font-bold">{selectedTrip.trip?.toFixed(1)}</p>
                        <p className="text-slate-500 text-xs">km</p>
                      </div>
                      <div className="bg-slate-700/50 rounded-xl p-3">
                        <p className="text-slate-400 text-xs mb-1">Velocidad media</p>
                        <p className="text-white text-2xl font-bold">{avgSpeed.toFixed(0)}</p>
                        <p className="text-slate-500 text-xs">km/h</p>
                      </div>
                      <div className="bg-slate-700/50 rounded-xl p-3">
                        <p className="text-slate-400 text-xs mb-1">Consumo</p>
                        <p className="text-white text-2xl font-bold">{selectedTrip.electricity?.toFixed(2)}</p>
                        <p className="text-slate-500 text-xs">kWh</p>
                      </div>
                      <div className="bg-slate-700/50 rounded-xl p-3">
                        <p className="text-slate-400 text-xs mb-1">Eficiencia</p>
                        <p className="text-white text-2xl font-bold">{efficiency.toFixed(2)}</p>
                        <p className="text-slate-500 text-xs">kWh/100km</p>
                      </div>
                    </div>

                    {/* SOC si está disponible */}
                    {(selectedTrip.start_soc !== undefined || selectedTrip.end_soc !== undefined) && (
                      <div className="bg-slate-700/50 rounded-xl p-4">
                        <p className="text-slate-400 text-sm mb-3">Estado de carga</p>
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
                      <div className="bg-slate-700/50 rounded-xl p-4">
                        <p className="text-slate-400 text-sm mb-1">Energía regenerada</p>
                        <p className="text-green-400 text-2xl font-bold">{selectedTrip.regeneration?.toFixed(2)} kWh</p>
                      </div>
                    )}

                    {/* Comparación y percentil */}
                    <div className="bg-slate-700/50 rounded-xl p-4">
                      <p className="text-slate-400 text-sm mb-3">Análisis</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300 text-sm">Comparación con tu media</span>
                          <span className={`font-bold ${comparisonPercent < 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {comparisonPercent > 0 ? '+' : ''}{comparisonPercent.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300 text-sm">Percentil</span>
                          <span className="font-bold text-cyan-400">Top {percentile}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300 text-sm">Coste estimado</span>
                          <span className="font-bold" style={{ color: BYD_RED }}>{cost.toFixed(2)}€</span>
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
        <div className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-700/50" style={{ paddingTop: 'env(safe-area-inset-top, 24px)' }}>
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setShowAllTripsModal(false)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white hover:bg-slate-800"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-sm sm:text-base md:text-lg font-bold">Todos los viajes</h1>
                  <p className="text-slate-500 text-xs sm:text-sm">{allTripsFiltered.length} viajes</p>
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
                    backgroundColor: allTripsFilterType === 'all' ? BYD_RED : '#334155',
                    color: allTripsFilterType === 'all' ? 'white' : '#94a3b8'
                  }}
                >
                  Todos
                </button>
                <button
                  onClick={() => setAllTripsFilterType('month')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor: allTripsFilterType === 'month' ? BYD_RED : '#334155',
                    color: allTripsFilterType === 'month' ? 'white' : '#94a3b8'
                  }}
                >
                  Por mes
                </button>
                <button
                  onClick={() => setAllTripsFilterType('range')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor: allTripsFilterType === 'range' ? BYD_RED : '#334155',
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
                  className="w-full bg-slate-700 text-white rounded-xl px-4 py-2 border border-slate-600 text-sm"
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
                    className="flex-1 bg-slate-700 text-white rounded-xl px-4 py-2 border border-slate-600 text-sm"
                  />
                  <input
                    type="date"
                    value={allTripsDateTo}
                    onChange={(e) => setAllTripsDateTo(e.target.value)}
                    className="flex-1 bg-slate-700 text-white rounded-xl px-4 py-2 border border-slate-600 text-sm"
                  />
                </div>
              )}

              {/* Sort Options */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                <span className="text-xs text-slate-400 px-2 py-1.5">Ordenar:</span>
                <button
                  onClick={() => {
                    if (allTripsSortBy === 'date') {
                      setAllTripsSortOrder(allTripsSortOrder === 'desc' ? 'asc' : 'desc');
                    } else {
                      setAllTripsSortBy('date');
                      setAllTripsSortOrder('desc');
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1"
                  style={{
                    backgroundColor: allTripsSortBy === 'date' ? BYD_RED : '#334155',
                    color: allTripsSortBy === 'date' ? 'white' : '#94a3b8'
                  }}
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
                  className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1"
                  style={{
                    backgroundColor: allTripsSortBy === 'efficiency' ? BYD_RED : '#334155',
                    color: allTripsSortBy === 'efficiency' ? 'white' : '#94a3b8'
                  }}
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
                  className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1"
                  style={{
                    backgroundColor: allTripsSortBy === 'distance' ? BYD_RED : '#334155',
                    color: allTripsSortBy === 'distance' ? 'white' : '#94a3b8'
                  }}
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
                  className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1"
                  style={{
                    backgroundColor: allTripsSortBy === 'consumption' ? BYD_RED : '#334155',
                    color: allTripsSortBy === 'consumption' ? 'white' : '#94a3b8'
                  }}
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
            {allTripsFiltered.map((trip, i) => {
              const efficiency = trip.trip > 0 && trip.electricity !== undefined && trip.electricity !== null
                ? (trip.electricity / trip.trip) * 100
                : 0;
              const score = calculateScore(efficiency, minEff, maxEff);
              const scoreColor = getScoreColor(score);

              return (
                <div
                  key={i}
                  onClick={() => openTripDetail(trip)}
                  className="bg-slate-800/50 rounded-xl p-3 sm:p-4 border border-slate-700/50 cursor-pointer hover:bg-slate-700/50 transition-colors"
                >
                  {/* Fecha y hora centrada - 100% */}
                  <div className="text-center mb-3">
                    <p className="text-white font-semibold text-sm sm:text-base">
                      {formatDate(trip.date)} · {formatTime(trip.start_timestamp)}
                    </p>
                  </div>
                  {/* 4 columnas de 25% cada una */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center">
                      <p className="text-slate-400 text-[10px] sm:text-xs mb-1">Distancia</p>
                      <p className="text-white text-base sm:text-xl font-bold">{trip.trip?.toFixed(1)}</p>
                      <p className="text-slate-500 text-[9px] sm:text-[10px]">km</p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-400 text-[10px] sm:text-xs mb-1">Consumo</p>
                      <p className="text-white text-base sm:text-xl font-bold">{trip.electricity?.toFixed(2)}</p>
                      <p className="text-slate-500 text-[9px] sm:text-[10px]">kWh</p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-400 text-[10px] sm:text-xs mb-1">Eficiencia</p>
                      <p className="text-white text-base sm:text-xl font-bold">{efficiency.toFixed(2)}</p>
                      <p className="text-slate-500 text-[9px] sm:text-[10px]">kWh/100km</p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-400 text-[10px] sm:text-xs mb-1">Score</p>
                      <p className="text-2xl sm:text-3xl font-bold" style={{ color: scoreColor }}>
                        {score.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={swipeContainerRef}
      className="h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white overflow-hidden"
    >
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Actualizar datos</h3>
            <div className="space-y-3">
              <label className="block cursor-pointer border-2 border-dashed border-slate-600 rounded-xl p-6 text-center hover:border-green-500 transition-colors">
                <input type="file" accept=".db" className="hidden" onChange={(e) => onFile(e, true)} />
                <Plus className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-white">Combinar con existentes</p>
              </label>
              <label className="block cursor-pointer border-2 border-dashed border-slate-600 rounded-xl p-6 text-center hover:border-amber-500 transition-colors">
                <input type="file" accept=".db" className="hidden" onChange={(e) => onFile(e, false)} />
                <Upload className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p className="text-white">Reemplazar todo</p>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 bg-slate-700 rounded-xl hover:bg-slate-600">Cancelar</button>
              <button onClick={clearData} className="py-2 px-4 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30">Borrar todo</button>
            </div>
          </div>
        </div>
      )}

      {/* Trip Detail Modal */}
      {showTripDetailModal && selectedTrip && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => { setShowTripDetailModal(false); setSelectedTrip(null); }}>
          <div className="bg-slate-800 rounded-2xl p-6 max-w-lg w-full border border-slate-700 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Detalle del viaje</h3>
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
                  <div className="bg-slate-700/50 rounded-xl p-4">
                    <p className="text-slate-400 text-sm mb-1">Fecha y hora</p>
                    <p className="text-white text-lg font-bold">{formatDate(selectedTrip.date)}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <div>
                        <p className="text-slate-400 text-xs">Inicio</p>
                        <p className="text-white font-medium">{formatTime(selectedTrip.start_timestamp)}</p>
                      </div>
                      {endTime && (
                        <>
                          <span className="text-slate-600">→</span>
                          <div>
                            <p className="text-slate-400 text-xs">Fin</p>
                            <p className="text-white font-medium">{formatTime(endTime)}</p>
                          </div>
                        </>
                      )}
                      <div className="ml-auto">
                        <p className="text-slate-400 text-xs">Duración</p>
                        <p className="text-white font-medium">{formatDuration(selectedTrip.duration)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Grid de métricas */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-700/50 rounded-xl p-3">
                      <p className="text-slate-400 text-xs mb-1">Distancia</p>
                      <p className="text-white text-2xl font-bold">{selectedTrip.trip?.toFixed(1)}</p>
                      <p className="text-slate-500 text-xs">km</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-xl p-3">
                      <p className="text-slate-400 text-xs mb-1">Velocidad media</p>
                      <p className="text-white text-2xl font-bold">{avgSpeed.toFixed(0)}</p>
                      <p className="text-slate-500 text-xs">km/h</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-xl p-3">
                      <p className="text-slate-400 text-xs mb-1">Consumo</p>
                      <p className="text-white text-2xl font-bold">{selectedTrip.electricity?.toFixed(2)}</p>
                      <p className="text-slate-500 text-xs">kWh</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-xl p-3">
                      <p className="text-slate-400 text-xs mb-1">Eficiencia</p>
                      <p className="text-white text-2xl font-bold">{efficiency.toFixed(2)}</p>
                      <p className="text-slate-500 text-xs">kWh/100km</p>
                    </div>
                  </div>

                  {/* SOC si está disponible */}
                  {(selectedTrip.start_soc !== undefined || selectedTrip.end_soc !== undefined) && (
                    <div className="bg-slate-700/50 rounded-xl p-4">
                      <p className="text-slate-400 text-sm mb-3">Estado de carga</p>
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
                    <div className="bg-slate-700/50 rounded-xl p-4">
                      <p className="text-slate-400 text-sm mb-1">Energía regenerada</p>
                      <p className="text-green-400 text-2xl font-bold">{selectedTrip.regeneration?.toFixed(2)} kWh</p>
                    </div>
                  )}

                  {/* Comparación y percentil */}
                  <div className="bg-slate-700/50 rounded-xl p-4">
                    <p className="text-slate-400 text-sm mb-3">Análisis</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300 text-sm">Comparación con tu media</span>
                        <span className={`font-bold ${comparisonPercent < 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {comparisonPercent > 0 ? '+' : ''}{comparisonPercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300 text-sm">Percentil</span>
                        <span className="font-bold text-cyan-400">Top {percentile}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300 text-sm">Coste estimado</span>
                        <span className="font-bold" style={{ color: BYD_RED }}>{cost.toFixed(2)}€</span>
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
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowSettingsModal(false)}>
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Settings className="w-6 h-6" style={{ color: BYD_RED }} />
              Configuración
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Modelo del coche</label>
                <input
                  type="text"
                  value={settings.carModel}
                  onChange={(e) => setSettings({...settings, carModel: e.target.value})}
                  placeholder="BYD Seal"
                  className="w-full bg-slate-700 text-white rounded-xl px-4 py-2 border border-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Matrícula</label>
                <input
                  type="text"
                  value={settings.licensePlate}
                  onChange={(e) => setSettings({...settings, licensePlate: e.target.value.toUpperCase()})}
                  placeholder="1234ABC"
                  className="w-full bg-slate-700 text-white rounded-xl px-4 py-2 border border-slate-600 uppercase"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Nº Póliza del seguro</label>
                <input
                  type="text"
                  value={settings.insurancePolicy}
                  onChange={(e) => setSettings({...settings, insurancePolicy: e.target.value})}
                  placeholder="123456789"
                  className="w-full bg-slate-700 text-white rounded-xl px-4 py-2 border border-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Tamaño de la batería (kWh)</label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.batterySize}
                  onChange={(e) => setSettings({...settings, batterySize: parseFloat(e.target.value) || 0})}
                  className="w-full bg-slate-700 text-white rounded-xl px-4 py-2 border border-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">State of Health - SoH (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.soh}
                  onChange={(e) => setSettings({...settings, soh: parseInt(e.target.value) || 100})}
                  className="w-full bg-slate-700 text-white rounded-xl px-4 py-2 border border-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Precio de electricidad (€/kWh)</label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.electricityPrice}
                  onChange={(e) => setSettings({...settings, electricityPrice: parseFloat(e.target.value) || 0})}
                  className="w-full bg-slate-700 text-white rounded-xl px-4 py-2 border border-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Tema</label>
                <div className="flex gap-2">
                  {['auto', 'light', 'dark'].map(theme => (
                    <button
                      key={theme}
                      onClick={() => setSettings({...settings, theme})}
                      className="flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: settings.theme === theme ? BYD_RED : '#334155',
                        color: settings.theme === theme ? 'white' : '#94a3b8'
                      }}
                    >
                      {theme === 'auto' ? 'Automático' : theme === 'light' ? 'Claro' : 'Oscuro'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSettingsModal(false)}
              className="w-full mt-6 py-3 rounded-xl font-medium text-white"
              style={{ backgroundColor: BYD_RED }}
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      <div className="flex-shrink-0 sticky top-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-700/50" style={{ paddingTop: 'env(safe-area-inset-top, 24px)' }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <img src="byd_logo.png" className="w-12 sm:w-16 md:w-20 h-auto" alt="BYD Logo" />
              <div>
                <h1 className="text-sm sm:text-base md:text-lg font-bold">Estadísticas BYD</h1>
                <p className="text-slate-500 text-xs sm:text-sm">{rawTrips.length} viajes</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettingsModal(true)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center justify-center gap-1 sm:gap-2 w-10 h-10 sm:w-auto sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-medium text-white"
                style={{ backgroundColor: BYD_RED }}
              >
                <Plus className="w-5 h-5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Actualizar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex-1 overflow-hidden"
      >
        <div className="max-w-7xl mx-auto h-full">
          <div
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
              userSelect: 'none'
            }}
          >
        {!data ? (
          // Show error message on all slides
          tabs.map((tab) => (
            <div key={tab.id} className="text-center py-12 bg-slate-800/30 rounded-2xl mx-3 sm:mx-4" style={{ width: `${100 / tabs.length}%`, flexShrink: 0 }}>
              <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400">No hay datos para mostrar</p>
            </div>
          ))
        ) : (
          <>
            {/* Slide 1: Overview */}
            <div style={{ width: `${100 / tabs.length}%`, flexShrink: 0, height: '100%', overflowY: 'auto', padding: '16px 12px 96px 12px' }}>
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <StatCard icon={MapPin} label="Distancia" value={summary.totalKm} unit="km" color="bg-red-500/20 text-red-400" sub={`${summary.kmDay} km/día`} />
                  <StatCard icon={Zap} label="Energía" value={summary.totalKwh} unit="kWh" color="bg-cyan-500/20 text-cyan-400" />
                  <StatCard icon={Car} label="Viajes" value={summary.totalTrips} unit="" color="bg-amber-500/20 text-amber-400" sub={`${summary.tripsDay}/día`} />
                  <StatCard icon={Clock} label="Tiempo" value={summary.totalHours} unit="h" color="bg-purple-500/20 text-purple-400" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <StatCard icon={Battery} label="Eficiencia" value={summary.avgEff} unit="kWh/100km" color="bg-green-500/20 text-green-400" />
                  <StatCard icon={TrendingUp} label="Velocidad" value={summary.avgSpeed} unit="km/h" color="bg-blue-500/20 text-blue-400" />
                  <StatCard icon={MapPin} label="Viaje medio" value={summary.avgKm} unit="km" color="bg-orange-500/20 text-orange-400" sub={`${summary.avgMin} min`} />
                  <StatCard icon={Calendar} label="Días activos" value={summary.daysActive} unit="" color="bg-pink-500/20 text-pink-400" />
                </div>
                <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-slate-700/50" >
                    <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Evolución Mensual</h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={monthly}>
                        <defs>
                          <linearGradient id="kmGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={BYD_RED} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={BYD_RED} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="monthLabel" stroke="#64748b" fontSize={12} />
                        <YAxis stroke="#64748b" fontSize={12} />
                        <Tooltip content={<ChartTip />} isAnimationActive={false} cursor={false} />
                        <Area type="monotone" dataKey="km" stroke={BYD_RED} fill="url(#kmGrad)" name="Km" isAnimationActive={false} activeDot={{ r: 6, fill: BYD_RED, stroke: '#fff', strokeWidth: 2 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-slate-700/50" >
                    <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Distribución de Viajes</h3>
                    <div className="flex flex-col items-center">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={tripDist}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={2}
                            dataKey="count"
                            label={({ percent }) => percent > 0 ? `${(percent * 100).toFixed(0)}%` : ''}
                            labelLine={false}
                            isAnimationActive={false}
                            activeShape={{ outerRadius: 95, stroke: '#fff', strokeWidth: 2 }}
                          >
                            {tripDist.map((e, i) => (
                              <Cell key={`cell-${i}`} fill={e.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0];
                                const total = tripDist.reduce((s, d) => s + d.count, 0);
                                const percent = ((data.value / total) * 100).toFixed(1);
                                return (
                                  <div className="bg-slate-800 border border-slate-600 rounded-xl p-3 shadow-xl">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.payload.color }}></div>
                                      <p className="text-white font-bold">{data.payload.range} km</p>
                                    </div>
                                    <p className="text-sm text-slate-300">{data.value} viajes ({percent}%)</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                            isAnimationActive={false}
                            cursor={false}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="grid grid-cols-5 gap-2 w-full mt-4">
                        {tripDist.map((d, i) => (
                          <div key={i} className="flex flex-col items-center">
                            <div className="w-3 h-3 rounded-full mb-1" style={{ backgroundColor: d.color }}></div>
                            <p className="text-[9px] sm:text-[10px] text-slate-400 text-center">{d.range}km</p>
                            <p className="text-xs sm:text-sm font-bold text-white">{d.count}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Slide 2: Trends */}
            <div style={{ width: `${100 / tabs.length}%`, flexShrink: 0, height: '100%', overflowY: 'auto', padding: '16px 12px 96px 12px' }}>
              <div className="space-y-4 sm:space-y-6">
                <div className="bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-slate-700/50" >
                  <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Km y kWh Mensual</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="monthLabel" stroke="#64748b" fontSize={11} angle={-20} textAnchor="end" height={50} />
                      <YAxis yAxisId="l" stroke={BYD_RED} fontSize={11} />
                      <YAxis yAxisId="r" orientation="right" stroke="#06b6d4" fontSize={11} />
                      <Tooltip content={<ChartTip />} isAnimationActive={false} cursor={false} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar yAxisId="l" dataKey="km" fill={BYD_RED} name="Km" radius={[4, 4, 0, 0]} isAnimationActive={false} activeBar={{ fill: '#ff1744', stroke: '#fff', strokeWidth: 1 }} />
                      <Bar yAxisId="r" dataKey="kwh" fill="#06b6d4" name="kWh" radius={[4, 4, 0, 0]} isAnimationActive={false} activeBar={{ fill: '#00d4ff', stroke: '#fff', strokeWidth: 1 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-slate-700/50" >
                  <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Últimos 60 días</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={daily.slice(-60)}>
                      <defs>
                        <linearGradient id="dayGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="dateLabel" stroke="#64748b" fontSize={10} angle={-45} textAnchor="end" height={60} />
                      <YAxis stroke="#64748b" />
                      <Tooltip content={<ChartTip />} isAnimationActive={false} cursor={false} />
                      <Area type="monotone" dataKey="km" stroke="#06b6d4" fill="url(#dayGrad)" name="Km" isAnimationActive={false} activeDot={{ r: 6, fill: '#06b6d4', stroke: '#fff', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Slide 3: Patterns */}
            <div style={{ width: `${100 / tabs.length}%`, flexShrink: 0, height: '100%', overflowY: 'auto', padding: '16px 12px 96px 12px' }}>
              <div className="space-y-4 sm:space-y-6">
                <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-slate-700/50" >
                    <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Por Hora</h3>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={hourly}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="hour" stroke="#64748b" tickFormatter={(h) => `${h}h`} fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} />
                        <Tooltip content={<ChartTip />} isAnimationActive={false} cursor={false} />
                        <Bar dataKey="trips" fill="#f59e0b" name="Viajes" radius={[2, 2, 0, 0]} isAnimationActive={false} activeBar={{ fill: '#fbbf24', stroke: '#fff', strokeWidth: 1 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-slate-700/50" >
                    <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Por Día</h3>
                    <ResponsiveContainer width="100%" height={260}>
                      <RadarChart data={weekday}>
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis dataKey="day" stroke="#64748b" />
                        <PolarRadiusAxis stroke="#64748b" />
                        <Radar dataKey="trips" stroke={BYD_RED} fill={BYD_RED} fillOpacity={0.3} name="Viajes" isAnimationActive={false} activeDot={{ r: 6, fill: BYD_RED, stroke: '#fff', strokeWidth: 2 }} />
                        <Tooltip content={<ChartTip />} isAnimationActive={false} cursor={false} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {weekday.map((d, i) => (
                    <div key={i} className="bg-slate-800/50 rounded-lg sm:rounded-xl p-2 sm:p-3 text-center border border-slate-700/50">
                      <p className="text-slate-400 text-[10px] sm:text-xs">{d.day}</p>
                      <p className="text-base sm:text-xl font-bold">{d.trips}</p>
                      <p className="text-[9px] sm:text-xs" style={{ color: BYD_RED }}>{d.km.toFixed(0)} km</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Slide 4: Efficiency */}
            <div style={{ width: `${100 / tabs.length}%`, flexShrink: 0, height: '100%', overflowY: 'auto', padding: '16px 12px 96px 12px' }}>
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <StatCard icon={Battery} label="Eficiencia" value={summary.avgEff} unit="kWh/100km" color="bg-green-500/20 text-green-400" />
                  <StatCard icon={Zap} label="Consumo/viaje" value={(parseFloat(summary.totalKwh) / summary.totalTrips).toFixed(2)} unit="kWh" color="bg-cyan-500/20 text-cyan-400" />
                  <StatCard icon={MapPin} label="Distancia media" value={summary.avgKm} unit="km" color="bg-purple-500/20 text-purple-400" />
                  <StatCard icon={TrendingUp} label="Velocidad media" value={summary.avgSpeed} unit="km/h" color="bg-amber-500/20 text-amber-400" />
                </div>
                <div className="bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-slate-700/50" >
                  <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Eficiencia vs Distancia</h3>
                  <ResponsiveContainer width="100%" height={320}>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        dataKey="km"
                        name="Distancia"
                        stroke="#64748b"
                        fontSize={11}
                        allowDecimals={false}
                        tickFormatter={(value) => Math.round(value)}
                        interval="preserveStartEnd"
                        minTickGap={30}
                        label={{ value: 'km', position: 'insideBottomRight', offset: -5, fill: '#64748b', fontSize: 11 }}
                      />
                      <YAxis
                        dataKey="eff"
                        name="Eficiencia"
                        stroke="#64748b"
                        fontSize={11}
                        allowDecimals={false}
                        tickFormatter={(value) => Math.round(value)}
                        label={{ value: 'kWh/100km', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
                      />
                      <Tooltip
                        isAnimationActive={false}
                        cursor={false}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-800 border border-slate-600 rounded-xl p-3">
                                <p className="text-white">{payload[0]?.value?.toFixed(1)} km</p>
                                <p style={{ color: BYD_RED }}>{payload[1]?.value?.toFixed(2)} kWh/100km</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Scatter data={effScatter} fill={BYD_RED} fillOpacity={0.6} isAnimationActive={false} activeShape={{ r: 8, fill: BYD_RED, stroke: '#fff', strokeWidth: 2 }} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Slide 5: Records */}
            <div style={{ width: `${100 / tabs.length}%`, flexShrink: 0, height: '100%', overflowY: 'auto', padding: '16px 12px 96px 12px' }}>
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-slate-800/50 rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-red-500/30">
                    <p className="text-xs sm:text-sm mb-1">🏆 Más largo</p>
                    <p className="text-xl sm:text-3xl font-bold">{summary.maxKm} <span className="text-sm sm:text-lg text-slate-500">km</span></p>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-cyan-500/30">
                    <p className="text-xs sm:text-sm mb-1">⚡ Mayor consumo</p>
                    <p className="text-xl sm:text-3xl font-bold">{summary.maxKwh} <span className="text-sm sm:text-lg text-slate-500">kWh</span></p>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-amber-500/30">
                    <p className="text-xs sm:text-sm mb-1">⏱️ Más duración</p>
                    <p className="text-xl sm:text-3xl font-bold">{summary.maxMin} <span className="text-sm sm:text-lg text-slate-500">min</span></p>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-purple-500/30">
                    <p className="text-xs sm:text-sm mb-1">📍 Más corto</p>
                    <p className="text-xl sm:text-3xl font-bold">{summary.minKm} <span className="text-sm sm:text-lg text-slate-500">km</span></p>
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
                  <div className="bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-slate-700/50">
                    <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-red-400">🥇 Top Distancia</h3>
                    {top.km.map((t, i) => (
                      <div key={i} className="flex justify-between py-2 border-b border-slate-700/50 last:border-0">
                        <span className="text-slate-400 text-xs sm:text-sm">{i + 1}. {formatDate(t.date)}</span>
                        <span className="font-medium text-sm sm:text-base">{t.trip?.toFixed(1)} km</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-slate-700/50">
                    <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-cyan-400">⚡ Top Consumo</h3>
                    {top.kwh.map((t, i) => (
                      <div key={i} className="flex justify-between py-2 border-b border-slate-700/50 last:border-0">
                        <span className="text-slate-400 text-xs sm:text-sm">{i + 1}. {formatDate(t.date)}</span>
                        <span className="font-medium text-sm sm:text-base">{t.electricity?.toFixed(1)} kWh</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-slate-700/50">
                    <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-amber-400">⏱️ Top Duración</h3>
                    {top.dur.map((t, i) => (
                      <div key={i} className="flex justify-between py-2 border-b border-slate-700/50 last:border-0">
                        <span className="text-slate-400 text-xs sm:text-sm">{i + 1}. {formatDate(t.date)}</span>
                        <span className="font-medium text-sm sm:text-base">{((t.duration || 0) / 60).toFixed(0)} min</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Slide 6: History */}
            <div style={{ width: `${100 / tabs.length}%`, flexShrink: 0, height: '100%', overflowY: 'auto', padding: '16px 12px 96px 12px' }}>
              <div className="space-y-4 sm:space-y-6">
                <h2 className="text-xl sm:text-2xl font-bold">Últimos 10 viajes</h2>
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

                    return allTrips.slice(0, 10).map((trip, i) => {
                      const efficiency = trip.trip > 0 && trip.electricity !== undefined && trip.electricity !== null
                        ? (trip.electricity / trip.trip) * 100
                        : 0;
                      const score = calculateScore(efficiency, minEff, maxEff);
                      const scoreColor = getScoreColor(score);

                      return (
                        <div
                          key={i}
                          onClick={() => openTripDetail(trip)}
                          className="bg-slate-800/50 rounded-xl p-3 sm:p-4 border border-slate-700/50 cursor-pointer hover:bg-slate-700/50 transition-colors"
                        >
                          {/* Fecha y hora centrada - 100% */}
                          <div className="text-center mb-3">
                            <p className="text-white font-semibold text-sm sm:text-base">
                              {formatDate(trip.date)} · {formatTime(trip.start_timestamp)}
                            </p>
                          </div>
                          {/* 4 columnas de 25% cada una */}
                          <div className="grid grid-cols-4 gap-2">
                            <div className="text-center">
                              <p className="text-slate-400 text-[10px] sm:text-xs mb-1">Distancia</p>
                              <p className="text-white text-base sm:text-xl font-bold">{trip.trip?.toFixed(1)}</p>
                              <p className="text-slate-500 text-[9px] sm:text-[10px]">km</p>
                            </div>
                            <div className="text-center">
                              <p className="text-slate-400 text-[10px] sm:text-xs mb-1">Consumo</p>
                              <p className="text-white text-base sm:text-xl font-bold">{trip.electricity?.toFixed(2)}</p>
                              <p className="text-slate-500 text-[9px] sm:text-[10px]">kWh</p>
                            </div>
                            <div className="text-center">
                              <p className="text-slate-400 text-[10px] sm:text-xs mb-1">Eficiencia</p>
                              <p className="text-white text-base sm:text-xl font-bold">{efficiency.toFixed(2)}</p>
                              <p className="text-slate-500 text-[9px] sm:text-[10px]">kWh/100km</p>
                            </div>
                            <div className="text-center">
                              <p className="text-slate-400 text-[10px] sm:text-xs mb-1">Score</p>
                              <p className="text-2xl sm:text-3xl font-bold" style={{ color: scoreColor }}>
                                {score.toFixed(1)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    });
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
        </div>
      </div>

      {/* Floating Filter Button */}
      <button
        onClick={() => setShowFilterModal(true)}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95"
        style={{ backgroundColor: BYD_RED }}
      >
        <Filter className="w-6 h-6 text-white" />
      </button>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowFilterModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div className="relative bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5" style={{ color: BYD_RED }} />
                <h2 className="text-xl font-bold text-white">Filtrar viajes</h2>
              </div>
              <button onClick={() => setShowFilterModal(false)} className="text-slate-400 hover:text-white">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Filter Type Buttons */}
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Tipo de filtro:</label>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => { setFilterType('all'); setSelMonth(''); setDateFrom(''); setDateTo(''); }}
                    className="px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left"
                    style={{
                      backgroundColor: filterType === 'all' ? BYD_RED : '#334155',
                      color: filterType === 'all' ? 'white' : '#94a3b8'
                    }}
                  >
                    📊 Todos los viajes ({rawTrips.length})
                  </button>
                  <button
                    onClick={() => setFilterType('month')}
                    className="px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left"
                    style={{
                      backgroundColor: filterType === 'month' ? BYD_RED : '#334155',
                      color: filterType === 'month' ? 'white' : '#94a3b8'
                    }}
                  >
                    📅 Por mes
                  </button>
                  <button
                    onClick={() => setFilterType('range')}
                    className="px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left"
                    style={{
                      backgroundColor: filterType === 'range' ? BYD_RED : '#334155',
                      color: filterType === 'range' ? 'white' : '#94a3b8'
                    }}
                  >
                    📆 Rango de fechas
                  </button>
                </div>
              </div>

              {/* Month Selector */}
              {filterType === 'month' && (
                <div className="space-y-2">
                  <label className="text-slate-400 text-sm">Seleccionar mes:</label>
                  <select
                    value={selMonth}
                    onChange={(e) => setSelMonth(e.target.value)}
                    className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 border border-slate-600 text-sm"
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
                  <label className="text-slate-400 text-sm">Rango de fechas:</label>
                  <div className="flex flex-col gap-2">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 border border-slate-600 text-sm"
                      placeholder="Desde"
                    />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 border border-slate-600 text-sm"
                      placeholder="Hasta"
                    />
                  </div>
                </div>
              )}

              {/* Results Count */}
              {filtered.length !== rawTrips.length && (
                <div className="pt-4 border-t border-slate-700">
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

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur border-t border-slate-700/50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="max-w-7xl mx-auto px-2 py-2">
          <div className="flex justify-around items-center">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => handleTabClick(t.id)}
                className="flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all min-w-0 flex-1"
                style={{
                  backgroundColor: activeTab === t.id ? BYD_RED + '20' : 'transparent',
                  color: activeTab === t.id ? BYD_RED : '#94a3b8'
                }}
              >
                <t.icon className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
