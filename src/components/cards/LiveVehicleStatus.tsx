// BYD Stats - Live Vehicle Status Component (StatCard format)
// Shows real-time vehicle status (charging state, SoC, etc.)

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Battery, Zap, Car } from '../Icons';
import { BYD_RED } from '@core/constants';
import { logger } from '@core/logger';
import { useCar } from '../../context/CarContext';
import { useLayout } from '../../context/LayoutContext';
import { useVehicleStatus } from '../../hooks/useVehicleStatus';
import { normalizeSoCToPercent } from '../../utils/normalize';
import toast from 'react-hot-toast';
import { useApp } from '@/context/AppContext';

interface LiveVehicleStatusProps {
    onClick?: () => void;
}

const LiveVehicleStatus: React.FC<LiveVehicleStatusProps> = ({ onClick }) => {
    const { t } = useTranslation();
    const { activeCar } = useCar();
    const { settings } = useApp();
    const { isCompact, isLargerCard, isVertical } = useLayout();
    const [isStoppingCharge, setIsStoppingCharge] = useState(false);
    const lastPollTime = useRef<number>(0);

    // PyBYD is the only connector now
    const statusId = activeCar?.vin;
    const isPybyd = activeCar?.connectorType === 'pybyd';

    // Use shared hook for vehicle status subscription
    const vehicleData = useVehicleStatus(statusId);

    // Polling Logic for Target SoC
    useEffect(() => {
        if (!isPybyd || !vehicleData?.chargingActive) return;

        const checkTargetSoC = async () => {
            const now = Date.now();
            if (now - lastPollTime.current < 60000) return; // Debounce 1 min
            lastPollTime.current = now;

            // Normalize: Settings is 0-100, data might be 0-1 or 0-100.
            const socPercent = normalizeSoCToPercent(vehicleData.lastSoC);
            const target = settings?.targetChargeSoC || 100;

            if (socPercent !== null && socPercent >= target) {
                logger.info(`[PyBYD] Target SoC reached (${socPercent}% >= ${target}%). Triggering stop...`);
                await handleStopCharge({ stopPropagation: () => { } } as React.MouseEvent);
            }
        };

        const interval = setInterval(checkTargetSoC, 60000);
        checkTargetSoC(); // Initial check

        return () => clearInterval(interval);
    }, [isPybyd, vehicleData?.chargingActive, vehicleData?.lastSoC, settings?.targetChargeSoC]);

    const handleStopCharge = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!statusId) return;

        setIsStoppingCharge(true);
        try {
            // Mock PyBYD stop
            logger.info('[LiveVehicleStatus] Stopping charge via PyBYD (Mock)');
            toast.success(t('charges.chargeStopped', 'Carga detenida (Simulado)'));
        } catch (error) {
            logger.error('[LiveVehicleStatus] Error stopping charge:', error);
            toast.error(t('charges.stopError', 'Error al detener la carga'));
        } finally {
            setIsStoppingCharge(false);
        }
    };

    // Compute display values using normalize utility
    const soc = normalizeSoCToPercent(vehicleData?.lastSoC);
    const isCharging = vehicleData?.chargingActive === true || ('isCharging' in (vehicleData ?? {}) && (vehicleData as { isCharging?: boolean })?.isCharging === true);
    const isConnected = !!statusId;
    const hasData = vehicleData !== null;
    const isTripping = vehicleData?.activeTripId != null;

    // Loading State (Skeleton) - REMOVED to allow clicking
    // if (isConnected && !hasData) { ... }

    // Determine what to show
    let Icon = Car;
    let label = t('status.vehicle', 'Vehículo');
    let value: string | number = '--';
    let unit = '';
    let colorClass = 'bg-slate-500/20 text-slate-400';
    let subText = '';

    if (!isConnected) {
        label = t('status.notConnected', 'Sin conectar');
        subText = t('status.linkLink', 'Vincular en Ajustes');
        colorClass = 'bg-slate-500/20 text-slate-400';
    } else if (!hasData) {
        // Loading state
        label = t('status.loading', 'Cargando...');
        subText = t('status.waitingData', 'Esperando datos...');
        Icon = Zap; // Default icon
        colorClass = 'bg-slate-100 dark:bg-slate-700 text-slate-400';
        value = '--';
    } else if (isCharging) {
        Icon = Zap;
        label = t('status.charging', 'Cargando');
        value = soc !== null ? soc : '--';
        unit = '%';
        colorClass = 'bg-emerald-500/20 text-emerald-400';
    } else if (isTripping) {
        Icon = Car;
        label = t('status.driving', 'En viaje');
        value = soc !== null ? soc : '--';
        unit = '%';
        colorClass = 'bg-blue-500/20 text-blue-400';
    } else if (soc !== null) {
        Icon = Battery;
        label = t('status.battery', 'Batería');
        value = soc;
        unit = '%';
        colorClass = soc > 50 ? 'bg-emerald-500/20 text-emerald-400' :
            soc > 20 ? 'bg-amber-500/20 text-amber-400' :
                'bg-red-500/20 text-red-400';
    }

    // Match StatCard exactly
    return (
        <div
            className={`bg-white dark:bg-slate-800/50 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700/50 flex items-stretch overflow-hidden ${isCompact ? (isLargerCard ? 'h-20' : 'h-16') : (isVertical ? 'h-20' : 'min-h-[80px] sm:min-h-[100px]')} ${onClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800' : ''} transition-colors`}
            onClick={onClick}
        >
            {/* Left colored icon section */}
            <div className={`flex items-center justify-center shrink-0 ${isCompact ? (isLargerCard ? 'w-14' : 'w-10') : (isVertical ? 'w-14' : 'w-14 sm:w-16')} ${colorClass}`}>
                <Icon className={`${isCompact ? (isLargerCard ? 'w-6 h-6' : 'w-5 h-5') : (isVertical ? 'w-6 h-6' : 'w-6 h-6 sm:w-7 sm:h-7')} ${isCharging ? 'animate-pulse' : ''}`} />
            </div>

            {/* Content section */}
            <div className="flex-1 flex flex-col items-center justify-center text-center px-2 py-1 min-w-0">
                <p
                    className="text-slate-600 dark:text-slate-400 leading-tight uppercase tracking-wider font-semibold truncate w-full"
                    style={{ fontSize: isCompact ? (isLargerCard ? '11px' : '9px') : (isVertical ? '9px' : '11px') }}
                >
                    {label}
                </p>
                <p
                    className="font-black text-slate-900 dark:text-white leading-none mt-1"
                    style={{ fontSize: isCompact ? (isLargerCard ? '28px' : '22px') : (isVertical ? '22px' : '28px') }}
                >
                    {value}
                    <span
                        className="text-slate-500 dark:text-slate-400 ml-1 font-bold"
                        style={{ fontSize: isCompact ? (isLargerCard ? '14px' : '10px') : (isVertical ? '10px' : '14px') }}
                    >
                        {unit}
                    </span>
                </p>

                {/* Sub text OR Stop button for charging */}
                {isCharging ? (
                    <button
                        onClick={handleStopCharge}
                        disabled={isStoppingCharge}
                        className="mt-1 px-2 py-0.5 rounded text-white font-bold transition-all hover:opacity-90 disabled:opacity-50"
                        style={{
                            fontSize: isCompact ? (isLargerCard ? '10px' : '8px') : (isVertical ? '8px' : '10px'),
                            backgroundColor: BYD_RED
                        }}
                    >
                        {isStoppingCharge ? '...' : t('charges.stop', 'PARAR')}
                    </button>
                ) : subText ? (
                    <p
                        className="leading-tight font-bold mt-1 truncate w-full text-slate-500 dark:text-slate-400"
                        style={{ fontSize: isCompact ? (isLargerCard ? '11px' : '9px') : (isVertical ? '9px' : '11px') }}
                    >
                        {subText}
                    </p>
                ) : isTripping ? (
                    <p
                        className="leading-tight font-bold mt-1 truncate w-full text-blue-500 dark:text-blue-400 animate-pulse"
                        style={{ fontSize: isCompact ? (isLargerCard ? '11px' : '9px') : (isVertical ? '9px' : '11px') }}
                    >
                        {t('status.tripActive', '● Viaje activo')}
                    </p>
                ) : null}
            </div>
        </div>
    );
};

export default LiveVehicleStatus;
