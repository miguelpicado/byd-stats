// BYD Stats - Database Upload Modal Component

import React from 'react';
import PropTypes from 'prop-types';
import { BYD_RED } from '../../utils/constants';
import { Upload, Database, Download, FileText } from '../Icons.jsx';
import ModalHeader from '../common/ModalHeader';
import { useTranslation } from 'react-i18next';

/**
 * Database upload/management modal
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Modal visibility
 * @param {Function} props.onClose - Close handler
 * @param {boolean} props.sqlReady - SQL.js ready state
 * @param {Function} props.onFileSelect - File selection handler
 * @param {Function} props.onExport - Export database handler
 * @param {Function} props.onClearData - Clear data handler
 * @param {Function} props.onLoadChargeRegistry - Load charge registry CSV handler
 * @param {boolean} props.hasData - Whether there is data loaded
 * @param {boolean} props.isNative - Native platform flag
 */
const DatabaseUploadModal = ({
    isOpen,
    onClose,
    sqlReady,
    onFileSelect,
    onExport,
    onClearData,
    onLoadChargeRegistry,
    hasData,
    isNative
}) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    const handleFileChange = (e, merge) => {
        const file = e.target.files[0];
        if (file) {
            onFileSelect(file, merge);
        }
        e.target.value = '';
    };

    const handleChargeRegistryChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            onLoadChargeRegistry(file);
            onClose();
        }
        e.target.value = '';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="database-modal-title"
                className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 max-h-[85vh] overflow-y-auto"
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
                            {/* Replace existing trips */}
                            <div>
                                <input
                                    type="file"
                                    id="uploadNew"
                                    accept="*/*,image/*,.db,.jpg,.jpeg"
                                    className="hidden"
                                    onChange={(e) => handleFileChange(e, false)}
                                    disabled={!sqlReady}
                                />
                                <button
                                    onClick={() => document.getElementById('uploadNew')?.click()}
                                    className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
                                    style={{ backgroundColor: BYD_RED }}
                                    disabled={!sqlReady}
                                >
                                    <Upload className="w-4 h-4" />
                                    {t('upload.loadNew')}
                                </button>
                            </div>

                            {/* Load only new trips (merge) */}
                            {hasData && (
                                <div>
                                    <input
                                        type="file"
                                        id="uploadMerge"
                                        accept="*/*,image/*,.db,.jpg,.jpeg"
                                        className="hidden"
                                        onChange={(e) => handleFileChange(e, true)}
                                        disabled={!sqlReady}
                                    />
                                    <button
                                        onClick={() => document.getElementById('uploadMerge')?.click()}
                                        className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600/80 transition-colors flex items-center justify-center gap-2"
                                        disabled={!sqlReady}
                                    >
                                        <Database className="w-4 h-4" />
                                        {t('upload.loadMerge')}
                                    </button>
                                </div>
                            )}

                            {/* Load charge registry (CSV) */}
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
                                    className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600/80 transition-colors flex items-center justify-center gap-2"
                                >
                                    <FileText className="w-4 h-4" />
                                    {t('upload.loadChargeRegistry')}
                                </button>
                            </div>

                            {/* Clear current view */}
                            {hasData && (
                                <button
                                    onClick={() => { onClearData(); onClose(); }}
                                    className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                                >
                                    {t('upload.clearView')}
                                </button>
                            )}

                            {/* Export trips */}
                            {hasData && (
                                <button
                                    onClick={() => { onExport(); onClose(); }}
                                    className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600/80 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    {t('upload.exportTrips')}
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

DatabaseUploadModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    sqlReady: PropTypes.bool,
    onFileSelect: PropTypes.func.isRequired,
    onExport: PropTypes.func.isRequired,
    onClearData: PropTypes.func.isRequired,
    onLoadChargeRegistry: PropTypes.func.isRequired,
    hasData: PropTypes.bool,
    isNative: PropTypes.bool
};

export default DatabaseUploadModal;
