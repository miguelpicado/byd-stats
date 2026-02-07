// BYD Stats - Live Vehicle Status Component (StatCard format)
// Shows real-time vehicle status from Smartcar (charging state, SoC, etc.)

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Battery, Zap, Car } from '../Icons';
import { BYD_RED } from '@core/constants';
import { useCar } from '../../context/CarContext';
import { useLayout } from '../../context/LayoutContext';
import { getFirestore, doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import toast from 'react-hot-toast';

interface VehicleData {
    lastSoC?: number;
    chargingActive?: boolean;
    lastUpdate?: Timestamp;
    pollingActive?: boolean;
    activeTripId?: string;
    activeChargeSessionId?: string;
}

interface LiveVehicleStatusProps {
    onClick?: () => void;
}

const LiveVehicleStatus: React.FC<LiveVehicleStatusProps> = ({ onClick }) => {
    const { t } = useTranslation();
    const { activeCar } = useCar();
    const { isCompact, isLargerCard, isVertical } = useLayout();
    const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
    const [isStoppingCharge, setIsStoppingCharge] = useState(false);

    // Subscribe to vehicle document in Firestore
    useEffect(() => {
        if (!activeCar?.smartcarVehicleId) {
            setVehicleData(null);
            return;
        }

        const db = getFirestore(getApp());
        const vehicleRef = doc(db, 'vehicles', activeCar.smartcarVehicleId);

        const unsubscribe = onSnapshot(vehicleRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                setVehicleData(docSnapshot.data() as VehicleData);
            } else {
                setVehicleData(null);
            }
        }, (error) => {
            console.error('Error listening to vehicle status:', error);
        });

        return () => unsubscribe();
    }, [activeCar?.smartcarVehicleId]);

    const handleStopCharge = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!activeCar?.smartcarVehicleId) return;

        setIsStoppingCharge(true);
        try {
            const functions = getFunctions(getApp(), 'europe-west1');
            const stopCharge = httpsCallable(functions, 'stopCharge');
            await stopCharge({ vehicleId: activeCar.smartcarVehicleId });
            toast.success(t('charges.chargeStopped', 'Carga detenida'));
        } catch (error: any) {
            console.error('Error stopping charge:', error);
            toast.error(t('charges.stopError', 'Error al detener la carga'));
        } finally {
            setIsStoppingCharge(false);
        }
    };

    // Compute display values
    const soc = vehicleData?.lastSoC != null ? Math.round(vehicleData.lastSoC * 100) : null;
    const isCharging = vehicleData?.chargingActive === true;
    const isConnected = !!activeCar?.smartcarVehicleId;
    const hasData = vehicleData !== null;
    const isTripping = vehicleData?.activeTripId != null;

    // Determine what to show
    let Icon = Car;
    let label = t('status.vehicle', 'Vehículo');
    let value: string | number = '--';
    let unit = '';
    let colorClass = 'bg-slate-500/20 text-slate-400';
    let subText = '';

    if (!isConnected) {
        label = t('status.notConnected', 'Sin conectar');
        subText = t('status.linkSmartcar', 'Vincular en Ajustes');
        colorClass = 'bg-slate-500/20 text-slate-400';
    } else if (!hasData) {
        label = t('status.connecting', 'Conectando...');
        colorClass = 'bg-blue-500/20 text-blue-400';
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
