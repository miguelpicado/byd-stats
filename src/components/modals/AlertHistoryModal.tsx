import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertTriangle, CheckCircle, Trash2, Clock } from '../Icons';
import { Anomaly } from '../../services/AnomalyService';
import ModalPortal from '../common/ModalPortal';

interface AlertHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    historyAnomalies: Anomaly[];
    onDelete: (id: string, e: React.MouseEvent) => void;
}

const AlertHistoryModal: React.FC<AlertHistoryModalProps> = ({
    isOpen,
    onClose,
    historyAnomalies,
    onDelete
}) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    // Helper to format date
    const formatDate = (timestamp?: number) => {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <ModalPortal>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-modal-backdrop" onClick={onClose}>
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

                <div
                    role="dialog"
                    aria-modal="true"
                    className="relative bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl animate-modal-content border border-slate-200 dark:border-slate-700"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-t-2xl">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                    {t('health.alertHistory', 'Histórico de Avisos')}
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {historyAnomalies.length} {t('common.alerts', 'avisos')} {t('common.archived', 'archivados')}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-2 scrollbar-hide bg-slate-50 dark:bg-black/20">
                        {historyAnomalies.length === 0 ? (
                            <div className="h-48 flex flex-col items-center justify-center text-slate-400">
                                <CheckCircle className="w-12 h-12 mb-3 opacity-20" />
                                <p>{t('health.noHistory', 'No hay avisos en el histórico')}</p>
                            </div>
                        ) : (
                            <div className="space-y-2 p-2">
                                {historyAnomalies.map((item) => (
                                    <div
                                        key={item.id}
                                        className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex gap-4 transition-all opacity-75 hover:opacity-100"
                                    >
                                        <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${{
                                                critical: 'bg-red-50 text-red-500 dark:bg-red-900/20',
                                                warning: 'bg-amber-50 text-amber-500 dark:bg-amber-900/20',
                                                info: 'bg-blue-50 text-blue-500 dark:bg-blue-900/20'
                                            }[item.severity]
                                            }`}>
                                            <AlertTriangle className="w-5 h-5" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-0.5">
                                                    {item.title}
                                                </h4>
                                                <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap ml-2">
                                                    {formatDate(item.timestamp)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                                                {item.description}
                                            </p>
                                        </div>

                                        <button
                                            onClick={(e) => onDelete(item.id, e)}
                                            className="shrink-0 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors self-center"
                                            title={t('common.delete', 'Borrar definitivamente')}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
};

export default AlertHistoryModal;
