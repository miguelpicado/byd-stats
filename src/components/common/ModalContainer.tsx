import React, { Suspense } from 'react';
import { useData } from '../../providers/DataProvider';

// Lazy loaded modals
const SettingsModalLazy = React.lazy(() => import('../modals/SettingsModal'));
const FilterModalLazy = React.lazy(() => import('../modals/FilterModal'));
const TripDetailModalLazy = React.lazy(() => import('../modals/TripDetailModal'));
const DatabaseUploadModalLazy = React.lazy(() => import('../modals/DatabaseUploadModal'));
const LegalModalLazy = React.lazy(() => import('../modals/LegalModal'));
const AddChargeModalLazy = React.lazy(() => import('../modals/AddChargeModal'));
const ChargeDetailModalLazy = React.lazy(() => import('../modals/ChargeDetailModal'));
const HelpModalLazy = React.lazy(() => import('../modals/HelpModal'));
const UploadOptionsModalLazy = React.lazy(() => import('../modals/UploadOptionsModal'));
const SyncConflictModalLazy = React.lazy(() => import('../modals/SyncConflictModal'));
const ConfirmationModalLazy = React.lazy(() => import('../common/ConfirmationModal'));
const CloudBackupsModalLazy = React.lazy(() => import('../modals/CloudBackupsModal'));
const RegistryRestoreModalLazy = React.lazy(() => import('../modals/RegistryRestoreModal'));
const ChargeNotificationModalLazy = React.lazy(() => import('../modals/ChargeNotificationModal'));
const BatteryStatusModalLazy = React.lazy(() => import('../modals/BatteryStatusModal'));

// Rarely used modals added in Sprint 8
const AddCarModalLazy = React.lazy(() => import('../modals/AddCarModal'));
const AlertHistoryModalLazy = React.lazy(() => import('../modals/AlertHistoryModal'));
const ChargeInsightsModalLazy = React.lazy(() => import('../modals/ChargeInsightsModal'));
const ChargingInsightsModalLazy = React.lazy(() => import('../modals/ChargingInsightsModal'));
const FAQModalLazy = React.lazy(() => import('../modals/FAQModal'));
const HealthReportModalLazy = React.lazy(() => import('../modals/HealthReportModal'));
const MfgDateModalLazy = React.lazy(() => import('../modals/MfgDateModal'));
const OdometerAdjustmentModalLazy = React.lazy(() => import('../modals/OdometerAdjustmentModal'));
const RangeInsightsModalLazy = React.lazy(() => import('../modals/RangeInsightsModal'));
const SoHExplanationModalLazy = React.lazy(() => import('../modals/SoHExplanationModal'));
const ThermalStressModalLazy = React.lazy(() => import('../modals/ThermalStressModal'));
const TripInsightsModalLazy = React.lazy(() => import('../modals/TripInsightsModal'));
const ClimateControlModalLazy = React.lazy(() => import('../modals/ClimateControlModal'));

