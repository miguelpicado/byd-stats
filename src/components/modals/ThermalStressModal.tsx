// BYD Stats - ThermalStressModal Component
// Allows customization of the global thermal stress factor for SoH calculations

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Info, Thermometer } from '../Icons';
import ModalPortal from '../common/ModalPortal';
import { BYD_RED } from '@core/constants';

interface ThermalStressModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (val: number) => void;
    initialValue?: number;
}

const ThermalStressModal: React.FC<ThermalStressModalProps> = ({ isOpen, onClose, onSave, initialValue = 1.0 }) => {
    const { t } = useTranslation();
    const [value, setValue] = useState(initialValue);

    if (!isOpen) return null;

    const recommendations = [
        { temp: '< 15°C', factor: '0.90x', value: 0.9, desc: t('modals.thermalStress.recCold', 'Clima frío / Templado') },
        { temp: '15-25°C', factor: '1.00x', value: 1.0, desc: t('modals.thermalStress.recIdeal', 'Clima ideal / Estándar') },
        { temp: '25-35°C', factor: '1.20x', value: 1.2, desc: t('modals.thermalStress.recHot', 'Clima cálido / Veranos calurosos') },
        { temp: '> 35°C', factor: '1.50x', value: 1.5, desc: t('modals.thermalStress.recExtreme', 'Clima extremo / Desértico') },
    ];

    const handleSave = () => {
        onSave(typeof value === 'string' ? parseFloat(value) : value);
        onClose();
    };

    return (
        <ModalPortal>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-modal-backdrop" onClick={onClose}>
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

                <div
                    role="dialog"
                    aria-modal="true"
                    className="relative bg-white dark:bg-slate-800 rounded-2xl p-0 max-w-sm w-full border border-slate-200 dark:border-slate-700 shadow-2xl animate-modal-content"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                <Thermometer className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                {t('modals.thermalStress.title', 'Factor de Estrés Térmico')}
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
                    <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            {t('modals.thermalStress.desc', 'Ajusta el factor multiplicador según la temperatura media anual de donde vives. El calor acelera la degradación química de las celdas LFP.')}
                        </p>

                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-900/30 flex gap-3">
                            <Info className="w-5 h-5 text-blue-600 dark:text-blue-500 shrink-0" />
                            <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                                {t('modals.thermalStress.info', 'Este valor afecta globalmente al desgaste por ciclos y degradación SEI.')}
                            </p>
                        </div>

                        {/* Slider / Input */}
                        <div className="space-y-3 py-2">
                            <div className="flex justify-between items-end">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    {t('modals.thermalStress.factor', 'Factor Seleccionado')}
                                </label>
                                <span className="text-3xl font-black text-slate-900 dark:text-white">
                                    {(typeof value === 'string' ? parseFloat(value) : value).toFixed(2)}x
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0.8"
                                max="2.0"
                                step="0.05"
                                value={value}
                                onChange={(e) => setValue(parseFloat(e.target.value))}
                                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                            />
                        </div>

                        {/* Recommendations */}
                        <div className="space-y-2 pt-2">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                                {t('modals.thermalStress.recommendations', 'Recomendaciones')}
                            </h3>
                            <div className="grid grid-cols-1 gap-2">
                                {recommendations.map((rec) => (
                                    <button
                                        key={rec.temp}
                                        onClick={() => setValue(rec.value)}
                                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${Math.abs((typeof value === 'string' ? parseFloat(value) : value) - rec.value) < 0.01
                                            ? 'bg-orange-500/10 border-orange-500/50 text-orange-700 dark:text-orange-400 ring-2 ring-orange-500/20'
                                            : 'bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                                            }`}
                                    >
                                        <div className="text-left">
                                            <p className="text-xs font-bold">{rec.temp}</p>
                                            <p className="text-[10px] opacity-70">{rec.desc}</p>
                                        </div>
                                        <span className="text-sm font-black">{rec.factor}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-5 border-t border-slate-100 dark:border-slate-700">
                        <button
                            onClick={handleSave}
                            className="w-full py-3 rounded-xl font-medium text-white shadow-lg transition-transform active:scale-95"
                            style={{ backgroundColor: BYD_RED }}
                        >
                            {t('common.save', 'Guardar cambios')}
                        </button>
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
};

export default ThermalStressModal;
