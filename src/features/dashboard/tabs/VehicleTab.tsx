import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCar } from '@/context/CarContext';
import { useLayout } from '@/context/LayoutContext';
import { useVehicleStatus } from '@/hooks/useVehicleStatus';
import { useData } from '@/providers/DataProvider';
import { useApp } from '@/context/AppContext';
import StatCard from '@components/ui/StatCard';
import { Battery, Zap, Lock, Unlock, Navigation, MapPin, AlertCircle, Activity } from '@components/Icons';
import { bydLock, bydUnlock, bydFlashLights } from '@/services/bydApi';
import toast from 'react-hot-toast';

// Lazy load modals
const OdometerAdjustmentModal = React.lazy(() => import('@components/modals/OdometerAdjustmentModal'));
const MfgDateModal = React.lazy(() => import('@components/modals/MfgDateModal'));
const RangeInsightsModal = React.lazy(() => import('@components/modals/RangeInsightsModal'));

interface VehicleTabProps {
  isActive?: boolean;
  tripDist?: { range: string; count: number; color: string }[];
  overviewSpacing?: string;
}

const VehicleTab: React.FC<VehicleTabProps> = ({
  isActive = true,
  tripDist = [],
  overviewSpacing = 'space-y-4'
}) => {
  const { t } = useTranslation();
  const { activeCar } = useCar();
  const { isCompact, isLargerCard, isVertical } = useLayout();
  const { updateSettings } = useApp();
  const vin = activeCar?.vin;

  // Get data from existing sources
  const vehicleData = useVehicleStatus(vin);
  const { stats, charges = [], trips = [], aiSoH, aiScenarios, aiLoss, isAiTraining } = useData();

  const summary = vehicleData?.summary;
  const isLocked = vehicleData?.isLocked;
  const isOnline = vehicleData?.isOnline;

  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Modal states
  const [showOdometerModal, setShowOdometerModal] = useState(false);
  const [showMfgModal, setShowMfgModal] = useState(false);
  const [showRangeModal, setShowRangeModal] = useState(false);

  if (!vin || !summary || !activeCar?.settings) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
        <p className="text-slate-400">{t('common.noVehicleConnected', 'No hay vehículo conectado')}</p>
      </div>
    );
  }

  const handleSettingsSave = (isoDate: string, displayDate: string) => {
    updateSettings({
      mfgDate: isoDate,
      mfgDateDisplay: displayDate
    });
  };

  const executeAction = async (
    key: string,
    action: () => Promise<any>,
    success: string,
    error: string
  ) => {
    setLoading(prev => ({ ...prev, [key]: true }));
    try {
      const result = await action();
      if (result.success) toast.success(success);
      else toast.error(error);
    } catch (err: any) {
      toast.error(err.message || error);
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  return (
    <>
      <div className={`${overviewSpacing}`}>
        {/* Row 1: SoC Actual + Autonomía */}
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
            onClick={() => setShowRangeModal(true)}
          />
        </div>

        {/* Row 2: Eficiencia + Carga Diaria */}
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
            label={t('vehicle.dailyChargeLabel', 'Carga Diaria')}
            value={summary.kmDay || '--'}
            unit={t('units.km')}
            color="bg-purple-500/20 text-purple-400"
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
            icon={Activity}
            label={t('stats.systemStatus', 'Estado Sistema')}
            value={t('stats.normal', 'Normal')}
            unit=""
            color="bg-emerald-500/20 text-emerald-400"
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
            onClick={() => setShowOdometerModal(true)}
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

        {/* Row 5: Action Buttons */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-2">
          <button
            onClick={isLocked ? () => executeAction('unlock', () => bydUnlock(vin), t('vehicle.unlocked', 'Desbloqueado'), t('vehicle.unlockFailed', 'Error')) : () => executeAction('lock', () => bydLock(vin), t('vehicle.locked', 'Bloqueado'), t('vehicle.lockFailed', 'Error'))}
            disabled={!isOnline || loading.lock || loading.unlock}
            className={`${isLocked ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'} text-white rounded-lg px-3 py-3 font-semibold text-sm flex flex-col items-center gap-1 disabled:opacity-50 transition-all`}
          >
            {isLocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            <span className="text-xs truncate">{isLocked ? t('vehicle.unlock', 'Abrir') : t('vehicle.lock', 'Cerrar')}</span>
          </button>

          <button
            onClick={() => toast.info('Próximamente')}
            disabled={!isOnline}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-3 py-3 font-semibold text-sm flex flex-col items-center gap-1 disabled:opacity-50 transition-all"
          >
            <Zap className="w-5 h-5" />
            <span className="text-xs truncate">{t('vehicle.preheat', 'Precond.')}</span>
          </button>

          <button
            onClick={() => executeAction('locate', () => bydFlashLights(vin), t('vehicle.lightsFlashed', 'Luces activadas'), t('vehicle.flashFailed', 'Error'))}
            disabled={!isOnline || loading.locate}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-3 py-3 font-semibold text-sm flex flex-col items-center gap-1 disabled:opacity-50 transition-all"
          >
            <Navigation className="w-5 h-5" />
            <span className="text-xs truncate">{t('vehicle.locate', 'Localizar')}</span>
          </button>
        </div>

        {/* Row 6: Navigation Buttons */}
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

      {/* Modals */}
      <React.Suspense fallback={null}>
        {showOdometerModal && (
          <OdometerAdjustmentModal
            isOpen={showOdometerModal}
            onClose={() => setShowOdometerModal(false)}
          />
        )}
        {showMfgModal && (
          <MfgDateModal
            isOpen={showMfgModal}
            onClose={() => setShowMfgModal(false)}
            onSave={handleSettingsSave}
            initialValue={activeCar.settings.mfgDateDisplay}
          />
        )}
        {showRangeModal && (
          <RangeInsightsModal
            isOpen={showRangeModal}
            onClose={() => setShowRangeModal(false)}
            aiScenarios={aiScenarios}
            aiLoss={aiLoss}
            isTraining={isAiTraining}
          />
        )}
      </React.Suspense>
    </>
  );
};

export default VehicleTab;
