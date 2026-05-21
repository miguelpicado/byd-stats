import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertTriangle } from '../Icons';
import ModalPortal from './ModalPortal';
import { useData } from '../../providers/DataProvider';

const ConfirmationModal: React.FC = () => {
    const { t } = useTranslation();
    const { confirmModalState, closeConfirmation } = useData();

    // Defensive check
    if (!confirmModalState) return null;

    const {
        isOpen,
        onConfirm,
        title,
        message,
        confirmText,
        cancelText,
        isWarning
    } = confirmModalState;

    const onClose = closeConfirmation;

    if (!isOpen) return null;

    // isDangerous check
    const isDangerous = isWarning;

    return (
        <ModalPortal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                ></div>

                <div className="relative bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden transform transition-all scale-100 opacity-100">
                    {/* Header */}
                    <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDangerous ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {title || t('common.confirm', 'Confirmar acción')}
                            </h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        <p className="text-slate-600 dark:text-slate-300">
                            {message}
                        </p>
                    </div>

                    {/* Footer */}
                    <div className="p-5 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            {cancelText || t('common.cancel', 'Cancelar')}
                        </button>
                        <button
                            onClick={() => {
                                if (onConfirm) onConfirm();
                                onClose();
                            }}
                            className={`px-4 py-2 rounded-xl text-white font-medium shadow-lg transition-all active:scale-95 ${isDangerous
                                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                                : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'
                                }`}
                        >
                            {confirmText || t('common.confirm', 'Confirmar')}
                        </button>
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
};

export default ConfirmationModal;
