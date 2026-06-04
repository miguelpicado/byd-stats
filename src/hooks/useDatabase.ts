// BYD Stats - useDatabase Hook

import { useState, useCallback } from 'react';
import { logger } from '@core/logger';
import { toast } from 'react-hot-toast';
import { Trip } from '@/types';
import { parseCsvTrips, mergeTrips } from '@/services/CsvImportService';
import { readFileAsText, readFileAsArrayBuffer } from '@/utils/fileReader';

// Declare types for window.SQL and initSqlJs
declare global {
    interface Window {
        SQL?: any;
        initSqlJs?: (config: any) => Promise<any>;
    }
}

interface UseDatabaseReturn {
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

    // Process database file (or CSV)
    const processDB = useCallback(async (file: File, existingTrips: Trip[] = [], merge: boolean = false): Promise<Trip[] | null> => {
        setLoading(true);
        setError(null);

        try {
            // Handle CSV Import
            if (file.name.toLowerCase().endsWith('.csv')) {
                const text = await readFileAsText(file);
                const { trips: rows, lineCount } = parseCsvTrips(text);

                if (rows.length === 0) {
                    toast.error(`CSV leído (${lineCount} líneas) pero 0 filas válidas detectadas. Verifica el formato.`);
                    logger.warn(`CSV Parsing failed. Lines: ${lineCount}, Rows: 0`);
                    return [];
                }

                logger.info(`CSV Parsed: ${rows.length} valid trips.`);
                return merge && existingTrips.length ? mergeTrips(existingTrips, rows) : rows;
            }

            // Handle SQLite Import (Existing Logic)
            if (!window.SQL) {
                setError('SQL no está listo');
                return null;
            }

            const buf = await readFileAsArrayBuffer(file);
            const db = new window.SQL.Database(new Uint8Array(buf));
            const t = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='EnergyConsumption'");

            if (!t.length || !t[0].values.length) {
                throw new Error('Tabla no encontrada');
            }

            // Check if is_deleted column exists to support databases directly from the car
            const tableInfo = db.exec("PRAGMA table_info(EnergyConsumption)");
            let hasIsDeleted = false;
            if (tableInfo.length && tableInfo[0].values) {
                hasIsDeleted = tableInfo[0].values.some((col: any[]) => col[1] === 'is_deleted');
            }

            const query = hasIsDeleted
                ? "SELECT * FROM EnergyConsumption WHERE is_deleted = 0 ORDER BY date, start_timestamp"
                : "SELECT * FROM EnergyConsumption ORDER BY date, start_timestamp";

            const res = db.exec(query);

            if (res.length && res[0].values.length) {
                const cols = res[0].columns;
                const rows = res[0].values.map((r: any[]) => {
                    const o: any = {};
                    cols.forEach((c: string, i: number) => { o[c] = r[i]; });
                    return o as Trip;
                });

                db.close();
                return merge && existingTrips.length ? mergeTrips(existingTrips, rows as Trip[]) : rows as Trip[];
            } else {
                throw new Error('Sin datos');
            }
        } catch (e: any) {
            const msg = `Error importando: ${e.message}`;
            toast.error(msg);
            setError(e.message);
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
            const blob = new Blob([data], { type: 'application/x-sqlite3' });
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
        } catch (e: any) {
            logger.error('Error exporting database:', e);
            return { success: false, reason: 'error', message: e.message };
        }
    }, []);

    // Check if JSON file is BYD Stats sync data
    const isJsonSyncData = useCallback(async (file: File): Promise<boolean> => {
        try {
            const text = await readFileAsText(file);
            const data = JSON.parse(text);
            return data && typeof data === 'object' && 'trips' in data && 'charges' in data && 'settings' in data;
        } catch {
            return false;
        }
    }, []);

    // Validate file type
    const validateFile = useCallback((file: File) => {
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.db') && !fileName.endsWith('.jpg') && !fileName.endsWith('.jpeg') && !fileName.endsWith('.csv')) {
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
