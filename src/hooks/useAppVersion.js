import { useState, useEffect } from 'react';

const CACHE_KEY = 'byd_app_version';
const CACHE_EXPIRY_KEY = 'byd_app_version_expiry';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const FALLBACK_VERSION = 'v1.6.0';

/**
 * Custom hook to fetch the latest app version from GitHub releases
 * Caches the version in localStorage for 24 hours to reduce API calls
 * @returns {Object} { version: string, isLoading: boolean }
 */
export default function useAppVersion() {
    const [version, setVersion] = useState(FALLBACK_VERSION);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchVersion = async () => {
            try {
                // Check if we have a cached version that's still valid
                const cachedVersion = localStorage.getItem(CACHE_KEY);
                const cacheExpiry = localStorage.getItem(CACHE_EXPIRY_KEY);
                const now = Date.now();

                if (cachedVersion && cacheExpiry && now < parseInt(cacheExpiry, 10)) {
                    // Use cached version
                    setVersion(cachedVersion);
                    setIsLoading(false);
                    return;
                }

                // Fetch latest release from GitHub API
                const response = await fetch(
                    'https://api.github.com/repos/miguelpicado/byd-stats/releases/latest',
                    {
                        headers: {
                            'Accept': 'application/vnd.github.v3+json',
                        },
                    }
                );

                if (!response.ok) {
                    throw new Error(`GitHub API returned ${response.status}`);
                }

                const data = await response.json();
                const latestVersion = data.tag_name || FALLBACK_VERSION;

                // Cache the version
                localStorage.setItem(CACHE_KEY, latestVersion);
                localStorage.setItem(CACHE_EXPIRY_KEY, (now + CACHE_DURATION).toString());

                setVersion(latestVersion);
            } catch (error) {
                console.warn('Failed to fetch app version from GitHub:', error);
                // Use cached version if available, otherwise use fallback
                const cachedVersion = localStorage.getItem(CACHE_KEY);
                setVersion(cachedVersion || FALLBACK_VERSION);
            } finally {
                setIsLoading(false);
            }
        };

        fetchVersion();
    }, []);

    return { version, isLoading };
}


