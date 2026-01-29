import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, Check, CarFront } from '../Icons';
import { useData } from '../../providers/DataProvider';

/**
 * Modal to restore an existing car from the Registry on fresh install
 */
const RegistryRestoreModal = ({ registryCars, onRestore, onSkip }) => {
    const { t } = useTranslation();
    const [selectedCar, setSelectedCar] = useState(registryCars && registryCars.length > 0 ? registryCars[0] : null);
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        if (!selectedCar) return;
        setLoading(true);
        try {
            await onRestore(selectedCar);
        } catch (error) {
            console.error("Restore failed", error);
            alert(t('errors.restoreFailed', 'Error al restaurar'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-modal-backdrop">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-modal-content">
                {/* Header */}
                <div className="flex items-center gap-4 p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                        <Cloud className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            {t('sync.foundExistingCars', 'Coches encontrados')}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {t('sync.restoreMessage', 'Hemos encontrado coches en tu nube. ¿Quieres restaurar uno?')}
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        {t('sync.selectCarToRestore', 'Selecciona el coche que quieres sincronizar con este dispositivo:')}
                    </p>

                    <div className="space-y-3">
                        {registryCars.map(car => (
                            <div
                                key={car.id}
                                onClick={() => setSelectedCar(car)}
                                className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedCar?.id === car.id
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${selectedCar?.id === car.id ? 'bg-blue-200 dark:bg-blue-800' : 'bg-slate-100 dark:bg-slate-700'}`}>
                                        <CarFront className={`w-5 h-5 ${selectedCar?.id === car.id ? 'text-blue-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-900 dark:text-white">{car.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {car.model || 'BYD'} • Última sinc: {car.lastSync ? new Date(car.lastSync).toLocaleDateString() : 'N/A'}
                                        </p>
                                    </div>
                                </div>
                                {selectedCar?.id === car.id && (
                                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                                        <Check className="w-4 h-4 text-white" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-xs rounded-lg">
                        <span className="font-bold">Nota:</span> Si eliges "Crear nuevo", se generará un nuevo ID y un nuevo archivo de datos independiente.
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={onSkip}
                        className="flex-1 py-3 px-4 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-sm"
                    >
                        {t('sync.createNew', 'No, es un coche nuevo')}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedCar || loading}
                        className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Cloud className="w-5 h-5" />
                                {t('sync.restore', 'Restaurar Coche')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RegistryRestoreModal;


