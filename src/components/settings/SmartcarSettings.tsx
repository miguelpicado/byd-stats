import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/context/AppContext';
import { useCar } from '@/context/CarContext';
import SmartcarAuth from '@smartcar/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import toast from 'react-hot-toast';

interface SmartcarTestResponse {
    permissions: {
        [key: string]: {
            status: string;
        };
    };
    errors: string[];
}

export const SmartcarSettings: React.FC = () => {
    const { t } = useTranslation();
    const { settings } = useApp();
    const { activeCar, updateCar, activeCarId } = useCar();
    const [isLinking, setIsLinking] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);

    // Track previous battery size to detect changes
    const prevBatterySizeRef = useRef(settings?.batterySize);

    // Sync batterySize to Smartcar vehicle when it changes
    useEffect(() => {
        const currentBatterySize = settings?.batterySize;
        const smartcarVehicleId = activeCar?.smartcarVehicleId;

        // Only sync if batterySize actually changed and we have a connected vehicle
        if (smartcarVehicleId &&
            currentBatterySize &&
            currentBatterySize !== prevBatterySizeRef.current &&
            prevBatterySizeRef.current !== undefined) {

            const syncBatteryToVehicle = async () => {
                try {
                    const functions = getFunctions(getApp(), 'europe-west1');
                    const updateVehicle = httpsCallable(functions, 'updateVehicleSettings');
                    await updateVehicle({
                        vehicleId: smartcarVehicleId,
                        batteryCapacity: currentBatterySize
                    });
                    console.log(`Synced battery capacity ${currentBatterySize} kWh to vehicle ${smartcarVehicleId}`);
                } catch (error) {
                    console.error('Failed to sync battery capacity:', error);
                }
            };

            syncBatteryToVehicle();
        }

        prevBatterySizeRef.current = currentBatterySize;
    }, [settings?.batterySize, activeCar?.smartcarVehicleId]);

    // Smartcar Auth Setup
    const smartcar = useMemo(() => new SmartcarAuth({
        clientId: import.meta.env.VITE_SMARTCAR_CLIENT_ID,
        redirectUri: import.meta.env.VITE_SMARTCAR_REDIRECT_URI,
        scope: ['read_odometer', 'read_vehicle_info', 'read_charge', 'read_security', 'read_location', 'read_battery', 'read_tires', 'control_security', 'control_climate', 'control_trunk'],
        mode: 'live',
        onComplete: async (err, code) => {
            if (err) {
                console.error('Smartcar Auth Error:', err);
                toast.error(t('settings.smartcarError', 'Error vinculando con Smartcar'));
                return;
            }
            setIsLinking(true);
            try {
                const functions = getFunctions(getApp(), 'europe-west1');
                const exchange = httpsCallable(functions, 'exchangeAuthCode');
                // Pass batterySize so Cloud Functions know the battery capacity
                const batteryCapacity = settings?.batterySize || 82.5;
                const result = await exchange({ code, batteryCapacity });
                const response = result.data as { vehicleId: string; make: string; model: string };
                const { vehicleId, make, model } = response;

                // Save the smartcarVehicleId to the user's active car
                if (activeCarId && vehicleId) {
                    updateCar(activeCarId, { smartcarVehicleId: vehicleId });
                    console.log(`Linked Smartcar vehicle ${vehicleId} to car ${activeCarId}`);
                }

                toast.success(t('settings.smartcarSuccess', `¡Vinculado ${make} ${model}!`));
            } catch (error) {
                console.error('Exchange error:', error);
                toast.error(t('settings.smartcarExchangeError', 'Error intercambiando tokens'));
            } finally {
                setIsLinking(false);
            }
        },
    }), [t, settings?.batterySize, activeCarId, updateCar]);

    const handleSmartcarLink = () => {
        smartcar.openDialog({ forceApproval: true });
    };

    const handleSmartcarDisconnect = async () => {
        if (!confirm(t('settings.smartcarDisconnectConfirm', '¿Seguro que quieres desconectar tu coche? Perderás la sincronización automática.'))) {
            return;
        }

        setIsDisconnecting(true);
        try {
            const functions = getFunctions(getApp(), 'europe-west1');
            const disconnect = httpsCallable(functions, 'disconnectSmartcar');
            const smartcarVehicleId = activeCar?.smartcarVehicleId;

            if (!smartcarVehicleId) {
                toast.error('No hay ID de Smartcar vinculado');
                return;
            }

            await disconnect({ vehicleId: smartcarVehicleId });

            // Cleanup local state
            if (activeCarId) {
                updateCar(activeCarId, {
                    smartcarVehicleId: undefined,
                    lastOdometer: undefined,
                    lastSoC: undefined
                });
            }

            toast.success(t('settings.smartcarDisconnected', 'Coche desconectado correctamente'));
            window.location.reload(); // Refresh to update UI
        } catch (error) {
            console.error('Disconnect error:', error);
            toast.error(t('settings.smartcarDisconnectError', 'Error al desconectar el coche'));
        } finally {
            setIsDisconnecting(false);
        }
    };

    const handleTestConnection = async () => {
        if (!activeCar?.smartcarVehicleId) {
            toast.error('No hay vehículo vinculado');
            return;
        }

        console.log('Starting connection test for:', activeCar.smartcarVehicleId);
        toast.loading('Probando conexión...', { id: 'test-connection' });

        try {
            const functions = getFunctions(getApp(), 'europe-west1');
            const testConnection = httpsCallable(functions, 'testSmartcarConnection');
            console.log('Calling testSmartcarConnection Cloud Function...');
            const result = await testConnection({ vehicleId: activeCar.smartcarVehicleId });
            console.log('Cloud Function returned result:', result);

            const data = result.data as SmartcarTestResponse;
            console.log('Parsed test data:', data);

            const successCount = Object.values(data.permissions).filter((p) => p.status === 'SUCCESS').length;
            const totalCount = Object.keys(data.permissions).length;

            if (data.errors.length === 0) {
                toast.success(`✅ Conexión OK (${successCount}/${totalCount})`, { id: 'test-connection' });
            } else {
                toast.error(`⚠️ Errores: ${data.errors.join(', ')}`, { id: 'test-connection', duration: 8000 });
            }
        } catch (error) {
            console.error('Test error caught in frontend:', error);

            // Log more details about the error
            const err = error as { code?: string; details?: unknown; message?: string };
            if (err.code) console.error('Error code:', err.code);
            if (err.details) console.error('Error details:', err.details);

            toast.error(`Error: ${err.message || 'Error desconocido'}`, { id: 'test-connection' });
        }
    };

    return (
        <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span>🚗</span>
                {t('settings.smartcarTitle', 'Conexión BYD (Smartcar)')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('settings.smartcarDesc', 'Vincula tu cuenta de BYD para sincronizar viajes y estado automáticamente.')}
            </p>
            <button
                onClick={handleSmartcarLink}
                disabled={isLinking || isDisconnecting}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
                {isLinking ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <span>🔗</span>
                )}
                {t('settings.smartcarButton', 'Vincular Coche')}
            </button>

            {activeCar?.smartcarVehicleId && (
                <>
                    <button
                        onClick={handleTestConnection}
                        disabled={isLinking || isDisconnecting}
                        className="w-full py-2.5 px-4 rounded-xl bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
                    >
                        <span>🔍</span>
                        Probar Conexión
                    </button>

                    <button
                        onClick={handleSmartcarDisconnect}
                        disabled={isDisconnecting || isLinking}
                        className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
                    >
                        {isDisconnecting ? (
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <span>🔌</span>
                        )}
                        {t('settings.smartcarDisconnect', 'Desconectar Coche')}
                    </button>
                </>
            )}
        </div>
    );
};
