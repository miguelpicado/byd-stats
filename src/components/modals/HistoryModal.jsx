// BYD Stats - History Modal Component

import React from 'react';
import PropTypes from 'prop-types';
import { BYD_RED } from '../../utils/constants';
import { Database, Plus } from '../Icons.jsx';
import { useTranslation } from 'react-i18next';

/**
 * History modal for trip history management
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Modal visibility
 * @param {Function} props.onClose - Close handler
 * @param {number} props.historyCount - Number of saved trips
 * @param {Function} props.onSave - Save current trips to history
 * @param {Function} props.onLoad - Load trips from history
 * @param {Function} props.onClear - Clear history
 */
const HistoryModal = ({ isOpen, onClose, historyCount, onSave, onLoad, onClear }) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="history-modal-title"
                className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        <h2 id="history-modal-title" className="text-xl font-bold text-slate-900 dark:text-white">{t('historyMod.title')}</h2>
                    </div>
                    <button onClick={onClose} aria-label="Close history" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                        <Plus className="w-6 h-6 rotate-45" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            {t('historyMod.description')}
                        </p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                            {t('historyMod.savedCount', { count: historyCount })}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <button
                            onClick={() => { onSave(); onClose(); }}
                            className="w-full py-3 rounded-xl font-medium text-white"
                            style={{ backgroundColor: BYD_RED }}
                        >
                            {t('historyMod.saveCurrent')}
                        </button>

                        <button
                            onClick={() => { onLoad(); onClose(); }}
                            className="w-full py-3 rounded-xl font-medium text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                            disabled={historyCount === 0}
                        >
                            {t('historyMod.loadFull')}
                        </button>

                        <button
                            onClick={() => { onClear(); onClose(); }}
                            className="w-full py-3 rounded-xl font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                            disabled={historyCount === 0}
                        >
                            {t('historyMod.clear')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

HistoryModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    historyCount: PropTypes.number.isRequired,
    onSave: PropTypes.func.isRequired,
    onLoad: PropTypes.func.isRequired,
    onClear: PropTypes.func.isRequired
};

export default HistoryModal;
