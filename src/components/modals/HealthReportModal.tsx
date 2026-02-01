import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertTriangle, CheckCircle, Info, Activity, Battery, Zap, AlertCircle } from '../Icons';
import { Anomaly } from '../../services/AnomalyService';

interface HealthReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    anomalies: Anomaly[];
}

const HealthReportModal: React.FC<HealthReportModalProps> = ({
    isOpen,
    onClose,
    anomalies: propAnomalies
}) => {
    const { t } = useTranslation();
    const [dismissedIds, setDismissedIds] = React.useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('byd_dismissed_anomalies');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    // Filter out dismissed anomalies
    // Use memo to avoid recalculation on unrelated renders, though simple enough here.
    const activeAnomalies = React.useMemo(() => {
        return propAnomalies.filter(a => !dismissedIds.includes(a.id));
    }, [propAnomalies, dismissedIds]);

    const handleDismiss = (id: string) => {
        const newDismissed = [...dismissedIds, id];
        setDismissedIds(newDismissed);
        localStorage.setItem('byd_dismissed_anomalies', JSON.stringify(newDismissed));
    };

    if (!isOpen) return null;

    // Categorize
    const batteryAnomalies = activeAnomalies.filter(a => a.type === 'battery');
    const drainAnomalies = activeAnomalies.filter(a => a.type === 'drain');
    const chargeAnomalies = activeAnomalies.filter(a => a.type === 'charging');
    const effAnomalies = activeAnomalies.filter(a => a.type === 'efficiency');

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/20';
            case 'warning': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
            default: return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'battery': return <Battery className="w-5 h-5" />;
            case 'drain': return <Activity className="w-5 h-5" />;
            case 'charging': return <Zap className="w-5 h-5" />;
            default: return <Info className="w-5 h-5" />;
        }
    };

    const StatusRow = ({ title, items, icon, emptyText }: { title: string, items: Anomaly[], icon: any, emptyText: string }) => (
        <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white capitalize">{title}</h3>
                {items.length === 0 && (
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-xs font-bold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> OK
                    </span>
                )}
            </div>

            {items.length === 0 ? (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-500 text-sm">
                    {emptyText}
                </div>
            ) : (
                <div className="space-y-3">
                    {items.map(item => (
                        <div key={item.id} className={`relative p-4 rounded-xl border ${getSeverityColor(item.severity)} flex flex-col gap-2`}>
                            <div className="flex justify-between items-start pr-8">
                                <h4 className="font-bold flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    {item.title}
                                </h4>
                                {item.value && <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-white/10 ml-2">{item.value}</span>}
                            </div>
                            <p className="text-sm opacity-90">{item.description}</p>
                            {item.timestamp && (
                                <p className="text-xs opacity-60 mt-1">
                                    {new Date(item.timestamp).toLocaleDateString()}
                                </p>
                            )}

                            {/* Dismiss Button */}
                            <button
                                onClick={() => handleDismiss(item.id)}
                                className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-current opacity-70 hover:opacity-100"
                                title={t('common.dismiss', 'Entendido / Ocultar')}
                            >
                                <CheckCircle className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-950 w-full max-w-lg max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Activity className="w-6 h-6 text-blue-500" />
                            {t('health.systemStatus', 'Estado del Sistema')}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {activeAnomalies.length === 0
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
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
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
            </div>
        </div>
    );
};

export default HealthReportModal;
