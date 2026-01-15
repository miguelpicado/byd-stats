// BYD Stats - Layout Constants
// Centralized layout values used across components

// Storage keys
export const STORAGE_KEY = 'byd_stats_data';
export const TRIP_HISTORY_KEY = 'byd_trip_history';
export const CHARGES_STORAGE_KEY = 'byd_charges_data';

// Tab padding values with safe-area support
export const TAB_PADDING = '12px 12px calc(96px + env(safe-area-inset-bottom)) 12px';
export const COMPACT_TAB_PADDING = '8px 10px calc(80px + env(safe-area-inset-bottom)) 10px';

// Spacing classes
export const COMPACT_SPACE_Y = 'space-y-3';

// Swipe navigation thresholds
export const SWIPE_THRESHOLD = 50; // Minimum distance to trigger tab change
export const SWIPE_VELOCITY_THRESHOLD = 0.3; // Minimum velocity for quick swipes

// Tab configuration
export const TAB_ORDER = ['overview', 'efficiency', 'trends', 'patterns', 'records', 'history', 'charges'];
export const TAB_COUNT = TAB_ORDER.length;
