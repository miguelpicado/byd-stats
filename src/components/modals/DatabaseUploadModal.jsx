// BYD Stats - Database Upload Modal Component

import React from 'react';
import { BYD_RED } from '../../utils/constants';
import { Upload, Database, Download, Plus } from '../Icons.jsx';

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
    onSaveToHistory,
    onClearHistory,
    hasData,
    historyCount,
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
                className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 max-h-[85vh] overflow-y-auto"
                style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
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

                <div className="space-y-4">
                    {/* Section 1: History Management */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            Historial ({historyCount} viajes)
                        </h3>
                        <div className="space-y-2">
                            <button
                                onClick={() => { onSaveToHistory(); onClose(); }}
                                className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors"
                                style={{ backgroundColor: BYD_RED }}
                                disabled={!hasData}
                            >
                                Guardar viajes actuales al historial
                            </button>
                            <button
                                onClick={() => { onShowHistory(); onClose(); }}
                                className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600/80 transition-colors"
                            >
                                Ver / Cargar historial
                            </button>
                            {historyCount > 0 && (
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => { onExport(); onClose(); }}
                                        className="py-2.5 px-4 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600/80 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Download className="w-4 h-4" /> Exportar
                                    </button>
                                    <button
                                        onClick={() => { onClearHistory(); onClose(); }}
                                        className="py-2.5 px-4 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                    >
                                        Borrar historial
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Section 2: File Operations */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Archivos / Base de Datos BYD
                        </h3>
                        <div className="space-y-2">
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
                                    className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600/80 transition-colors flex items-center justify-center gap-2"
                                    disabled={!sqlReady}
                                >
                                    <Upload className="w-4 h-4" />
                                    Cargar nuevos viajes (Reemplazar)
                                </button>
                            </div>

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
                                        Cargar sólo viajes nuevos (Combinar)
                                    </button>
                                </div>
                            )}

                            {/* Clear current view only */}
                            {hasData && (
                                <button
                                    onClick={() => { onClearData(); onClose(); }}
                                    className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                                >
                                    Limpiar vista actual (No borra historial)
                                </button>
                            )}

                            {hasData && (
                                <button
                                    onClick={() => { onExport(); onClose(); }}
                                    className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600/80 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Exportar viajes
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {!isNative && (
                    <p className="text-slate-400 dark:text-slate-500 text-[10px] text-center mt-4">
                        Consejo: Si el archivo .db no aparece, prueba a renombrarlo a .jpg
                    </p>
                )}
            </div>
        </div>
    );
};

export default DatabaseUploadModal;
