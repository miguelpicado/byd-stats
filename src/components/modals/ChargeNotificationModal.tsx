// BYD Stats - Charge Notification Modal
// Shows when a charge session completes, allowing user to save or discard

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Battery, X, Check, Trash2 } from '../Icons';
import { BYD_RED } from '@core/constants';
import { useApp } from '../../context/AppContext';
import { useData } from '../../providers/DataProvider';
import { useCar } from '../../context/CarContext';
import { getFirestore, collection, query, where, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import toast from 'react-hot-toast';

interface ChargeSession {
    id: string;
    vehicleId: string;
    status: 'in_progress' | 'completed';
    startDate: Timestamp;
    endDate?: Timestamp;
    startSoC: number;
    endSoC?: number;
    currentSoC?: number;
    startOdometer?: number;
    endOdometer?: number;
    location?: { lat: number; lon: number };
    autoStopped?: boolean;
    autoStopSoC?: number;
    userConfirmed?: boolean;
    userDiscarded?: boolean;
}

const ChargeNotificationModal: React.FC = () => {
    const { t } = useTranslation();
    const { settings } = useApp();
    const { addCharge } = useData();
    const { activeCar } = useCar();

    const [pendingSessions, setPendingSessions] = useState<ChargeSession[]>([]);
    const [currentSession, setCurrentSession] = useState<ChargeSession | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Subscribe to completed charge sessions for the active vehicle
    useEffect(() => {
        if (!activeCar?.vin) return;

        const db = getFirestore(getApp());
        // BYD VINs are 17 chars, use bydVehicles subcollection
        const isByd = activeCar.vin.length === 17;
        const sessionsRef = isByd
            ? collection(db, 'bydVehicles', activeCar.vin, 'chargingSessions')
            : collection(db, 'chargeSessions');

        // Query for completed sessions that haven't been confirmed or discarded
        const constraints = [where('status', '==', 'completed')];
        // Only add vehicleId filter for top-level collection (legacy)
        if (!isByd) {
            constraints.push(where('vehicleId', '==', activeCar.vin));
        }
        const q = query(sessionsRef, ...constraints);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const sessions: ChargeSession[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                // Only include sessions that haven't been handled yet
                if (!data.userConfirmed && !data.userDiscarded) {
                    sessions.push({
                        id: doc.id,
                        ...data
                    } as ChargeSession);
                }
            });

            // Sort by endDate descending (most recent first)
            sessions.sort((a, b) => {
                const aTime = a.endDate?.toMillis() || 0;
                const bTime = b.endDate?.toMillis() || 0;
                return bTime - aTime;
            });

            setPendingSessions(sessions);

            // Show the first pending session
            if (sessions.length > 0 && !currentSession) {
                setCurrentSession(sessions[0]);
            }
        }, (error) => {
            console.error('Error listening to charge sessions:', error);
        });

        return () => unsubscribe();
    }, [activeCar?.vin]);

    // Calculate energy added based on SoC change
    const calculateEnergyAdded = (session: ChargeSession): number => {
        const batterySize = Number(settings?.batterySize) || 82.5;
        const soh = Number(settings?.soh) || 100;
        const usableBattery = batterySize * (soh / 100);

        const startSoC = session.startSoC || 0;
        const endSoC = session.endSoC || session.currentSoC || startSoC;
        const socGain = endSoC - startSoC;

        return usableBattery * socGain; // kWh
    };

    const handleSave = async () => {
        if (!currentSession) return;

        setIsSaving(true);
        try {
            const db = getFirestore(getApp());

            // Convert session to charge format
            const startDate = currentSession.startDate?.toDate() || new Date();
            const endDate = currentSession.endDate?.toDate() || new Date();
            const energyAdded = calculateEnergyAdded(currentSession);

            const chargeData = {
                date: startDate.toISOString().split('T')[0].replace(/-/g, ''),
                time: endDate.toTimeString().slice(0, 5),
                odometer: currentSession.endOdometer || currentSession.startOdometer || 0,
                kwhCharged: Math.round(energyAdded * 100) / 100,
                totalCost: 0, // User can edit later
                chargerTypeId: settings?.chargerTypes?.[0]?.id || 'unknown',
                pricePerKwh: 0,
                initialPercentage: Math.round((currentSession.startSoC || 0) * 100),
                finalPercentage: Math.round((currentSession.endSoC || currentSession.currentSoC || 0) * 100),
                type: 'electric' as const,
                isSOCEstimated: false,
                source: 'smartcar' as const,
            };

            // Add charge to local data
            addCharge(chargeData);

            // Mark session as confirmed in Firestore
            // BYD VINs are 17 chars, use bydVehicles subcollection
            const isByd = activeCar?.vin?.length === 17;
            const sessionRef = isByd && activeCar?.vin
                ? doc(db, 'bydVehicles', activeCar.vin, 'chargingSessions', currentSession.id)
                : doc(db, 'chargeSessions', currentSession.id);
            await updateDoc(sessionRef, {
                userConfirmed: true,
                confirmedAt: Timestamp.now()
            });

            toast.success(t('charges.chargeImported', 'Carga importada correctamente'));

            // Move to next pending session or close
            const remaining = pendingSessions.filter(s => s.id !== currentSession.id);
            if (remaining.length > 0) {
                setCurrentSession(remaining[0]);
            } else {
                setCurrentSession(null);
            }
        } catch (error) {
            console.error('Error saving charge:', error);
            toast.error(t('charges.importError', 'Error al importar la carga'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDiscard = async () => {
        if (!currentSession) return;

        try {
            const db = getFirestore(getApp());
            // BYD VINs are 17 chars, use bydVehicles subcollection
            const isByd = activeCar?.vin?.length === 17;
            const sessionRef = isByd && activeCar?.vin
                ? doc(db, 'bydVehicles', activeCar.vin, 'chargingSessions', currentSession.id)
                : doc(db, 'chargeSessions', currentSession.id);
            await updateDoc(sessionRef, {
                userDiscarded: true,
                discardedAt: Timestamp.now()
            });

            toast.success(t('charges.chargeDiscarded', 'Carga descartada'));

            // Move to next pending session or close
            const remaining = pendingSessions.filter(s => s.id !== currentSession.id);
            if (remaining.length > 0) {
                setCurrentSession(remaining[0]);
            } else {
                setCurrentSession(null);
            }
        } catch (error) {
            console.error('Error discarding charge:', error);
        }
    };

    const handleClose = () => {
        setCurrentSession(null);
    };

    if (!currentSession) return null;

    const startDate = currentSession.startDate?.toDate();
    const endDate = currentSession.endDate?.toDate();
    const startSoC = Math.round((currentSession.startSoC || 0) * 100);
    const endSoC = Math.round((currentSession.endSoC || currentSession.currentSoC || 0) * 100);
    const energyAdded = calculateEnergyAdded(currentSession);
    const durationMinutes = startDate && endDate
        ? Math.round((endDate.getTime() - startDate.getTime()) / 60000)
        : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-backdrop" onClick={handleClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

            <div
                role="dialog"
                aria-modal="true"
                className="relative bg-white dark:bg-slate-800 rounded-2xl p-0 max-w-sm w-full border border-slate-200 dark:border-slate-700 shadow-2xl animate-modal-content overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-5 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                                <Battery className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold">
                                    {t('charges.chargeCompleted', 'Carga Completada')}
                                </h2>
                                <p className="text-sm text-white/80">
                                    {endDate?.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} • {endDate?.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 rounded-full hover:bg-white/20 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                    {/* Main Stats */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3 text-center">
                            <p className="text-xs text-slate-500 dark:text-slate-400">SoC</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">
                                {startSoC}% → {endSoC}%
                            </p>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                +{endSoC - startSoC}%
                            </p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3 text-center">
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('charges.energyAdded', 'Energía')}</p>
                            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                                {energyAdded.toFixed(1)} <span className="text-sm font-normal">kWh</span>
                            </p>
                        </div>
                    </div>

                    {/* Duration */}
                    <div className="flex justify-between items-center py-2 border-t border-b border-slate-100 dark:border-slate-700/50">
                        <span className="text-sm text-slate-600 dark:text-slate-400">{t('charges.duration', 'Duración')}</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {Math.floor(durationMinutes / 60)}h {durationMinutes % 60}min
                        </span>
                    </div>

                    {/* Auto-stopped indicator */}
                    {currentSession.autoStopped && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 flex items-center gap-2">
                            <span className="text-blue-500">⚡</span>
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                {t('charges.autoStopped', 'Carga detenida automáticamente al alcanzar el SoC objetivo')}
                            </p>
                        </div>
                    )}

                    {/* Info */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                        {t('charges.importQuestion', '¿Quieres guardar esta carga en tu historial?')}
                    </p>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex gap-3">
                    <button
                        onClick={handleDiscard}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                        <Trash2 className="w-4 h-4" />
                        {t('common.discard', 'Descartar')}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 py-2.5 rounded-xl text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"
                        style={{ backgroundColor: BYD_RED }}
                    >
                        {isSaving ? (
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Check className="w-4 h-4" />
                        )}
                        {t('common.save', 'Guardar')}
                    </button>
                </div>

                {/* Pending count */}
                {pendingSessions.length > 1 && (
                    <div className="px-4 pb-3 text-center">
                        <span className="text-xs text-slate-400">
                            {pendingSessions.length - 1} {t('charges.morePending', 'más pendientes')}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChargeNotificationModal;
