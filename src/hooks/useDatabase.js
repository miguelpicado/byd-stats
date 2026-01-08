// BYD Stats - useDatabase Hook

import { useState, useCallback } from 'react';

/**
 * Custom hook for database operations
 * @returns {Object} Database operation functions and state
 */
export function useDatabase() {
    const [sqlReady, setSqlReady] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Initialize SQL.js
    const initSql = useCallback(async () => {
        return new Promise((resolve, reject) => {
            const sc = document.createElement('script');
            sc.src = '/assets/sql/sql-wasm.min.js';
            sc.onload = async () => {
                try {
                    window.SQL = await window.initSqlJs({
                        locateFile: f => `/assets/sql/${f}`
                    });
                    setSqlReady(true);
                    resolve(true);
                } catch (e) {
                    setError('Error cargando SQL.js');
                    console.error('SQL.js load error:', e);
                    reject(e);
                }
            };
            sc.onerror = () => {
                setError('Error cargando SQL.js');
                reject(new Error('Failed to load SQL.js'));
            };
            document.head.appendChild(sc);
        });
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
                    setLoading(false);
                    return Array.from(map.values()).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
                } else {
                    setLoading(false);
                    return rows;
                }
            } else {
                throw new Error('Sin datos');
            }
        } catch (e) {
            setError(e.message);
            console.error('Database processing error:', e);
            setLoading(false);
            return null;
        }
    }, []);

    // Export database
    const exportDatabase = useCallback(async (trips) => {
        if (!window.SQL || trips.length === 0) {
            alert('No hay datos para exportar');
            return false;
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
            return true;
        } catch (e) {
            console.error('Error exporting database:', e);
            alert('Error al exportar la base de datos: ' + e.message);
            return false;
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
