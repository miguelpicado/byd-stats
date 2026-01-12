// BYD Stats - useFileOpening Hook

import { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

// Register the custom FileOpener plugin
const FileOpener = registerPlugin('FileOpener');

/**
 * Custom hook for handling file opening from external sources
 * Handles files shared to the app or opened from file managers
 * @returns {Object} File opening state and handlers
 */
export function useFileOpening() {
    const [sharedFile, setSharedFile] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Only run on native platforms
        if (!Capacitor.isNativePlatform()) {
            return;
        }

        let isSubscribed = true;

        // Check for shared file on startup
        const checkSharedFile = async () => {
            try {
                const result = await FileOpener.getSharedFile();
                if (result && result.uri) {
                    console.log('Found shared file on startup:', result);
                    setSharedFile(result);
                }
            } catch (err) {
                console.error('Error checking for shared file:', err);
            }
        };

        // Handle app URL open events (when a file is opened or shared)
        const handleAppUrlOpen = async (event) => {
            if (!isSubscribed) return;

            try {
                console.log('App URL Open event:', event);

                // Handle file URIs
                if (event.url) {
                    const fileUri = event.url;

                    // Check if it's a file URL
                    if (fileUri.startsWith('file://') || fileUri.startsWith('content://')) {
                        setSharedFile({ uri: fileUri });
                    }
                }
            } catch (err) {
                console.error('Error handling app URL open:', err);
                setError(err.message);
            }
        };

        // Subscribe to app URL open events
        const urlListener = App.addListener('appUrlOpen', handleAppUrlOpen);

        // Check for any pending file on app startup
        checkSharedFile();

        // Also check launch URL
        App.getLaunchUrl().then((result) => {
            if (result && result.url) {
                handleAppUrlOpen({ url: result.url });
            }
        }).catch(err => {
            console.error('Error getting launch URL:', err);
        });

        // Cleanup
        return () => {
            isSubscribed = false;
            urlListener.then(listener => listener.remove());
        };
    }, []);

    /**
     * Clear the shared file state
     */
    const clearSharedFile = () => {
        setSharedFile(null);
        setError(null);
    };

    /**
     * Read file content from URI using native plugin
     * @param {string} uri - File URI
     * @returns {Promise<File>} File object
     */
    const readFileFromUri = async (uri) => {
        try {
            console.log('Reading file from URI:', uri);

            // Use the native plugin to read the file
            const result = await FileOpener.readFileFromUri({ uri });

            if (!result || !result.data) {
                throw new Error('No data received from file');
            }

            // Convert base64 to blob
            const base64Data = result.data;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: result.mimeType || 'application/x-sqlite3' });

            // Create File object
            const fileName = result.fileName || 'shared.db';
            return new File([blob], fileName, { type: result.mimeType || 'application/x-sqlite3' });
        } catch (err) {
            console.error('Error reading file from URI:', err);
            throw err;
        }
    };

    return {
        sharedFile,
        error,
        clearSharedFile,
        readFileFromUri
    };
}

export default useFileOpening;
