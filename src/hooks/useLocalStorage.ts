import { useState, useEffect, useCallback } from 'react';
import { logger } from '@core/logger';

// Configuration
const BATCH_DELAY = 150;

// Queue for pending writes
const writeQueue = new Map<string, { value: unknown; timeout: NodeJS.Timeout }>();

/**
 * Forcefully write all pending changes to localStorage
 */
export function flushWrites(): void {
    writeQueue.forEach((entry, key) => {
        clearTimeout(entry.timeout);
        try {
            localStorage.setItem(key, JSON.stringify(entry.value));
            // logger.debug(`[Storage] Flushed write for ${key}`);
        } catch (error) {
            logger.error(`Error flushing localStorage key "${key}":`, error);
        }
    });
    writeQueue.clear();
}

/**
 * Flush on page unload to prevent data loss
 */
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flushWrites);
}

function batchedWrite(key: string, value: unknown): void {
    // Clear existing timeout for this key
    const pending = writeQueue.get(key);
    if (pending) {
        clearTimeout(pending.timeout);
    }

    // Schedule new write
    const timeout = setTimeout(() => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            // logger.debug(`[Storage] Batched write for ${key}`);
        } catch (error) {
            logger.error(`Error writing localStorage key "${key}":`, error);
        }
        writeQueue.delete(key);
    }, BATCH_DELAY);

    writeQueue.set(key, { value, timeout });
}

/**
 * Custom hook for localStorage with automatic serialization and batched writes
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void, () => void] {
    // Get initial value from localStorage or use default
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            logger.error(`Error reading localStorage key "${key}":`, error);
            return initialValue;
        }
    });

    // Update localStorage when value changes (using batching)
    useEffect(() => {
        if (storedValue === undefined || storedValue === null) {
            try {
                // Remove immediately from storage to avoid inconsistency
                localStorage.removeItem(key);
                const pending = writeQueue.get(key);
                if (pending) clearTimeout(pending.timeout);
                writeQueue.delete(key);
            } catch (error) {
                logger.error(`Error removing localStorage key "${key}":`, error);
            }
        } else {
            batchedWrite(key, storedValue);
        }
    }, [key, storedValue]);

    // Update state wrapper
    const setValue = useCallback((value: T) => {
        setStoredValue(value);
    }, []);

    // Remove value from storage
    const removeValue = useCallback(() => {
        try {
            localStorage.removeItem(key);
            setStoredValue(initialValue);
            const pending = writeQueue.get(key);
            if (pending) clearTimeout(pending.timeout);
            writeQueue.delete(key);
        } catch (error) {
            logger.error(`Error removing localStorage key "${key}":`, error);
        }
    }, [key, initialValue]);

    return [storedValue, setValue, removeValue];
}

export default useLocalStorage;
