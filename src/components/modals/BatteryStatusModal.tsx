// BYD Stats - Battery Status Modal
// Shows live battery status and charging settings

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Battery, Zap, X } from '../Icons';
import { BYD_RED } from '@core/constants';
import { logger } from '@core/logger';
import { useApp } from '../../context/AppContext';
import { useCar } from '../../context/CarContext';
import { useData } from '../../providers/DataProvider';
import { useVehicleStatus } from '../../hooks/useVehicleStatus';
import { normalizeSoCToDecimal, normalizeSoCToPercent, getNumericBatterySize } from '../../utils/normalize';
import toast from 'react-hot-toast';

const BatteryStatusModal: React.FC = () => {
    const { modals, closeModal, aiSoH } = useData();
    const isOpen = modals.batteryStatus;
    const onClose = () => closeModal('batteryStatus');
    const { t } = useTranslation();
    const { settings, updateSettings } = useApp();
    const { activeCar } = useCar();
    const [isStoppingCharge, setIsStoppingCharge] = useState(false);
    const [isEditingTarget, setIsEditingTarget] = useState(false);
    const [editTargetValue, setEditTargetValue] = useState('');

    // PyBYD is the only connector
    const statusId = activeCar?.vin;

    // Use shared hook for vehicle status - only subscribe when modal is open
    const vehicleData = useVehicleStatus(statusId, { enabled: isOpen });

    // Calculate battery values - prioritize AI SoH over manual settings
    const batterySize = getNumericBatterySize(settings?.batterySize) || 82.5;
    const soh = aiSoH ?? (Number(settings?.soh) || 100);
    const usableBattery = batterySize * (soh / 100);
    const isAiSoH = aiSoH !== null;

    // Use normalize utilities for SoC conversion
    const currentSoC = normalizeSoCToDecimal(vehicleData?.lastSoC);
    const currentSoCPercent = normalizeSoCToPercent(vehicleData?.lastSoC);
    const currentKwh = currentSoC !== null ? usableBattery * currentSoC : null;

    const isCharging = vehicleData?.chargingActive === true;
    const isConnected = !!statusId;

    // Target SoC calculations
    const targetSoC = settings?.targetChargeSoC || 80;
    const targetKwh = usableBattery * (targetSoC / 100);
    const kwhToCharge = currentSoC !== null ? Math.max(0, targetKwh - (usableBattery * currentSoC)) : null;

    const handleStopCharge = async () => {
        if (!statusId) return;

        setIsStoppingCharge(true);
        try {
            // Mock PyBYD stop
            logger.info('[BatteryStatusModal] Stopping charge via PyBYD (Mock)');
            toast.success(t('charges.chargeStopped', 'Carga detenida (Simulado)'));
        } catch (error: unknown) {
            logger.error('[BatteryStatusModal] Error stopping charge:', error);
            toast.error(t('charges.stopError', 'Error al detener la carga'));
        } finally {
            setIsStoppingCharge(false);
        }
    };

    const handleTargetSoCChange = async (newTarget: number) => {
        updateSettings({ targetChargeSoC: newTarget });

        if (statusId) {
            try {
                // Start/Update polling (handled in LiveVehicleStatus)
                logger.info(`[BatteryStatusModal] Updated target SoC to ${newTarget}% for PyBYD`);
            } catch (err) {
                logger.error('[BatteryStatusModal] Failed to sync targetSoC:', err);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-backdrop" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

            <div
                role="dialog"
                aria-modal="true"
                className="relative bg-white dark:bg-slate-800 rounded-2xl p-0 max-w-sm w-full border border-slate-200 dark:border-slate-700 shadow-2xl animate-modal-content overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`p-5 text-white ${isCharging ? 'bg-gradient-to-r from-emerald-500 to-green-600' : 'bg-gradient-to-r from-slate-600 to-slate-700'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                                {isCharging ? (
                                    <Zap className="w-6 h-6 animate-pulse" />
                                ) : (
                                    <Battery className="w-6 h-6" />
                                )}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold">
                                    {isCharging ? t('status.charging', 'Cargando') : t('status.battery', 'Batería')}
                                </h2>
                                <p className="text-sm text-white/80">
                                    {isConnected ? t('status.connectedVia', 'Conectado (PyBYD)') : t('status.notConnected', 'Sin conectar')}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-white/20 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                    {/* Main Battery Stats */}
                    {isConnected && currentSoCPercent !== null ? (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4 text-center">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('status.currentSoC', 'SoC Actual')}</p>
                                    <p className="text-3xl font-black text-slate-900 dark:text-white">
                                        {currentSoCPercent}<span className="text-lg font-bold text-slate-400">%</span>
                                    </p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4 text-center">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('status.estimatedKwh', 'Energía Disponible')}</p>
                                    <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                                        {currentKwh?.toFixed(1)}<span className="text-lg font-bold text-slate-400">kWh</span>
                                    </p>
                                </div>
                            </div>

                            {/* Battery capacity info */}
                            <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500 dark:text-slate-400">{t('settings.batterySize', 'Capacidad nominal')}</span>
                                    <span className="font-medium text-slate-900 dark:text-white">{batterySize} kWh</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                        {t('settings.soh', 'Estado de Salud (SoH)')}
                                        {isAiSoH && <span className="text-[10px]">🧠</span>}
                                    </span>
                                    <span className={`font-medium ${isAiSoH ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>
                                        {typeof soh === 'number' ? soh.toFixed(1) : soh}%
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm border-t border-slate-200 dark:border-slate-600 pt-2">
                                    <span className="text-slate-500 dark:text-slate-400">{t('status.usableCapacity', 'Capacidad utilizable')}</span>
                                    <span className="font-bold text-slate-900 dark:text-white">{usableBattery.toFixed(1)} kWh</span>
                                </div>
                            </div>

                            {/* Charging info if charging */}
                            {isCharging && kwhToCharge !== null && (
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 border border-emerald-200 dark:border-emerald-800">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-xs text-emerald-600 dark:text-emerald-400">{t('status.chargingTo', 'Cargando hasta')} {targetSoC}%</p>
                                            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                                                +{kwhToCharge.toFixed(1)} kWh {t('status.remaining', 'restantes')}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleStopCharge}
                                            disabled={isStoppingCharge}
                                            className="px-4 py-2 rounded-xl font-medium text-sm text-white transition-all hover:opacity-90 disabled:opacity-50"
                                            style={{ backgroundColor: BYD_RED }}
                                        >
                                            {isStoppingCharge ? '...' : t('charges.stop', 'PARAR')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : !isConnected ? (
                        <div className="text-center py-6">
                            <Battery className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                            <p className="text-slate-500 dark:text-slate-400">
                                {t('status.connectVehicle', 'Vincula tu coche en Ajustes para ver el estado de la batería')}
                            </p>
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-3" />
                            <p className="text-slate-500 dark:text-slate-400">{t('status.loading', 'Cargando datos...')}</p>
                        </div>
                    )}

                    {/* Target SoC Setting - Only show if connected */}
                    {isConnected && (
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label htmlFor="targetSoCInput" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {t('settings.targetSoC', 'SoC Objetivo')}
                                    </label>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {t('settings.targetSoCDesc', 'Detener carga automáticamente')}
                                    </p>
                                </div>
                                {isEditingTarget ? (
                                    <div className="flex items-center gap-1">
                                        <input
                                            id="targetSoCInput"
                                            type="number"
                                            min="50"
                                            max="100"
                                            autoFocus
                                            value={editTargetValue}
                                            onChange={(e) => setEditTargetValue(e.target.value)}
                                            onBlur={() => {
                                                const val = Math.min(100, Math.max(50, parseInt(editTargetValue) || 80));
                                                handleTargetSoCChange(val);
                                                setIsEditingTarget(false);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const val = Math.min(100, Math.max(50, parseInt(editTargetValue) || 80));
                                                    handleTargetSoCChange(val);
                                                    setIsEditingTarget(false);
                                                } else if (e.key === 'Escape') {
                                                    setIsEditingTarget(false);
                                                }
                                            }}
                                            className="w-16 text-2xl font-bold text-center bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg border-2 border-emerald-500 outline-none"
                                        />
                                        <span className="text-sm text-slate-500">%</span>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => {
                                            setEditTargetValue(String(targetSoC));
                                            setIsEditingTarget(true);
                                        }}
                                        className="flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg px-2 py-1 transition-colors"
                                    >
                                        <span className="text-2xl font-bold text-slate-900 dark:text-white">{targetSoC}</span>
                                        <span className="text-sm text-slate-500">%</span>
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {[80, 85, 90, 95, 100].map(val => (
                                    <button
                                        key={val}
                                        onClick={() => handleTargetSoCChange(val)}
                                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${targetSoC === val
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                            }`}
                                    >
                                        {val}%
                                    </button>
                                ))}
                            </div>
                            {targetSoC < 100 && (
                                <p className="text-xs text-slate-400 text-center">
                                    = {(usableBattery * targetSoC / 100).toFixed(1)} kWh
                                </p>
                            )}
                        </div>
                    )}

                    {/* Auto-import toggle - Only show if connected */}
                    {isConnected && (
                        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3">
                            <div>
                                <p className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {t('settings.autoImportCharges', 'Auto-importar Cargas')}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {t('settings.autoImportChargesDesc', 'Guardar sesiones automáticamente')}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    const newValue = !settings?.autoImportCharges;
                                    updateSettings({ autoImportCharges: newValue });
                                }}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings?.autoImportCharges ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings?.autoImportCharges ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-700">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 rounded-xl font-medium text-white"
                        style={{ backgroundColor: BYD_RED }}
                    >
                        {t('common.close', 'Cerrar')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BatteryStatusModal;
