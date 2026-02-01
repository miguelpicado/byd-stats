// BYD Stats - Storage Service
// Abstracting localStorage operations for better testability and maintenance

import { logger } from '@core/logger';

export interface StorageResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export const StorageService = {
    /**
     * Get item from local storage
     * @param key Storage key
     * @param defaultValue Default value if key is missing or error occurs
     */
    get<T>(key: string, defaultValue: T): T {
        try {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;
            return JSON.parse(item) as T;
        } catch (error) {
            logger.error(`Error reading from storage [${key}]:`, error);
            return defaultValue;
        }
    },

    /**
     * Save item to local storage
     * @param key Storage key
     * @param value Value to save
     */
    save<T>(key: string, value: T): boolean {
        try {
            const serialized = JSON.stringify(value);
            localStorage.setItem(key, serialized);
            return true;
        } catch (error) {
            logger.error(`Error saving to storage [${key}]:`, error);
            return false;
        }
    },

    /**
     * Remove item from local storage
     * @param key Storage key
     */
    remove(key: string): boolean {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            logger.error(`Error removing from storage [${key}]:`, error);
            return false;
        }
    },

    /**
     * Clear all items related to a specific prefix
     * @param prefix Prefix to search for (e.g. 'byd_stats_')
     */
    clearByPrefix(prefix: string): void {
        try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch (error) {
            logger.error(`Error clearing storage by prefix [${prefix}]:`, error);
        }
    }
};
