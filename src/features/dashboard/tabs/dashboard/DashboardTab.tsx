import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVehicleStatus } from '@/hooks/useVehicleStatus';
import { useCar } from '@/context/CarContext';
import { useData } from '@/providers/DataProvider';
import { AnomalyService } from '@/services/AnomalyService';
import { TripInsightType } from '@/types';

// Sub-components
import BatteryHeader from './BatteryHeader';
import MiniStatsRow from './MiniStatsRow';
import CarVisualization from './CarVisualization';
import VehicleStatusPanel from './VehicleStatusPanel';
import LocationCard from './LocationCard';
import QuickActions from './QuickActions';

// Modals
const TripInsightsModal = React.lazy(() => import('@components/modals/TripInsightsModal'));
const OdometerAdjustmentModal = React.lazy(() => import('@components/modals/OdometerAdjustmentModal'));
const HealthReportModal = React.lazy(() => import('@components/modals/HealthReportModal'));
const RangeInsightsModal = React.lazy(() => import('@components/modals/RangeInsightsModal'));

const DashboardTab: React.FC = () => {
    const { t } = useTranslation();
    const { activeCar } = useCar();
    const { stats, settings, charges, trips, aiSoH, acknowledgedAnomalies = [], deletedAnomalies = [], setAcknowledgedAnomalies, setDeletedAnomalies, aiLoss, aiScenarios, isAiTraining } = useData();
    const { summary } = stats || {};
    const vehicleStatus = useVehicleStatus(activeCar?.vin);

    // Modal State
    const [insightType, setInsightType] = useState<TripInsightType | null>(null);
    const [showOdometerModal, setShowOdometerModal] = useState(false);
    const [showHealthModal, setShowHealthModal] = useState(false);
    const [showRangeModal, setShowRangeModal] = useState(false);

    // Calculate Anomalies for System Status
    const allAnomalies = useMemo(() => {
        if (!stats || !settings) return [];
        return AnomalyService.checkSystemHealth(stats, settings, charges || [], trips || []);
    }, [stats, settings, charges, trips]);

    const activeAnomalies = useMemo(() =>
        allAnomalies.filter(a => !acknowledgedAnomalies.includes(a.id) && !deletedAnomalies.includes(a.id)),
        [allAnomalies, acknowledgedAnomalies, deletedAnomalies]);

    const historyAnomalies = useMemo(() =>
        allAnomalies.filter(a => acknowledgedAnomalies.includes(a.id) && !deletedAnomalies.includes(a.id)),
        [allAnomalies, acknowledgedAnomalies, deletedAnomalies]);

    const systemStatusText = activeAnomalies.length > 0
        ? `${activeAnomalies.length} ${t('dashboard.alert', 'Alerts')}`
        : t('dashboard.normal', 'Normal');

    const handleOpenModal = (modal: string) => {
        switch (modal) {
            case 'generalInfo': // Odo
            case 'general':
                setShowOdometerModal(true);
                break;
            case 'consumption': // Energy
            case 'energy':
                setInsightType('energy');
                break;
            case 'soh':
                setInsightType('soh');
                break;
            case 'healthReport':
            case 'system':
                setShowHealthModal(true);
                break;
            case 'range':
                // Assuming we have a RangeInsightsModal or similar, or just open consumption/insights for now
                // Looking at OverviewContent, it opens 'range' modal logic or 'energy'
                // Let's reuse setInsightType if possible or add a specific Range modal state if needed
                // Step 992 showed RangeInsightsModal availability.
                setShowRangeModal(true);
                break;
            default:
                console.warn('Unknown modal:', modal);
        }
    };

    const isAiReady = aiLoss !== null && aiLoss < 0.5;

    return (
        <div className="flex flex-col space-y-2 p-2 w-full h-full overflow-hidden">
            {/* Battery & Range Header */}
            <BatteryHeader
                status={vehicleStatus}
                summary={summary || null}
                isAiReady={isAiReady}
                onOpenModal={handleOpenModal}
            />

            {/* Mini Stats (Odo, Energy, SoH, System) */}
            <MiniStatsRow
                odo={vehicleStatus?.lastOdometer?.toLocaleString() ?? summary?.totalKm?.toLocaleString() ?? '--'}
                energy={summary?.totalKwh?.toLocaleString() ?? '--'}
                soh={aiSoH ? aiSoH.toFixed(1) : (summary?.soh?.toString() ?? '--')}
                systemStatus={systemStatusText}
                onOpenModal={handleOpenModal}
            />

            {/* Car Image (Visual only) */}
            <CarVisualization />

            {/* Vehicle Control & Status Panel (Tires, Windows, Doors, Climate) */}
            <VehicleStatusPanel status={vehicleStatus} />

            {/* Location / Map */}
            <LocationCard status={vehicleStatus} />

            {/* Quick Actions (Lock, etc.) */}
            <QuickActions />

            {/* Lazy Modals */}
            <React.Suspense fallback={null}>
                <TripInsightsModal
                    isOpen={!!insightType}
                    onClose={() => setInsightType(null)}
                    type={insightType || 'distance'} // Default to distance if null but open logic prevents it
                    trips={trips || []}
                    settings={settings}
                    summary={summary || undefined}
                    aiSoH={aiSoH}
                />
                <OdometerAdjustmentModal
                    isOpen={showOdometerModal}
                    onClose={() => setShowOdometerModal(false)}
                />
                <HealthReportModal
                    isOpen={showHealthModal}
                    onClose={() => setShowHealthModal(false)}
                    anomalies={activeAnomalies}
                    historyAnomalies={historyAnomalies}
                    onAcknowledge={(id) => setAcknowledgedAnomalies([...acknowledgedAnomalies, id])}
                    onDelete={(id) => setDeletedAnomalies([...deletedAnomalies, id])}
                />
                <RangeInsightsModal
                    isOpen={showRangeModal}
                    onClose={() => setShowRangeModal(false)}
                    aiScenarios={aiScenarios || []}
                    aiLoss={aiLoss || 0}
                    summary={summary || null}
                    isTraining={isAiTraining || false}
                />
            </React.Suspense>
        </div>
    );
};

export default DashboardTab;
