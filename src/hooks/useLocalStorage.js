// BYD Stats - useLocalStorage Hook

import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for localStorage with automatic serialization
 * @param {string} key - Storage key
 * @param {any} initialValue - Initial value if not found in storage
 * @returns {[any, Function, Function]} [value, setValue, removeValue]
 */
export function useLocalStorage(key, initialValue) {
    // Get initial value from localStorage or use default
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(`Error reading localStorage key "${key}":`, error);
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
            console.error(`Error writing localStorage key "${key}":`, error);
        }
    }, [key, storedValue]);

    // Remove value from storage
    const removeValue = useCallback(() => {
        try {
            localStorage.removeItem(key);
            setStoredValue(initialValue);
        } catch (error) {
            console.error(`Error removing localStorage key "${key}":`, error);
        }
    }, [key, initialValue]);

    return [storedValue, setStoredValue, removeValue];
}

export default useLocalStorage;
