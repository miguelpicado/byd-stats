import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import StatCard from '@components/ui/StatCard';
import { Battery, Zap, Lock, Unlock, Navigation, MapPin, Activity, AlertTriangle } from '@components/Icons';
import { bydLock, bydUnlock, bydFlashLights } from '@/services/bydApi';
import toast from 'react-hot-toast';
import { useApp } from '@/context/AppContext';
import { useData } from '@/providers/DataProvider';
import { Summary, Settings, TripInsightType } from '@/types';
import { AnomalyService } from '@/services/AnomalyService';
import { useLayout } from '@/context/LayoutContext';
import { useVehicleStatus } from '@/hooks/useVehicleStatus';
import { useCar } from '@/context/CarContext';

// Lazy load modals
const OdometerAdjustmentModal = React.lazy(() => import('@components/modals/OdometerAdjustmentModal'));
const RangeInsightsModal = React.lazy(() => import('@components/modals/RangeInsightsModal'));
const TripInsightsModal = React.lazy(() => import('@components/modals/TripInsightsModal'));
const HealthReportModal = React.lazy(() => import('@components/modals/HealthReportModal'));

interface VehicleTabProps {
  isActive?: boolean;
}

/**
 * Vehicle tab showing main statistics (mobile/vertical layout only)
 */
const VehicleTab: React.FC<VehicleTabProps> = ({ isActive = true }) => {
  const { t } = useTranslation();
  const { updateSettings } = useApp();
  const { aiScenarios, aiLoss, aiSoH, aiSoHStats, charges, stats, isAiTraining } = useData();
  const { isCompact, isLargerCard, isVertical } = useLayout();
  const { activeCar } = useCar();
  const vin = activeCar?.vin;

  const vehicleData = useVehicleStatus(vin);
  const summary = vehicleData?.summary || {};
  const isOnline = vehicleData?.isOnline ?? true;

  const [insightType, setInsightType] = useState<TripInsightType | null>(null);
  const [showOdometerModal, setShowOdometerModal] = useState(false);
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const handleCardClick = (type: TripInsightType) => {
    if (type === 'distance') {
      setShowOdometerModal(true);
    } else {
      setInsightType(type);
    }
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

  // Calculate system health anomalies (exact copy from OverviewContent)
  const { acknowledgedAnomalies = [], setAcknowledgedAnomalies, deletedAnomalies = [], setDeletedAnomalies } = useData();

  const allAnomalies = useMemo(() => {
    if (!stats || !activeCar?.settings) return [];
    return AnomalyService.checkSystemHealth(stats, activeCar.settings, charges || [], vehicleData?.trips || []);
  }, [stats, activeCar?.settings, charges, vehicleData?.trips]);

  const activeAnomalies = useMemo(() =>
    allAnomalies.filter(a => !acknowledgedAnomalies.includes(a.id) && !deletedAnomalies.includes(a.id)),
    [allAnomalies, acknowledgedAnomalies, deletedAnomalies]);

  const criticalAnomalies = activeAnomalies.filter(a => a.severity === 'critical').length;
  const warningAnomalies = activeAnomalies.filter(a => a.severity === 'warning').length;
  const hasAnomalies = activeAnomalies.length > 0;

  const isAiReady = aiLoss !== null && aiLoss < 0.5;

  return (
    <>
      <div className="space-y-4">
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
            color={vehicleData && vehicleData.lastSoC > 50 ? 'bg-emerald-500/20 text-emerald-400' : vehicleData && vehicleData.lastSoC > 20 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}
          />
          <StatCard
            isVerticalMode={isVertical}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Battery}
            label={isAiReady ? t('stats.aiRange', 'AI Range') : t('stats.estimatedRange', 'Autonomía')}
            value={summary.estimatedRange || '--'}
            unit={t('units.km')}
            color={isAiReady ? "bg-indigo-500/20 text-indigo-400" : "bg-blue-500/20 text-blue-400"}
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
            onClick={() => handleCardClick('efficiency')}
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
            onClick={() => handleCardClick('soh')}
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
              ? "bg-red-500/20 text-red-500"
              : (warningAnomalies > 0 ? "bg-amber-500/20 text-amber-500" : "bg-emerald-500/20 text-emerald-500")}
            sub={hasAnomalies ? t('stats.checkDetails', 'Ver detalles') : t('stats.allSystemsOk', 'Todo correcto')}
            onClick={() => setShowHealthModal(true)}
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
            onClick={() => handleCardClick('distance')}
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
            onClick={() => handleCardClick('energy')}
          />
        </div>

        {/* Row 5: Action Buttons */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-2">
          <button
            onClick={vehicleData?.isLocked ? () => executeAction('unlock', () => bydUnlock(vin!), t('vehicle.unlocked', 'Desbloqueado'), t('vehicle.unlockFailed', 'Error')) : () => executeAction('lock', () => bydLock(vin!), t('vehicle.locked', 'Bloqueado'), t('vehicle.lockFailed', 'Error'))}
            disabled={!isOnline || loading.lock || loading.unlock}
            className={`${vehicleData?.isLocked ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'} text-white rounded-lg px-3 py-3 font-semibold text-sm flex flex-col items-center gap-1 disabled:opacity-50 transition-all`}
          >
            {vehicleData?.isLocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            <span className="text-xs truncate">{vehicleData?.isLocked ? t('vehicle.unlock', 'Abrir') : t('vehicle.lock', 'Cerrar')}</span>
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
            onClick={() => executeAction('locate', () => bydFlashLights(vin!), t('vehicle.lightsFlashed', 'Luces activadas'), t('vehicle.flashFailed', 'Error'))}
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
        {showOdometerModal && <OdometerAdjustmentModal isOpen={showOdometerModal} onClose={() => setShowOdometerModal(false)} />}
        {showRangeModal && <RangeInsightsModal isOpen={showRangeModal} onClose={() => setShowRangeModal(false)} aiScenarios={aiScenarios} aiLoss={aiLoss} isTraining={isAiTraining} />}
        {insightType === 'efficiency' && <TripInsightsModal isOpen={true} onClose={() => setInsightType(null)} type="efficiency" />}
        {insightType === 'energy' && <TripInsightsModal isOpen={true} onClose={() => setInsightType(null)} type="energy" />}
        {insightType === 'soh' && <TripInsightsModal isOpen={true} onClose={() => setInsightType(null)} type="soh" />}
        {insightType === 'distance' && <TripInsightsModal isOpen={true} onClose={() => setInsightType(null)} type="distance" />}
        {showHealthModal && <HealthReportModal isOpen={showHealthModal} onClose={() => setShowHealthModal(false)} />}
      </React.Suspense>
    </>
  );
};

export default VehicleTab;
