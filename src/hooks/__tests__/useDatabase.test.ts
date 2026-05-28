// BYD Stats - useDatabase Hook Tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useDatabase from '../useDatabase';
import { logger } from '@core/logger';

// Mock dependencies
vi.mock('react-hot-toast', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    }
}));

vi.mock('@core/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    }
}));

// Polyfill Blob.prototype.arrayBuffer for JSDOM
if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = async function (this: Blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve(reader.result as ArrayBuffer);
            };
            reader.readAsArrayBuffer(this);
        });
    };
}

describe('useDatabase Hook', () => {
    let mockExec: any;

    beforeEach(() => {
        vi.clearAllMocks();
        delete (window as any).SQL;
        delete (window as any).initSqlJs;

        mockExec = vi.fn();
        
        // Use regular function so it can be called as a constructor with 'new'
        const mockDatabase = vi.fn().mockImplementation(function (this: any) {
            this.exec = mockExec;
            this.close = vi.fn();
        });

        (window as any).SQL = {
            Database: mockDatabase
        };
    });

    it('should initialize successfully when initSqlJs is available', async () => {
        const mockInitSqlJs = vi.fn().mockResolvedValue({
            Database: vi.fn()
        });
        (window as any).initSqlJs = mockInitSqlJs;

        const { result } = renderHook(() => useDatabase());
        
        let success;
        await act(async () => {
            success = await result.current.initSql();
        });

        expect(success).toBe(true);
        expect(result.current.sqlReady).toBe(true);
    });

    it('should parse database successfully with is_deleted column', async () => {
        // Mock table check (returns EnergyConsumption)
        mockExec.mockImplementation((query: string) => {
            if (query.includes('sqlite_master')) {
                return [{ values: [['EnergyConsumption']] }];
            }
            if (query.includes('PRAGMA table_info')) {
                return [{
                    values: [
                        [0, 'trip', 'REAL'],
                        [1, 'electricity', 'REAL'],
                        [2, 'is_deleted', 'INTEGER']
                    ]
                }];
            }
            if (query.includes('SELECT * FROM EnergyConsumption')) {
                return [{
                    columns: ['trip', 'electricity', 'date', 'start_timestamp'],
                    values: [[10.5, 1.2, '2025-01-01', 1704067200]]
                }];
            }
            return [];
        });

        const { result } = renderHook(() => useDatabase());
        
        let trips;
        await act(async () => {
            const file = new File([new ArrayBuffer(100)], 'EC_Database.db');
            trips = await result.current.processDB(file);
        });

        if (trips === null) {
            console.log('logger.error calls:', (logger.error as any).mock.calls);
        }

        expect(trips).not.toBeNull();
        expect(trips).toHaveLength(1);
        expect(trips[0]).toEqual({
            trip: 10.5,
            electricity: 1.2,
            date: '2025-01-01',
            start_timestamp: 1704067200
        });
        // Check that the query used is_deleted = 0
        expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('is_deleted = 0'));
    });

    it('should parse database successfully without is_deleted column (fallback)', async () => {
        // Mock table check (returns EnergyConsumption)
        mockExec.mockImplementation((query: string) => {
            if (query.includes('sqlite_master')) {
                return [{ values: [['EnergyConsumption']] }];
            }
            if (query.includes('PRAGMA table_info')) {
                // Returns columns without is_deleted (as natively exported from the car)
                return [{
                    values: [
                        [0, 'trip', 'REAL'],
                        [1, 'electricity', 'REAL']
                    ]
                }];
            }
            if (query.includes('SELECT * FROM EnergyConsumption')) {
                return [{
                    columns: ['trip', 'electricity', 'date', 'start_timestamp'],
                    values: [[10.5, 1.2, '2025-01-01', 1704067200]]
                }];
            }
            return [];
        });

        const { result } = renderHook(() => useDatabase());
        
        let trips;
        await act(async () => {
            const file = new File([new ArrayBuffer(100)], 'EC_Database.db');
            trips = await result.current.processDB(file);
        });

        if (trips === null) {
            console.log('logger.error calls:', (logger.error as any).mock.calls);
        }

        expect(trips).not.toBeNull();
        expect(trips).toHaveLength(1);
        expect(trips[0]).toEqual({
            trip: 10.5,
            electricity: 1.2,
            date: '2025-01-01',
            start_timestamp: 1704067200
        });
        // Check that the query did NOT use is_deleted
        expect(mockExec).not.toHaveBeenCalledWith(expect.stringContaining('is_deleted = 0'));
        expect(mockExec).toHaveBeenCalledWith("SELECT * FROM EnergyConsumption ORDER BY date, start_timestamp");
    });
});
