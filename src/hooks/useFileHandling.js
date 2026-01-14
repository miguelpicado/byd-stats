// BYD Stats - Unified File Handling Hook (Android Native + PWA)

import { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';
import { logger } from '../utils/logger';

// Register the custom FileOpener plugin for Android native
const FileOpener = registerPlugin('FileOpener');

/**
 * Unified hook for handling file operations in both Android native and PWA
 * Automatically detects platform and uses appropriate method
 * @returns {Object} File handling state and utilities
 */
export function useFileHandling() {
    const [pendingFile, setPendingFile] = useState(null);
    const [error, setError] = useState(null);
    const isNative = Capacitor.isNativePlatform();

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let isSubscribed = true;

        // ========================================
        // ANDROID NATIVE FILE HANDLING
        // ========================================
        if (isNative) {
            logger.debug('[FileHandling] Running on Android native platform');

            // Check for shared file on startup
            const checkNativeSharedFile = async () => {
                try {
                    const result = await FileOpener.getSharedFile();
                    if (result && result.uri) {
                        logger.debug('[Android] Found shared file on startup:', result);
                        setPendingFile({ uri: result.uri, source: 'android' });
                    }
                } catch (err) {
                    logger.error('[Android] Error checking for shared file:', err);
                }
            };

            // Handle app URL open events (when a file is opened or shared)
            const handleAppUrlOpen = async (event) => {
                if (!isSubscribed) return;

                try {
                    logger.debug('[Android] App URL Open event:', event);

                    if (event.url) {
                        const fileUri = event.url;

                        if (fileUri.startsWith('file://') || fileUri.startsWith('content://')) {
                            logger.debug('[Android] File URI detected:', fileUri);
                            setPendingFile({ uri: fileUri, source: 'android' });
                        }
                    }
                } catch (err) {
                    logger.error('[Android] Error handling app URL open:', err);
                    setError(err.message);
                }
            };

            // Subscribe to app URL open events
            const urlListener = App.addListener('appUrlOpen', handleAppUrlOpen);

            // Check for any pending file on app startup
            checkNativeSharedFile();

            // Also check launch URL
            App.getLaunchUrl().then((result) => {
                if (result && result.url) {
                    handleAppUrlOpen({ url: result.url });
                }
            }).catch(err => {
                logger.error('[Android] Error getting launch URL:', err);
            });

            // Cleanup
            return () => {
                isSubscribed = false;
                urlListener.then(listener => listener.remove());
            };
        }

        // ========================================
        // PWA FILE HANDLING
        // ========================================
        else {
            logger.debug('[FileHandling] Running on PWA/Web platform');

            // 1. Handle File Handling API (when user opens .db file from system)
            if ('launchQueue' in window) {
                logger.debug('[PWA] File Handling API supported');

                window.launchQueue.setConsumer(async (launchParams) => {
                    if (!isSubscribed) return;

                    try {
                        if (launchParams.files && launchParams.files.length > 0) {
                            logger.debug('[PWA] Files received via launchQueue:', launchParams.files.length);

                            const fileHandle = launchParams.files[0];
                            const file = await fileHandle.getFile();

                            logger.debug('[PWA] File opened:', file.name, file.size);
                            setPendingFile({ file, source: 'pwa-launch' });
                        }
                    } catch (err) {
                        logger.error('[PWA] Error handling launchQueue file:', err);
                        setError('Error al abrir el archivo');
                    }
                });
            } else {
                logger.debug('[PWA] File Handling API not supported');
            }

            // 2. Handle Web Share Target API (when file is shared to PWA)
            const checkSharedFile = async () => {
                try {
                    const urlParams = new URLSearchParams(window.location.search);
                    if (urlParams.get('shared') === 'true') {
                        logger.debug('[PWA] Shared file detected, checking IndexedDB');

                        // Clean up URL
                        window.history.replaceState({}, '', window.location.pathname);

                        // Read file from IndexedDB (stored by Service Worker)
                        const db = await openDB();
                        const tx = db.transaction('shared-files', 'readonly');
                        const store = tx.objectStore('shared-files');
                        const request = store.get('latest');

                        request.onsuccess = () => {
                            const data = request.result;
                            if (data && data.data) {
                                logger.debug('[PWA] Shared file loaded from IndexedDB:', data.name, data.size);

                                // Convert ArrayBuffer back to File
                                const blob = new Blob([data.data], { type: data.type });
                                const file = new File([blob], data.name, { type: data.type });

                                setPendingFile({ file, source: 'pwa-share' });

                                // Clean up IndexedDB
                                const deleteTx = db.transaction('shared-files', 'readwrite');
                                const deleteStore = deleteTx.objectStore('shared-files');
                                deleteStore.delete('latest');
                            }
                        };

                        request.onerror = () => {
                            logger.error('[PWA] Error reading shared file from IndexedDB');
                            setError('Error al leer el archivo compartido');
                        };
                    }
                } catch (err) {
                    logger.error('[PWA] Error checking shared file:', err);
                }
            };

            checkSharedFile();

            return () => {
                isSubscribed = false;
            };
        }
    }, [isNative]);

    /**
     * Clear pending file state
     */
    const clearPendingFile = () => {
        setPendingFile(null);
        setError(null);
    };

    /**
     * Read file content - works for both Android and PWA
     * @param {Object} pendingFile - Pending file object
     * @returns {Promise<File>} File object
     */
    const readFile = async (pendingFile) => {
        if (!pendingFile) {
            throw new Error('No pending file');
        }

        // PWA: file is already a File object
        if (pendingFile.source === 'pwa-launch' || pendingFile.source === 'pwa-share') {
            return pendingFile.file;
        }

        // Android: need to read from URI using native plugin
        if (pendingFile.source === 'android') {
            try {
                logger.debug('[Android] Reading file from URI:', pendingFile.uri);

                const result = await FileOpener.readFileFromUri({ uri: pendingFile.uri });

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
                logger.error('[Android] Error reading file from URI:', err);
                throw err;
            }
        }

        throw new Error('Unknown file source');
    };

    return {
        pendingFile,
        error,
        clearPendingFile,
        readFile,
        isNative
    };
}

/**
 * Open IndexedDB database (for PWA)
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('byd-stats-sw', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('shared-files')) {
                db.createObjectStore('shared-files', { keyPath: 'id' });
            }
        };
    });
}

export default useFileHandling;
