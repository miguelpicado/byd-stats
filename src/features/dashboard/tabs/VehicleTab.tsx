import React, { useMemo, useState } from 'react';
import StatCard from '@components/ui/StatCard';
import { MapPin, Zap, Battery, Activity, AlertTriangle } from '@components/Icons';
// Lazy load modals
const TripInsightsModal = React.lazy(() => import('@components/modals/TripInsightsModal'));
const OdometerAdjustmentModal = React.lazy(() => import('@components/modals/OdometerAdjustmentModal'));
const HealthReportModal = React.lazy(() => import('@components/modals/HealthReportModal'));
const RangeInsightsModal = React.lazy(() => import('@components/modals/RangeInsightsModal'));
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
}

/**
 * Vehicle tab showing main statistics only (no charts) - mobile/vertical layout
 */
const VehicleTab: React.FC<VehicleTabProps> = ({
  summary,
  trips = [],
  settings,
  isActive = true
}) => {
  const { updateSettings } = useApp();
  const { aiLoss, aiSoH, aiSoHStats, charges, stats } = useData();
  const { isCompact, isLargerCard, isVertical } = useLayout();

  const [insightType, setInsightType] = useState<TripInsightType | null>(null);
  const [showOdometerModal, setShowOdometerModal] = useState(false);
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);

  const handleCardClick = (type: TripInsightType) => {
    if (type === 'distance') {
      setShowOdometerModal(true);
    } else {
      setInsightType(type);
    }
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
        {/* Stats Grid */}
        <div className={`grid grid-cols-2 gap-3 sm:gap-4`}>
          <StatCard
            isVerticalMode={isVertical}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={MapPin}
            label="Distance"
            value={summary.totalKm}
            unit="km"
            color="bg-red-500/20 text-red-400"
            sub={`${summary.kmDay} km/day`}
            onClick={() => handleCardClick('distance')}
          />
          <StatCard
            isVerticalMode={isVertical}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Zap}
            label="Energy"
            value={summary.totalKwh}
            unit="kWh"
            color="bg-cyan-500/20 text-cyan-400"
            sub={`Stationary: ${summary.stationaryConsumption} kWh`}
            onClick={() => handleCardClick('energy')}
          />
        </div>

        <div className={`grid grid-cols-2 gap-3 sm:gap-4`}>
          <StatCard
            isVerticalMode={isVertical}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Battery}
            label="Estimated Range"
            value={summary.estimatedRange}
            unit="km"
            color={isAiReady ? "bg-indigo-500/20 text-indigo-400" : "bg-amber-500/20 text-amber-400"}
            onClick={() => setShowRangeModal(true)}
          />
          <StatCard
            isVerticalMode={isVertical}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Battery}
            label="Efficiency"
            value={summary.avgEff}
            unit="kWh/100km"
            color="bg-green-500/20 text-green-400"
            onClick={() => handleCardClick('efficiency')}
          />
        </div>

        <div className={`grid grid-cols-2 gap-3 sm:gap-4`}>
          <StatCard
            isVerticalMode={isVertical}
            isLarger={isLargerCard}
            isCompact={isCompact}
            icon={Battery}
            label="SoH"
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
            label="System Status"
            value={hasAnomalies ? `${activeAnomalies.length} Alert${activeAnomalies.length > 1 ? 's' : ''}` : 'Normal'}
            unit=""
            color={criticalAnomalies > 0
              ? "bg-red-500/20 text-red-500"
              : (warningAnomalies > 0 ? "bg-amber-500/20 text-amber-500" : "bg-emerald-500/20 text-emerald-500")}
            sub={hasAnomalies ? 'Check details' : 'All systems ok'}
            onClick={() => setShowHealthModal(true)}
          />
        </div>
      </div>

      {/* Modals */}
      <React.Suspense fallback={null}>
        {showOdometerModal && <OdometerAdjustmentModal isOpen={showOdometerModal} onClose={() => setShowOdometerModal(false)} />}
        {showRangeModal && <RangeInsightsModal isOpen={showRangeModal} onClose={() => setShowRangeModal(false)} aiScenarios={[]} aiLoss={aiLoss} isTraining={false} />}
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
