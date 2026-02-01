// BYD Stats - Upload Options Modal
// Simple modal to choose between merging or replacing data

import React, { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Upload } from '../Icons';
import { useData } from '../../providers/DataProvider';

const UploadOptionsModal: React.FC = () => {
    const { t } = useTranslation();
    const { modals, closeModal, loadFile, clearData } = useData();

    const isOpen = modals.upload;
    const onClose = () => closeModal('upload');

    if (!isOpen) return null;

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>, merge: boolean) => {
        const file = e.target.files?.[0];
        if (file) {
            loadFile(file, merge);
            onClose();
        }
        e.target.value = '';
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-modal-backdrop" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 animate-modal-content"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="upload-options-title"
            >
                <h3 id="upload-options-title" className="text-xl font-bold mb-4 text-slate-900 dark:text-white">{t('settings.updateData')}</h3>

                <div className="space-y-3">
                    {/* Merge Option */}
                    <label className="block cursor-pointer border-2 border-dashed border-slate-600 rounded-xl p-6 text-center hover:border-green-500 transition-colors">
                        <input
                            type="file"
                            accept="*/*,image/*,.db,.jpg,.jpeg"
                            className="hidden"
                            onChange={(e) => handleFileChange(e, true)}
                        />
                        <Plus className="w-8 h-8 mx-auto mb-2 text-green-500" />
                        <p className="text-slate-900 dark:text-white">{t('upload.mergeExisting')}</p>
                    </label>

                    {/* Replace Option */}
                    <label className="block cursor-pointer border-2 border-dashed border-slate-600 rounded-xl p-6 text-center hover:border-amber-500 transition-colors">
                        <input
                            type="file"
                            accept="*/*,image/*,.db,.jpg,.jpeg"
                            className="hidden"
                            onChange={(e) => handleFileChange(e, false)}
                        />
                        <Upload className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                        <p className="text-slate-900 dark:text-white">{t('upload.replaceAll')}</p>
                    </label>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={() => { clearData(); onClose(); }}
                        className="py-2 px-4 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30"
                    >
                        {t('upload.deleteAll')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UploadOptionsModal;
