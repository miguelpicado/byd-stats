// BYD Stats - useSettings Hook

import { useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { SETTINGS_KEY, DEFAULT_SETTINGS } from '@core/constants';

/**
 * Custom hook for managing app settings
 * @returns {[Object, Function]} [settings, updateSettings]
 */
export function useSettings() {
    const [settings, setSettings] = useLocalStorage(SETTINGS_KEY, DEFAULT_SETTINGS);

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