const ModalContainer: React.FC = () => {
    const {
        modals,
        googleSync,
        confirmModalState,
        closeModal,
        openModal,
        charges,
        settings,
        stats,
        aiScenarios,
        aiLoss,
        aiSoH,
        aiSoHStats,
        trips,
        isAiTraining
    } = useData();

    return (
        <Suspense fallback={null}>
            {/* Core/Primary Modals */}
            {modals.tripDetail && <TripDetailModalLazy />}
            {modals.settings && <SettingsModalLazy />}
            {modals.history && <DatabaseUploadModalLazy />}
            {modals.upload && <UploadOptionsModalLazy />}
            {modals.filter && <FilterModalLazy />}
            {modals.legal && <LegalModalLazy />}
            {modals.addCharge && <AddChargeModalLazy />}
            {modals.chargeDetail && <ChargeDetailModalLazy />}
            {modals.help && <HelpModalLazy />}
            {googleSync?.pendingConflict && <SyncConflictModalLazy />}
            {confirmModalState?.isOpen && <ConfirmationModalLazy />}
            {modals.backups && <CloudBackupsModalLazy />}

            {modals.registryRestore && (
                <RegistryRestoreModalLazy
                    registryCars={modals.registryCars}
                    onRestore={async (car) => {
                        try {
                            await googleSync.restoreFromRegistry(car);
                        } finally {
                            closeModal('registryRestore');
                        }
                    }}
                    onSkip={() => {
                        closeModal('registryRestore');
                        googleSync.skipRegistryRestore();
                    }}
                />
            )}

            <ChargeNotificationModalLazy />
            {modals.batteryStatus && <BatteryStatusModalLazy />}

            {/* Sprint 8 Lazy Modals */}
            {modals.addCar && (
                <AddCarModalLazy
                    isOpen={modals.addCar}
                    onClose={() => closeModal('addCar')}
                    onSave={() => { }}
                />
            )}

            {modals.alertHistory && (
                <AlertHistoryModalLazy
                    isOpen={modals.alertHistory}
                    onClose={() => closeModal('alertHistory')}
                    historyAnomalies={[]}
                    onDelete={() => { }}
                />
            )}

            {modals.chargeInsights && (
                <ChargeInsightsModalLazy
                    isOpen={modals.chargeInsights}
                    onClose={() => closeModal('chargeInsights')}
                    type={modals.chargeInsightsType || 'kwh'}
                    charges={charges}
                    batterySize={Number(settings.batterySize)}
                    chargerTypes={settings.chargerTypes}
                />
            )}

            {modals.chargingInsights && (
                <ChargingInsightsModalLazy
                    isOpen={modals.chargingInsights}
                    onClose={() => closeModal('chargingInsights')}
                    stats={stats ? { ...stats, sohData: stats.sohData || null } : null}
                    settings={settings}
                />
            )}

            {modals.climateControl && (
                <ClimateControlModalLazy
                    isOpen={modals.climateControl}
                    onClose={() => closeModal('climateControl')}
                />
            )}

            {modals.faq && <FAQModalLazy />}

            {modals.healthReport && (
                <HealthReportModalLazy
                    isOpen={modals.healthReport}
                    onClose={() => closeModal('healthReport')}
                    anomalies={[]}
                    onAcknowledge={() => { }}
                />
            )}

            {modals.mfgDate && (
                <MfgDateModalLazy
                    isOpen={modals.mfgDate}
                    onClose={() => closeModal('mfgDate')}
                    onSave={() => { }}
                />
            )}

            {modals.odometerAdjustment && (
                <OdometerAdjustmentModalLazy
                    isOpen={modals.odometerAdjustment}
                    onClose={() => closeModal('odometerAdjustment')}
                />
            )}

            {modals.rangeInsights && (
                <RangeInsightsModalLazy
                    isOpen={modals.rangeInsights}
                    onClose={() => closeModal('rangeInsights')}
                    aiScenarios={aiScenarios || []}
                    aiLoss={aiLoss}
                    isTraining={isAiTraining}
                    summary={stats?.summary || null}
                />
            )}

            {modals.sohExplanation && (
                <SoHExplanationModalLazy
                    isOpen={modals.sohExplanation}
                    onClose={() => closeModal('sohExplanation')}
                    type={modals.sohExplanationType as any}
                />
            )}

            {modals.thermalStress && (
                <ThermalStressModalLazy
                    isOpen={modals.thermalStress}
                    onClose={() => closeModal('thermalStress')}
                    onSave={() => { }}
                />
            )}

            {modals.tripInsights && (
                <TripInsightsModalLazy
                    isOpen={modals.tripInsights}
                    onClose={() => closeModal('tripInsights')}
                    type={modals.tripInsightsType || 'distance'}
                    trips={trips}
                    settings={settings}
                    summary={stats?.summary}
                    aiSoH={aiSoH}
                    aiSoHStats={aiSoHStats}
                    onMfgDateClick={() => openModal('mfgDate')}
                    onThermalStressClick={() => openModal('thermalStress')}
                />
            )}
        </Suspense>
    );
};

export default React.memo(ModalContainer);
