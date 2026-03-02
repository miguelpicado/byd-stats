import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useAutoChargeDetection from '../useAutoChargeDetection';
import toast from 'react-hot-toast';

// Setup Mocks
const mockOpenModal = vi.hoisted(() => vi.fn());
const mockT = vi.hoisted(() => vi.fn((key) => key));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT })
}));

vi.mock('@/providers/ModalProvider', () => ({
    useModalContext: () => ({ openModal: mockOpenModal })
}));

let mockActiveCar = vi.hoisted(() => ({ vin: 'TEST_VIN' }));
vi.mock('@/context/CarContext', () => ({
    useCar: () => ({ activeCar: mockActiveCar })
}));

let mockSettings = vi.hoisted(() => ({
    chargerTypes: [
        { id: 'slow', speedKw: 3.7 },
        { id: 'fast', speedKw: 50 },
        { id: 'rapid', speedKw: 150 }
    ]
}));
vi.mock('@/context/AppContext', () => ({
    useApp: () => ({ settings: mockSettings })
}));

let mockVehicleStatus = vi.hoisted(() => ({ chargingActive: false, lastSoC: 0.1, lastOdometer: 1000 }));
vi.mock('../useVehicleStatus', () => ({
    useVehicleStatus: () => mockVehicleStatus
}));

// Firebase Mocks
const firestoreMocks = vi.hoisted(() => {
    return {
        mockUnsubscribe: vi.fn(),
        mockUpdateDoc: vi.fn().mockResolvedValue(undefined)
    }
});

let snapshotCallback: any = null;

vi.mock('firebase/app', () => ({
    getApp: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    onSnapshot: vi.fn((_q, callback) => {
        snapshotCallback = callback;
        return firestoreMocks.mockUnsubscribe;
    }),
    updateDoc: firestoreMocks.mockUpdateDoc
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    }
}));

