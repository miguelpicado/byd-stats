// BYD Stats - Storage Service
// Abstracting localStorage operations for better testability and maintenance

import { logger } from '@core/logger';

export interface StorageResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}

const isQuotaExceeded = (error: unknown): boolean =>
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' ||
     error.name === 'NS_ERROR_DOM_QUOTA_REACHED');

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
     * Returns result with specific error for quota exceeded vs other errors
     */
    save<T>(key: string, value: T): { success: boolean; quotaExceeded: boolean } {
        try {
            const serialized = JSON.stringify(value);
            localStorage.setItem(key, serialized);
            return { success: true, quotaExceeded: false };
        } catch (error) {
            if (isQuotaExceeded(error)) {
                logger.warn(`Storage quota exceeded saving [${key}]`);
                return { success: false, quotaExceeded: true };
            }
            logger.error(`Error saving to storage [${key}]:`, error);
            return { success: false, quotaExceeded: false };
        }
    },

    /**
     * Remove item from local storage
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
    },

    /**
     * Check if storage has room for a given size (rough estimate)
     */
    hasRoom: (estimatedBytes: number): boolean => {
        try {
            const testKey = '_byd_quota_test_';
            const testValue = 'x'.repeat(Math.min(estimatedBytes, 1024 * 100)); // max 100KB test
            localStorage.setItem(testKey, testValue);
            localStorage.removeItem(testKey);
            return true;
        } catch {
            return false;
        }
    },

    /**
     * Estimated usage in bytes (rough — 2 bytes per char in UTF-16)
     */
    getUsageEstimate: (): number => {
        let size = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                size += key.length + (localStorage.getItem(key)?.length || 0);
            }
        }
        return size * 2; // UTF-16 → bytes
    }
};
