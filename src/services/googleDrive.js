import { gapi } from 'gapi-script';

const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/drive.appdata";
const DB_FILENAME = 'byd_stats_data.json';
const FOLDER_ID = 'appDataFolder';

export const googleDriveService = {
  isInited: false,

  /**
   * Initialize the GAPI client (only for Drive API calls, auth is handled by @react-oauth/google)
   */
  initClient: async () => {
    return new Promise((resolve, reject) => {
      gapi.load('client', () => {
        gapi.client.init({
          discoveryDocs: DISCOVERY_DOCS,
        }).then(() => {
          googleDriveService.isInited = true;
          resolve(true);
        }).catch(err => {
          console.error("Error initializing GAPI client", err);
          reject(err);
        });
      });
    });
  },

  /**
   * Set the access token for GAPI calls
   */
  setAccessToken: (token) => {
    if (!token) return;
    gapi.client.setToken({ access_token: token });
  },

  /**
   * Check if the user is signed in (checks if token is present)
   */
  isSignedIn: () => {
    const token = gapi.client.getToken();
    return !!token && !!token.access_token;
  },

  /**
   * Sign out (Clear token)
   */
  signOut: async () => {
    gapi.client.setToken(null);
  },

  /**
   * List files in the App Data folder to find our DB
   */
  listFiles: async () => {
    try {
      const response = await gapi.client.drive.files.list({
        spaces: 'appDataFolder',
        fields: 'nextPageToken, files(id, name, modifiedTime)',
        pageSize: 10,
        q: `name = '${DB_FILENAME}'`
      });
      return response.result.files;
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
      const response = await gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media'
      });
      console.log("Download response:", response);
      let result = response.result;

      // Ensure result is an object/array. GAPI might return string if not auto-parsed.
      if (typeof result === 'string') {
        try {
          result = JSON.parse(result);
        } catch (e) {
          console.warn("Could not parse download result as JSON", e);
        }
      }

      // Normalize to { trips: [], settings: {} }
      if (Array.isArray(result)) {
        // Legacy format (just array of trips)
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
   * Method: 2-step to avoid manual multipart framing issues.
   * 1. If new, create metadata (to put in appDataFolder).
   * 2. Upload content via uploadType=media.
   */
  uploadFile: async (data, existingFileId = null) => {
    try {
      const fileContent = JSON.stringify(data);
      const accessToken = gapi.client.getToken().access_token;

      let fileId = existingFileId;

      // Step 1: If no existing file, create metadata first
      if (!fileId) {
        const metadata = {
          name: DB_FILENAME,
          mimeType: 'application/json',
          parents: [FOLDER_ID]
        };

        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json'
          },
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
      const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;

      const updateRes = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        },
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
    const localTrips = localData.trips || [];
    const remoteTrips = remoteData.trips || [];

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
    // This allows syncing settings FROM cloud to this device.
    const mergedSettings = { ...localData.settings, ...remoteData.settings };

    return {
      trips: mergedTrips,
      settings: mergedSettings
    };
  }
};
