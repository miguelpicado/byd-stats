// BYD Stats - useDatabase Hook

import { useState, useCallback } from 'react';
import { logger } from '@core/logger';
import { toast } from 'react-hot-toast';
import { Trip } from '@/types';

// SQL.js types
interface SqlJsDatabase {
    exec(sql: string): Array<{ columns: string[]; values: unknown[][] }>;
    run(sql: string, params?: unknown[]): void;
    prepare(sql: string): SqlJsStatement;
    export(): Uint8Array;
    close(): void;
}

interface SqlJsStatement {
    run(params?: unknown[]): void;
    free(): void;
}

interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => SqlJsDatabase;
}

// Declare types for window.SQL and initSqlJs
declare global {
    interface Window {
        SQL?: SqlJsStatic;
        initSqlJs?: (config: { locateFile: (file: string) => string }) => Promise<SqlJsStatic>;
    }
}

export interface UseDatabaseReturn {
    sqlReady: boolean;
    loading: boolean;
    error: string | null;
    initSql: () => Promise<boolean>;
    processDB: (file: File, existingTrips?: Trip[], merge?: boolean) => Promise<Trip[] | null>;
    exportDatabase: (trips: Trip[]) => Promise<{ success: boolean; reason?: string; message?: string }>;
    validateFile: (file: File) => boolean;
    setError: (error: string | null) => void;
    isJsonSyncData: (file: File) => Promise<boolean>;
}

/**
 * Custom hook for database operations
 */
