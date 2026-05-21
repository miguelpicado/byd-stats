// BYD Stats - File Handling Hook (PWA)

import { useEffect, useState, useMemo } from 'react';
import { logger } from '@core/logger';

interface PendingFile {
    file?: File;
    source: 'pwa-launch' | 'pwa-share';
}

interface UseFileHandlingReturn {
    pendingFile: PendingFile | null;
    error: string | null;
    clearPendingFile: () => void;
    readFile: (pendingFile: PendingFile) => Promise<File>;
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
 * Hook for handling PWA file operations (File Handling API + Web Share Target)
 */
export function useFileHandling(): UseFileHandlingReturn {
    const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let isSubscribed = true;

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
    }, []);

    /**
     * Clear pending file state
     */
    const clearPendingFile = () => {
        setPendingFile(null);
        setError(null);
    };

    /**
     * Read file content
     */
    const readFile = async (pendingFile: PendingFile): Promise<File> => {
        if (!pendingFile || !pendingFile.file) {
            throw new Error('No file object in pendingFile');
        }
        return pendingFile.file;
    };

    return useMemo(() => ({
        pendingFile,
        error,
        clearPendingFile,
        readFile
    }), [pendingFile, error, clearPendingFile, readFile]);
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
