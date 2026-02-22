// BYD Stats - Climate Control Modal Component
// Advanced climate control interface for BYD vehicles

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { BYD_RED } from '@/core/constants';
import { Thermometer, Wind, Battery } from '../Icons';
import ModalHeader from '../common/ModalHeader';
import { useData } from '../../providers/DataProvider';
import { useVehicleStatus } from '@/hooks/useVehicleStatus';
import {
    bydStartClimate,
    bydStopClimate,
    bydSeatClimate,
    bydBatteryHeat
} from '@/services/bydApi';

interface ClimateControlModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ClimateSettings {
    temperature: number;
    duration: number; // 10, 15, 20, 25, 30 minutes
    cycleMode: number; // 1 = Exterior, 2 = Interior
    driverSeatHeat: number; // 1 = off, 2 = low, 3 = high
    driverSeatVent: number; // 1 = off, 2 = low, 3 = high
    passengerSeatHeat: number;
    passengerSeatVent: number;
    batteryHeat: boolean;
}

const ClimateControlModal: React.FC<ClimateControlModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { settings } = useData();
    const vehicleStatus = useVehicleStatus();
    const connectedVin = settings.bydConnectedVin;
    const controlPin = settings.bydControlPin;

    const [isLoading, setIsLoading] = useState(false);
    const [climateSettings, setClimateSettings] = useState<ClimateSettings>({
        temperature: 22,
        duration: 15,
        cycleMode: 1, // Exterior by default
        driverSeatHeat: 1, // 1 = off (pyBYD scale)
        driverSeatVent: 1, // 1 = off (pyBYD scale)
        passengerSeatHeat: 1, // 1 = off (pyBYD scale)
        passengerSeatVent: 1, // 1 = off (pyBYD scale)
        batteryHeat: false,
    });

    const isClimateActive = vehicleStatus?.climateActive || false;

    // Duration options mapping to timeSpan (1-5)
    const durationOptions = [
        { minutes: 10, timeSpan: 1 },
        { minutes: 15, timeSpan: 2 },
        { minutes: 20, timeSpan: 3 },
        { minutes: 25, timeSpan: 4 },
        { minutes: 30, timeSpan: 5 },
    ];

    // Seat heat levels (pyBYD scale: 1=off, 2=low, 3=high)
    const seatLevels = [
        { label: t('climate.levelOff'), value: 1 },
        { label: t('climate.levelLow'), value: 2 },
        { label: t('climate.levelHigh'), value: 3 },
    ];

    const handleStartClimate = async () => {
        if (!connectedVin) {
            toast.error(t('climate.noVehicle'));
            return;
        }

        setIsLoading(true);
        try {
            // Convert duration to timeSpan (10/15/20/25/30 min → 1/2/3/4/5)
            const timeSpan = Math.floor(climateSettings.duration / 5) - 1;

            // Start climate with temperature and options
            const result = await bydStartClimate(
                connectedVin,
                climateSettings.temperature,
                controlPin,
                timeSpan,
                climateSettings.cycleMode
            );

            if (result.success) {
                toast.success(`Climate started at ${climateSettings.temperature}°C`);

                // Apply seat heating/ventilation if any is active (1=off, 2=low, 3=high)
                const hasAnySeatSetting =
                    climateSettings.driverSeatHeat > 1 ||
                    climateSettings.driverSeatVent > 1 ||
                    climateSettings.passengerSeatHeat > 1 ||
                    climateSettings.passengerSeatVent > 1;

                if (hasAnySeatSetting) {
                    await bydSeatClimate(connectedVin, {
                        mainHeat: climateSettings.driverSeatHeat,
                        mainVentilation: climateSettings.driverSeatVent,
                        copilotHeat: climateSettings.passengerSeatHeat,
                        copilotVentilation: climateSettings.passengerSeatVent,
                    }, controlPin);
                }

                // Apply battery heating if requested
                if (climateSettings.batteryHeat) {
                    await bydBatteryHeat(connectedVin, controlPin);
                }

                onClose();
            } else {
                toast.error(t('climate.startFailed'));
            }
        } catch (error: any) {
            console.error('Climate control error:', error);
            toast.error(error.message || t('climate.controlFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleStopClimate = async () => {
        if (!connectedVin) return;

        setIsLoading(true);
        try {
            const result = await bydStopClimate(connectedVin, controlPin);
            if (result.success) {
                toast.success(t('climate.stopped'));
                onClose();
            } else {
                toast.error(t('climate.stopFailed'));
            }
        } catch (error: any) {
            console.error('Stop climate error:', error);
            toast.error(error.message || t('climate.stopFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    const updateSetting = <K extends keyof ClimateSettings>(
        key: K,
        value: ClimateSettings[K]
    ) => {
        setClimateSettings(prev => ({ ...prev, [key]: value }));
    };

    if (!isOpen) return null;

    const inputClass = "w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 border border-slate-200 dark:border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50";
    const labelClass = "block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2";
    const sectionClass = "mb-6";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-backdrop" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="climate-control-modal-title"
                className="relative bg-white dark:bg-slate-800 rounded-2xl p-5 max-w-md w-full max-h-[85vh] overflow-y-auto border border-slate-200 dark:border-slate-700 animate-modal-content"
                style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
                onClick={(e) => e.stopPropagation()}
            >
                <ModalHeader
                    title={t('climate.title')}
                    Icon={Thermometer}
                    onClose={onClose}
                    id="climate-control-modal-title"
                    iconColor={isClimateActive ? '#10b981' : BYD_RED}
                    className="mb-4"
                />

                {/* Current Status */}
                {isClimateActive && (
                    <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                            ✓ Climate currently active
                        </p>
                    </div>
                )}

                <div className="space-y-6">
                    {/* Temperature Section */}
                    <div className={sectionClass}>
                        <label className={labelClass}>
                            <Thermometer className="inline w-4 h-4 mr-1.5" />
                            Temperature: {climateSettings.temperature}°C
                        </label>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500">15°</span>
                            <input
                                type="range"
                                min="15"
                                max="31"
                                value={climateSettings.temperature}
                                onChange={(e) => updateSetting('temperature', parseInt(e.target.value))}
                                className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                            />
                            <span className="text-xs text-slate-500">31°</span>
                        </div>
                    </div>

                    {/* Duration Section */}
                    <div className={sectionClass}>
                        <label className={labelClass}>Duration</label>
                        <div className="grid grid-cols-5 gap-2">
                            {durationOptions.map(({ minutes }) => (
                                <button
                                    key={minutes}
                                    type="button"
                                    onClick={() => updateSetting('duration', minutes)}
                                    className={`py-2 px-2 rounded-lg text-sm font-medium transition-all ${
                                        climateSettings.duration === minutes
                                            ? 'bg-red-500 text-white'
                                            : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    {minutes}m
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Recirculation Mode */}
                    <div className={sectionClass}>
                        <label className={labelClass}>
                            <Wind className="inline w-4 h-4 mr-1.5" />
                            Air Recirculation
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => updateSetting('cycleMode', 1)}
                                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-sm transition-all border-2 ${
                                    climateSettings.cycleMode === 1
                                        ? 'bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-300'
                                        : 'bg-slate-100 dark:bg-slate-700/50 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                Exterior
                            </button>
                            <button
                                type="button"
                                onClick={() => updateSetting('cycleMode', 2)}
                                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-sm transition-all border-2 ${
                                    climateSettings.cycleMode === 2
                                        ? 'bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-300'
                                        : 'bg-slate-100 dark:bg-slate-700/50 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                Interior
                            </button>
                        </div>
                    </div>

                    {/* Seat Climate - Driver */}
                    <div className={sectionClass}>
                        <label className={labelClass}>Driver Seat</label>
                        <div className="space-y-2">
                            <div>
                                <p className="text-xs text-slate-500 mb-1.5">🔥 Heating</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {seatLevels.map(({ label, value }) => (
                                        <button
                                            key={`driver-heat-${value}`}
                                            type="button"
                                            onClick={() => updateSetting('driverSeatHeat', value)}
                                            className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                                                climateSettings.driverSeatHeat === value
                                                    ? 'bg-orange-500 text-white'
                                                    : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 mb-1.5">❄️ Ventilation</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {seatLevels.map(({ label, value }) => (
                                        <button
                                            key={`driver-vent-${value}`}
                                            type="button"
                                            onClick={() => updateSetting('driverSeatVent', value)}
                                            className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                                                climateSettings.driverSeatVent === value
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Seat Climate - Passenger */}
                    <div className={sectionClass}>
                        <label className={labelClass}>Passenger Seat</label>
                        <div className="space-y-2">
                            <div>
                                <p className="text-xs text-slate-500 mb-1.5">🔥 Heating</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {seatLevels.map(({ label, value }) => (
                                        <button
                                            key={`passenger-heat-${value}`}
                                            type="button"
                                            onClick={() => updateSetting('passengerSeatHeat', value)}
                                            className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                                                climateSettings.passengerSeatHeat === value
                                                    ? 'bg-orange-500 text-white'
                                                    : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 mb-1.5">❄️ Ventilation</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {seatLevels.map(({ label, value }) => (
                                        <button
                                            key={`passenger-vent-${value}`}
                                            type="button"
                                            onClick={() => updateSetting('passengerSeatVent', value)}
                                            className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                                                climateSettings.passengerSeatVent === value
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Battery Heat */}
                    <div className={sectionClass}>
                        <label className={labelClass}>Battery Heating</label>
                        <button
                            type="button"
                            onClick={() => updateSetting('batteryHeat', !climateSettings.batteryHeat)}
                            className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-sm transition-all border-2 ${
                                climateSettings.batteryHeat
                                    ? 'bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-300'
                                    : 'bg-slate-100 dark:bg-slate-700/50 border-transparent text-slate-600 dark:text-slate-400'
                            }`}
                        >
                            <Battery className="w-4 h-4" />
                            <span>Battery Heating</span>
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3 pt-2">
                        {isClimateActive ? (
                            <button
                                onClick={handleStopClimate}
                                disabled={isLoading}
                                className="w-full py-3 rounded-xl font-medium text-white transition-colors hover:opacity-90 active:opacity-80 disabled:opacity-50 bg-slate-600"
                            >
                                {isLoading ? t('climate.stopping') : t('climate.stopButton')}
                            </button>
                        ) : (
                            <button
                                onClick={handleStartClimate}
                                disabled={isLoading}
                                className="w-full py-3 rounded-xl font-medium text-white transition-colors hover:opacity-90 active:opacity-80 disabled:opacity-50"
                                style={{ backgroundColor: BYD_RED }}
                            >
                                {isLoading ? t('climate.starting') : t('climate.startButton')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClimateControlModal;
