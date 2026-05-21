import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Activity, Battery, Zap, AlertCircle, CheckCircle, Clock } from '../Icons';
import { Anomaly } from '@/services/AnomalyService';
import AlertHistoryModal from './AlertHistoryModal';
import ModalPortal from '../common/ModalPortal';

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
    const [showHistory, setShowHistory] = useState(false);

    if (!isOpen) return null;

    const bmsCalibration = anomalies.find(a => a.id === 'bms_calibration');
    const batteryAnomalies = anomalies.filter(a => a.type === 'battery' && a.id !== 'bms_calibration');
    const drainAnomalies = anomalies.filter(a => a.type === 'drain');
    const chargeAnomalies = anomalies.filter(a => a.type === 'charging');
    const effAnomalies = anomalies.filter(a => a.type === 'efficiency');

    // Helper for rows
    const StatusRow = ({ title, items, icon, emptyText }: any) => (
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
                        </div>

                        {/* Footer - History Button */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 flex justify-center">
                            <button
                                onClick={() => setShowHistory(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
                            >
                                <Clock className="w-4 h-4" />
                                {t('health.viewHistory', 'Ver Histórico de Avisos')}
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
