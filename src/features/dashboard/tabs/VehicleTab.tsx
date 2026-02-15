import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCar } from '@/context/CarContext';
import { useLayout } from '@/context/LayoutContext';
import { useVehicleStatus } from '@/hooks/useVehicleStatus';
import { normalizeSoCToPercent } from '@/utils/normalize';
import {
  Battery, Zap, Car, AlertCircle, TrendingUp,
  BarChart3, Lock, Unlock, Navigation
} from '@components/Icons';
import { BYD_RED } from '@core/constants';
import { logger } from '@core/logger';
import { bydLock, bydUnlock, bydFlashLights, bydCloseWindows, bydSeatClimate, bydBatteryHeat } from '@/services/bydApi';
import toast from 'react-hot-toast';

interface VehicleTabProps {
  isActive?: boolean;
}

interface StatCardProps {
  icon: React.ComponentType<{ className: string }>;
  label: string;
  value: string | number;
  unit?: string;
  colorClass?: string;
  onClick?: () => void;
}

/**
 * StatCard Component - Reusable statistic display card
 */
const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  label,
  value,
  unit = '',
  colorClass = 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
  onClick
}) => {
  const { isCompact, isLargerCard, isVertical } = useLayout();

  return (
    <div
      className={`bg-white dark:bg-slate-800/50 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700/50 flex items-stretch overflow-hidden h-24 sm:h-28 ${
        onClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800' : ''
      } transition-colors`}
      onClick={onClick}
    >
      {/* Icon section */}
      <div className={`flex items-center justify-center shrink-0 w-20 sm:w-24 ${colorClass}`}>
        <Icon className="w-8 h-8 sm:w-10 sm:h-10" />
      </div>

      {/* Content section */}
      <div className="flex-1 flex flex-col items-center justify-center px-3 sm:px-4 py-2 text-center">
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider truncate w-full">
          {label}
        </p>
        <p className="font-bold text-lg sm:text-2xl text-slate-900 dark:text-white leading-tight mt-1">
          {value}
          {unit && <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 ml-1 font-semibold">{unit}</span>}
        </p>
      </div>
    </div>
  );
};

/**
 * Action Button Component - For vehicle control actions
 */
interface ActionButtonProps {
  icon: React.ComponentType<{ className: string }>;
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'success' | 'danger' | 'warning';
}

const ActionButton: React.FC<ActionButtonProps> = ({
  icon: Icon,
  label,
  onClick,
  loading = false,
  disabled = false,
  variant = 'primary'
}) => {
  const variantStyles: Record<string, string> = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white',
    success: 'bg-emerald-500 hover:bg-emerald-600 text-white',
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${variantStyles[variant]} rounded-lg sm:rounded-xl px-3 sm:px-4 py-3 sm:py-4 font-semibold text-sm sm:text-base flex flex-col items-center justify-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`}
    >
      <Icon className={`w-6 h-6 sm:w-7 sm:h-7 ${loading ? 'animate-spin' : ''}`} />
      <span className="text-xs sm:text-sm truncate">{loading ? '...' : label}</span>
    </button>
  );
};

/**
 * Vehicle Tab Component - Main vehicle control dashboard
 */
const VehicleTab: React.FC<VehicleTabProps> = ({ isActive = true }) => {
  const { t } = useTranslation();
  const { activeCar } = useCar();
  const { isCompact } = useLayout();
  const vin = activeCar?.vin;
  const vehicleData = useVehicleStatus(vin);

  // Loading states for actions
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Helper to execute actions with loading state
  const executeAction = async (
    actionKey: string,
    action: () => Promise<any>,
    successMessage: string,
    errorMessage: string
  ) => {
    if (!vin) {
      toast.error(t('common.noVehicleSelected', 'No hay vehículo seleccionado'));
      return;
    }

    setLoading(prev => ({ ...prev, [actionKey]: true }));
    try {
      const result = await action();
      if (result.success) {
        toast.success(successMessage);
        logger.info(`[VehicleTab] ${actionKey} success`);
      } else {
        toast.error(errorMessage);
        logger.warn(`[VehicleTab] ${actionKey} failed`);
      }
    } catch (error: any) {
      logger.error(`[VehicleTab] ${actionKey} error:`, error);
      toast.error(error.message || errorMessage);
    } finally {
      setLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  // Action handlers
  const handleLockUnlock = async () => {
    const isLocked = vehicleData?.isLocked;
    if (isLocked) {
      await executeAction(
        'unlock',
        () => bydUnlock(vin!),
        t('vehicle.unlocked', 'Coche desbloqueado'),
        t('vehicle.unlockFailed', 'Error al desbloquear')
      );
    } else {
      await executeAction(
        'lock',
        () => bydLock(vin!),
        t('vehicle.locked', 'Coche bloqueado'),
        t('vehicle.lockFailed', 'Error al bloquear')
      );
    }
  };

  const handleFlashLights = async () => {
    await executeAction(
      'flashLights',
      () => bydFlashLights(vin!),
      t('vehicle.lightsFlashed', 'Luces intermitentes activadas'),
      t('vehicle.flashFailed', 'Error al activar luces')
    );
  };

  const handlePreconditioning = async () => {
    // Placeholder for future intelligent preconditioning logic
    toast.info('Precondicionamiento - Próximamente');
    logger.info('[VehicleTab] Preconditioning placeholder clicked');
  };

  const handleCloseWindows = async () => {
    await executeAction(
      'closeWindows',
      () => bydCloseWindows(vin!),
      t('vehicle.windowsClosed', 'Ventanas cerradas'),
      t('vehicle.closeWindowsFailed', 'Error al cerrar ventanas')
    );
  };

  const handleSeatClimate = async () => {
    // Driver seat, high heat (mode 3)
    await executeAction(
      'seatClimate',
      () => bydSeatClimate(vin!, 0, 3),
      t('vehicle.seatHeatingEnabled', 'Calefacción de asientos activada'),
      t('vehicle.seatClimateF ailed', 'Error en calefacción de asientos')
    );
  };

  const handleBatteryHeat = async () => {
    await executeAction(
      'batteryHeat',
      () => bydBatteryHeat(vin!),
      t('vehicle.batteryHeatingEnabled', 'Precalentamiento de batería activado'),
      t('vehicle.batteryHeatFailed', 'Error en precalentamiento')
    );
  };

  // Format values
  const soc = vehicleData?.lastSoC !== undefined ? Math.round(normalizeSoCToPercent(vehicleData.lastSoC) || 0) : '--';
  const range = vehicleData?.lastRange || '--';
  const isLocked = vehicleData?.isLocked;
  const isOnline = vehicleData?.isOnline;

  if (!vin) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
        <p className="text-slate-400">{t('common.noVehicleConnected', 'No hay vehículo conectado')}</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3 sm:space-y-4">
      {/* Row 1: SoC + Autonomía */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          icon={Battery}
          label={t('vehicle.socLabel', 'SoC Actual')}
          value={soc}
          unit="%"
          colorClass={
            soc > 50
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : soc > 20
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                : 'bg-red-500/20 text-red-600 dark:text-red-400'
          }
        />
        <StatCard
          icon={TrendingUp}
          label={t('vehicle.autonomyLabel', 'Autonomía')}
          value={range}
          unit="km"
          colorClass="bg-blue-500/20 text-blue-600 dark:text-blue-400"
        />
      </div>

      {/* Row 2: Eficiencia + Carga Diaria */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          icon={BarChart3}
          label={t('vehicle.efficiencyLabel', 'Eficiencia')}
          value="6.2"
          unit="km/kWh"
          colorClass="bg-slate-500/20 text-slate-600 dark:text-slate-400"
        />
        <StatCard
          icon={ZapIcon}
          label={t('vehicle.dailyChargeLabel', 'Carga Diaria')}
          value="8.5"
          unit="kWh"
          colorClass="bg-purple-500/20 text-purple-600 dark:text-purple-400"
        />
      </div>

      {/* Row 3: Estado Salud Batería + Estado Sistema */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          icon={Zap}
          label={t('vehicle.sohLabel', 'Salud Batería')}
          value="92.3"
          unit="%"
          colorClass="bg-green-500/20 text-green-600 dark:text-green-400"
        />
        <StatCard
          icon={Car}
          label={t('vehicle.systemStatusLabel', 'Estado Sistema')}
          value={isOnline ? '🟢 Online' : '🔴 Offline'}
          colorClass={isOnline ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-red-500/20 text-red-600 dark:text-red-400'}
        />
      </div>

      {/* Row 4: Distancia + Energía Consumida */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          icon={Car}
          label={t('vehicle.distanceLabel', 'Distancia')}
          value="1,245"
          unit="km"
          colorClass="bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
        />
        <StatCard
          icon={ZapIcon}
          label={t('vehicle.energyConsumedLabel', 'Energía Consumida')}
          value="4,892"
          unit="kWh"
          colorClass="bg-orange-500/20 text-orange-600 dark:text-orange-400"
        />
      </div>

      {/* Row 5: Action Buttons - Lock/Unlock, Preaconditioning, Flash Lights */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-2">
        <ActionButton
          icon={isLocked ? Lock : Unlock}
          label={isLocked ? t('vehicle.unlock', 'Abrir') : t('vehicle.lock', 'Cerrar')}
          onClick={handleLockUnlock}
          loading={loading.lock || loading.unlock}
          disabled={!isOnline}
          variant={isLocked ? 'success' : 'danger'}
        />
        <ActionButton
          icon={Zap}
          label={t('vehicle.preheat', 'Precond.')}
          onClick={handlePreconditioning}
          loading={loading.preconditioning}
          disabled={!isOnline}
          variant="warning"
        />
        <ActionButton
          icon={Navigation}
          label={t('vehicle.locate', 'Localizar')}
          onClick={handleFlashLights}
          loading={loading.flashLights}
          disabled={!isOnline}
          variant="primary"
        />
      </div>

      {/* Row 6: Navigation Buttons - Trips, Charges, Add Charge */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <button className="bg-slate-600/20 hover:bg-slate-600/30 text-slate-700 dark:text-slate-300 dark:bg-slate-700/30 dark:hover:bg-slate-700/50 rounded-lg sm:rounded-xl px-3 sm:px-4 py-3 sm:py-4 font-semibold text-sm sm:text-base flex flex-col items-center justify-center gap-1 transition-all active:scale-95">
          <span className="text-lg">📍</span>
          <span className="text-xs sm:text-sm truncate">{t('vehicle.tripsHistory', 'Viajes')}</span>
        </button>
        <button className="bg-slate-600/20 hover:bg-slate-600/30 text-slate-700 dark:text-slate-300 dark:bg-slate-700/30 dark:hover:bg-slate-700/50 rounded-lg sm:rounded-xl px-3 sm:px-4 py-3 sm:py-4 font-semibold text-sm sm:text-base flex flex-col items-center justify-center gap-1 transition-all active:scale-95">
          <span className="text-lg">🔌</span>
          <span className="text-xs sm:text-sm truncate">{t('vehicle.chargesHistory', 'Cargas')}</span>
        </button>
        <button className="bg-slate-600/20 hover:bg-slate-600/30 text-slate-700 dark:text-slate-300 dark:bg-slate-700/30 dark:hover:bg-slate-700/50 rounded-lg sm:rounded-xl px-3 sm:px-4 py-3 sm:py-4 font-semibold text-sm sm:text-base flex flex-col items-center justify-center gap-1 transition-all active:scale-95">
          <span className="text-lg">➕</span>
          <span className="text-xs sm:text-sm truncate">{t('vehicle.newCharge', 'Nueva Carga')}</span>
        </button>
      </div>
    </div>
  );
};

export default VehicleTab;
