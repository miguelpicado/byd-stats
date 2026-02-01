// BYD Stats - Constants

export const BYD_RED = '#EA0029';

// Storage keys
export const STORAGE_KEY = 'byd_stats_data';
export const TRIP_HISTORY_KEY = 'byd_trip_history';
export const CHARGES_STORAGE_KEY = 'byd_charges_data';
export const SETTINGS_KEY = 'byd_settings';

// Layout constants - Tab padding values with safe-area support
export const TAB_PADDING = '12px 12px calc(96px + env(safe-area-inset-bottom)) 12px';
export const COMPACT_TAB_PADDING = '8px 10px calc(80px + env(safe-area-inset-bottom)) 10px';
export const COMPACT_SPACE_Y = 'space-y-3';

// Swipe navigation thresholds
export const SWIPE_THRESHOLD = 50; // Minimum distance to trigger tab change
export const SWIPE_VELOCITY_THRESHOLD = 0.3; // Minimum velocity for quick swipes

// Tab configuration
export const TAB_ORDER = ['overview', 'calendar', 'efficiency', 'trends', 'patterns', 'records', 'history', 'charges'];
export const TAB_COUNT = TAB_ORDER.length;

// Day names mapping
export const dayNamesFull: Record<string, string> = {
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
    fuelPrice: 1.50, // €/L - only used for hybrid vehicles
    useCalculatedPrice: false,
    theme: 'auto',
    chargerTypes: [],
    hiddenTabs: [],
    // Home Charging Defaults
    homeChargerRating: 16, // 3.7W default
    offPeakEnabled: false,
    offPeakStart: "00:00",
    offPeakEnd: "08:00",
    offPeakStartWeekend: undefined,
    offPeakEndWeekend: undefined,
    offPeakPrice: 0.11
};

// Trip distribution colors
export const TRIP_DISTRIBUTION_COLORS = [
    { range: '0-5', color: '#06b6d4' },
    { range: '5-15', color: '#10b981' },
    { range: '15-30', color: '#f59e0b' },
    { range: '30-50', color: '#EA0029' },
    { range: '50+', color: '#8b5cf6' }
];

// Hybrid vehicle constants
export const HYBRID_COLORS = {
    electric: '#10b981',  // Green for electric
    fuel: '#f59e0b',      // Amber for fuel/gasoline
    combined: '#6366f1'   // Indigo for combined metrics
};

// Energy equivalents (for combined efficiency calculations)
export const FUEL_ENERGY_EQUIVALENT_KWH = 9.7; // kWh per liter of gasoline

// Default fuel price (€/L) - can be overridden in settings
export const DEFAULT_FUEL_PRICE = 1.50;
