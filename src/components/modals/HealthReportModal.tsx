import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Activity, Battery, Zap, AlertCircle, CheckCircle, Clock, RefreshCw, Wheel } from '../Icons';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore, doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { useCar } from '../../context/CarContext';
import toast from 'react-hot-toast';
import { Anomaly } from '@/services/AnomalyService';
import AlertHistoryModal from './AlertHistoryModal';
import ModalPortal from '../common/ModalPortal';

interface VehicleFirestoreData {
    isLocked?: boolean;
    climateActive?: boolean;
    trunkOpen?: boolean;
    tires?: {
        frontLeft: number;
        frontRight: number;
        backLeft: number;
        backRight: number;
    };
    lastUpdate?: Timestamp;
}

interface HealthReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    anomalies: Anomaly[];
    historyAnomalies?: Anomaly[];
    onAcknowledge?: (id: string) => void;
    onDelete?: (id: string) => void;
}

const HealthReportModal: React.FC<HealthReportModalProps> = ({
    isOpen,
    onClose,
    anomalies,
    historyAnomalies = [],
    onAcknowledge,
    onDelete
}) => {
    const { t } = useTranslation();
    const { activeCar, activeCarId, updateCar } = useCar();
    const [showHistory, setShowHistory] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [vehicleData, setVehicleData] = useState<VehicleFirestoreData | null>(null);

    // Subscribe to vehicle document in Firestore for real-time data
    useEffect(() => {
        if (!activeCar?.vin) {
            setVehicleData(null);
            return;
        }

        const db = getFirestore(getApp());
        const vehicleRef = doc(db, 'vehicles', activeCar.vin);

        const unsubscribe = onSnapshot(vehicleRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                setVehicleData(docSnapshot.data() as VehicleFirestoreData);
            } else {
                setVehicleData(null);
            }
        }, (error) => {
            console.error('[HealthReportModal] Error listening to vehicle:', error);
        });

        return () => unsubscribe();
    }, [activeCar?.vin]);

    // Auto-refresh vehicle data when modal opens
    useEffect(() => {
        if (isOpen && activeCar?.vin) {
            const refreshData = async () => {
                setActionLoading('refreshVehicleData');
                try {
                    const functions = getFunctions(getApp(), 'europe-west1');
                    const refresh = httpsCallable(functions, 'refreshVehicleData');
                    const result = await refresh({ vehicleId: activeCar.vin });
                    console.log('[HealthReportModal] Auto-refresh result:', result.data);
                } catch (error: unknown) {
                    console.error('[HealthReportModal] Auto-refresh failed:', error instanceof Error ? error.message : error);
                } finally {
                    setActionLoading(null);
                }
            };
            refreshData();
        }
    }, [isOpen, activeCar?.vin]);

    // Use Firestore data for live status, fallback to activeCar
    const isLocked = vehicleData?.isLocked ?? activeCar?.isLocked;
    const climateActive = vehicleData?.climateActive ?? activeCar?.climateActive;
    const trunkOpen = vehicleData?.trunkOpen ?? false;
    const tires = vehicleData?.tires ?? activeCar?.tires;

    // Tire Pressure View
    const TiresView = ({ tires }: { tires: { frontLeft: number; frontRight: number; backLeft: number; backRight: number } }) => {
        if (!tires) return null;

        const Tire = ({ label, value }: { label: string; value: number }) => {
            // Smartcar often returns kPa. 250 kPa = 2.5 bar.
            // If value > 10, it's likely kPa, so we divide by 100
            const displayValue = value > 10 ? (value / 100).toFixed(1) : value.toFixed(1);

            return (
                <div className={`flex flex-col items-center bg-white dark:bg-slate-800 rounded-xl p-2 border border-slate-100 dark:border-slate-800 shadow-sm`}>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">{label}</span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{displayValue} bar</span>
                </div>
            );
        };

        return (
            <div className="mt-4 mb-6">
                <div className="grid grid-cols-2 gap-4 relative">
                    {/* Wheel background icon */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                        <Wheel className="w-24 h-24" />
                    </div>

                    <Tire label="DI" value={tires.frontLeft} />
                    <Tire label="DD" value={tires.frontRight} />
                    <Tire label="TI" value={tires.backLeft} />
                    <Tire label="TD" value={tires.backRight} />
                </div>
            </div>
        );
    };

    const handleAction = async (action: string) => {
        if (!activeCarId) return;

        setActionLoading(action);
        const toastId = toast.loading(`${t('common.processing', 'Procesando...')} ${action}`);

        try {
            const functions = getFunctions(getApp(), 'europe-west1');
            const callAction = httpsCallable(functions, action);
            const result = await callAction({ vehicleId: activeCar?.vin || activeCarId });

            // Log diagnostic results to console
            if (action === 'fullSmartcarDiagnostic') {
                console.log('=== SMARTCAR DIAGNOSTIC RESULTS ===');
                console.log(JSON.stringify(result.data, null, 2));
                const data = result.data as { summary?: { available?: unknown[]; unavailable?: unknown[] } };
                toast.success(`Diagnóstico completo. Disponibles: ${data.summary?.available?.length || 0}, No disponibles: ${data.summary?.unavailable?.length || 0}. Ver consola (F12)`, { id: toastId, duration: 8000 });
                return;
            }

            // Update local state if needed
            if (action === 'lockVehicle') updateCar(activeCarId, { isLocked: true });
            if (action === 'unlockVehicle') updateCar(activeCarId, { isLocked: false });
            if (action === 'startClimate') updateCar(activeCarId, { climateActive: true });
            if (action === 'stopClimate') updateCar(activeCarId, { climateActive: false });

            toast.success(`${t('common.success', '¡Éxito!')}`, { id: toastId });
        } catch (error: unknown) {
            console.error(`Action ${action} failed:`, error);
            toast.error(`${t('common.error', 'Error')}: ${error instanceof Error ? error.message : String(error)}`, { id: toastId });
        } finally {
            setActionLoading(null);
        }
    };

    if (!isOpen) return null;

    const bmsCalibration = anomalies.find(a => a.id === 'bms_calibration');
    const batteryAnomalies = anomalies.filter(a => a.type === 'battery' && a.id !== 'bms_calibration');
    const drainAnomalies = anomalies.filter(a => a.type === 'drain');
    const chargeAnomalies = anomalies.filter(a => a.type === 'charging');
    const effAnomalies = anomalies.filter(a => a.type === 'efficiency');

    // Helper for rows
    const StatusRow = ({ title, items, icon, emptyText }: { title: string; items: Anomaly[]; icon: React.ReactNode; emptyText: string }) => (
        <div className="mb-6 last:mb-0">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                {icon}
                {title}
            </h3>
            {items.length === 0 ? (
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 flex items-center gap-3 text-slate-500 dark:text-slate-400">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <span className="text-sm">{emptyText}</span>
                </div>
            ) : (
                <div className="space-y-3">
                    {items.map((item: Anomaly) => (
                        <div key={item.id} className={`relative rounded-xl p-4 border ${item.severity === 'critical' ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-900/50' :
                            item.severity === 'warning' ? 'bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/50' :
                                'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/50'
                            }`}>
                            <div className="flex justify-between items-start pr-8">
                                <h4 className={`font-bold text-sm ${item.severity === 'critical' ? 'text-red-700 dark:text-red-400' :
                                    item.severity === 'warning' ? 'text-amber-700 dark:text-amber-400' :
                                        'text-blue-700 dark:text-blue-400'
                                    }`}>
                                    {item.title}
                                </h4>
                                {item.value && (
                                    <span className="text-xs font-mono font-bold px-2 py-0.5 bg-white/50 dark:bg-black/20 rounded">
                                        {item.value}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs mt-1 text-slate-600 dark:text-slate-300 leading-relaxed max-w-[90%]">
                                {item.description}
                            </p>

                            {/* Acknowledge Button */}
                            {onAcknowledge && (
                                <button
                                    onClick={() => onAcknowledge(item.id)}
                                    className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-current opacity-60 hover:opacity-100"
                                    title={t('common.dismiss', 'Entendido / Ocultar')}
                                >
                                    <CheckCircle className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <ModalPortal>
            <div className="fixed inset-0 z-50 overflow-y-auto">
                {/* Backdrop */}
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

                {/* Container for centering - ensures vertical scrolling if content is tall */}
                <div className="flex min-h-full items-center justify-center p-4">
                    <div className="relative w-full max-w-lg bg-white dark:bg-slate-950 rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 my-8">

                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Activity className="w-6 h-6 text-blue-500" />
                                    {t('health.systemStatus', 'Estado del Sistema')}
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    {anomalies.length === 0
                                        ? t('health.allSystemsNormal', 'Todos los sistemas funcionan correctamente')
                                        : t('health.anomaliesDetected', 'Se han detectado irregularidades')
                                    }
                                </p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <X className="w-6 h-6 text-slate-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 pb-24 sm:pb-6"> {/* Extra padding bottom for mobile if needed, though button is now separate */}

                            {/* AI Calibration Recommendation */}
                            {bmsCalibration && (
                                <div className="mb-8 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-3 opacity-10">
                                        <Zap className="w-24 h-24 text-indigo-500" />
                                    </div>

                                    <div className="relative z-10">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                                AI Insight
                                            </span>
                                            <span className="text-xs text-slate-400 font-mono">TensorFlow-Lite</span>
                                        </div>

                                        <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100 mb-2">
                                            {bmsCalibration.title}
                                        </h3>

                                        <p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 leading-relaxed mb-4">
                                            {bmsCalibration.description}
                                        </p>

                                        <div className="flex items-center gap-3">
                                            <div className="h-1 flex-1 bg-indigo-200 dark:bg-indigo-800 rounded-full overflow-hidden">
                                                <div className="h-full w-1/3 bg-indigo-500 animate-pulse"></div>
                                            </div>
                                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                                                Requiere Atención
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <StatusRow
                                title={t('health.battery', 'Batería')}
                                items={batteryAnomalies}
                                icon={<Battery className="w-5 h-5" />}
                                emptyText={t('health.batteryOk', 'Salud de batería dentro de parámetros normales.')}
                            />

                            <StatusRow
                                title={t('health.drain', 'Drenaje Fantasma')}
                                items={drainAnomalies}
                                icon={<Activity className="w-5 h-5" />}
                                emptyText={t('health.drainOk', 'Consumo en reposo normal.')}
                            />

                            <StatusRow
                                title={t('health.charging', 'Carga')}
                                items={chargeAnomalies}
                                icon={<Zap className="w-5 h-5" />}
                                emptyText={t('health.chargingOk', 'Eficiencia de carga óptima.')}
                            />

                            <StatusRow
                                title={t('health.efficiency', 'Eficiencia & Neumáticos')}
                                items={effAnomalies}
                                icon={<AlertCircle className="w-5 h-5" />}
                                emptyText={t('health.efficiencyOk', 'Consumo consistente con el historial.')}
                            />

                            {/* Tire Pressure Section */}
                            <div className="mt-8">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <Activity className="w-5 h-5" />
                                        {t('health.tires', 'Presión de Neumáticos')}
                                    </h3>
                                    <button
                                        onClick={() => handleAction('refreshVehicleData')}
                                        disabled={!!actionLoading}
                                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                                        title={t('health.refreshData', 'Actualizar datos del vehículo')}
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'refreshVehicleData' ? 'animate-spin' : ''}`} />
                                        {t('health.refresh', 'Actualizar')}
                                    </button>
                                </div>
                                {tires ? (
                                    <TiresView tires={tires} />
                                ) : (
                                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 flex items-center gap-3 text-slate-500 dark:text-slate-400 mb-6">
                                        <Activity className="w-5 h-5 opacity-30" />
                                        <span className="text-sm">{t('health.noTireData', 'No hay datos de presión recientes.')}</span>
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Footer - History Button */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 flex justify-center">
                            <button
                                onClick={() => setShowHistory(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
                            >
                                <Clock className="w-4 h-4" />
                                {t('health.viewHistory', 'Ver Histórico')}
                            </button>
                        </div>
                    </div>
                </div>

                <AlertHistoryModal
                    isOpen={showHistory}
                    onClose={() => setShowHistory(false)}
                    historyAnomalies={historyAnomalies}
                    onDelete={onDelete ? (id, e) => {
                        e.stopPropagation();
                        onDelete(id);
                    } : () => { }}
                />
            </div>
        </ModalPortal>
    );
};

export default HealthReportModal;
