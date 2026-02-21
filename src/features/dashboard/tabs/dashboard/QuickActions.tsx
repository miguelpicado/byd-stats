import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Unlock, Flashlight, WindowUp, Thermometer } from '@/components/Icons';
import { useCar } from '@/context/CarContext';
import { useVehicleStatus } from '@/hooks/useVehicleStatus';
import { useData } from '@/providers/DataProvider';
import { bydLock, bydUnlock, bydStartClimate, bydStopClimate, bydFlashLights, bydHonkHorn, bydCloseWindows, bydSeatClimate } from '@/services/bydApi';
import toast from 'react-hot-toast';

const QuickActions: React.FC = () => {
    const { t } = useTranslation();
    const { activeCar } = useCar();
    const vehicleStatus = useVehicleStatus(activeCar?.vin);
    const { openModal } = useData();
    const [loadingButton, setLoadingButton] = useState<string | null>(null);
    const isLocked = vehicleStatus?.isLocked === true;
    const areWindowsOpen = vehicleStatus?.windows && Object.values(vehicleStatus.windows).some(isOpen => isOpen);
    const climateActive = vehicleStatus?.climateActive === true;

    // Long press state
    const flashTimerRef = useRef<NodeJS.Timeout>();
    const climateTimerRef = useRef<NodeJS.Timeout>();
    const isFlashLongPress = useRef(false);
    const isClimateLongPress = useRef(false);

    const handleCommand = async (
        command: string,
        fn: (vin: string, ...args: any[]) => Promise<any>,
        ...args: any[]
    ) => {
        if (!activeCar?.vin) {
            toast.error(t('errors.noVehicle', 'No vehicle selected'));
            return;
        }

        setLoadingButton(command);
        try {
            const result = await fn(activeCar.vin, ...args);
            if (result.success) {
                toast.success(t('messages.commandSuccess', 'Command sent successfully'));
            } else {
                toast.error(t('messages.commandFailed', 'Command failed'));
            }
        } catch (error: any) {
            console.error(`[QuickActions] Full error object:`, error);

            // Extract all possible error information
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'Remote control failed';
            const errorDetails = error.details || null;

            console.error(`[QuickActions] Code: ${errorCode}`);
            console.error(`[QuickActions] Message: ${errorMessage}`);
            if (errorDetails) {
                console.error(`[QuickActions] Details:`, errorDetails);
            }

            // Create user-friendly error messages
            let userMessage = errorMessage;
            if (errorCode === 'functions/internal') {
                userMessage = 'Backend error. Check Firebase logs for details.';
            } else if (errorCode === 'functions/failed-precondition' && errorMessage.includes('1009')) {
                userMessage = 'PIN verification failed. Please reconnect your BYD account to update the PIN.';
            }

            // Show toast with appropriate duration
            toast.error(userMessage, { duration: 8000 });
        } finally {
            setLoadingButton(null);
        }
    };

    const handleLock = async () => {
        if (isLocked) {
            await handleCommand('undo_lock', bydUnlock);
        } else {
            if (areWindowsOpen) {
                toast(t('messages.closingWindows', 'Closing windows...'), { icon: '🪟' });
                await handleCommand('windows', bydCloseWindows);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            await handleCommand('lock', bydLock);
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
            await handleCommand('climate_off', bydStopClimate);
        } else {
            // Smart climate logic
            const currentTemp = vehicleStatus?.interiorTemp ?? vehicleStatus?.exteriorTemp ?? 15;
            const isCold = currentTemp < 20;

            if (isCold) {
                toast(t('messages.heating', 'Heating...'), { icon: '🔥' });
                await handleCommand('heat', async (vin) => {
                    await bydStartClimate(vin, 22);
                    await bydSeatClimate(vin, 0, 2); // Driver seat heat high
                    return { success: true };
                });
            } else {
                toast(t('messages.cooling', 'Cooling...'), { icon: '❄️' });
                await handleCommand('cool', async (vin) => {
                    await bydStartClimate(vin, 21);
                    await bydSeatClimate(vin, 0, 0); // Seat off
                    return { success: true };
                });
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
