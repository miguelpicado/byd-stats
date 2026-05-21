import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, MapPin } from '../Icons';
import ModalPortal from '../common/ModalPortal';
import { useApp } from '../../context/AppContext';

interface OdometerAdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const OdometerAdjustmentModal: React.FC<OdometerAdjustmentModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { settings, updateSettings } = useApp();
    const [offset, setOffset] = useState<number | string>(0);

    // Initialize state when modal opens
    useEffect(() => {
        if (isOpen) {
            setOffset(settings.odometerOffset || 0);
        }
    }, [isOpen, settings.odometerOffset]);

    const handleSave = () => {
        const val = typeof offset === 'string' ? parseFloat(offset) : offset;
        if (!isNaN(val)) {
            updateSettings({ odometerOffset: val });
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <ModalPortal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-backdrop" onClick={onClose}>
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

                <div
                    role="dialog"
                    aria-modal="true"
                    className="relative bg-white dark:bg-slate-800 rounded-2xl p-0 max-w-sm w-full border border-slate-200 dark:border-slate-700 shadow-2xl animate-modal-content"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-100 dark:bg-red-900/30">
                                <MapPin className="w-5 h-5 text-red-500" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                {t('modals.odometerTitle', 'Ajuste de Odómetro')}
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
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            {t('modals.odometerDesc', 'Ajuste visual para corregir la diferencia con el marcador del coche.')}
                        </p>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                {t('modals.offset', 'Desfase (km)')}
                            </label>
                            <input
                                type="number"
                                value={offset}
                                onChange={(e) => setOffset(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="0"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                            >
                                {t('common.save')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
};

export default OdometerAdjustmentModal;
