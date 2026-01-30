// BYD Stats - Logger Utility
// Provides leveled logging with production filtering

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

export const LOG_LEVELS = {
    DEBUG: LogLevel.DEBUG,
    INFO: LogLevel.INFO,
    WARN: LogLevel.WARN,
    ERROR: LogLevel.ERROR
};

// Default levels based on environment
// @ts-ignore
const DEFAULT_LEVEL = import.meta.env?.PROD ? LogLevel.ERROR : LogLevel.WARN;

/**
 * Leveled logger that filters output based on environment
 */
export const logger = {
    _currentLevel: DEFAULT_LEVEL,

    /**
     * Manually set the log level (useful for testing)
     * @param {number} level - Level from LOG_LEVELS
     */
    setLevel: (level: number) => {
        logger._currentLevel = level;
    },

    /**
     * Debug level logging
     */
    debug: (...args: any[]) => {
        if (logger._currentLevel <= LogLevel.DEBUG) {
            console.log('[DEBUG]', ...args);
        }
    },

    /**
     * Info level logging
     */
    info: (...args: any[]) => {
        if (logger._currentLevel <= LogLevel.INFO) {
            console.info('[INFO]', ...args);
        }
    },

    /**
     * Warning level logging
     */
    warn: (...args: any[]) => {
        if (logger._currentLevel <= LogLevel.WARN) {
            console.warn('[WARN]', ...args);
        }
    },

    /**
     * Error level logging
     */
    error: (...args: any[]) => {
        if (logger._currentLevel <= LogLevel.ERROR) {
            console.error('[ERROR]', ...args);
        }
    }
};

export default logger;
