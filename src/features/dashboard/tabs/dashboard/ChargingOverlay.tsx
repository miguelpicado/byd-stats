import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, Battery, Clock, Target } from '@/components/Icons';
import { VehicleStatus } from '@/hooks/useVehicleStatus';
import { normalizeSoCToPercent } from '@/utils/normalize';
import { useApp } from '@/context/AppContext';

interface ChargingOverlayProps {
    vehicleStatus: VehicleStatus;
    batteryCapacityKwh: number;
}

const ChargingOverlay: React.FC<ChargingOverlayProps> = ({ vehicleStatus, batteryCapacityKwh }) => {
    const { t } = useTranslation();
    const { settings, updateSettings } = useApp();
    const [editingTarget, setEditingTarget] = useState(false);
    const [sliderValue, setSliderValue] = useState(settings?.targetChargeSoC ?? 80);

    const detail = vehicleStatus.chargingDetail;
    const socPercent = normalizeSoCToPercent(vehicleStatus.lastSoC);
    // lastPower is only populated during full T-Box polls (trips), never during cloud-only
    // charging probes. Use estimatedPowerKw from chargingDetail instead.
    const power = detail?.estimatedPowerKw != null
        ? detail.estimatedPowerKw
        : (vehicleStatus.lastPower ?? null);

    // Calculate kWh charged from initial SoC
    const initialSoCPercent = detail?.initialSoC != null ? normalizeSoCToPercent(detail.initialSoC) : null;
    const kwhCharged = (socPercent != null && initialSoCPercent != null && batteryCapacityKwh > 0)
        ? ((socPercent - initialSoCPercent) / 100) * batteryCapacityKwh
        : null;

    // Charge type
    const chargeType = detail?.chargeType ?? null;

    // Remaining time
    const remainingMinutes = detail?.remainingMinutes ?? null;
    const formatRemaining = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    // Target SoC
    const targetSoC = settings?.targetChargeSoC ?? 100;

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSliderValue(Number(e.target.value));
    };

    const handleSliderRelease = () => {
        updateSettings({ targetChargeSoC: sliderValue });
        setEditingTarget(false);
    };

    const rows: { icon: React.FC<any>; label: string; value: string; highlight?: boolean }[] = [
        {
            icon: Zap,
            label: t('charging.power', 'Potencia'),
            value: power != null ? `${Math.abs(power).toFixed(1)} kW` : '--',
            highlight: true
        },
        {
            icon: Battery,
            label: t('charging.currentSoC', 'SoC actual'),
            value: socPercent != null ? `${socPercent}%` : '--'
        },
        {
            icon: Zap,
            label: t('charging.chargeType', 'Tipo'),
            value: chargeType ?? '--'
        },
        {
            icon: Battery,
            label: t('charging.kwhCharged', 'Cargado'),
            value: kwhCharged != null ? `${kwhCharged.toFixed(1)} kWh` : '--'
        },
        {
            icon: Clock,
            label: t('charging.remaining', 'Restante'),
            value: remainingMinutes != null ? formatRemaining(remainingMinutes) : '--'
        }
    ];

    return (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-emerald-500/30 shadow-lg px-4 py-3 w-full">
                {/* Header */}
                <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-emerald-500 animate-pulse" />
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                        {t('charging.active', 'Cargando')}
                    </span>
                </div>

                {/* Parameter rows */}
                <div className="space-y-1.5">
                    {rows.map((row, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <row.icon className={`w-3.5 h-3.5 ${row.highlight ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`} />
                                <span className="text-xs text-slate-500 dark:text-slate-400">{row.label}</span>
                            </div>
                            <span className={`text-sm font-bold ${row.highlight ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-white'}`}>
                                {row.value}
                            </span>
                        </div>
                    ))}

                    {/* Target SoC - editable inline */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <Target className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                {t('charging.targetSoC', 'Objetivo')}
                            </span>
                        </div>
                        {editingTarget ? (
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="range"
                                    min={20}
                                    max={100}
                                    step={5}
                                    value={sliderValue}
                                    onChange={handleSliderChange}
                                    onMouseUp={handleSliderRelease}
                                    onTouchEnd={handleSliderRelease}
                                    className="w-20 h-1.5 accent-emerald-500"
                                    autoFocus
                                />
                                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 w-8 text-right">
                                    {sliderValue}%
                                </span>
                            </div>
                        ) : (
                            <button
                                onClick={(e) => { e.stopPropagation(); setEditingTarget(true); setSliderValue(targetSoC); }}
                                className="text-sm font-bold text-slate-800 dark:text-white hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors flex items-center gap-1"
                            >
                                {targetSoC}%
                                <span className="text-[10px] text-slate-400">✏️</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChargingOverlay;
