/**
 * Tests for ModalProvider
 *
 * Strategy:
 * - ModalProvider wraps useModalState() which manages all modal booleans and
 *   associated data (selectedTrip, selectedCharge, editingCharge)
 * - window.history.pushState / back are mocked to avoid side effects
 * - Test: initial state, openModal, closeModal, toggleModal, closeAllModals,
 *   isAnyModalOpen, selectedTrip/Charge, guard hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { ModalProvider, useModalContext } from '../ModalProvider';
import type { Trip, Charge } from '@/types';

// ─── Mock window.history to avoid navigation side-effects ────────────────────

beforeEach(() => {
    vi.spyOn(window.history, 'pushState').mockImplementation(() => undefined);
    vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    Object.defineProperty(window, 'location', {
        value: { hash: '' },
        writable: true,
        configurable: true,
    });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ModalProvider>{children}</ModalProvider>
);

const makeTrip = (overrides: Partial<Trip> = {}): Trip => ({
    id: 'trip-1',
    date: '2024-03-01',
    distance: 100,
    start_timestamp: 1000,
    end_timestamp: 2000,
    ...overrides,
} as Trip);

const makeCharge = (overrides: Partial<Charge> = {}): Charge => ({
    id: 'charge-1',
    date: '2024-03-01',
    time: '10:00',
    kwhCharged: 40,
    totalCost: 8,
    pricePerKwh: 0.2,
    chargerTypeId: 'home',
    timestamp: new Date('2024-03-01T10:00').getTime(),
    ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ModalProvider', () => {
    // ─── Guard hook ──────────────────────────────────────────────────────────

    describe('useModalContext guard', () => {
        it('throws when used outside ModalProvider', () => {
            const { result } = renderHook(() => {
                try {
                    return useModalContext();
                } catch (e) {
                    return e;
                }
            });
            expect(result.current).toBeInstanceOf(Error);
            expect((result.current as Error).message).toContain('ModalProvider');
        });
    });

    // ─── Initial state ───────────────────────────────────────────────────────

    describe('initial state', () => {
        it('all boolean modals start as false', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });
            const { modals } = result.current;

            expect(modals.upload).toBe(false);
            expect(modals.filter).toBe(false);
            expect(modals.settings).toBe(false);
            expect(modals.help).toBe(false);
            expect(modals.addCharge).toBe(false);
            expect(modals.tripDetail).toBe(false);
            expect(modals.chargeDetail).toBe(false);
            expect(modals.backups).toBe(false);
            expect(modals.legal).toBe(false);
        });

        it('isAnyModalOpen is false initially', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });
            expect(result.current.isAnyModalOpen).toBe(false);
        });

        it('selectedTrip and selectedCharge start as null/undefined', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });
            expect(result.current.selectedTrip).toBeNull();
            expect(result.current.selectedCharge).toBeNull();
        });

        it('editingCharge starts as null', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });
            expect(result.current.editingCharge).toBeNull();
        });

        it('exposes required functions', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });
            expect(typeof result.current.openModal).toBe('function');
            expect(typeof result.current.closeModal).toBe('function');
            expect(typeof result.current.toggleModal).toBe('function');
            expect(typeof result.current.closeAllModals).toBe('function');
        });
    });

    // ─── openModal ───────────────────────────────────────────────────────────

    describe('openModal', () => {
        it('sets the target modal to true', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });

            act(() => { result.current.openModal('settings'); });

            expect(result.current.modals.settings).toBe(true);
        });

        it('does not open other modals', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });

            act(() => { result.current.openModal('help'); });

            expect(result.current.modals.settings).toBe(false);
            expect(result.current.modals.filter).toBe(false);
        });

        it('isAnyModalOpen becomes true when a modal is opened', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });

            act(() => { result.current.openModal('upload'); });

            expect(result.current.isAnyModalOpen).toBe(true);
        });

        it('can open multiple modals', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });

            act(() => {
                result.current.openModal('settings');
                result.current.openModal('filter');
            });

            expect(result.current.modals.settings).toBe(true);
            expect(result.current.modals.filter).toBe(true);
        });
    });

    // ─── closeModal ──────────────────────────────────────────────────────────

    describe('closeModal', () => {
        it('sets the target modal to false', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });

            act(() => { result.current.openModal('settings'); });
            expect(result.current.modals.settings).toBe(true);

            act(() => { result.current.closeModal('settings'); });
            expect(result.current.modals.settings).toBe(false);
        });

        it('is a no-op when the modal is already closed', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });

            act(() => { result.current.closeModal('help'); });

            expect(result.current.modals.help).toBe(false);
        });

        it('isAnyModalOpen becomes false when the last open modal is closed', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });

            act(() => { result.current.openModal('filter'); });
            expect(result.current.isAnyModalOpen).toBe(true);

            act(() => { result.current.closeModal('filter'); });
            expect(result.current.isAnyModalOpen).toBe(false);
        });

        it('does not close other modals', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });

            act(() => {
                result.current.openModal('settings');
                result.current.openModal('filter');
            });

            act(() => { result.current.closeModal('settings'); });

            expect(result.current.modals.settings).toBe(false);
            expect(result.current.modals.filter).toBe(true);
        });
    });

    // ─── toggleModal ─────────────────────────────────────────────────────────

    describe('toggleModal', () => {
        it('opens a closed modal', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });

            act(() => { result.current.toggleModal('help'); });

            expect(result.current.modals.help).toBe(true);
        });

        it('closes an open modal', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });

            act(() => { result.current.openModal('help'); });
            act(() => { result.current.toggleModal('help'); });

            expect(result.current.modals.help).toBe(false);
        });

        it('double-toggle returns to original state', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });

            act(() => { result.current.toggleModal('backups'); });
            act(() => { result.current.toggleModal('backups'); });

            expect(result.current.modals.backups).toBe(false);
        });
    });

    // ─── closeAllModals ──────────────────────────────────────────────────────

    describe('closeAllModals', () => {
        it('closes all open modals at once', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });

            act(() => {
                result.current.openModal('settings');
                result.current.openModal('filter');
                result.current.openModal('help');
            });
            expect(result.current.isAnyModalOpen).toBe(true);

            act(() => { result.current.closeAllModals(); });

            expect(result.current.modals.settings).toBe(false);
            expect(result.current.modals.filter).toBe(false);
            expect(result.current.modals.help).toBe(false);
            expect(result.current.isAnyModalOpen).toBe(false);
        });

        it('is a no-op when no modals are open', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });

            act(() => { result.current.closeAllModals(); });

            expect(result.current.isAnyModalOpen).toBe(false);
        });
    });

    // ─── Selected items ──────────────────────────────────────────────────────

    describe('selectedTrip', () => {
        it('setSelectedTrip stores the trip', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });
            const trip = makeTrip({ id: 'trip-xyz' });

            act(() => { result.current.setSelectedTrip(trip); });

            expect(result.current.selectedTrip?.id).toBe('trip-xyz');
        });

        it('setSelectedTrip can be cleared to null', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });

            act(() => { result.current.setSelectedTrip(makeTrip()); });
            act(() => { result.current.setSelectedTrip(null); });

            expect(result.current.selectedTrip).toBeNull();
        });
    });

    describe('selectedCharge', () => {
        it('setSelectedCharge stores the charge', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });
            const charge = makeCharge({ id: 'charge-xyz' });

            act(() => { result.current.setSelectedCharge(charge); });

            expect(result.current.selectedCharge?.id).toBe('charge-xyz');
        });

        it('setSelectedCharge can be cleared to null', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });

            act(() => { result.current.setSelectedCharge(makeCharge()); });
            act(() => { result.current.setSelectedCharge(null); });

            expect(result.current.selectedCharge).toBeNull();
        });
    });

    describe('editingCharge', () => {
        it('setEditingCharge stores the charge being edited', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });
            const charge = makeCharge({ id: 'edit-me' });

            act(() => { result.current.setEditingCharge(charge); });

            expect(result.current.editingCharge?.id).toBe('edit-me');
        });

        it('setEditingCharge can be cleared to null', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });

            act(() => { result.current.setEditingCharge(makeCharge()); });
            act(() => { result.current.setEditingCharge(null); });

            expect(result.current.editingCharge).toBeNull();
        });
    });

    // ─── Edge cases ──────────────────────────────────────────────────────────

    describe('edge cases', () => {
        it('opening an already-open modal is idempotent', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });

            act(() => { result.current.openModal('settings'); });
            act(() => { result.current.openModal('settings'); });

            expect(result.current.modals.settings).toBe(true);
            expect(result.current.isAnyModalOpen).toBe(true);
        });

        it('closing a never-opened modal does not crash', () => {
            const { result } = renderHook(() => useModalContext(), { wrapper });

            expect(() => {
                act(() => { result.current.closeModal('upload'); });
            }).not.toThrow();
        });
    });
});