describe('useAutoChargeDetection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();

        // Default enabled
        localStorage.setItem('byd_auto_register_charges', 'true');

        // Reset state
        mockActiveCar.vin = 'TEST_VIN';
        mockVehicleStatus.chargingActive = false;
        mockVehicleStatus.lastSoC = 0.1;
        mockVehicleStatus.lastOdometer = 1000;
        snapshotCallback = null;
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('Frontend fallback detection', () => {
        it('does nothing if auto register is disabled', () => {
            localStorage.setItem('byd_auto_register_charges', 'false');

            mockVehicleStatus.chargingActive = true;
            renderHook(() => useAutoChargeDetection());

            expect(localStorage.getItem('byd_current_charge_session')).toBeNull();
            expect(toast.success).not.toHaveBeenCalled();
        });

        it('saves session and shows toast when charging starts', () => {
            const now = 1600000000000;
            vi.spyOn(Date, 'now').mockReturnValue(now);
            mockVehicleStatus.chargingActive = true;
            mockVehicleStatus.lastSoC = 0.2;
            mockVehicleStatus.lastOdometer = 1050;

            renderHook(() => useAutoChargeDetection());

            const session = JSON.parse(localStorage.getItem('byd_current_charge_session') || '{}');
            expect(session).toEqual({
                startTime: now,
                startSoC: 0.2,
                startOdometer: 1050
            });
            expect(toast.success).toHaveBeenCalledWith('charges.autoDetectStart');
        });

        it('clears session when charging stops', () => {
            localStorage.setItem('byd_current_charge_session', JSON.stringify({
                startTime: 1000, startSoC: 0.2, startOdometer: 1050
            }));

            mockVehicleStatus.chargingActive = false;
            mockVehicleStatus.lastSoC = 0.8;
            mockVehicleStatus.lastOdometer = 1050;

            renderHook(() => useAutoChargeDetection());

            expect(localStorage.getItem('byd_current_charge_session')).toBeNull();
        });
    });

    describe('Backend detection listener', () => {
        it('subscribes to autoCharges collection', () => {
            renderHook(() => useAutoChargeDetection());

            // onSnapshot should be called
            expect(snapshotCallback).toBeDefined();
        });

        it('ignores doc changes that are not "added"', () => {
            renderHook(() => useAutoChargeDetection());

            snapshotCallback({
                docChanges: () => [
                    { type: 'modified', doc: { data: () => ({}) } },
                    { type: 'removed', doc: { data: () => ({}) } }
                ]
            });

            expect(mockOpenModal).not.toHaveBeenCalled();
        });

        it('processes new auto charge and pre-fills form', async () => {
            renderHook(() => useAutoChargeDetection());

            const chargeEndTime = new Date('2023-10-15T14:30:00Z');
            const mockDocRef = { id: 'doc123' };

            snapshotCallback({
                docChanges: () => [
                    {
                        type: 'added',
                        doc: {
                            ref: mockDocRef,
                            data: () => ({
                                startSoC: 0.2, // 20%
                                endSoC: 0.8,   // 80%
                                odometer: 1500,
                                kwhCharged: 36,
                                estimatedPowerKw: 45, // Should match 'fast' charger (50kW)
                                endTime: { toMillis: () => chargeEndTime.getTime() }
                            })
                        }
                    }
                ]
            });

            // Check prefill data
            const prefillStr = localStorage.getItem('auto_charge_prefill');
            expect(prefillStr).not.toBeNull();

            const prefill = JSON.parse(prefillStr!);
            expect(prefill.initialPercentage).toBe(20);
            expect(prefill.finalPercentage).toBe(80);
            expect(prefill.odometer).toBe(1500);
            expect(prefill.kwhCharged).toBe(36);
            expect(prefill.chargerTypeId).toBe('fast'); // Matches closest speedKw
            expect(prefill.notes).toBe('charges.autoDetectedNote');

            // Check actions
            expect(mockOpenModal).toHaveBeenCalledWith('addCharge');
            expect(toast.success).toHaveBeenCalledWith('charges.autoDetectEnd');
            expect(firestoreMocks.mockUpdateDoc).toHaveBeenCalledWith(mockDocRef, { status: 'presented' });
        });

        it('selects correct charger type based on estimated power', () => {
            renderHook(() => useAutoChargeDetection());

            // Test 1: Power 6kW -> Should pick slow charger (3.7kW) because it's the fallback 
            // wait, the logic says "candidates.speedKw >= estimatedPower", so for 6kW, "fast" (50) is the lowest candidate
            snapshotCallback({
                docChanges: () => [{
                    type: 'added',
                    doc: {
                        ref: {},
                        data: () => ({ estimatedPowerKw: 6 })
                    }
                }]
            });
            const prefill1 = JSON.parse(localStorage.getItem('auto_charge_prefill')!);
            expect(prefill1.chargerTypeId).toBe('fast');

            // Test 2: Power 120kW -> Should pick rapid (150kW)
            snapshotCallback({
                docChanges: () => [{
                    type: 'added',
                    doc: {
                        ref: {},
                        data: () => ({ estimatedPowerKw: 120 })
                    }
                }]
            });
            const prefill2 = JSON.parse(localStorage.getItem('auto_charge_prefill')!);
            expect(prefill2.chargerTypeId).toBe('rapid');

            // Test 3: Power 3kW -> Should pick slow (3.7kW)
            snapshotCallback({
                docChanges: () => [{
                    type: 'added',
                    doc: {
                        ref: {},
                        data: () => ({ estimatedPowerKw: 3 })
                    }
                }]
            });
            const prefill3 = JSON.parse(localStorage.getItem('auto_charge_prefill')!);
            expect(prefill3.chargerTypeId).toBe('slow');
        });

        it('clears frontend session when backend session is processed to avoid conflicts', () => {
            localStorage.setItem('byd_current_charge_session', '{"some":"data"}');
            renderHook(() => useAutoChargeDetection());

            snapshotCallback({
                docChanges: () => [{
                    type: 'added',
                    doc: { ref: {}, data: () => ({}) }
                }]
            });

            expect(localStorage.getItem('byd_current_charge_session')).toBeNull();
        });
    });
});
