// BYD Stats - PWA File Handling Hook

import { useEffect, useState } from 'react';

/**
 * Custom hook for handling PWA file operations
 * Supports both File Handling API and Web Share Target API
 * @returns {Object} File handling state and utilities
 */
export function usePWAFileHandling() {
    const [pendingFile, setPendingFile] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Only run in browser context
        if (typeof window === 'undefined') return;

        let isSubscribed = true;

        // 1. Handle File Handling API (when user opens .db file from system)
        if ('launchQueue' in window) {
            console.log('[PWA] File Handling API supported');

            window.launchQueue.setConsumer(async (launchParams) => {
                if (!isSubscribed) return;

                try {
                    if (launchParams.files && launchParams.files.length > 0) {
                        console.log('[PWA] Files received via launchQueue:', launchParams.files.length);

                        const fileHandle = launchParams.files[0];
                        const file = await fileHandle.getFile();

                        console.log('[PWA] File opened:', file.name, file.size);

                        setPendingFile(file);
                    }
                } catch (err) {
                    console.error('[PWA] Error handling launchQueue file:', err);
                    setError('Error al abrir el archivo');
                }
            });
        } else {
            console.log('[PWA] File Handling API not supported');
        }

        // 2. Handle Web Share Target API (when file is shared to PWA)
        const checkSharedFile = async () => {
            try {
                // Check if we came from a share action
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('shared') === 'true') {
                    console.log('[PWA] Shared file detected, checking IndexedDB');

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
                            console.log('[PWA] Shared file loaded from IndexedDB:', data.name, data.size);

                            // Convert ArrayBuffer back to File
                            const blob = new Blob([data.data], { type: data.type });
                            const file = new File([blob], data.name, { type: data.type });

                            setPendingFile(file);

                            // Clean up IndexedDB
                            const deleteTx = db.transaction('shared-files', 'readwrite');
                            const deleteStore = deleteTx.objectStore('shared-files');
                            deleteStore.delete('latest');
                        }
                    };

                    request.onerror = () => {
                        console.error('[PWA] Error reading shared file from IndexedDB');
                        setError('Error al leer el archivo compartido');
                    };
                }
            } catch (err) {
                console.error('[PWA] Error checking shared file:', err);
            }
        };

        checkSharedFile();

        return () => {
            isSubscribed = false;
        };
    }, []);

    /**
     * Clear pending file state
     */
    const clearPendingFile = () => {
        setPendingFile(null);
        setError(null);
    };

    return {
        pendingFile,
        error,
        clearPendingFile
    };
}

/**
 * Open IndexedDB database
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

export default usePWAFileHandling;
