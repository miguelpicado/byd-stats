const DRIVER_API_URL = "https://www.googleapis.com/drive/v3";
const UPLOAD_API_URL = "https://www.googleapis.com/upload/drive/v3";
const DB_FILENAME = 'byd_stats_data.json';
const FOLDER_ID = 'appDataFolder';

let accessToken = null;

export const googleDriveService = {
  // Flag to indicate if service is ready (always true now as we use fetch)
  isInited: true,

  /**
   * Initialize - No-op for fetch implementation, kept for compatibility
   */
  initClient: async () => {
    console.log("googleDriveService: Init (Fetch mode) - Ready");
    return Promise.resolve(true);
  },

  /**
   * Set the access token for API calls
   */
  setAccessToken: (token) => {
    accessToken = token;
  },

  /**
   * Check if the user is signed in (checks if token is present)
   */
  isSignedIn: () => {
    return !!accessToken;
  },

  /**
   * Sign out (Clear token)
   */
  signOut: async () => {
    accessToken = null;
  },

  /**
   * Helper for fetch headers
   */
  _getHeaders: () => {
    if (!accessToken) throw new Error("No access token set");
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
  },

  /**
   * List files in the App Data folder to find our DB
   */
  listFiles: async () => {
    try {
      const query = `name = '${DB_FILENAME}'`;
      const url = `${DRIVER_API_URL}/files?spaces=${FOLDER_ID}&fields=nextPageToken,files(id,name,modifiedTime)&pageSize=10&q=${encodeURIComponent(query)}`;

      const headers = googleDriveService._getHeaders();
      const tokenPreview = headers.Authorization.substring(7, 25); // Skip 'Bearer '
      alert(`DEBUG: Fetching...\nToken Prefix: ${tokenPreview}\nIs JWT (ID Token)? ${tokenPreview.startsWith('eyJ')}`);

      const response = await fetch(url, {
        headers: headers
      });

      if (!response.ok) {
        throw new Error(`Error listing files: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.files;
    } catch (error) {
      console.error("Error listing files", error);
      throw error;
    }
  },

  /**
   * Download the database file content
   */
  downloadFile: async (fileId) => {
    try {
      const url = `${DRIVER_API_URL}/files/${fileId}?alt=media`;
      const response = await fetch(url, {
        headers: googleDriveService._getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Error downloading file: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log("Download successful");

      // Normalize to { trips: [], settings: {} }
      if (Array.isArray(result)) {
        console.log("Migrating legacy array format to object...");
        return { trips: result, settings: {} };
      }

      if (result && typeof result === 'object') {
        return {
          trips: Array.isArray(result.trips) ? result.trips : [],
          settings: result.settings || {}
        };
      }

      return { trips: [], settings: {} };
    } catch (error) {
      console.error("Error downloading file", error);
      throw error;
    }
  },

  /**
   * Upload (Create or Update) the database file
   */
  uploadFile: async (data, existingFileId = null) => {
    try {
      const fileContent = JSON.stringify(data);
      let fileId = existingFileId;

      // Step 1: If no existing file, create metadata first
      if (!fileId) {
        const metadata = {
          name: DB_FILENAME,
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
        console.log("Created new file ID:", fileId);
      }

      // Step 2: Upload Content (Simple Upload)
      // Use uploadType=media
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
      console.error('Error uploading file:', error);
      throw error;
    }
  },

  /**
   * Merge logic:
   * Returns merged { trips, settings }
   */
  mergeData: (localData, remoteData) => {
    // 1. Merge Trips (Union by date-timestamp)
    const localTrips = (localData && Array.isArray(localData.trips)) ? localData.trips : [];
    const remoteTrips = (remoteData && Array.isArray(remoteData.trips)) ? remoteData.trips : [];

    const map = new Map();
    localTrips.forEach(t => map.set(t.date + '-' + t.start_timestamp, t));
    remoteTrips.forEach(t => {
      const key = t.date + '-' + t.start_timestamp;
      if (!map.has(key)) {
        map.set(key, t);
      }
    });

    const mergedTrips = Array.from(map.values()).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // 2. Merge Settings
    // Strategy: Remote settings overlay local settings if they exist.
    const mergedSettings = { ...localData.settings, ...remoteData.settings };

    return {
      trips: mergedTrips,
      settings: mergedSettings
    };
  }
};
