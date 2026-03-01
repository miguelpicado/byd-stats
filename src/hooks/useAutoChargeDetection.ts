/**
 * Auto Charge Detection Hook
 *
 * Two-pronged approach:
 * 1. Backend-driven (primary): Listens to `autoCharges` subcollection written by
 *    cloudProbeVehicle when charging→idle transition is detected. Survives app restarts.
 * 2. Frontend-driven (fallback): Monitors `chargingActive` transitions in vehicleStatus.
 *    Uses localStorage to persist the active session across restarts.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getFirestore, collection, query, where, orderBy, limit, onSnapshot, updateDoc } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { useVehicleStatus } from './useVehicleStatus';
import { useCar } from '@/context/CarContext';
import { useApp } from '@/context/AppContext';
import { useModalContext } from '@/providers/ModalProvider';
import toast from 'react-hot-toast';

interface ChargeSession {
    startTime: number;
    startSoC: number;
    startOdometer: number;
}

const SESSION_STORAGE_KEY = 'byd_current_charge_session';

function saveSession(session: ChargeSession | null) {
    if (session) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
    }
}

function loadSession(): ChargeSession | null {
    try {
        const saved = localStorage.getItem(SESSION_STORAGE_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch {
        return null;
    }
}

function isEnabled(): boolean {
    return localStorage.getItem('byd_auto_register_charges') === 'true';
}

export function useAutoChargeDetection() {
    const { t } = useTranslation();
    const { activeCar } = useCar();
    const { settings } = useApp();
    const { openModal } = useModalContext();
    const vehicleStatus = useVehicleStatus(activeCar?.vin);

    // -------------------------------------------------------------------------
    // PRIMARY: Listen to backend-recorded autoCharges (survives app restarts)
    // -------------------------------------------------------------------------
    useEffect(() => {
        const vin = activeCar?.vin;
        if (!vin || !isEnabled()) return;

        const db = getFirestore(getApp());
        const autoChargesRef = collection(db, 'bydVehicles', vin, 'autoCharges');
        const q = query(
            autoChargesRef,
            where('status', '==', 'pending_review'),
            orderBy('createdAt', 'desc'),
            limit(1)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type !== 'added') return;

                const data = change.doc.data();
                const chargerTypes = settings?.chargerTypes || [];

                // Estimate best matching charger type: smallest speedKw >= estimatedPowerKw
                const estimatedPower: number = data.estimatedPowerKw || 0;
                let matchedChargerTypeId = chargerTypes[0]?.id || '';
                if (estimatedPower > 0 && chargerTypes.length > 0) {
                    const candidates = chargerTypes
                        .filter((ct: any) => ct.speedKw >= estimatedPower)
                        .sort((a: any, b: any) => a.speedKw - b.speedKw);
                    if (candidates.length > 0) {
                        matchedChargerTypeId = candidates[0].id;
                    }
                }

                const endTimeMs: number = data.endTime?.toMillis?.() ?? Date.now();
                const endDate = new Date(endTimeMs);

                const prefilledData = {
                    type: 'electric' as const,
                    date: endDate.toISOString().split('T')[0],
                    time: endDate.toTimeString().slice(0, 5),
                    odometer: data.odometer || '',
                    initialPercentage: Math.round((data.startSoC || 0) * 100),
                    finalPercentage: Math.round((data.endSoC || 0) * 100),
                    kwhCharged: data.kwhCharged || '',
                    chargerTypeId: matchedChargerTypeId,
                    totalCost: '',
                    location: '',
                    notes: t('charges.autoDetectedNote'),
                };

                localStorage.setItem('auto_charge_prefill', JSON.stringify(prefilledData));
                openModal('addCharge');
                toast.success(t('charges.autoDetectEnd'));

                // Mark as presented so we don't re-trigger on the same doc
                updateDoc(change.doc.ref, { status: 'presented' }).catch((err) => { if (import.meta.env.DEV) console.warn('Failed to update charge status:', err); });

                // Clear any lingering frontend session for this charge
                saveSession(null);
            });
        }, (err) => { if (import.meta.env.DEV) console.warn('autoCharges listener error:', err); });

        return () => unsubscribe();
    }, [activeCar?.vin, settings?.chargerTypes, openModal, t]);

    // -------------------------------------------------------------------------
    // FALLBACK: Frontend transition detection with localStorage persistence
    // Used when the backend hasn't recorded the session yet (e.g. app open during charging)
    // -------------------------------------------------------------------------
    useEffect(() => {
        if (!vehicleStatus || !isEnabled()) return;

        const isCharging = vehicleStatus.chargingActive || false;
        const savedSession = loadSession();
        const wasCharging = savedSession !== null;

        if (isCharging && !wasCharging) {
            // Charging started — persist to localStorage so it survives restarts
            saveSession({
                startTime: Date.now(),
                startSoC: vehicleStatus.lastSoC || 0,
                startOdometer: vehicleStatus.lastOdometer || 0,
            });
            toast.success(t('charges.autoDetectStart'));
        }

        if (!isCharging && wasCharging) {
            // Charging ended — the backend autoCharges listener will handle registration.
            // Just clear the local session here.
            saveSession(null);
        }
    }, [vehicleStatus, t]);
}

export default useAutoChargeDetection;
