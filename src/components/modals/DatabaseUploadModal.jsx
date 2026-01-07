// BYD Stats - Database Upload Modal Component

import React from 'react';
import { BYD_RED } from '../../utils/constants';
import { Upload, Database, Download, Plus } from '../icons';

/**
 * Database upload/management modal
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Modal visibility
 * @param {Function} props.onClose - Close handler
 * @param {boolean} props.sqlReady - SQL.js ready state
 * @param {Function} props.onFileSelect - File selection handler
 * @param {Function} props.onExport - Export database handler
 * @param {Function} props.onClearData - Clear data handler
 * @param {Function} props.onShowHistory - Show history modal handler
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
    onShowHistory,
    hasData,
    isNative
}) => {
    if (!isOpen) return null;

    const handleFileChange = (e, merge) => {
        const file = e.target.files[0];
        if (file) {
            onFileSelect(file, merge);
        }
        e.target.value = '';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
            <div
                className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Gestión de datos</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                        <Plus className="w-6 h-6 rotate-45" />
                    </button>
                </div>

                <div className="space-y-3">
                    {/* Import new database */}
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
                            className="w-full py-3 px-4 rounded-xl font-medium text-white flex items-center justify-center gap-2"
                            style={{ backgroundColor: BYD_RED }}
                            disabled={!sqlReady}
                        >
                            <Upload className="w-5 h-5" />
                            Cargar nueva base de datos
                        </button>
                    </div>

                    {/* Merge databases */}
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
                                className="w-full py-3 px-4 rounded-xl font-medium text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                                disabled={!sqlReady}
                            >
                                <Database className="w-5 h-5" />
                                Combinar con datos actuales
                            </button>
                        </div>
                    )}

                    {/* Export database */}
                    {hasData && (
                        <button
                            onClick={() => { onExport(); onClose(); }}
                            className="w-full py-3 px-4 rounded-xl font-medium text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <Download className="w-5 h-5" />
                            Exportar base de datos
                        </button>
                    )}

                    {/* History */}
                    <button
                        onClick={() => { onShowHistory(); onClose(); }}
                        className="w-full py-3 px-4 rounded-xl font-medium text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                    >
                        <Database className="w-5 h-5" />
                        Historial de viajes
                    </button>

                    {/* Clear data */}
                    {hasData && (
                        <button
                            onClick={() => { onClearData(); onClose(); }}
                            className="w-full py-3 px-4 rounded-xl font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                        >
                            Borrar todos los datos
                        </button>
                    )}
                </div>

                {!isNative && (
                    <p className="text-slate-500 dark:text-slate-400 text-xs text-center mt-4">
                        💡 Si tu navegador no muestra archivos .db, renómbralo a .jpg
                    </p>
                )}
            </div>
        </div>
    );
};

export default DatabaseUploadModal;
