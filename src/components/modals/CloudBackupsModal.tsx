import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Cloud, Database, Download, FileText, AlertTriangle, Trash2 } from '../Icons';
import { useData } from '../../providers/DataProvider';
import { useCar } from '../../context/CarContext';

interface DriveFile {
    id: string;
    name: string;
    modifiedTime: string;
    size: number;
}

/**
 * Modal to display and restore from cloud backups
 */
const CloudBackupsModal: React.FC = () => {
    const { t } = useTranslation();
    const {
        closeModal,
        googleSync
    } = useData();
    const { activeCarId } = useCar();

    const [backups, setBackups] = useState<DriveFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [restoringId, setRestoringId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const loadBackups = useCallback(async () => {
        setLoading(true);
        try {
            if (!googleSync?.checkCloudBackups) {
                // If not available (e.g. mocked or offline), set empty
                setBackups([]);
                return;
            }
            const files = await googleSync.checkCloudBackups();
            // Sort by date desc
            const sorted = (files || []).sort((a: DriveFile, b: DriveFile) =>
                new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
            );
            setBackups(sorted);
        } catch (err) {
            console.error("Error loading backups", err);
            setError(t('errors.generic', 'Error cargando copias'));
        } finally {
            setLoading(false);
        }
    }, [googleSync, t]);

    useEffect(() => {
        if (googleSync?.isAuthenticated) {
            loadBackups();
        }
    }, [googleSync?.isAuthenticated, loadBackups]);

    const handleRestore = async (file: DriveFile) => {
        if (!confirm(t('common.confirmRestore', '¿Estás seguro de importar este archivo? Se fusionará con tus datos actuales.'))) {
            return;
        }

        setRestoringId(file.id);
        try {
            if (!googleSync?.importFromCloud) return;

            const success = await googleSync.importFromCloud(file.id);
            if (success) {
                alert(t('common.restoreSuccess', 'Datos importados correctamente.'));
                closeModal('backups');
            } else {
                alert(t('errors.restoreFailed', 'Error al importar datos.'));
            }
        } catch (err: any) {
            alert(err.message);
        } finally {
            setRestoringId(null);
        }
    };

    const handleDelete = async (file: DriveFile) => {
        if (!confirm(t('common.confirmDeleteBackup', '¿Estás seguro de eliminar esta copia? Esta acción no se puede deshacer.'))) {
            return;
        }

        setDeletingId(file.id);
        try {
            if (!googleSync?.deleteBackup) return;

            await googleSync.deleteBackup(file.id);
            await loadBackups();
        } catch (err: any) {
            alert(t('errors.deleteFailed', 'Error eliminando copia: ') + err.message);
        } finally {
            setDeletingId(null);
        }
    };

    const formatSize = (bytes: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const isCurrentFile = (filename: string) => {
        // Simple check if filename contains activeCarId
        if (!activeCarId) return filename === 'byd_stats_data.json';
        return filename.includes(activeCarId);
    };

    if (!googleSync) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-modal-backdrop">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col animate-modal-content">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <Cloud className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                {t('settings.cloudBackups', 'Copias en la Nube')}
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {t('settings.selectBackupToRestore', 'Selecciona un archivo para importar (o eliminar)')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => closeModal('backups')}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
                            <p className="text-sm">{t('common.loading', 'Cargando...')}</p>
                        </div>
                    ) : error ? (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-center text-sm">
                            {error}
                        </div>
                    ) : backups.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <Database className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>{t('errors.noBackupsFound', 'No se encontraron copias de seguridad')}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-xs rounded-lg flex gap-2 items-start">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <p>
                                    Importar un archivo fusionará sus viajes con los locales.
                                    Si el archivo pertenece a otro coche, asegúrate de que eso es lo que deseas.
                                </p>
                            </div>

                            {backups.map(file => {
                                const isCurrent = isCurrentFile(file.name);
                                return (
                                    <div
                                        key={file.id}
                                        className={`p-3 rounded-xl border transition-all ${isCurrent
                                            ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                                            : 'bg-white dark:bg-slate-700/30 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3 overflow-hidden">
                                                <div className="mt-1 p-1.5 bg-slate-100 dark:bg-slate-600 rounded-lg shrink-0">
                                                    <FileText className="w-4 h-4 text-slate-500 dark:text-slate-300" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-sm text-slate-900 dark:text-white truncate" title={file.name}>
                                                        {file.name}
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                        <span>{new Date(file.modifiedTime).toLocaleString()}</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                                        <span>{formatSize(file.size)}</span>
                                                    </div>
                                                    {isCurrent && (
                                                        <span className="inline-block mt-1.5 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] rounded-full font-medium">
                                                            Archivo Actual
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex gap-2 shrink-0">
                                                <button
                                                    onClick={() => handleDelete(file)}
                                                    disabled={deletingId === file.id || restoringId === file.id || googleSync.isSyncing}
                                                    className={`p-2 rounded-lg transition-colors ${deletingId === file.id
                                                        ? 'bg-red-50 dark:bg-red-900/30 text-red-400 cursor-wait'
                                                        : 'bg-slate-100 dark:bg-slate-700 hover:bg-red-100 dark:hover:bg-red-900/40 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400'
                                                        }`}
                                                    title={t('common.delete', 'Eliminar')}
                                                >
                                                    {deletingId === file.id ? (
                                                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleRestore(file)}
                                                    disabled={restoringId === file.id || deletingId === file.id || googleSync.isSyncing}
                                                    className={`p-2 rounded-lg transition-colors ${restoringId === file.id
                                                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-wait'
                                                        : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                                                        }`}
                                                    title={t('common.import', 'Importar')}
                                                >
                                                    {restoringId === file.id ? (
                                                        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <Download className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>


                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <button
                        onClick={() => closeModal('backups')}
                        className="w-full py-2.5 px-4 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                    >
                        {t('common.close', 'Cerrar')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CloudBackupsModal;
