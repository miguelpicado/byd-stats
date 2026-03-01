import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVehicleStatus } from '@/hooks/useVehicleStatus';
import { useCar } from '@/context/CarContext';
import { useApp } from '@/context/AppContext';
import { useLayout } from '@/context/LayoutContext';
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
const ChargingInsightsModal = React.lazy(() => import('@components/modals/ChargingInsightsModal'));
const MfgDateModal = React.lazy(() => import('@components/modals/MfgDateModal'));
const ThermalStressModal = React.lazy(() => import('@components/modals/ThermalStressModal'));

const DashboardTab: React.FC = () => {
    const { t } = useTranslation();
    const { activeCar } = useCar();
    const { updateSettings } = useApp();
    const { isNative } = useLayout();
    const { stats, settings, charges, trips, aiSoH, aiSoHStats, acknowledgedAnomalies = [], deletedAnomalies = [], setAcknowledgedAnomalies, setDeletedAnomalies, aiLoss, aiScenarios, isAiTraining, recalculateSoH, recalculateAutonomy } = useData();
    const { summary } = stats || {};
    const vehicleStatus = useVehicleStatus(activeCar?.vin);

    // QuickActions only available for native app with PyBYD connection
    const showQuickActions = isNative && activeCar?.connectorType === 'pybyd';

    // Modal State
    const [insightType, setInsightType] = useState<TripInsightType | null>(null);
    const [showOdometerModal, setShowOdometerModal] = useState(false);
    const [showHealthModal, setShowHealthModal] = useState(false);
    const [showRangeModal, setShowRangeModal] = useState(false);
    const [showChargingInsightsModal, setShowChargingInsightsModal] = useState(false);
    const [showMfgModal, setShowMfgModal] = useState(false);
    const [showThermalModal, setShowThermalModal] = useState(false);

    // Map refresh state (triggered by easter egg or manual refresh)
    const [mapRefreshKey, setMapRefreshKey] = useState<number>(0);

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

    const handleMfgDateSave = (isoDate: string, displayDate: string) => {
        updateSettings({
            mfgDate: isoDate,
            mfgDateDisplay: displayDate
        });
    };

    const handleThermalStressSave = (factor: number) => {
        updateSettings({
            thermalStressFactor: factor
        });
    };

    const handleForceMapRefresh = () => {
        setMapRefreshKey(Date.now());
    };

    const handleOpenModal = (modal: string) => {
        switch (modal) {
            case 'generalInfo': // Odo
            case 'general':
                if (activeCar?.connectorType === 'pybyd' || vehicleStatus?.lastOdometer) {
                    setInsightType('distance');
                } else {
                    setShowOdometerModal(true);
                }
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
                setShowRangeModal(true);
                break;
            case 'chargingInsights':
                setShowChargingInsightsModal(true);
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

            {/* Car Image + Charging Overlay */}
            <CarVisualization
                onForceRefresh={handleForceMapRefresh}
                trips={trips}
                charges={charges}
                recalculateSoH={recalculateSoH}
                recalculateAutonomy={recalculateAutonomy}
                vehicleStatus={vehicleStatus}
                batteryCapacityKwh={settings?.batterySize ?? 60.48}
            />

            {/* Vehicle Control & Status Panel (Tires, Windows, Doors, Climate) */}
            <VehicleStatusPanel status={vehicleStatus} />

            {/* Location / Map */}
            <LocationCard status={vehicleStatus} forceRefresh={mapRefreshKey} />

            {/* Quick Actions (Lock, etc.) - Only in APK with PyBYD */}
            {showQuickActions && <QuickActions />}

            {/* Lazy Modals */}
            <React.Suspense fallback={null}>
                <TripInsightsModal
                    isOpen={!!insightType}
                    onClose={() => setInsightType(null)}
                    type={insightType || 'distance'}
                    trips={trips || []}
                    settings={settings}
                    summary={summary || undefined}
                    aiSoH={aiSoH}
                    aiSoHStats={aiSoHStats}
                    onMfgDateClick={() => setShowMfgModal(true)}
                    onThermalStressClick={() => setShowThermalModal(true)}
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
                <ChargingInsightsModal
                    isOpen={showChargingInsightsModal}
                    onClose={() => setShowChargingInsightsModal(false)}
                    stats={stats}
                    settings={settings}
                    charges={charges}
                    summary={summary || undefined}
                    trips={trips}
                />
                {showMfgModal && (
                    <MfgDateModal
                        isOpen={showMfgModal}
                        onClose={() => setShowMfgModal(false)}
                        onSave={handleMfgDateSave}
                        initialValue={settings?.mfgDateDisplay}
                    />
                )}
                {showThermalModal && (
                    <ThermalStressModal
                        isOpen={showThermalModal}
                        onClose={() => setShowThermalModal(false)}
                        onSave={handleThermalStressSave}
                        initialValue={settings?.thermalStressFactor || 1.0}
                    />
                )}
            </React.Suspense>
        </div>
    );
};

export default DashboardTab;
