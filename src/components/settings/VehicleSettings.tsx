import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { Calendar } from '../Icons';
import { useApp } from '@/context/AppContext';
import { useCar } from '@/context/CarContext';
import { useData } from '@/providers/DataProvider';

// Lazy load modals
const MfgDateModal = React.lazy(() => import('../modals/MfgDateModal'));

export const VehicleSettings: React.FC = () => {
    const { t } = useTranslation();
    const { settings, updateSettings } = useApp();
    const { activeCar, updateCar, activeCarId } = useCar();
    const { stats, aiSoH } = useData();
    const [showMfgModal, setShowMfgModal] = useState(false);

    // Get SoH data from summary
    const sohData = stats?.summary?.sohData;
    const currentSohMode = settings?.sohMode || 'manual';

    const handleBatterySave = async () => {
        if (!activeCar?.vin) return;
        try {
            console.log(`Syncing battery capacity for ${activeCar.vin}: ${settings.batterySize}`);
            const vehicleRef = doc(db, 'bydVehicles', activeCar.vin);
            await updateDoc(vehicleRef, {
                batteryCapacity: settings.batterySize
            });
        } catch (error) {
            console.error('Error syncing battery capacity:', error);
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <label htmlFor="carModel" className="block text-sm text-slate-600 dark:text-slate-400 mb-2">{t('settings.carModel')}</label>
                <input
                    id="carModel"
                    name="carModel"
                    type="text"
                    value={activeCar?.name || settings?.carModel || ''}
                    onChange={(e) => {
                        const newName = e.target.value;
                        updateSettings({ ...settings, carModel: newName });
                        if (activeCarId) updateCar(activeCarId, { name: newName });
                    }}
                    placeholder="BYD Seal"
                    className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600"
                />
            </div>

            <div>
                <label htmlFor="licensePlate" className="block text-sm text-slate-600 dark:text-slate-400 mb-2">{t('settings.licensePlate')}</label>
                <input
                    id="licensePlate"
                    name="licensePlate"
                    type="text"
                    value={settings?.licensePlate || ''}
                    onChange={(e) => updateSettings({ ...settings, licensePlate: e.target.value.toUpperCase() })}
                    placeholder="1234ABC"
                    className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600 uppercase"
                />
            </div>

            <div>
                <label htmlFor="insurancePolicy" className="block text-sm text-slate-600 dark:text-slate-400 mb-2">{t('settings.insurancePolicy')}</label>
                <input
                    id="insurancePolicy"
                    name="insurancePolicy"
                    type="text"
                    value={settings?.insurancePolicy || ''}
                    onChange={(e) => updateSettings({ insurancePolicy: e.target.value })}
                    placeholder="123456789"
                    className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600"
                />
            </div>

            <div>
                <label htmlFor="batterySize" className="block text-sm text-slate-600 dark:text-slate-400 mb-2">{t('settings.batterySize')}</label>
                <input
                    id="batterySize"
                    name="batterySize"
                    type="number"
                    step="0.01"
                    value={settings?.batterySize || 0}
                    onChange={(e) => updateSettings({ ...settings, batterySize: parseFloat(e.target.value) || 0 })}
                    onBlur={handleBatterySave}
                    className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600"
                />
            </div>

            <div className="space-y-3">
                <p className="block text-sm text-slate-600 dark:text-slate-400 mb-1">{t('settings.sohMode')}</p>

                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl" role="radiogroup" aria-label={t('settings.sohMode')}>
                    {(['manual', 'calculated', 'ai'] as const).map(mode => (
                        <button
                            key={mode}
                            role="radio"
                            aria-checked={currentSohMode === mode}
                            onClick={() => {
                                if (mode === 'calculated' && !settings.mfgDate) {
                                    setShowMfgModal(true);
                                }
                                updateSettings({ ...settings, sohMode: mode });
                            }}
                            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${currentSohMode === mode
                                ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            {mode === 'ai' ? 'SoH IA' : t(`settings.soh${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
                        </button>
                    ))}
                </div>

                {currentSohMode === 'manual' ? (
                    <div className="space-y-3">
                        <label htmlFor="soh" className="sr-only">{t('settings.sohMode')}</label>
                        <input
                            id="soh"
                            name="soh"
                            aria-label={t('settings.sohMode')}
                            type="number"
                            min="0"
                            max="100"
                            value={settings?.soh || 100}
                            onChange={(e) => updateSettings({ ...settings, soh: parseInt(e.target.value) || 100 })}
                            className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600"
                        />
                        <button
                            onClick={() => setShowMfgModal(true)}
                            className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                <span className="text-xs text-slate-600 dark:text-slate-400">{t('settings.mfgDate')}</span>
                            </div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                {settings.mfgDateDisplay || t('common.notSet', 'No definida')}
                            </span>
                        </button>
                    </div>
                ) : currentSohMode === 'calculated' ? (
                    <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4 space-y-3 border border-slate-100 dark:border-slate-700/50">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-500 dark:text-slate-400">{t('settings.estimatedSoh')}</span>
                            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{sohData?.estimated_soh || 100}%</span>
                        </div>
                    </div>
                ) : (
                    <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-xl p-4 space-y-3 border border-indigo-100 dark:border-indigo-800/30">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">SoH por Inteligencia Artificial</span>
                            <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                {aiSoH?.toFixed(1) || 100}%
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <React.Suspense fallback={null}>
                {showMfgModal && (
                    <MfgDateModal
                        isOpen={showMfgModal}
                        onClose={() => setShowMfgModal(false)}
                        onSave={(isoDate: string, displayDate: string) => {
                            updateSettings({
                                ...settings,
                                mfgDate: isoDate,
                                mfgDateDisplay: displayDate
                            });
                        }}
                        initialValue={settings.mfgDateDisplay}
                    />
                )}
            </React.Suspense>
        </div>
    );
};
