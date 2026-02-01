import { logger } from '@core/logger';
import { Trip, Charge, Settings, ChargerType, Car } from '@/types';

const DRIVER_API_URL = "https://www.googleapis.com/drive/v3";
const UPLOAD_API_URL = "https://www.googleapis.com/upload/drive/v3";
const DB_FILENAME = 'byd_stats_data.json';
const FOLDER_ID = 'appDataFolder';

let accessToken: string | null = null;

export interface GoogleDriveFile {
    id: string;
    name: string;
    modifiedTime?: string;
    size?: string;
}

export interface SyncData {
    trips: Trip[];
    settings: Settings;
    charges: Charge[];
}

export interface RegistryData {
    lastUpdated: string;
    cars: Car[];
}

export const googleDriveService = {
    // Flag to indicate if service is ready
    isInited: true,

    /**
     * Initialize - No-op for fetch implementation, kept for compatibility
     */
    initClient: async (): Promise<boolean> => {
        return Promise.resolve(true);
    },

    /**
     * Set the access token for API calls
     */
    setAccessToken: (token: string | null): void => {
        accessToken = token;
    },

    /**
     * Check if the user is signed in (checks if token is present)
     */
    isSignedIn: (): boolean => {
        return !!accessToken;
    },

    /**
     * Sign out (Clear token)
     */
    signOut: async (): Promise<void> => {
        accessToken = null;
    },

    /**
     * Helper for fetch headers
     */
    _getHeaders: (): HeadersInit => {
        if (!accessToken) throw new Error("No access token set");
        return {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        };
    },

    /**
     * List files in the App Data folder to find our DB
     */
    listFiles: async (filename: string = DB_FILENAME): Promise<GoogleDriveFile[]> => {
        try {
            const query = `name = '${filename}'`;
            const url = `${DRIVER_API_URL}/files?spaces=${FOLDER_ID}&fields=nextPageToken,files(id,name,modifiedTime,size)&pageSize=10&orderBy=modifiedTime desc&q=${encodeURIComponent(query)}`;

            const response = await fetch(url, {
                headers: googleDriveService._getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Error listing files: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data.files as GoogleDriveFile[];
        } catch (error) {
            logger.error('Error listing files', error);
            throw error;
        }
    },

    /**
     * List ALL BYD Stats database files (including UUIDs)
     */
    listAllDatabaseFiles: async (): Promise<GoogleDriveFile[]> => {
        try {
            const query = `name contains 'byd_stats_data' and mimeType = 'application/json'`;
            const url = `${DRIVER_API_URL}/files?spaces=${FOLDER_ID}&fields=nextPageToken,files(id,name,modifiedTime,size)&pageSize=20&orderBy=modifiedTime desc&q=${encodeURIComponent(query)}`;

            const response = await fetch(url, {
                headers: googleDriveService._getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Error listing all files: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data.files as GoogleDriveFile[];
        } catch (error) {
            logger.error('Error listing all database files', error);
            throw error;
        }
    },

    /**
     * Download the database file content
     */
    downloadFile: async (fileId: string): Promise<SyncData> => {
        try {
            const url = `${DRIVER_API_URL}/files/${fileId}?alt=media`;
            const response = await fetch(url, {
                headers: googleDriveService._getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Error downloading file: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            // Normalize to { trips: [], settings: {}, charges: [] }
            if (Array.isArray(result)) {
                return { trips: result, settings: {} as Settings, charges: [] };
            }

            if (result && typeof result === 'object') {
                return {
                    trips: Array.isArray(result.trips) ? result.trips : [],
                    settings: result.settings || {} as Settings,
                    charges: Array.isArray(result.charges) ? result.charges : []
                };
            }

            return { trips: [], settings: {} as Settings, charges: [] };
        } catch (error) {
            logger.error('Error downloading file', error);
            throw error;
        }
    },

    /**
     * Upload (Create or Update) the database file
     */
    uploadFile: async (data: any, existingFileId: string | null = null, filename: string = DB_FILENAME): Promise<any> => {
        try {
            const fileContent = JSON.stringify(data);
            let fileId = existingFileId;

            // Step 1: If no existing file, create metadata first
            if (!fileId) {
                const metadata = {
                    name: filename,
                    mimeType: 'application/json',
                    parents: [FOLDER_ID]
                };

                const createRes = await fetch(`${DRIVER_API_URL}/files`, {
                    method: 'POST',
                    headers: googleDriveService._getHeaders(),
                    body: JSON.stringify(metadata)
                });

                if (!createRes.ok) {
                    throw new Error('Failed to create file metadata: ' + await createRes.text());
                }
                const createData = await createRes.json();
                fileId = createData.id;
            }

            // Step 2: Upload Content (Simple Upload for small files)
            const updateUrl = `${UPLOAD_API_URL}/files/${fileId}?uploadType=media`;

            const updateRes = await fetch(updateUrl, {
                method: 'PATCH',
                headers: googleDriveService._getHeaders(),
                body: fileContent
            });

            if (!updateRes.ok) {
                throw new Error('Failed to upload file content: ' + await updateRes.text());
            }

            return await updateRes.json();

        } catch (error) {
            logger.error('Error uploading file:', error);
            throw error;
        }
    },

    /**
     * Delete a file
     */
    deleteFile: async (fileId: string): Promise<boolean> => {
        try {
            const url = `${DRIVER_API_URL}/files/${fileId}`;
            const response = await fetch(url, {
                method: 'DELETE',
                headers: googleDriveService._getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Error deleting file: ${response.status} ${response.statusText}`);
            }
            return true;
        } catch (error) {
            logger.error('Error deleting file', error);
            throw error;
        }
    },

    /**
     * Get Registry File
     */
    getRegistry: async (): Promise<RegistryData | null> => {
        try {
            const files = await googleDriveService.listFiles('byd_stats_registry.json');
            if (files && files.length > 0) {
                // We use downloadFile but check if it matches RegistryData structure
                // But downloadFile returns SyncData... allow loose typing here or distinct method
                const url = `${DRIVER_API_URL}/files/${files[0].id}?alt=media`;
                const response = await fetch(url, { headers: googleDriveService._getHeaders() });
                if (!response.ok) throw new Error('Failed to DL registry');
                const fileContent = await response.json();

                return {
                    lastUpdated: fileContent.lastUpdated,
                    cars: Array.isArray(fileContent.cars) ? fileContent.cars : []
                };
            }
            return null;
        } catch (e) {
            logger.error('Error getting registry', e);
            return null;
        }
    },

    /**
     * Update Registry File
     */
    updateRegistry: async (registryData: RegistryData): Promise<void> => {
        try {
            const files = await googleDriveService.listFiles('byd_stats_registry.json');
            const fileId = files && files.length > 0 ? files[0].id : null;
            await googleDriveService.uploadFile(registryData, fileId, 'byd_stats_registry.json');
        } catch (e) {
            logger.error('Error updating registry', e);
            throw e;
        }
    },

    /**
     * Merge logic:
     * Returns merged { trips, settings, charges }
     */
    mergeData: (localData: SyncData, remoteData: SyncData): SyncData => {
        // 1. Merge Trips (Union by date-timestamp)
        const localTrips = (localData && Array.isArray(localData.trips)) ? localData.trips : [];
        const remoteTrips = (remoteData && Array.isArray(remoteData.trips)) ? remoteData.trips : [];

        const tripMap = new Map<string, Trip>();
        localTrips.forEach(t => tripMap.set(`${t.date}-${t.start_timestamp}`, t));
        remoteTrips.forEach(t => {
            const key = `${t.date}-${t.start_timestamp}`;
            if (!tripMap.has(key)) {
                tripMap.set(key, t);
            }
        });

        const mergedTrips = Array.from(tripMap.values()).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        // 2. Merge Settings
        const localSettings = localData.settings || {} as Settings;
        const remoteSettings = remoteData.settings || {} as Settings;

        // Helper: Is a value a "default" or "empty" value?
        const isDefault = (key: string, val: any): boolean => {
            if (val === undefined || val === null || val === '') return true;
            if (key === 'odometerOffset' && val === 0) return true;
            if (key === 'soh' && val === 100) return true;
            if (key === 'batterySize' && val === 60.48) return true;
            return false;
        };

        // Merge other settings (non-default wins, then local wins)
        const mergedSettings: any = { ...remoteSettings, ...localSettings };

        // Explicit merging logic
        const allKeys = new Set([...Object.keys(localSettings), ...Object.keys(remoteSettings)]);
        
        allKeys.forEach(key => {
            if (key === 'chargerTypes' || key === 'hiddenTabs') return;
            
            const localVal = (localSettings as any)[key];
            const remoteVal = (remoteSettings as any)[key]; // Corrected access

            if (isDefault(key, localVal) && !isDefault(key, remoteVal)) {
                mergedSettings[key] = remoteVal;
            } else if (!isDefault(key, localVal)) {
                mergedSettings[key] = localVal;
            }
        });

        // Special handling for chargerTypes array
        const localChargerTypes = localSettings.chargerTypes || [];
        const remoteChargerTypes = remoteSettings.chargerTypes || [];

        const DEFAULT_IDS = ['domestic', 'slow', 'fast', 'ultrafast'];
        const chargerTypeMap = new Map<string, ChargerType>();

        // Fill with remote first
        remoteChargerTypes.forEach(ct => chargerTypeMap.set(ct.id, ct));
        // Overwrite with local
        localChargerTypes.forEach(ct => chargerTypeMap.set(ct.id, ct));

        // Cleanup deleted defaults
        if (localChargerTypes.length > 0) {
            DEFAULT_IDS.forEach(id => {
                const inLocal = localChargerTypes.some(ct => ct.id === id);
                const inRemote = remoteChargerTypes.some(ct => ct.id === id);
                if (inRemote && !inLocal) {
                    chargerTypeMap.delete(id);
                }
            });
        }

        const mergedChargerTypes = Array.from(chargerTypeMap.values());
        if (mergedChargerTypes.length > 0) {
            mergedSettings.chargerTypes = mergedChargerTypes;
        }

        // 3. Merge Charges
        const localCharges = (localData && Array.isArray(localData.charges)) ? localData.charges : [];
        const remoteCharges = (remoteData && Array.isArray(remoteData.charges)) ? remoteData.charges : [];

        const chargeMap = new Map<string, Charge>();
        
        localCharges.forEach(c => {
            const key = c.timestamp ? String(c.timestamp) : `${c.date}T${c.time}`;
            chargeMap.set(key, c);
        });
        
        remoteCharges.forEach(c => {
            const key = c.timestamp ? String(c.timestamp) : `${c.date}T${c.time}`;
            if (!chargeMap.has(key)) {
                chargeMap.set(key, c);
            }
        });

        const mergedCharges = Array.from(chargeMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        return {
            trips: mergedTrips,
            settings: mergedSettings as Settings,
            charges: mergedCharges
        };
    }
};
