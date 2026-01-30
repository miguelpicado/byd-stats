// BYD Stats - useSettings Hook

import { useEffect } from 'react';
// @ts-ignore - useLocalStorage is still JS
import { useLocalStorage } from './useLocalStorage';
import { SETTINGS_KEY, DEFAULT_SETTINGS } from '@core/constants';
import { Settings } from '@/types';

/**
 * Custom hook for managing app settings
 * @returns {[Settings, Function]} [settings, updateSettings]
 */
export function useSettings(): [Settings, (s: Settings | ((prev: Settings) => Settings)) => void] {
    const [settings, setSettings] = useLocalStorage(SETTINGS_KEY, DEFAULT_SETTINGS) as any;

    // Ensure all default settings exist
    useEffect(() => {
        const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
        if (JSON.stringify(mergedSettings) !== JSON.stringify(settings)) {
            setSettings(mergedSettings);
        }
    }, [settings, setSettings]);

    return [settings, setSettings];
}

export default useSettings;
