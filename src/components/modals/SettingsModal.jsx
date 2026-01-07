// BYD Stats - Settings Modal Component

import React from 'react';
import { BYD_RED } from '../../utils/constants';
import { Settings } from '../icons';

/**
 * Settings modal for app configuration
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Modal visibility
 * @param {Function} props.onClose - Close handler
 * @param {Object} props.settings - Current settings object
 * @param {Function} props.onSettingsChange - Settings change handler
 */
const SettingsModal = ({ isOpen, onClose, settings, onSettingsChange }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                    <Settings className="w-6 h-6" style={{ color: BYD_RED }} />
                    Configuración
                </h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Modelo del coche</label>
                        <input
                            type="text"
                            value={settings.carModel}
                            onChange={(e) => onSettingsChange({ ...settings, carModel: e.target.value })}
                            placeholder="BYD Seal"
                            className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Matrícula</label>
                        <input
                            type="text"
                            value={settings.licensePlate}
                            onChange={(e) => onSettingsChange({ ...settings, licensePlate: e.target.value.toUpperCase() })}
                            placeholder="1234ABC"
                            className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600 uppercase"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Nº Póliza del seguro</label>
                        <input
                            type="text"
                            value={settings.insurancePolicy}
                            onChange={(e) => onSettingsChange({ ...settings, insurancePolicy: e.target.value })}
                            placeholder="123456789"
                            className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Tamaño de la batería (kWh)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={settings.batterySize}
                            onChange={(e) => onSettingsChange({ ...settings, batterySize: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">State of Health - SoH (%)</label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            value={settings.soh}
                            onChange={(e) => onSettingsChange({ ...settings, soh: parseInt(e.target.value) || 100 })}
                            className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Precio de electricidad (€/kWh)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={settings.electricityPrice}
                            onChange={(e) => onSettingsChange({ ...settings, electricityPrice: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Tema</label>
                        <div className="flex gap-2">
                            {['auto', 'light', 'dark'].map(theme => (
                                <button
                                    key={theme}
                                    onClick={() => onSettingsChange({ ...settings, theme })}
                                    className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${settings.theme === theme
                                            ? 'text-white'
                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                                        }`}
                                    style={{
                                        backgroundColor: settings.theme === theme ? BYD_RED : ''
                                    }}
                                >
                                    {theme === 'auto' ? 'Automático' : theme === 'light' ? 'Claro' : 'Oscuro'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="w-full mt-6 py-3 rounded-xl font-medium text-white"
                    style={{ backgroundColor: BYD_RED }}
                >
                    Guardar
                </button>
            </div>
        </div>
    );
};

export default SettingsModal;
