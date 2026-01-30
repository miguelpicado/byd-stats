// BYD Stats - MfgDateModal Component
// Captures car manufacturing date with specific instructions for BYD owners

import React, { useState, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, X, Info } from '../Icons';
import ModalPortal from '../common/ModalPortal';
import { BYD_RED } from '@core/constants';

interface MfgDateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (isoDate: string, displayDate: string) => void;
    initialValue?: string;
}

const MfgDateModal: React.FC<MfgDateModalProps> = ({ isOpen, onClose, onSave, initialValue = '' }) => {
    const { t } = useTranslation();
    const [value, setValue] = useState(initialValue);
    const [error, setError] = useState(false);

    if (!isOpen) return null;

    const handleSave = () => {
        // Validate MM/YY format
        const regex = /^(0[1-9]|1[0-2])\/([0-9]{2})$/;
        if (!regex.test(value)) {
            setError(true);
            return;
        }

        setError(false);
        // Convert MM/YY to YYYY-MM-01 for internal use
        const [month, year] = value.split('/');
        const fullYear = `20${year}`;
        const isoDate = `${fullYear}-${month}-01`;

        onSave(isoDate, value); // Pass both internal and display format
        onClose();
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/[^0-9/]/g, '');
        if (val.length === 2 && !val.includes('/')) {
            val += '/';
        }
        if (val.length > 5) val = val.substring(0, 5);
        setValue(val);
        if (error) setError(false);
    };

    return (
        <ModalPortal>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-modal-backdrop" onClick={onClose}>
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

                <div
                    role="dialog"
                    aria-modal="true"
                    className="relative bg-white dark:bg-slate-800 rounded-2xl p-0 max-w-sm w-full border border-slate-200 dark:border-slate-700 shadow-2xl animate-modal-content"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                {t('modals.mfgDate.title')}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-5 space-y-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            {t('modals.mfgDate.desc')}
                        </p>

                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-900/30 flex gap-3">
                            <Info className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0" />
                            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                                {t('modals.mfgDate.instructions')}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                {t('settings.mfgDate')}
                            </label>
                            <input
                                type="text"
                                value={value}
                                onChange={handleInputChange}
                                placeholder="MM/YY"
                                className={`w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-3 border text-center text-xl font-bold tracking-widest ${error ? 'border-red-500' : 'border-slate-200 dark:border-slate-600 focus:border-blue-500'
                                    }`}
                            />
                            {error && (
                                <p className="text-xs text-red-500 mt-1 text-center">
                                    {t('modals.mfgDate.invalid')}
                                </p>
                            )}
                            <p className="text-[10px] text-slate-400 text-center">
                                {t('modals.mfgDate.formatHint')}
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-5 border-t border-slate-100 dark:border-slate-700">
                        <button
                            onClick={handleSave}
                            className="w-full py-3 rounded-xl font-medium text-white shadow-lg transition-transform active:scale-95"
                            style={{ backgroundColor: BYD_RED }}
                        >
                            {t('modals.mfgDate.save')}
                        </button>
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
};

export default MfgDateModal;
