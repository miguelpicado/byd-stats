import { useState, useEffect, useCallback } from 'react';
import { logger } from '@core/logger';

// Queue for pending writes
const writeQueue = new Map<string, { value: unknown; timeout: NodeJS.Timeout }>();

function batchedWrite(key: string, value: unknown, delay = 100): void {
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
    }, delay);

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
                localStorage.removeItem(key);
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
        } catch (error) {
            logger.error(`Error removing localStorage key "${key}":`, error);
        }
    }, [key, initialValue]);

    return [storedValue, setValue, removeValue];
}

export default useLocalStorage;
