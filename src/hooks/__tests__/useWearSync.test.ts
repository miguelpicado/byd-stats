import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useWearSync from '../useWearSync';
import { Capacitor } from '@capacitor/core';
import { toast } from 'react-hot-toast';
import * as bydApi from '@/services/bydApi';

// 1. Mock Capacitor and Plugins before any imports
const mocker = vi.hoisted(() => {
    return {
        mockAddListener: vi.fn(),
        mockSyncVehicleData: vi.fn()
    }
});
const { mockAddListener, mockSyncVehicleData } = mocker;
mockAddListener.mockResolvedValue({ remove: vi.fn() });
mockSyncVehicleData.mockResolvedValue({ success: true });

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: vi.fn(() => true)
    },
    registerPlugin: vi.fn(() => ({
        addListener: mocker.mockAddListener,
        syncVehicleData: mocker.mockSyncVehicleData
    }))
}));

// 2. Mock all hooks used by useWearSync
let mockActiveCar: any = { vin: 'TEST_VIN' };
vi.mock('@/context/CarContext', () => ({
    useCar: () => ({ activeCar: mockActiveCar })
}));

let mockVehicleStatus: any = {
    lastSoC: 0.5, // 50%
    climateActive: false
};
vi.mock('@/hooks/useVehicleStatus', () => ({
    useVehicleStatus: () => mockVehicleStatus
}));

let mockData: any = {
    stats: { summary: { estimatedRange: 400 } }
};
vi.mock('@/providers/DataProvider', () => ({
    useData: () => mockData
}));

let mockIsNative = true;
vi.mock('@/context/LayoutContext', () => ({
    useLayout: () => ({ isNative: mockIsNative })
}));

// 3. Mock APIs and Toast
vi.mock('@/services/bydApi', () => ({
    bydUnlock: vi.fn().mockResolvedValue({ success: true }),
    bydFlashLights: vi.fn().mockResolvedValue({ success: true }),
    bydStartClimate: vi.fn().mockResolvedValue({ success: true }),
    bydStopClimate: vi.fn().mockResolvedValue({ success: true }),
    bydWakeVehicle: vi.fn().mockResolvedValue({ success: true })
}));

vi.mock('react-hot-toast', () => ({
    toast: {
        loading: vi.fn(() => 'toast-id'),
        success: vi.fn(),
        error: vi.fn()
    }
}));

describe('useWearSync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        // Reset defaults
        mockActiveCar = { vin: 'TEST_VIN' };
        mockVehicleStatus = { lastSoC: 0.5, climateActive: false };
        mockData = { stats: { summary: { estimatedRange: 400 } } };
        mockIsNative = true;
        (Capacitor.isNativePlatform as any).mockReturnValue(true);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('no-ops entirely on non-native platform (PWA)', () => {
        (Capacitor.isNativePlatform as any).mockReturnValue(false);
        mockIsNative = false;

        renderHook(() => useWearSync());

        expect(mockAddListener).not.toHaveBeenCalled();
        expect(mockSyncVehicleData).not.toHaveBeenCalled();
    });

    it('registers action listener on native platform', () => {
        renderHook(() => useWearSync());

        expect(mockAddListener).toHaveBeenCalledWith('onWatchAction', expect.any(Function));
    });

    it('normalizes SoC from decimal to percent (0.5 → 50)', async () => {
        renderHook(() => useWearSync());

        // Fast forward the 2s debounce timer
        vi.runAllTimers();

        // estimatedRange 400 * 50% = 200 rangeKm
        expect(mockSyncVehicleData).toHaveBeenCalledWith({
            rangeKm: 200,
            soc: 50,
            vin: 'TEST_VIN',
            climateActive: false
        });
    });

    it('debounces wear data sync with 2s timeout', () => {
        const { rerender } = renderHook(() => useWearSync());

        // Initial sync scheduled...

        // Modify status simulating rapid updates
        mockVehicleStatus = { lastSoC: 0.51, climateActive: false };
        rerender();
        mockVehicleStatus = { lastSoC: 0.52, climateActive: false };
        rerender();

        // Advance time but not enough
        vi.advanceTimersByTime(1000);
        expect(mockSyncVehicleData).not.toHaveBeenCalled();

        // Advance remaining time
        vi.advanceTimersByTime(1000);

        // Should only be called once with latest values
        expect(mockSyncVehicleData).toHaveBeenCalledTimes(1);
        expect(mockSyncVehicleData).toHaveBeenCalledWith({
            rangeKm: 208, // 400 * 0.52
            soc: 52,
            vin: 'TEST_VIN',
            climateActive: false
        });
    });

    describe('Watch Actions Handling', () => {
        let actionCallback: (data: { action: string }) => void;

        beforeEach(() => {
            mockAddListener.mockImplementation((event, cb) => {
                if (event === 'onWatchAction') actionCallback = cb;
                return Promise.resolve({ remove: vi.fn() });
            });
            renderHook(() => useWearSync());
        });

        it('dispatches unlock action to BYD API', async () => {
            await actionCallback({ action: 'unlock' });
            expect(toast.loading).toHaveBeenCalledWith('Abriendo coche...');
            expect(bydApi.bydUnlock).toHaveBeenCalledWith('TEST_VIN');

            // Wait for internal promise resolution
            await Promise.resolve();
            expect(toast.success).toHaveBeenCalledWith('Abriendo coche OK', { id: 'toast-id' });
        });

        it('dispatches flash action to BYD API', async () => {
            await actionCallback({ action: 'flash' });
            expect(bydApi.bydFlashLights).toHaveBeenCalledWith('TEST_VIN');
        });

        it('starts climate if currently off', async () => {
            mockVehicleStatus.climateActive = false; // Need to ensure it reads current ref
            await actionCallback({ action: 'climate' });
            expect(bydApi.bydStartClimate).toHaveBeenCalledWith('TEST_VIN', 21);
        });

        it('stops climate if currently on', async () => {
            // Re-render hook with climate on so the internal ref catches it
            mockVehicleStatus = { lastSoC: 0.5, climateActive: true };
            renderHook(() => useWearSync());

            await actionCallback({ action: 'climate' });
            expect(bydApi.bydStopClimate).toHaveBeenCalledWith('TEST_VIN');
        });

        it('shows error toast on action failure', async () => {
            (bydApi.bydUnlock as any).mockResolvedValueOnce({ success: false, message: 'API limits' });

            await actionCallback({ action: 'unlock' });

            await Promise.resolve();
            expect(toast.error).toHaveBeenCalledWith('Fallo: API limits', { id: 'toast-id' });
        });
    });
});
