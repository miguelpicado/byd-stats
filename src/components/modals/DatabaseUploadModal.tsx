import React, { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Download, FileText, Trash2, Database } from '../Icons';
import ModalHeader from '../common/ModalHeader';
import { useData } from '../../providers/DataProvider';
import { useCar } from '../../context/CarContext';
import { Capacitor } from '@capacitor/core';

// Electric blue color for accent buttons
const ELECTRIC_BLUE = '#3b82f6';

/**
 * Database upload/management modal
 */
const DatabaseUploadModal: React.FC = () => {
    const { t } = useTranslation();
    const isNative = Capacitor.isNativePlatform();
    const {
        modals,
        closeModal,
        database,
        loadFile,
        exportData,
        clearData,
        replaceCharges,
        loadChargeRegistry,
        exportCharges,
        trips,
        charges
    } = useData();

    const { deleteCar, activeCarId, cars } = useCar();

    // Derived State
    const isOpen = modals.history;
    const sqlReady = !!database;
    const hasData = trips && trips.length > 0;
    const hasCharges = charges && charges.length > 0;

    const onClose = () => closeModal('history');

    if (!isOpen) return null;

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>, merge: boolean) => {
        const file = e.target.files?.[0];
        if (file) {
            loadFile(file, merge);
            onClose();
        }
        e.target.value = '';
    };

    const handleChargeRegistryChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            loadChargeRegistry(file);
            onClose();
        }
        e.target.value = '';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-backdrop" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="database-modal-title"
                className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 max-h-[85vh] overflow-y-auto animate-modal-content"
                style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
                onClick={(e) => e.stopPropagation()}
            >
                <ModalHeader
                    title={t('upload.title')}
                    Icon={Database}
                    onClose={onClose}
                    id="database-modal-title"
                    iconClassName="w-5 h-5 text-slate-600 dark:text-slate-400"
                />

                <div className="space-y-4">
                    {/* File Operations Section */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            {t('upload.filesSection')}
                        </h3>
                        <div className="space-y-2">
                            {/* 1. Load only new trips (merge) - GREEN */}
                            <div>
                                <input
                                    type="file"
                                    id="uploadMerge"
                                    accept="*/*,image/*,.db,.jpg,.jpeg,.csv"
                                    className="hidden"
                                    onChange={(e) => handleFileChange(e, true)}
                                    disabled={!sqlReady}
                                />
                                <button
                                    onClick={() => document.getElementById('uploadMerge')?.click()}
                                    className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
                                    style={{ backgroundColor: '#10B981' }} // Emerald/Green for safe action (merge)
                                    disabled={!sqlReady}
                                >
                                    <Upload className="w-4 h-4" />
                                    {t('upload.loadMerge')}
                                </button>
                            </div>

                            {/* 2. Load charge registry (CSV) - ELECTRIC BLUE */}
                            <div>
                                <input
                                    type="file"
                                    id="uploadChargeRegistry"
                                    accept=".csv,text/csv"
                                    className="hidden"
                                    onChange={handleChargeRegistryChange}
                                />
                                <button
                                    onClick={() => document.getElementById('uploadChargeRegistry')?.click()}
                                    className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
                                    style={{ backgroundColor: ELECTRIC_BLUE }}
                                >
                                    <FileText className="w-4 h-4" />
                                    {t('upload.loadChargeRegistry')}
                                </button>
                            </div>

                            {/* 3. Load NEW (Replace) - RED */}
                            <div>
                                <input
                                    type="file"
                                    id="uploadNew"
                                    accept="*/*,image/*,.db,.jpg,.jpeg,.csv"
                                    className="hidden"
                                    onChange={(e) => handleFileChange(e, false)}
                                    disabled={!sqlReady}
                                />
                                <button
                                    onClick={() => document.getElementById('uploadNew')?.click()}
                                    className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
                                    style={{ backgroundColor: '#EF4444' }} // Red for dangerous action (replace)
                                    disabled={!sqlReady}
                                >
                                    <Database className="w-4 h-4" />
                                    {t('upload.loadNew')}
                                </button>
                            </div>

                            {/* 3. Delete Car (Replace Clear Data) */}
                            {cars.length > 0 && (
                                <button
                                    onClick={() => {
                                        if (window.confirm(t('confirmations.deleteCar', '¿Estás seguro de que quieres eliminar este coche y todos sus datos?'))) {
                                            clearData();
                                            replaceCharges([]);
                                            if (activeCarId) {
                                                deleteCar(activeCarId);
                                            }
                                            onClose();
                                        }
                                    }}
                                    className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    {t('cars.deleteCar', 'Borrar Coche')}
                                </button>
                            )}

                            {/* 4. Export trips */}
                            {hasData && (
                                <button
                                    onClick={() => { exportData(); onClose(); }}
                                    className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600/80 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    {t('upload.exportTrips')}
                                </button>
                            )}

                            {/* 5. Export charges */}
                            {hasCharges && (
                                <button
                                    onClick={() => { exportCharges(); onClose(); }}
                                    className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600/80 transition-colors flex items-center justify-center gap-2"
                                >
                                    <FileText className="w-4 h-4" />
                                    {t('upload.exportCharges')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {!isNative && (
                    <p className="text-slate-400 dark:text-slate-500 text-[10px] text-center mt-4">
                        {t('upload.tip')}
                    </p>
                )}
            </div>
        </div>
    );
};

export default DatabaseUploadModal;
