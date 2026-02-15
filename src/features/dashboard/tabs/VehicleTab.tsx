import React, { useMemo, useState } from 'react';
import StatCard from '@components/ui/StatCard';
import LiveVehicleStatus from '@components/cards/LiveVehicleStatus';
import EstimatedChargeCard from '@components/cards/EstimatedChargeCard';
import { Battery, Activity, AlertTriangle, Lock, Zap, MapPin, Navigation, Plus } from '@components/Icons';
// Lazy load modals
const TripInsightsModal = React.lazy(() => import('@components/modals/TripInsightsModal'));
const RangeInsightsModal = React.lazy(() => import('@components/modals/RangeInsightsModal'));
const HealthReportModal = React.lazy(() => import('@components/modals/HealthReportModal'));
const OdometerAdjustmentModal = React.lazy(() => import('@components/modals/OdometerAdjustmentModal'));

import { useApp } from '@/context/AppContext';
import { useData } from '@/providers/DataProvider';
import { useCar } from '@/context/CarContext';
import { Summary, Settings, Trip, TripInsightType } from '@/types';
import { AnomalyService } from '@/services/AnomalyService';
import { useLayout } from '@/context/LayoutContext';
import { bydLock, bydStartClimate, bydFlashLights } from '@/services/bydApi';
import toast from 'react-hot-toast';

interface VehicleTabProps {
  summary: Summary | null;
  trips?: Trip[];
  settings: Settings;
  isActive?: boolean;
}

