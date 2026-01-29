// BYD Stats - Logger Utility
// Provides leveled logging with production filtering

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// In production, only show warnings and errors
// In development, show everything
const CURRENT_LEVEL = import.meta.env.PROD ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;

/**
 * Leveled logger that filters output based on environment
 * - DEBUG: Development debugging information
 * - INFO: General informational messages
 * - WARN: Warning messages (shown in production)
 * - ERROR: Error messages (shown in production)
 */
export const logger = {
    level: 'info', // Default log level logging - only in development

    /**
     * Debug level logging - only in development
     * @param {...any} args - Arguments to log
     */
    debug: (...args) => {
        if (CURRENT_LEVEL <= LOG_LEVELS.DEBUG) {
            console.log('[DEBUG]', ...args);
        }
    },

    /**
     * Info level logging - only in development
     * @param {...any} args - Arguments to log
     */
    info: (...args) => {
        if (CURRENT_LEVEL <= LOG_LEVELS.INFO) {
            console.info('[INFO]', ...args);
        }
    },

    /**
     * Warning level logging - shown in production
     * @param {...any} args - Arguments to log
     */
    warn: (...args) => {
        if (CURRENT_LEVEL <= LOG_LEVELS.WARN) {
            console.warn('[WARN]', ...args);
        }
    },

    /**
     * Error level logging - shown in production
     * @param {...any} args - Arguments to log
     */
    error: (...args) => {
        if (CURRENT_LEVEL <= LOG_LEVELS.ERROR) {
            console.error('[ERROR]', ...args);
        }
    }
};

export default logger;

