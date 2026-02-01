// BYD Stats - useLocalStorage Hook

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@core/logger';

/**
 * Custom hook for localStorage with automatic serialization
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

    // Update localStorage when value changes
    useEffect(() => {
        try {
            if (storedValue === undefined || storedValue === null) {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, JSON.stringify(storedValue));
            }
        } catch (error) {
            logger.error(`Error writing localStorage key "${key}":`, error);
        }
    }, [key, storedValue]);

    // Remove value from storage
    const removeValue = useCallback(() => {
        try {
            localStorage.removeItem(key);
            setStoredValue(initialValue);
        } catch (error) {
            logger.error(`Error removing localStorage key "${key}":`, error);
        }
    }, [key, initialValue]);

    return [storedValue, setStoredValue, removeValue];
}

export default useLocalStorage;