const VehicleTab: React.FC<VehicleTabProps> = ({
  summary,
  trips = [],
  settings,
  isActive = true
}) => {
  const { updateSettings } = useApp();
  const { aiLoss, aiSoH, aiSoHStats, charges, stats, openModal } = useData();
  const { isCompact, isLargerCard, isVertical } = useLayout();
  const { activeCar } = useCar();

  const [insightType, setInsightType] = useState<TripInsightType | null>(null);
  const [showOdometerModal, setShowOdometerModal] = useState(false);
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [loadingButton, setLoadingButton] = useState<string | null>(null);

  const handleCardClick = (type: TripInsightType) => {
    setInsightType(type);
  };

  const handleCommand = async (
    command: string,
    fn: (vin: string, ...args: any[]) => Promise<any>,
    ...args: any[]
  ) => {
    if (!activeCar?.vin) {
      toast.error('No vehicle selected');
      return;
    }

    setLoadingButton(command);
    try {
      const result = await fn(activeCar.vin, ...args);
      if (result.success) {
        toast.success(`${command} executed successfully`);
      } else {
        toast.error(`${command} failed`);
      }
    } catch (error: any) {
      toast.error(`Error: ${error.message || 'Unknown error'}`);
    } finally {
      setLoadingButton(null);
    }
  };

  const handleLock = () => handleCommand('Lock', bydLock);
  const handlePreheat = () => handleCommand('Preheat', bydStartClimate, 22);
  const handleLocate = () => handleCommand('Locate', bydFlashLights);

  // Calculate system health anomalies
  const { acknowledgedAnomalies = [], setAcknowledgedAnomalies, deletedAnomalies = [], setDeletedAnomalies } = useData();

  const allAnomalies = useMemo(() => {
    if (!stats || !settings) return [];
    return AnomalyService.checkSystemHealth(stats, settings, charges || [], trips);
  }, [stats, settings, charges, trips]);

  const activeAnomalies = useMemo(() =>
    allAnomalies.filter(a => !acknowledgedAnomalies.includes(a.id) && !deletedAnomalies.includes(a.id)),
    [allAnomalies, acknowledgedAnomalies, deletedAnomalies]);

  const criticalAnomalies = activeAnomalies.filter(a => a.severity === 'critical').length;
  const warningAnomalies = activeAnomalies.filter(a => a.severity === 'warning').length;
  const hasAnomalies = activeAnomalies.length > 0;

  const isAiReady = aiLoss !== null && aiLoss < 0.5;

  if (!summary) {
    return <div className="text-center py-12 text-slate-500">No data available</div>;
  }

  return (
    <>
      <div className="space-y-4">
        {/* Row 1: SoC Actual + Autonomía */}
        <div className={`grid grid-cols-2 gap-3 sm:gap-4`}>
          <LiveVehicleStatus onClick={() => openModal('batteryStatus')} />
          <StatCard
            isVerticalMode={isVertical}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Battery}
            label="Autonomía"
            value={summary.estimatedRange}
            unit="km"
            color={isAiReady ? "bg-indigo-500/20 text-indigo-400" : "bg-amber-500/20 text-amber-400"}
            onClick={() => setShowRangeModal(true)}
          />
        </div>

        {/* Row 2: Eficiencia + Carga Diaria Estimada */}
        <div className={`grid grid-cols-2 gap-3 sm:gap-4`}>
          <StatCard
            isVerticalMode={isVertical}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Battery}
            label="Eficiencia"
            value={summary.avgEff}
            unit="kWh/100km"
            color="bg-green-500/20 text-green-400"
            onClick={() => handleCardClick('efficiency')}
          />
          <EstimatedChargeCard
            summary={summary}
            settings={settings}
            stats={stats || null}
            charges={charges}
            trips={trips}
          />
        </div>

        {/* Row 3: Distancia Total + Energía Total Consumida */}
        <div className={`grid grid-cols-2 gap-3 sm:gap-4`}>
          <StatCard
            isVerticalMode={isVertical}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={MapPin}
            label="Distancia Total"
            value={summary.totalKm}
            unit="km"
            color="bg-red-500/20 text-red-400"
            sub={`${summary.kmDay} km/día`}
            onClick={() => handleCardClick('distance')}
          />
          <StatCard
            isVerticalMode={isVertical}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Zap}
            label="Energía Total"
            value={summary.totalKwh}
            unit="kWh"
            color="bg-cyan-500/20 text-cyan-400"
            sub={`Estacionario: ${summary.stationaryConsumption} kWh`}
            onClick={() => handleCardClick('energy')}
          />
        </div>

        {/* Row 4: Salud Batería + Estado Sistema */}
        <div className={`grid grid-cols-2 gap-3 sm:gap-4`}>
          <StatCard
            isVerticalMode={isVertical}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Battery}
            label="Salud Batería"
            value={aiSoH ? aiSoH.toFixed(1) : summary.soh}
            unit="%"
            color="bg-emerald-500/20 text-emerald-400"
            onClick={() => handleCardClick('soh')}
          />
          <StatCard
            isVerticalMode={isVertical}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={hasAnomalies ? AlertTriangle : Activity}
            label="Estado Sistema"
            value={hasAnomalies ? `${activeAnomalies.length} Alerta${activeAnomalies.length > 1 ? 's' : ''}` : 'Normal'}
            unit=""
            color={criticalAnomalies > 0
              ? "bg-red-500/20 text-red-500"
              : (warningAnomalies > 0 ? "bg-amber-500/20 text-amber-500" : "bg-emerald-500/20 text-emerald-500")}
            sub={hasAnomalies ? 'Ver detalles' : 'Todo correcto'}
            onClick={() => setShowHealthModal(true)}
          />
        </div>

        {/* Row 5: Action Buttons (Lock, Preheat, Locate) */}
        <div className={`grid grid-cols-3 gap-3 sm:gap-4`}>
          <button
            onClick={handleLock}
            disabled={loadingButton === 'Lock'}
            className="flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[100px] sm:min-h-[120px]"
          >
            <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm font-medium">Bloquear</span>
          </button>
          <button
            onClick={handlePreheat}
            disabled={loadingButton === 'Preheat'}
            className="flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[100px] sm:min-h-[120px]"
          >
            <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm font-medium">Precalentar</span>
          </button>
          <button
            onClick={handleLocate}
            disabled={loadingButton === 'Locate'}
            className="flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[100px] sm:min-h-[120px]"
          >
            <MapPin className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm font-medium">Localizar</span>
          </button>
        </div>

        {/* Row 6: Navigation Buttons (Trips, Charges, New Charge) */}
        <div className={`grid grid-cols-3 gap-3 sm:gap-4`}>
          <button
            onClick={() => openModal('allTrips')}
            className="flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-lg bg-slate-500/20 text-slate-400 hover:bg-slate-500/30 transition-colors min-h-[100px] sm:min-h-[120px]"
          >
            <Navigation className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm font-medium">Viajes</span>
          </button>
          <button
            onClick={() => openModal('allCharges')}
            className="flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors min-h-[100px] sm:min-h-[120px]"
          >
            <Battery className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm font-medium">Cargas</span>
          </button>
          <button
            onClick={() => openModal('addCharge')}
            className="flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors min-h-[100px] sm:min-h-[120px]"
          >
            <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm font-medium">Nueva Carga</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <React.Suspense fallback={null}>
        {showRangeModal && <RangeInsightsModal isOpen={showRangeModal} onClose={() => setShowRangeModal(false)} aiScenarios={[]} aiLoss={aiLoss} isTraining={false} />}
        {insightType === 'distance' && <TripInsightsModal isOpen={true} onClose={() => setInsightType(null)} type="distance" />}
        {insightType === 'energy' && <TripInsightsModal isOpen={true} onClose={() => setInsightType(null)} type="energy" />}
        {insightType === 'efficiency' && <TripInsightsModal isOpen={true} onClose={() => setInsightType(null)} type="efficiency" />}
        {insightType === 'soh' && <TripInsightsModal isOpen={true} onClose={() => setInsightType(null)} type="soh" />}
        {showOdometerModal && <OdometerAdjustmentModal isOpen={showOdometerModal} onClose={() => setShowOdometerModal(false)} />}
        {showHealthModal && <HealthReportModal isOpen={showHealthModal} onClose={() => setShowHealthModal(false)} />}
      </React.Suspense>
    </>
  );
};

export default VehicleTab;
