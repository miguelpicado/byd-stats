import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCar } from '@/context/CarContext';
import { useLayout } from '@/context/LayoutContext';
import { useVehicleStatus } from '@/hooks/useVehicleStatus';
import { useData } from '@/providers/DataProvider';
import StatCard from '@components/ui/StatCard';
import { Battery, Zap, Lock, Unlock, Navigation, MapPin, AlertCircle } from '@components/Icons';
import { logger } from '@core/logger';
import { bydLock, bydUnlock, bydFlashLights } from '@/services/bydApi';
import toast from 'react-hot-toast';

interface VehicleTabProps {
  isActive?: boolean;
}

const VehicleTab: React.FC<VehicleTabProps> = ({ isActive = true }) => {
  const { t } = useTranslation();
  const { activeCar } = useCar();
  const { isCompact, isLargerCard, isVertical } = useLayout();
  const vin = activeCar?.vin;

  // Get real data from app
  const vehicleData = useVehicleStatus(vin);
  const { stats } = useData();

  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const summary = vehicleData?.summary;
  const isLocked = vehicleData?.isLocked;
  const isOnline = vehicleData?.isOnline;

  if (!vin || !summary) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
        <p className="text-slate-400">{t('common.noVehicleConnected', 'No hay vehículo conectado')}</p>
      </div>
    );
  }

  // Execute action with loading state
  const executeAction = async (
    key: string,
    action: () => Promise<any>,
    success: string,
    error: string
  ) => {
    setLoading(prev => ({ ...prev, [key]: true }));
    try {
      const result = await action();
      if (result.success) {
        toast.success(success);
      } else {
        toast.error(error);
      }
    } catch (err: any) {
      toast.error(err.message || error);
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleLock = () => executeAction(
    'lock',
    () => bydLock(vin),
    t('vehicle.locked', 'Bloqueado'),
    t('vehicle.lockFailed', 'Error al bloquear')
  );

  const handleUnlock = () => executeAction(
    'unlock',
    () => bydUnlock(vin),
    t('vehicle.unlocked', 'Desbloqueado'),
    t('vehicle.unlockFailed', 'Error al desbloquear')
  );

  const handleLocate = () => executeAction(
    'locate',
    () => bydFlashLights(vin),
    t('vehicle.lightsFlashed', 'Luces activadas'),
    t('vehicle.flashFailed', 'Error al activar luces')
  );

  return (
    <div className="w-full space-y-3 sm:space-y-4">
      {/* SoC + Range */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          isVerticalMode={isVertical}
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Battery}
          label={t('stats.soc', 'SoC Actual')}
          value={vehicleData?.lastSoC ?? '--'}
          unit="%"
          color={
            vehicleData && vehicleData.lastSoC > 50
              ? 'bg-emerald-500/20 text-emerald-400'
              : vehicleData && vehicleData.lastSoC > 20
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-red-500/20 text-red-400'
          }
        />
        <StatCard
          isVerticalMode={isVertical}
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Battery}
          label={t('stats.estimatedRange', 'Autonomía')}
          value={summary.estimatedRange || '--'}
          unit={t('units.km')}
          color="bg-blue-500/20 text-blue-400"
        />
      </div>

      {/* Efficiency + Daily */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          isVerticalMode={isVertical}
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Zap}
          label={t('stats.efficiency', 'Eficiencia')}
          value={summary.avgEff || '--'}
          unit={t('units.kWh100km', 'kWh/100km')}
          color="bg-green-500/20 text-green-400"
        />
        <StatCard
          isVerticalMode={isVertical}
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Battery}
          label={t('stats.energy', 'Energía')}
          value={summary.totalKwh || '--'}
          unit={t('units.kWh')}
          color="bg-cyan-500/20 text-cyan-400"
        />
      </div>

      {/* SoH + Distance */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          isVerticalMode={isVertical}
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={Battery}
          label={t('settings.soh', 'Salud')}
          value={summary.soh || '--'}
          unit="%"
          color="bg-emerald-500/20 text-emerald-400"
        />
        <StatCard
          isVerticalMode={isVertical}
          isLarger={isLargerCard}
          isCompact={isCompact}
          icon={MapPin}
          label={t('stats.distance', 'Distancia')}
          value={summary.totalKm || '--'}
          unit={t('units.km')}
          color="bg-red-500/20 text-red-400"
        />
      </div>

      {/* Control Buttons */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-2">
        <button
          onClick={isLocked ? handleUnlock : handleLock}
          disabled={!isOnline || loading.lock || loading.unlock}
          className={`${
            isLocked
              ? 'bg-emerald-500 hover:bg-emerald-600'
              : 'bg-red-500 hover:bg-red-600'
          } text-white rounded-lg px-3 py-3 font-semibold text-sm flex flex-col items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
        >
          {isLocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          <span className="text-xs truncate">{isLocked ? t('vehicle.unlock', 'Abrir') : t('vehicle.lock', 'Cerrar')}</span>
        </button>

        <button
          onClick={() => toast.info('Próximamente')}
          disabled={!isOnline}
          className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-3 py-3 font-semibold text-sm flex flex-col items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Zap className="w-5 h-5" />
          <span className="text-xs truncate">{t('vehicle.preheat', 'Precond.')}</span>
        </button>

        <button
          onClick={handleLocate}
          disabled={!isOnline || loading.locate}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-3 py-3 font-semibold text-sm flex flex-col items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Navigation className="w-5 h-5" />
          <span className="text-xs truncate">{t('vehicle.locate', 'Localizar')}</span>
        </button>
      </div>

      {/* Navigation */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <button className="bg-slate-600/20 hover:bg-slate-600/30 text-slate-700 dark:text-slate-300 dark:bg-slate-700/30 dark:hover:bg-slate-700/50 rounded-lg px-3 py-3 font-semibold text-sm flex flex-col items-center gap-1 transition-all">
          <span className="text-lg">📍</span>
          <span className="text-xs truncate">{t('vehicle.tripsHistory', 'Viajes')}</span>
        </button>
        <button className="bg-slate-600/20 hover:bg-slate-600/30 text-slate-700 dark:text-slate-300 dark:bg-slate-700/30 dark:hover:bg-slate-700/50 rounded-lg px-3 py-3 font-semibold text-sm flex flex-col items-center gap-1 transition-all">
          <span className="text-lg">🔌</span>
          <span className="text-xs truncate">{t('vehicle.chargesHistory', 'Cargas')}</span>
        </button>
        <button className="bg-slate-600/20 hover:bg-slate-600/30 text-slate-700 dark:text-slate-300 dark:bg-slate-700/30 dark:hover:bg-slate-700/50 rounded-lg px-3 py-3 font-semibold text-sm flex flex-col items-center gap-1 transition-all">
          <span className="text-lg">➕</span>
          <span className="text-xs truncate">{t('vehicle.newCharge', 'Nueva Carga')}</span>
        </button>
      </div>
    </div>
  );
};

export default VehicleTab;
