import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCar } from '@/context/CarContext';
import { useLayout } from '@/context/LayoutContext';
import { useVehicleStatus } from '@/hooks/useVehicleStatus';
import { useData } from '@/providers/DataProvider';
import { normalizeSoCToPercent } from '@/utils/normalize';
import StatCard from '@components/ui/StatCard';
import {
  Battery, Zap, Car, AlertCircle, TrendingUp,
  BarChart3, Lock, Unlock, Navigation, MapPin, Activity, AlertTriangle
} from '@components/Icons';
import { AnomalyService, Anomaly } from '@/services/AnomalyService';
import { BYD_RED } from '@core/constants';
import { logger } from '@core/logger';
import { bydLock, bydUnlock, bydFlashLights, bydCloseWindows, bydSeatClimate, bydBatteryHeat } from '@/services/bydApi';
import toast from 'react-hot-toast';

interface VehicleTabProps {
  isActive?: boolean;
}

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
 * Navigation Button Component - For secondary actions
 */
interface NavButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ icon, label, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="bg-slate-600/20 hover:bg-slate-600/30 text-slate-700 dark:text-slate-300 dark:bg-slate-700/30 dark:hover:bg-slate-700/50 rounded-lg sm:rounded-xl px-3 sm:px-4 py-3 sm:py-4 font-semibold text-sm sm:text-base flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
    >
      <span className="text-lg">{icon}</span>
      <span className="text-xs sm:text-sm truncate">{label}</span>
    </button>
  );
};

/**
 * Vehicle Tab Component - Main vehicle control dashboard
 */
const VehicleTab: React.FC<VehicleTabProps> = ({ isActive = true }) => {
  const { t } = useTranslation();
  const { activeCar } = useCar();
  const { isCompact, isLargerCard, isVertical } = useLayout();
  const vin = activeCar?.vin;
  const vehicleData = useVehicleStatus(vin);

  // Get app data (summary, stats, charges, aiSoH, etc.)
  const { stats, charges = [], trips = [], aiSoH, acknowledgedAnomalies = [], deletedAnomalies = [], setAcknowledgedAnomalies } = useData();

  // Get summary from vehicleData or stats - prefer vehicleData for real-time updates
  const summary = vehicleData?.summary || {
    totalKm: 0,
    kmDay: 0,
    totalKwh: 0,
    estimatedRange: 0,
    avgEff: 0,
    soh: 0,
    stationaryConsumption: 0,
    isHybrid: false
  };

  // Loading states for actions
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Calculate system health anomalies
  const allAnomalies: Anomaly[] = React.useMemo(() => {
    if (!stats || !activeCar?.settings) return [];
    return AnomalyService.checkSystemHealth(stats, activeCar.settings, charges || [], trips || []);
  }, [stats, activeCar?.settings, charges, trips]);

  const activeAnomalies = React.useMemo(() =>
    allAnomalies.filter(a => !acknowledgedAnomalies.includes(a.id) && !deletedAnomalies.includes(a.id)),
    [allAnomalies, acknowledgedAnomalies, deletedAnomalies]);

  const criticalAnomalies = activeAnomalies.filter(a => a.severity === 'critical').length;
  const warningAnomalies = activeAnomalies.filter(a => a.severity === 'warning').length;
  const hasAnomalies = activeAnomalies.length > 0;

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

  // Format values from real data
  const soc = vehicleData?.lastSoC !== undefined ? Math.round(normalizeSoCToPercent(vehicleData.lastSoC) || 0) : '--';
  const range = vehicleData?.lastRange !== undefined ? vehicleData.lastRange : summary.estimatedRange || '--';
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
      {/* Row 1: SoC Actual + Autonomía */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          isVerticalMode={isVertical}
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Battery}
          label={t('stats.soc', 'SoC Actual')}
          value={soc}
          unit="%"
          color={
            soc > 50
              ? 'bg-emerald-500/20 text-emerald-400'
              : soc > 20
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-red-500/20 text-red-400'
          }
        />
        <StatCard
          isVerticalMode={isVertical}
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={TrendingUp}
          label={t('stats.estimatedRange', 'Autonomía')}
          value={range}
          unit={t('units.km')}
          color="bg-blue-500/20 text-blue-400"
        />
      </div>

      {/* Row 2: Eficiencia + Carga Diaria */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          isVerticalMode={isVertical}
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Battery}
          label={t('stats.efficiency', 'Eficiencia')}
          value={summary.avgEff || '--'}
          unit={t('units.kWh100km', 'kWh/100km')}
          color="bg-green-500/20 text-green-400"
        />
        <StatCard
          isVerticalMode={isVertical}
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Zap}
          label={t('vehicle.dailyChargeLabel', 'Carga Diaria')}
          value={summary.kmDay || '--'}
          unit={t('units.km')}
          color="bg-purple-500/20 text-purple-400"
          sub={`${t('units.day')}`}
        />
      </div>

      {/* Row 3: Salud Batería + Estado Sistema */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          isVerticalMode={isVertical}
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Battery}
          label={t('settings.soh', 'Salud Batería')}
          value={aiSoH ? aiSoH.toFixed(1) : summary.soh || '--'}
          unit="%"
          color="bg-emerald-500/20 text-emerald-400"
        />
        <StatCard
          isVerticalMode={isVertical}
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={hasAnomalies ? AlertTriangle : Activity}
          label={t('stats.systemStatus', 'Estado Sistema')}
          value={hasAnomalies ? `${activeAnomalies.length} Alerta${activeAnomalies.length > 1 ? 's' : ''}` : t('stats.normal', 'Normal')}
          unit=""
          color={criticalAnomalies > 0
            ? "bg-red-500/20 text-red-400"
            : (warningAnomalies > 0 ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400")
          }
        />
      </div>

      {/* Row 4: Distancia + Energía Consumida */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          isVerticalMode={isVertical}
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={MapPin}
          label={t('stats.distance', 'Distancia')}
          value={summary.totalKm || '--'}
          unit={t('units.km')}
          color="bg-red-500/20 text-red-400"
          sub={`${summary.kmDay || 0} ${t('units.km')}/${t('units.day')}`}
        />
        <StatCard
          isVerticalMode={isVertical}
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Zap}
          label={t('stats.energy', 'Energía Consumida')}
          value={summary.totalKwh || '--'}
          unit={t('units.kWh')}
          color="bg-cyan-500/20 text-cyan-400"
          sub={`${t('stats.stationary', 'Estacionaria')}: ${summary.stationaryConsumption || 0} kWh`}
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
        <NavButton
          icon="📍"
          label={t('vehicle.tripsHistory', 'Viajes')}
          onClick={() => logger.info('[VehicleTab] Trips history clicked')}
        />
        <NavButton
          icon="🔌"
          label={t('vehicle.chargesHistory', 'Cargas')}
          onClick={() => logger.info('[VehicleTab] Charges history clicked')}
        />
        <NavButton
          icon="➕"
          label={t('vehicle.newCharge', 'Nueva Carga')}
          onClick={() => logger.info('[VehicleTab] New charge clicked')}
        />
      </div>
    </div>
  );
};

export default VehicleTab;
