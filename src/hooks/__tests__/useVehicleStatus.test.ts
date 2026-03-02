import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVehicleStatus, getStatusId } from '../useVehicleStatus';
import { logger } from '@core/logger';

// Mock context to return isNative=true by default
let isNativeMock = true;
vi.mock('@/context/LayoutContext', () => ({
    useLayout: () => ({ isNative: isNativeMock })
}));

// Mock logger
vi.mock('@core/logger', () => ({
    logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

// Mock Firebase
let mockOnSnapshotCallback: any = null;
const mockUnsubscribe = vi.fn();

vi.mock('firebase/app', () => ({
    getApp: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(),
    doc: vi.fn(),
    onSnapshot: vi.fn((_ref, callback, _errorCallback) => {
        mockOnSnapshotCallback = callback;
        return mockUnsubscribe;
    }),
    Timestamp: {
        now: vi.fn(() => ({ toMillis: () => Date.now() }))
    }
}));

import { onSnapshot } from 'firebase/firestore';

describe('useVehicleStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockOnSnapshotCallback = null;
        isNativeMock = true; // reset
    });

    afterEach(() => {
        // cleanup rendered hooks if necessary (RTL does it automatically)
    });

    it('subscribes to Firestore when enabled=true and VIN provided and isNative=true', () => {
        renderHook(() => useVehicleStatus('test_vin'));

        expect(onSnapshot).toHaveBeenCalled();
    });

    it('does NOT subscribe when enabled=false', () => {
        renderHook(() => useVehicleStatus('test_vin', { enabled: false }));

        expect(onSnapshot).not.toHaveBeenCalled();
    });

    it('does NOT subscribe when VIN is empty', () => {
        renderHook(() => useVehicleStatus(''));

        expect(onSnapshot).not.toHaveBeenCalled();
    });

    it('does NOT subscribe when isNative is false', () => {
        isNativeMock = false;
        renderHook(() => useVehicleStatus('test_vin'));

        expect(onSnapshot).not.toHaveBeenCalled();
    });

    it('returns null vehicleData initially', () => {
        const { result } = renderHook(() => useVehicleStatus('test_vin'));

        expect(result.current).toBeNull();
    });

    it('updates vehicleData on snapshot', () => {
        const { result } = renderHook(() => useVehicleStatus('test_vin'));

        const mockData = { lastSoC: 50, isLocked: true };

        act(() => {
            if (mockOnSnapshotCallback) {
                mockOnSnapshotCallback({
                    exists: () => true,
                    data: () => mockData
                });
            }
        });

        expect(result.current).toEqual(mockData);
    });

    it('detects deep sleep and preserves previous location', () => {
        const { result } = renderHook(() => useVehicleStatus('test_vin'));

        // Setup initial valid state
        const validState = {
            lastLocation: { lat: 40.4168, lon: -3.7038 }
        };

        act(() => {
            if (mockOnSnapshotCallback) {
                mockOnSnapshotCallback({
                    exists: () => true,
                    data: () => validState
                });
            }
        });

        expect(result.current?.lastLocation?.lat).toBe(40.4168);

        // Deep sleep state arrives (0,0)
        const deepSleepState = {
            lastLocation: { lat: 0, lon: 0 }
        };

        act(() => {
            if (mockOnSnapshotCallback) {
                mockOnSnapshotCallback({
                    exists: () => true,
                    data: () => deepSleepState
                });
            }
        });

        // Location should be preserved
        expect(result.current?.lastLocation?.lat).toBe(40.4168);
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Keeping last valid location'));
    });

    it('detects deep sleep and preserves previous tire pressure', () => {
        const { result } = renderHook(() => useVehicleStatus('test_vin'));

        // Setup initial valid state
        const validState = {
            tirePressure: { frontLeft: 2.5, frontRight: 2.5, rearLeft: 2.5, rearRight: 2.5 }
        };

        act(() => {
            if (mockOnSnapshotCallback) {
                mockOnSnapshotCallback({
                    exists: () => true,
                    data: () => validState
                });
            }
        });

        expect(result.current?.tirePressure?.frontLeft).toBe(2.5);

        // Deep sleep state arrives (all 0s)
        const deepSleepState = {
            tirePressure: { frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0 }
        };

        act(() => {
            if (mockOnSnapshotCallback) {
                mockOnSnapshotCallback({
                    exists: () => true,
                    data: () => deepSleepState
                });
            }
        });

        // Tire pressure should be preserved
        expect(result.current?.tirePressure?.frontLeft).toBe(2.5);
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Keeping last valid tire pressure'));
    });

    it('unsubscribes on unmount', () => {
        const { unmount } = renderHook(() => useVehicleStatus('test_vin'));

        unmount();

        expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('sets null when document does not exist', () => {
        const { result } = renderHook(() => useVehicleStatus('test_vin'));

        act(() => {
            if (mockOnSnapshotCallback) {
                mockOnSnapshotCallback({
                    exists: () => true,
                    data: () => ({ lastSoC: 50 })
                });
            }
        });

        expect(result.current?.lastSoC).toBe(50);

        // Document deleted
        act(() => {
            if (mockOnSnapshotCallback) {
                mockOnSnapshotCallback({
                    exists: () => false
                });
            }
        });

        expect(result.current).toBeNull();
    });

    describe('getStatusId', () => {
        it('returns VIN from car object', () => {
            const car = { vin: '1234567890', name: 'My BYD' };
            expect(getStatusId(car)).toBe('1234567890');
        });

        it('returns undefined if car is null or missing VIN', () => {
            expect(getStatusId(null)).toBeUndefined();
            expect(getStatusId({ name: 'My BYD' })).toBeUndefined();
        });
    });
});
