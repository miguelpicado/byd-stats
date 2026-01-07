// BYD Stats - Constants

export const BYD_RED = '#EA0029';

// Storage keys
export const STORAGE_KEY = 'byd_stats_data';
export const TRIP_HISTORY_KEY = 'byd_trip_history';
export const SETTINGS_KEY = 'byd_settings';

// Layout constants
export const TAB_PADDING = '12px 12px 96px 12px';
export const COMPACT_TAB_PADDING = '8px 10px 80px 10px';
export const COMPACT_SPACE_Y = 'space-y-3';

// Day names mapping
export const dayNamesFull = {
  'Lun': 'Lunes',
  'Mar': 'Martes',
  'Mié': 'Miércoles',
  'Jue': 'Jueves',
  'Vie': 'Viernes',
  'Sáb': 'Sábado',
  'Dom': 'Domingo'
};

// Default settings
export const DEFAULT_SETTINGS = {
  carModel: '',
  licensePlate: '',
  insurancePolicy: '',
  batterySize: 60.48,
  soh: 100,
  electricityPrice: 0.15,
  theme: 'auto'
};

// Trip distribution colors
export const TRIP_DISTRIBUTION_COLORS = [
  { range: '0-5', color: '#06b6d4' },
  { range: '5-15', color: '#10b981' },
  { range: '15-30', color: '#f59e0b' },
  { range: '30-50', color: '#EA0029' },
  { range: '50+', color: '#8b5cf6' }
];
