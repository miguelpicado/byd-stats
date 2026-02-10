import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, Trash2 } from '../Icons';
import { BYD_RED } from '@core/constants';
import { useApp } from '@/context/AppContext';

export const ChargingSettings: React.FC = () => {
    const { t } = useTranslation();
    const { settings, updateSettings } = useApp();

    // Charger types management
    const handleChargerTypeChange = useCallback((index: number, field: string, value: any) => {
        const updatedTypes = [...(settings.chargerTypes || [])];
        updatedTypes[index] = { ...updatedTypes[index], [field]: value };
        updateSettings({ ...settings, chargerTypes: updatedTypes });
    }, [settings, updateSettings]);

    const handleAddChargerType = useCallback(() => {
        const newType = {
            id: `custom_${Date.now()}`,
            name: t('settings.newChargerType'),
            speedKw: 7.4,
            efficiency: 0.90
        };
        const updatedTypes = [...(settings.chargerTypes || []), newType];
        updateSettings({ ...settings, chargerTypes: updatedTypes });
    }, [settings, updateSettings, t]);

    const handleDeleteChargerType = useCallback((index: number) => {
        const updatedTypes = (settings.chargerTypes || []).filter((_: any, i: number) => i !== index);
        updateSettings({ ...settings, chargerTypes: updatedTypes });
    }, [settings, updateSettings]);

    return (
        <div className="space-y-4">
            {/* Charger Types Section */}
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <span style={{ color: BYD_RED }}><Zap className="w-4 h-4" /></span>
                    {t('settings.chargerTypes')}
                </h3>

                {(settings?.chargerTypes || []).map((charger: any, index: number) => {
                    const nameId = `charger_${index}_name`;
                    const speedId = `charger_${index}_speed`;
                    const efficiencyId = `charger_${index}_efficiency`;

                    return (
                        <div key={charger.id} className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3 space-y-2">
                            <div className="flex items-center gap-2">
                                <label htmlFor={nameId} className="sr-only">{t('settings.chargerName')}</label>
                                <input
                                    id={nameId}
                                    name={nameId}
                                    type="text"
                                    value={charger?.name || ''}
                                    onChange={(e) => handleChargerTypeChange(index, 'name', e.target.value)}
                                    className="flex-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm border border-slate-200 dark:border-slate-600"
                                    placeholder={t('settings.chargerName')}
                                />
                                <button
                                    onClick={() => handleDeleteChargerType(index)}
                                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    title={t('settings.deleteChargerType')}
                                    aria-label={t('settings.deleteChargerType')}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label htmlFor={speedId} className="text-xs text-slate-500 dark:text-slate-400">{t('settings.chargerSpeed')}</label>
                                    <input
                                        id={speedId}
                                        name={speedId}
                                        type="number"
                                        step="0.1"
                                        value={charger?.speedKw || 0}
                                        onChange={(e) => handleChargerTypeChange(index, 'speedKw', parseFloat(e.target.value) || 0)}
                                        className="w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm border border-slate-200 dark:border-slate-600"
                                    />
                                </div>
                                <div>
                                    <label htmlFor={efficiencyId} className="text-xs text-slate-500 dark:text-slate-400">{t('settings.chargerEfficiency')}</label>
                                    <input
                                        id={efficiencyId}
                                        name={efficiencyId}
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="1"
                                        value={charger?.efficiency || 0}
                                        onChange={(e) => handleChargerTypeChange(index, 'efficiency', parseFloat(e.target.value) || 0)}
                                        className="w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm border border-slate-200 dark:border-slate-600"
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}

                <button
                    onClick={handleAddChargerType}
                    className="w-full py-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-sm"
                >
                    + {t('settings.addChargerType')}
                </button>
            </div>

            {/* Home Charging Configuration */}
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <span style={{ color: BYD_RED }}>⚡</span>
                    {t('settings.homeCharging', 'Carga Doméstica')}
                </h3>

                <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3 space-y-3">
                    <div>
                        <label htmlFor="homeChargerRating" className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('settings.chargerRating', 'Potencia del Cargador (Amperios)')}</label>
                        <div className="flex items-center gap-2">
                            <input
                                id="homeChargerRating"
                                name="homeChargerRating"
                                type="number"
                                value={settings.homeChargerRating || 8}
                                onChange={(e) => updateSettings({ ...settings, homeChargerRating: parseInt(e.target.value) || 0 })}
                                className="w-20 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm border border-slate-200 dark:border-slate-600"
                            />
                            <span className="text-xs text-slate-400">
                                ≈ {((settings.homeChargerRating || 8) * 230 / 1000).toFixed(1)} kW
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                            8A (1.8kW), 10A (2.3kW), 16A (3.7kW), 32A (7.4kW)
                        </p>
                    </div>

                    <div className="flex items-center justify-between">
                        <label id="offPeakLabel" className="text-sm text-slate-700 dark:text-slate-300">{t('settings.offPeakEnabled', 'Tarifa Valle (Horario Reducido)')}</label>
                        <button
                            aria-labelledby="offPeakLabel"
                            onClick={() => {
                                updateSettings({ ...settings, offPeakEnabled: !settings.offPeakEnabled });
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.offPeakEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.offPeakEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {settings.offPeakEnabled && (
                        <div className="space-y-3 pl-2 border-l-2 border-slate-200 dark:border-slate-600">
                            {/* Weekday Schedule */}
                            <div className="space-y-1">
                                <p className="block text-xs font-semibold text-slate-700 dark:text-slate-300">{t('settings.offPeakWeekday', 'Horario L-V')}</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label htmlFor="offPeakStart" className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">{t('settings.startTime', 'Inicio')}</label>
                                        <input
                                            id="offPeakStart"
                                            name="offPeakStart"
                                            type="time"
                                            value={settings.offPeakStart || "00:00"}
                                            onChange={(e) => updateSettings({ ...settings, offPeakStart: e.target.value })}
                                            className="w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm border border-slate-200 dark:border-slate-600"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="offPeakEnd" className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">{t('settings.endTime', 'Fin')}</label>
                                        <input
                                            id="offPeakEnd"
                                            name="offPeakEnd"
                                            type="time"
                                            value={settings.offPeakEnd || "08:00"}
                                            onChange={(e) => updateSettings({ ...settings, offPeakEnd: e.target.value })}
                                            className="w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm border border-slate-200 dark:border-slate-600"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Weekend Schedule */}
                            <div className="space-y-1">
                                <p className="block text-xs font-semibold text-slate-700 dark:text-slate-300">{t('settings.offPeakWeekend', 'Horario Fin de Semana')}</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label htmlFor="offPeakStartWeekend" className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">{t('settings.startTime', 'Inicio')}</label>
                                        <input
                                            id="offPeakStartWeekend"
                                            name="offPeakStartWeekend"
                                            type="time"
                                            value={settings.offPeakStartWeekend || settings.offPeakStart || "00:00"}
                                            onChange={(e) => updateSettings({ ...settings, offPeakStartWeekend: e.target.value })}
                                            className="w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm border border-slate-200 dark:border-slate-600"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="offPeakEndWeekend" className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">{t('settings.endTime', 'Fin')}</label>
                                        <input
                                            id="offPeakEndWeekend"
                                            name="offPeakEndWeekend"
                                            type="time"
                                            value={settings.offPeakEndWeekend || settings.offPeakEnd || "08:00"}
                                            onChange={(e) => updateSettings({ ...settings, offPeakEndWeekend: e.target.value })}
                                            className="w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm border border-slate-200 dark:border-slate-600"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="offPeakPrice" className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('settings.offPeakPrice', 'Precio Valle (€/kWh)')}</label>
                                <input
                                    id="offPeakPrice"
                                    name="offPeakPrice"
                                    type="number"
                                    step="0.001"
                                    value={settings.offPeakPrice || 0.05}
                                    onChange={(e) => updateSettings({ ...settings, offPeakPrice: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm border border-slate-200 dark:border-slate-600"
                                    placeholder="0.05"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
