import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Zap, Wind, Thermometer, AlertTriangle } from '@/components/Icons';
import { useCar } from '@/context/CarContext';
import { useVehicleStatus } from '@/hooks/useVehicleStatus';
import { bydLock, bydUnlock, bydStartClimate, bydFlashLights, bydCloseWindows, bydSeatClimate } from '@/services/bydApi';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import toast from 'react-hot-toast';

const QuickActions: React.FC = () => {
    const { t } = useTranslation();
    const { activeCar } = useCar();
    const vehicleStatus = useVehicleStatus(activeCar?.vin);
    const [loadingButton, setLoadingButton] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setIsAuthenticated(!!user);
        });
        return () => unsubscribe();
    }, []);

    const isLocked = vehicleStatus?.isLocked === true;
    const areWindowsOpen = vehicleStatus?.windows && Object.values(vehicleStatus.windows).some(isOpen => isOpen);

    const handleCommand = async (
        command: string,
        fn: (vin: string, ...args: any[]) => Promise<any>,
        ...args: any[]
    ) => {
        if (!isAuthenticated) {
            toast.error(t('errors.authRequired', 'Authentication required. Check your connection or refresh.'));
            return;
        }

        if (!activeCar?.vin) {
            toast.error(t('errors.noVehicle', 'No vehicle selected'));
            return;
        }

        setLoadingButton(command);
        try {
            const auth = getAuth();
            console.log('[QuickActions] Current Auth UID:', auth.currentUser?.uid);

            const result = await fn(activeCar.vin, ...args);
            if (result.success) {
                toast.success(t('messages.commandSuccess', 'Command sent successfully'));
            } else {
                toast.error(t('messages.commandFailed', 'Command failed'));
            }
        } catch (error: any) {
            console.error(`[QuickActions] error:`, error);

            // Show the raw error message from the cloud function
            const msg = error.message || 'Remote control failed';

            // Create a longer-lasting toast for debugging
            toast.error(`Error: ${msg}`, { duration: 6000 });

            // Log code for debugging too
            if (error.code) {
                console.log('[QuickActions] Error code:', error.code);
            }
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

    const handleSmartClimate = async () => {
        // Determine current temp (Interior > Exterior > Default 15)
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
    };

    const actions = [
        {
            id: 'lock',
            label: isLocked ? t('actions.unlock', 'Unlock') : t('actions.lock', 'Lock'),
            icon: Lock,
            color: isLocked ? 'bg-green-600' : 'bg-red-600',
            action: handleLock,
            loading: loadingButton === 'lock' || loadingButton === 'undo_lock'
        },
        {
            id: 'windows',
            label: t('actions.windows', 'Windows'),
            icon: Wind,
            color: 'bg-slate-600',
            action: () => handleCommand('windows', bydCloseWindows),
            loading: loadingButton === 'windows'
        },
        {
            id: 'flash',
            label: t('actions.flash', 'Flash'),
            icon: Zap,
            color: 'bg-yellow-600',
            action: () => handleCommand('flash', bydFlashLights),
            loading: loadingButton === 'flash'
        },
        {
            id: 'heat',
            label: t('actions.climate', 'Climate'),
            icon: Thermometer,
            color: 'bg-orange-600',
            action: handleSmartClimate,
            loading: loadingButton === 'heat' || loadingButton === 'cool'
        },
    ];

    if (!isAuthenticated) {
        return (
            <div className="w-full shrink-0 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl flex items-center justify-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    {t('errors.authRequired', 'Authentication required (Check Internet/Config)')}
                </span>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-4 gap-2 w-full shrink-0">
            {actions.map((action) => (
                <button
                    key={action.id}
                    onClick={action.action}
                    disabled={!!loadingButton}
                    className={`${action.color} rounded-xl p-2 flex flex-row items-center justify-center gap-2 text-white shadow-lg active:scale-95 transition-transform h-12 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {action.loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <action.icon className={`w-5 h-5 ${action.id === 'lock' && !isLocked ? 'text-white' : ''}`} />
                    )}
                    <span className="text-[10px] font-bold uppercase hidden sm:block">{action.label}</span>
                </button>
            ))}
        </div>
    );
};

export default QuickActions;
