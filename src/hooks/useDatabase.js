// BYD Stats - useDatabase Hook

import { useState, useCallback } from 'react';
import { logger } from '@utils/logger';

/**
 * Custom hook for database operations
 * @returns {Object} Database operation functions and state
 */
export function useDatabase() {
    const [sqlReady, setSqlReady] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Initialize SQL.js using browser-ready version from public/assets/sql
    const initSql = useCallback(async () => {
        if (window.SQL) {
            setSqlReady(true);
            return true;
        }

        try {
            // Load SQL.js from the browser-ready build in public/assets/sql
            // This avoids the npm package which contains Node.js-specific code (fs, path)
            if (!window.initSqlJs) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = '/assets/sql/sql-wasm.min.js';
                    script.onload = resolve;
                    script.onerror = () => reject(new Error('Failed to load SQL.js script'));
                    document.head.appendChild(script);
                });
            }

            window.SQL = await window.initSqlJs({
                locateFile: f => `/assets/sql/${f}`
            });
            setSqlReady(true);
            return true;
        } catch (e) {
            setError('Error cargando SQL.js');
            logger.error('SQL.js load error:', e);
            throw e;
        }
    }, []);

    // Process database file
    const processDB = useCallback(async (file, existingTrips = [], merge = false) => {
        if (!window.SQL) {
            setError('SQL no está listo');
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const buf = await file.arrayBuffer();
            const db = new window.SQL.Database(new Uint8Array(buf));
            const t = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='EnergyConsumption'");

            if (!t.length || !t[0].values.length) {
                throw new Error('Tabla no encontrada');
            }

            const res = db.exec("SELECT * FROM EnergyConsumption WHERE is_deleted = 0 ORDER BY date, start_timestamp");

            if (res.length && res[0].values.length) {
                const cols = res[0].columns;
                const rows = res[0].values.map(r => {
                    const o = {};
                    cols.forEach((c, i) => { o[c] = r[i]; });
                    return o;
                });

                db.close();

                if (merge && existingTrips.length) {
                    const map = new Map();
                    existingTrips.forEach(t => map.set(t.date + '-' + t.start_timestamp, t));
                    rows.forEach(t => map.set(t.date + '-' + t.start_timestamp, t));
                    return Array.from(map.values()).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
                } else {
                    return rows;
                }
            } else {
                throw new Error('Sin datos');
            }
        } catch (e) {
            setError(e.message);
            logger.error('Database processing error:', e);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    // Export database
    const exportDatabase = useCallback(async (trips) => {
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
        } catch (e) {
            logger.error('Error exporting database:', e);
            return { success: false, reason: 'error', message: e.message };
        }
    }, []);

    // Validate file type
    const validateFile = useCallback((file) => {
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.db') && !fileName.endsWith('.jpg') && !fileName.endsWith('.jpeg')) {
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
        setError
    };
}

export default useDatabase;
