// BYD Stats - Unified File Handling Hook (Android Native + PWA)

import { useEffect, useState, useMemo } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';
import { logger } from '@core/logger';

// Type definitions for our custom plugin
interface FileOpenerPlugin {
    getSharedFile(): Promise<{ uri: string } | null>;
    readFileFromUri(options: { uri: string }): Promise<{ data: string; mimeType: string; fileName?: string } | null>;
}

// Register the custom FileOpener plugin for Android native
const FileOpener = registerPlugin<FileOpenerPlugin>('FileOpener');

interface PendingFile {
    uri?: string;
    file?: File;
    source: 'android' | 'pwa-launch' | 'pwa-share';
}

interface UseFileHandlingReturn {
    pendingFile: PendingFile | null;
    error: string | null;
    clearPendingFile: () => void;
    readFile: (pendingFile: PendingFile) => Promise<File>;
    isNative: boolean;
}

// Extend Window interface for LaunchQueue API
declare global {
    interface Window {
        launchQueue?: {
            setConsumer: (callback: (launchParams: any) => void) => void;
        };
    }
}

/**
 * Unified hook for handling file operations in both Android native and PWA
 * Automatically detects platform and uses appropriate method
 */
export function useFileHandling(): UseFileHandlingReturn {
    const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
    const [error, setError] = useState<string | null>(null);
    const isNative = Capacitor.isNativePlatform();

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let isSubscribed = true;

        // ========================================
        // ANDROID NATIVE FILE HANDLING
        // ========================================
        if (isNative) {
            // Check for shared file on startup
            const checkNativeSharedFile = async () => {
                try {
                    const result = await FileOpener.getSharedFile();
                    if (result && result.uri) {
                        setPendingFile({ uri: result.uri, source: 'android' });
                    }
                } catch (err) {
                    logger.error('[Android] Error checking for shared file:', err);
                }
            };

            // Handle app URL open events (when a file is opened or shared)
            const handleAppUrlOpen = async (event: any) => {
                if (!isSubscribed) return;

                try {
                    if (event.url) {
                        const fileUri = event.url;

                        if (fileUri.startsWith('file://') || fileUri.startsWith('content://')) {
                            setPendingFile({ uri: fileUri, source: 'android' });
                        }
                    }
                } catch (err: any) {
                    logger.error('[Android] Error handling app URL open:', err);
                    setError(err.message || 'Error handling URL');
                }
            };

            // Subscribe to app URL open events
            const urlListener = CapacitorApp.addListener('appUrlOpen', handleAppUrlOpen);

            // Check for any pending file on app startup
            checkNativeSharedFile();

            // Also check launch URL
            CapacitorApp.getLaunchUrl().then((result) => {
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
            // 1. Handle File Handling API (when user opens .db file from system)
            if ('launchQueue' in window && window.launchQueue) {
                window.launchQueue.setConsumer(async (launchParams: any) => {
                    if (!isSubscribed) return;

                    try {
                        if (launchParams.files && launchParams.files.length > 0) {
                            const fileHandle = launchParams.files[0];
                            const file = await fileHandle.getFile();

                            setPendingFile({ file, source: 'pwa-launch' });
                        }
                    } catch (err) {
                        setError('Error al abrir el archivo');
                    }
                });
            }

            // 2. Handle Web Share Target API (when file is shared to PWA)
            const checkSharedFile = async () => {
                try {
                    const urlParams = new URLSearchParams(window.location.search);
                    if (urlParams.get('shared') === 'true') {

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
     */
    const readFile = async (pendingFile: PendingFile): Promise<File> => {
        if (!pendingFile) {
            throw new Error('No pending file');
        }

        // PWA: file is already a File object
        if (pendingFile.source === 'pwa-launch' || pendingFile.source === 'pwa-share') {
            if (!pendingFile.file) throw new Error('No file object in pendingFile');
            return pendingFile.file;
        }

        // Android: need to read from URI using native plugin
        if (pendingFile.source === 'android') {
            try {
                if (!pendingFile.uri) throw new Error('No URI in pendingFile');
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

    return useMemo(() => ({
        pendingFile,
        error,
        clearPendingFile,
        readFile,
        isNative
    }), [pendingFile, error, clearPendingFile, readFile, isNative]);
}

/**
 * Open IndexedDB database (for PWA)
 */
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('byd-stats-sw', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains('shared-files')) {
                db.createObjectStore('shared-files', { keyPath: 'id' });
            }
        };
    });
}

export default useFileHandling;