export function useDatabase(): UseDatabaseReturn {
    const [sqlReady, setSqlReady] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize SQL.js using browser-ready version from public/assets/sql
    const initSql = useCallback(async () => {
        if (window.SQL) {
            setSqlReady(true);
            return true;
        }

        try {
            // Get the base URL for the application (handles bad subdirectories like /test1/)
            const baseUrl = import.meta.env.BASE_URL;
            const assetsPath = `${baseUrl}assets/sql/`;

            // Load SQL.js from the browser-ready build in public/assets/sql
            // This avoids the npm package which contains Node.js-specific code (fs, path)
            if (!window.initSqlJs) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = `${assetsPath}sql-wasm.min.js`;
                    script.onload = () => resolve(true);
                    script.onerror = () => reject(new Error('Failed to load SQL.js script'));
                    document.head.appendChild(script);
                });
            }

            if (window.initSqlJs) {
                window.SQL = await window.initSqlJs({
                    locateFile: (f: string) => `${assetsPath}${f}`
                });
                setSqlReady(true);
                return true;
            }
            return false;
        } catch (e) {
            setError('Error cargando SQL.js');
            logger.error('SQL.js load error:', e);
            throw e;
        }
    }, []);

    // Check if a JSON file is SyncData format
    const isJsonSyncData = useCallback(async (file: File): Promise<boolean> => {
        if (!file.name.toLowerCase().endsWith('.json')) return false;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            // Check if it has the SyncData structure (trips, charges, or settings)
            return data && typeof data === 'object' &&
                   (Array.isArray(data.trips) || Array.isArray(data.charges) || data.settings);
        } catch {
            return false;
        }
    }, []);

    // Process database file (or CSV or JSON)
    const processDB = useCallback(async (file: File, existingTrips: Trip[] = [], merge: boolean = false): Promise<Trip[] | null> => {
        setLoading(true);
        setError(null);

        try {
            // Handle JSON SyncData Import
            if (file.name.toLowerCase().endsWith('.json')) {
                const text = await file.text();
                const data = JSON.parse(text);

                // Check if it's SyncData format
                if (data && typeof data === 'object' &&
                    (Array.isArray(data.trips) || Array.isArray(data.charges) || data.settings)) {
                    // This is a complete SyncData file - return null to signal special handling
                    // The caller should use importSyncData instead
                    logger.info('Detected JSON SyncData format - should use importSyncData');
                    return null;
                }

                // Otherwise treat as regular JSON trip data
                if (Array.isArray(data)) {
                    return data as Trip[];
                }
                throw new Error('Formato JSON no reconocido');
            }

            // Handle CSV Import
            if (file.name.toLowerCase().endsWith('.csv')) {
                const text = await file.text();
                const lines = text.split(/\r?\n/).filter(l => l.trim());

                if (lines.length < 2) throw new Error('CSV vacío o formato incorrecto');

                const rows = lines.slice(1).map((line, _index) => {
                    // Method from DataProvider.jsx (loadChargeRegistry)
                    // Matches quoted strings OR non-comma sequences
                    const values = line.match(/("[^"]*"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim());

                    if (!values || values.length < 4) {
                        // Try semicolon fallback if comma failed
                        const semiValues = line.match(/("[^"]*"|[^;]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim());
                        if (semiValues && semiValues.length >= 4) {
                            // Use semicolon logic if it looks better
                            return parseTripRow(semiValues);
                        }
                        return null;
                    }

                    return parseTripRow(values);
                }).filter((r): r is Trip => r !== null);

                // Helper to parse a standardized row array
                function parseTripRow(values: string[]): Trip | null {
                    const [inicio, dur, dist, energy] = values;
                    if (!inicio) return null;

                    // Strict Date Parsing (from DataProvider)
                    // Expects YYYY-MM-DD HH:MM specifically
                    const dateMatch = inicio.match(/^(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2})/);

                    if (!dateMatch) {
                        return null;
                    }

                    const dateStr = dateMatch[1]; // "2025-07-13"
                    const timeStr = dateMatch[2]; // "11:42"

                    const [year, month, day] = dateStr.split('-').map(Number);
                    const [hour, minute] = timeStr.split(':').map(Number);

                    // Construct Date object (month is 0-indexed)
                    const dateObj = new Date(year, month - 1, day, hour || 0, minute || 0);
                    const timestamp = Math.floor(dateObj.getTime() / 1000); // Seconds for App compatibility

                    // Fix: Duration in CSV is in minutes (integer), app expects seconds
                    const durationSeconds = (parseInt(dur) || 0) * 60;

                    // Format for App (YYYYMMDD without hyphens, expected by dateUtils)
                    const appDateStr = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
                    const appMonthStr = `${year}${String(month).padStart(2, '0')}`;

                    return {
                        trip: parseFloat(dist) || 0,
                        electricity: parseFloat(energy) || 0,
                        duration: durationSeconds,
                        date: appDateStr,
                        start_timestamp: timestamp,
                        month: appMonthStr,
                        end_timestamp: timestamp + durationSeconds
                    };
                }

                if (rows.length === 0) {
                    toast.error(`CSV leído (${lines.length} líneas) pero 0 filas válidas detectadas. Verifica el formato.`);
                    logger.warn(`CSV Parsing failed. Lines: ${lines.length}, Rows: 0`);
                    return [];
                }

                logger.info(`CSV Parsed: ${rows.length} valid trips.`);

                // Merge Logic (Reused)
                if (merge && existingTrips.length) {
                    const map = new Map<string, Trip>();
                    // Use a unique key for deduplication. Date + Timestamp is good.
                    existingTrips.forEach(t => map.set(`${t.date}-${t.start_timestamp}`, t));
                    rows.forEach(t => map.set(`${t.date}-${t.start_timestamp}`, t));

                    return Array.from(map.values()).sort((a, b) => {
                        const dateComp = (a.date || '').localeCompare(b.date || '');
                        if (dateComp !== 0) return dateComp;
                        return (a.start_timestamp || 0) - (b.start_timestamp || 0);
                    });
                } else {
                    return rows;
                }
            }

            // Handle SQLite Import (Existing Logic)
            if (!window.SQL) {
                setError('SQL no está listo');
                return null;
            }

            const buf = await file.arrayBuffer();
            const db = new window.SQL.Database(new Uint8Array(buf));
            const t = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='EnergyConsumption'");

            if (!t.length || !t[0].values.length) {
                throw new Error('Tabla no encontrada');
            }

            const res = db.exec("SELECT * FROM EnergyConsumption WHERE is_deleted = 0 ORDER BY date, start_timestamp");

            if (res.length && res[0].values.length) {
                const cols = res[0].columns;
                const rows = res[0].values.map((r) => {
                    const o: Record<string, unknown> = {};
                    cols.forEach((c, i) => { o[c] = r[i]; });
                    return o as unknown as Trip;
                });

                db.close();

                if (merge && existingTrips.length) {
                    const map = new Map<string, Trip>();
                    existingTrips.forEach(t => map.set(`${t.date}-${t.start_timestamp}`, t));
                    rows.forEach((t: Trip) => map.set(`${t.date}-${t.start_timestamp}`, t));
                    return Array.from(map.values()).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
                } else {
                    return rows;
                }
            } else {
                throw new Error('Sin datos');
            }
        } catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            const msg = `Error importando: ${error.message}`;
            toast.error(msg);
            setError(error.message);
            logger.error('Database/File processing error:', e);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    // Export database
    const exportDatabase = useCallback(async (trips: Trip[]) => {
        if (!window.SQL || trips.length === 0) {
            return { success: false, reason: 'no_data' };
        }

        try {
            const db = new window.SQL.Database();

            db.run(`
        CREATE TABLE IF NOT EXISTS EnergyConsumption (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trip REAL,
          electricity REAL,
          duration INTEGER,
          date TEXT,
          start_timestamp INTEGER,
          month TEXT,
          is_deleted INTEGER DEFAULT 0
        )
      `);

            const stmt = db.prepare(`
        INSERT INTO EnergyConsumption (trip, electricity, duration, date, start_timestamp, month, is_deleted)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `);

            trips.forEach(trip => {
                stmt.run([
                    trip.trip || 0,
                    trip.electricity || 0,
                    trip.duration || 0,
                    trip.date || '',
                    trip.start_timestamp || 0,
                    trip.month || ''
                ]);
            });
            stmt.free();

            const data = db.export();
            const blob = new Blob([data as any], { type: 'application/x-sqlite3' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `EC_Database_${new Date().toISOString().slice(0, 10)}.db`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            db.close();
            return { success: true };
        } catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            logger.error('Error exporting database:', e);
            return { success: false, reason: 'error', message: error.message };
        }
    }, []);

    // Validate file type
    const validateFile = useCallback((file: File) => {
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.db') && !fileName.endsWith('.jpg') && !fileName.endsWith('.jpeg') &&
            !fileName.endsWith('.csv') && !fileName.endsWith('.json')) {
            return false;
        }
        return true;
    }, []);

    return {
        sqlReady,
        loading,
        error,
        initSql,
        processDB,
        exportDatabase,
        validateFile,
        setError,
        isJsonSyncData
    };
}

export default useDatabase;
