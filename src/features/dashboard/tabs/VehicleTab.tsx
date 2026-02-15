import React, { useMemo, useState } from 'react';
import StatCard from '@components/ui/StatCard';
import LiveVehicleStatus from '@components/cards/LiveVehicleStatus';
import EstimatedChargeCard from '@components/cards/EstimatedChargeCard';
import { Battery, Activity, AlertTriangle } from '@components/Icons';
// Lazy load modals
const TripInsightsModal = React.lazy(() => import('@components/modals/TripInsightsModal'));
const RangeInsightsModal = React.lazy(() => import('@components/modals/RangeInsightsModal'));
const HealthReportModal = React.lazy(() => import('@components/modals/HealthReportModal'));
import { useApp } from '@/context/AppContext';
import { useData } from '@/providers/DataProvider';
import { Summary, Settings, Trip, TripInsightType } from '@/types';
import { AnomalyService } from '@/services/AnomalyService';
import { useLayout } from '@/context/LayoutContext';

interface VehicleTabProps {
  summary: Summary | null;
  trips?: Trip[];
  settings: Settings;
  isActive?: boolean;
  charges?: any[];
  stats?: any;
}

/**
 * Vehicle tab showing main statistics only (no charts) - mobile/vertical layout
 */
const VehicleTab: React.FC<VehicleTabProps> = ({
  summary,
  trips = [],
  settings,
  isActive = true,
  charges: chargesParam,
  stats: statsParam
}) => {
  const { updateSettings } = useApp();
  const { aiLoss, aiSoH, aiSoHStats, charges: chargesContext, stats: statsContext, openModal } = useData();
  const { isCompact, isLargerCard, isVertical } = useLayout();

  // Use provided props or fallback to context
  const charges = chargesParam ?? chargesContext;
  const stats = statsParam ?? statsContext;

  const [insightType, setInsightType] = useState<TripInsightType | null>(null);
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);

  const handleCardClick = (type: TripInsightType) => {
    setInsightType(type);
  };

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

        {/* Row 3: Salud Batería + Estado Sistema */}
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
      </div>

      {/* Modals */}
      <React.Suspense fallback={null}>
        {showRangeModal && <RangeInsightsModal isOpen={showRangeModal} onClose={() => setShowRangeModal(false)} aiScenarios={[]} aiLoss={aiLoss} isTraining={false} />}
        {insightType === 'efficiency' && <TripInsightsModal isOpen={true} onClose={() => setInsightType(null)} type="efficiency" />}
        {insightType === 'soh' && <TripInsightsModal isOpen={true} onClose={() => setInsightType(null)} type="soh" />}
        {showHealthModal && <HealthReportModal isOpen={showHealthModal} onClose={() => setShowHealthModal(false)} />}
      </React.Suspense>
    </>
  );
};

export default VehicleTab;
