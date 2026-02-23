import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Unlock, Flashlight, WindowUp, Thermometer } from '@/components/Icons';
import { useCar } from '@/context/CarContext';
import { useVehicleStatus } from '@/hooks/useVehicleStatus';
import { useLayout } from '@/context/LayoutContext';
import { useData } from '@/providers/DataProvider';
import { bydLock, bydUnlock, bydStartClimate, bydStopClimate, bydFlashLights, bydHonkHorn, bydCloseWindows, bydSeatClimate, bydWakeVehicle } from '@/services/bydApi';
import toast from 'react-hot-toast';
import { logger } from '@core/logger';

const QuickActions: React.FC = () => {
    const { t } = useTranslation();
    const { activeCar } = useCar();
    const { isNative } = useLayout();
    const vehicleStatus = useVehicleStatus(activeCar?.vin);
    const { openModal } = useData();
    const [loadingButton, setLoadingButton] = useState<string | null>(null);

    // Optimistic state updates (UI reflects action immediately, then syncs with Firestore)
    const [optimisticLocked, setOptimisticLocked] = useState<boolean | null>(null);
    const [optimisticClimate, setOptimisticClimate] = useState<boolean | null>(null);

    // Use optimistic state if available, otherwise fall back to server state
    const isLocked = optimisticLocked ?? vehicleStatus?.isLocked ?? false;
    const areWindowsOpen = vehicleStatus?.windows && Object.values(vehicleStatus.windows).some(isOpen => isOpen);
    const climateActive = optimisticClimate ?? vehicleStatus?.climateActive ?? false;

    // Long press state
    const flashTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const climateTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const isFlashLongPress = useRef(false);
    const isClimateLongPress = useRef(false);

    const handleCommand = async (
        command: string,
        fn: (vin: string, ...args: any[]) => Promise<any>,
        optimisticUpdate?: () => void,
        ...args: any[]
    ) => {
        // Validate vehicle connectivity
        if (!activeCar) {
            toast.error(t('errors.noVehicle', 'No vehicle selected'));
            logger.warn('[QuickActions] No active car selected');
            return;
        }

        if (!activeCar.vin) {
            toast.error('Vehicle VIN not available. Please reconnect your BYD account.');
            logger.error('[QuickActions] Active car missing VIN');
            return;
        }

        if (activeCar.connectorType !== 'pybyd') {
            toast.error('Remote control requires direct BYD account connection');
            logger.warn(`[QuickActions] Car connectorType is ${activeCar.connectorType}, need 'pybyd'`);
            return;
        }

        if (!isNative) {
            toast.error('Remote control only available in the mobile app');
            logger.warn('[QuickActions] Remote control attempted in PWA mode');
            return;
        }

        setLoadingButton(command);

        // Apply optimistic update immediately for better UX
        optimisticUpdate?.();

        try {
            const result = await fn(activeCar.vin, ...args);
            if (result.success) {
                toast.success(t('messages.commandSuccess', 'Command sent successfully'));

                // Refresh vehicle state after successful command
                logger.info(`[QuickActions] Command ${command} succeeded, refreshing vehicle state...`);
                setTimeout(() => {
                    bydWakeVehicle(activeCar.vin!).catch(err => {
                        logger.warn('[QuickActions] Failed to refresh vehicle state:', err);
                    });
                }, 1000);
            } else {
                toast.error(t('messages.commandFailed', 'Command failed'));
                // Revert optimistic update on failure
                setOptimisticLocked(null);
                setOptimisticClimate(null);
            }
        } catch (error: any) {
            logger.error(`[QuickActions] Command ${command} failed:`, error);

            // Revert optimistic update on error
            setOptimisticLocked(null);
            setOptimisticClimate(null);

            // Extract error information
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'Remote control failed';

            // Create user-friendly error messages
            let userMessage = errorMessage;
            if (errorCode === 'functions/internal') {
                userMessage = 'Backend error. The command may have succeeded despite this error.';
            } else if (errorCode === 'functions/failed-precondition' && errorMessage.includes('1009')) {
                userMessage = 'PIN verification failed. Please reconnect your BYD account to update the PIN.';
            } else if (errorCode === 'functions/unauthenticated') {
                userMessage = 'Authentication failed. Please reconnect your BYD account.';
            } else if (errorMessage.includes('timeout')) {
                userMessage = 'Vehicle not responding. Make sure it\'s online and try again.';
            }

            toast.error(userMessage, { duration: 6000 });
        } finally {
            setLoadingButton(null);
        }
    };

    const handleLock = async () => {
        if (isLocked) {
            await handleCommand(
                'undo_lock',
                bydUnlock,
                () => setOptimisticLocked(false) // Optimistically unlock
            );
        } else {
            if (areWindowsOpen) {
                toast(t('messages.closingWindows', 'Closing windows...'), { icon: '🪟' });
                await handleCommand('windows', bydCloseWindows);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            await handleCommand(
                'lock',
                bydLock,
                () => setOptimisticLocked(true) // Optimistically lock
            );
        }
    };

    // Flash: short press = flash lights, long press = honk horn
    const handleFlashDown = () => {
        isFlashLongPress.current = false;
        flashTimerRef.current = setTimeout(() => {
            isFlashLongPress.current = true;
            handleCommand('honk', bydHonkHorn);
        }, 600);
    };

    const handleFlashUp = () => {
        clearTimeout(flashTimerRef.current);
        if (!isFlashLongPress.current) {
            handleCommand('flash', bydFlashLights);
        }
    };

    const handleFlashLeave = () => {
        clearTimeout(flashTimerRef.current);
    };

    // Climate: short press = toggle on/off, long press = open advanced modal
    const handleClimateDown = () => {
        isClimateLongPress.current = false;
        climateTimerRef.current = setTimeout(() => {
            isClimateLongPress.current = true;
            openModal('climateControl');
        }, 600);
    };

    const handleClimateUp = () => {
        clearTimeout(climateTimerRef.current);
        if (!isClimateLongPress.current) {
            handleClimateToggle();
        }
    };

    const handleClimateLeave = () => {
        clearTimeout(climateTimerRef.current);
    };

    const handleClimateToggle = async () => {
        if (climateActive) {
            await handleCommand(
                'climate_off',
                bydStopClimate,
                () => setOptimisticClimate(false) // Optimistically stop climate
            );
        } else {
            // Smart climate logic
            const currentTemp = vehicleStatus?.interiorTemp ?? vehicleStatus?.exteriorTemp ?? 15;
            const isCold = currentTemp < 20;

            if (isCold) {
                toast(t('messages.heating', 'Heating...'), { icon: '🔥' });
                await handleCommand(
                    'heat',
                    async (vin) => {
                        await bydStartClimate(vin, 22);
                        await bydSeatClimate(vin, {
                            mainHeat: 3, // Driver seat heat high
                            mainVentilation: 1,
                            copilotHeat: 1,
                            copilotVentilation: 1
                        });
                        return { success: true };
                    },
                    () => setOptimisticClimate(true) // Optimistically start climate
                );
            } else {
                toast(t('messages.cooling', 'Cooling...'), { icon: '❄️' });
                await handleCommand(
                    'cool',
                    async (vin) => {
                        await bydStartClimate(vin, 21);
                        await bydSeatClimate(vin, {
                            mainHeat: 1, // Seat off
                            mainVentilation: 1,
                            copilotHeat: 1,
                            copilotVentilation: 1
                        });
                        return { success: true };
                    },
                    () => setOptimisticClimate(true) // Optimistically start climate
                );
            }
        }
    };

    const actions = [
        {
            id: 'lock',
            label: isLocked ? t('actions.unlock', 'Unlock') : t('actions.lock', 'Lock'),
            icon: isLocked ? Unlock : Lock,
            color: isLocked ? 'bg-green-600' : 'bg-red-600',
            action: handleLock,
            loading: loadingButton === 'lock' || loadingButton === 'undo_lock'
        },
        {
            id: 'windows',
            label: t('actions.windows', 'Windows'),
            icon: WindowUp,
            color: 'bg-slate-600',
            action: () => handleCommand('windows', bydCloseWindows),
            loading: loadingButton === 'windows'
        },
        {
            id: 'flash',
            label: t('actions.flash', 'Flash'),
            icon: Flashlight,
            color: 'bg-yellow-600',
            action: () => {}, // Handled by onPointerDown/Up
            onPointerDown: handleFlashDown,
            onPointerUp: handleFlashUp,
            onPointerLeave: handleFlashLeave,
            loading: loadingButton === 'flash' || loadingButton === 'honk'
        },
        {
            id: 'climate',
            label: climateActive ? t('actions.climateOff', 'Stop') : t('actions.climate', 'Climate'),
            icon: Thermometer,
            color: climateActive ? 'bg-green-600' : 'bg-orange-600',
            action: () => {}, // Handled by onPointerDown/Up
            onPointerDown: handleClimateDown,
            onPointerUp: handleClimateUp,
            onPointerLeave: handleClimateLeave,
            loading: loadingButton === 'heat' || loadingButton === 'cool' || loadingButton === 'climate_off'
        },
    ];

    /*
    const handleTestPin = async () => {
        if (!activeCar?.vin) {
            toast.error('No vehicle selected');
            return;
        }

        toast.loading('Testing PIN configuration...', { id: 'pin-test' });

        try {
            // Try to call a simple command to test PIN
            const result = await bydFlashLights(activeCar.vin);
            toast.success('PIN is configured correctly!', { id: 'pin-test' });
            console.log('[QuickActions] PIN test result:', result);
        } catch (error: any) {
            toast.error(`PIN test failed: ${error.message}`, { id: 'pin-test', duration: 8000 });
            console.error('[QuickActions] PIN test failed:', error);
        }
    };
    */

    return (
        <div className="grid grid-cols-4 gap-2 w-full shrink-0">
            {actions.map((action) => (
                <button
                    key={action.id}
                    onClick={action.action}
                    onPointerDown={(action as any).onPointerDown}
                    onPointerUp={(action as any).onPointerUp}
                    onPointerLeave={(action as any).onPointerLeave}
                    disabled={!!loadingButton}
                    className={`${action.color} rounded-xl p-2 flex flex-row items-center justify-center gap-2 text-white shadow-lg active:scale-95 transition-transform h-12 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {action.loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <action.icon className="w-5 h-5" />
                    )}
                    <span className="text-[10px] font-bold uppercase hidden sm:block">{action.label}</span>
                </button>
            ))}
        </div>
    );
};

export default QuickActions;
