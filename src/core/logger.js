// BYD Stats - Logger Utility
// Provides leveled logging with production filtering

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// Default levels based on environment
const DEFAULT_LEVEL = import.meta.env?.PROD ? LOG_LEVELS.ERROR : LOG_LEVELS.WARN;

/**
 * Leveled logger that filters output based on environment
 */
export const logger = {
    _currentLevel: DEFAULT_LEVEL,

    /**
     * Manually set the log level (useful for testing)
     * @param {number} level - Level from LOG_LEVELS
     */
    setLevel: (level) => {
        logger._currentLevel = level;
    },

    /**
     * Debug level logging
     */
    debug: (...args) => {
        if (logger._currentLevel <= LOG_LEVELS.DEBUG) {
            console.log('[DEBUG]', ...args);
        }
    },

    /**
     * Info level logging
     */
    info: (...args) => {
        if (logger._currentLevel <= LOG_LEVELS.INFO) {
            console.info('[INFO]', ...args);
        }
    },

    /**
     * Warning level logging
     */
    warn: (...args) => {
        if (logger._currentLevel <= LOG_LEVELS.WARN) {
            console.warn('[WARN]', ...args);
        }
    },

    /**
     * Error level logging
     */
    error: (...args) => {
        if (logger._currentLevel <= LOG_LEVELS.ERROR) {
            console.error('[ERROR]', ...args);
        }
    }
};

export default logger;
export { LOG_LEVELS };
