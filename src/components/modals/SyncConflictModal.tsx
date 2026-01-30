import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Cloud, Database, AlertTriangle } from '../Icons';
import { useData } from '../../providers/DataProvider';

/**
 * Modal for resolving sync conflicts between local and cloud data
 */
const SyncConflictModal: React.FC = () => {
    const { t } = useTranslation();
    const { googleSync } = useData();

    const { pendingConflict: conflict, resolveConflict: onResolve, dismissConflict: onClose } = googleSync || {};
    const isOpen = !!conflict;

    if (!isOpen || !conflict) return null;

    const { differences } = conflict;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-modal-backdrop">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden animate-modal-content">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            {t('sync.conflictDetected')}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4 overflow-y-auto max-h-[50vh]">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        {t('sync.conflictDescription')}
                    </p>

                    {/* Differences List */}
                    <div className="space-y-2">
                        {differences.map((diff: any, index: number) => (
                            <div
                                key={index}
                                className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-sm"
                            >
                                <div className="font-medium text-slate-900 dark:text-white">
                                    {diff.label}
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                    <Database className="w-4 h-4" />
                                    <span className="truncate">{diff.local}</span>
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                    <Cloud className="w-4 h-4" />
                                    <span className="truncate">{diff.cloud}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
                    <button
                        onClick={() => onResolve && onResolve('local')}
                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <Database className="w-5 h-5" />
                        {t('sync.keepLocal')}
                    </button>
                    <button
                        onClick={() => onResolve && onResolve('cloud')}
                        className="w-full py-3 px-4 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <Cloud className="w-5 h-5" />
                        {t('sync.useCloud')}
                    </button>
                    <button
                        onClick={() => onResolve && onResolve('merge')}
                        className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors"
                    >
                        {t('sync.mergeBoth')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SyncConflictModal;
