
import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap } from '../Icons';
import { Summary, Settings, ProcessedData, Charge, Trip } from '../../types';
import ChargingInsightsModal from '../modals/ChargingInsightsModal';
import StatCard from '../ui/StatCard';
import { useLayout } from '@/context/LayoutContext';
import { ChargingLogic } from '@/core/chargingLogic';
import { useData } from '@/providers/DataProvider';

interface EstimatedChargeCardProps {
    summary: Summary;
    settings: Settings;
    stats: ProcessedData | null; // Needed for modal logic
    charges?: Charge[];
    trips?: Trip[];
}

const EstimatedChargeCard: React.FC<EstimatedChargeCardProps> = ({ summary, settings, stats, charges, trips }) => {
    const { t } = useTranslation();
    const { isCompact, isLargerCard, isVertical } = useLayout();
    const { findSmartChargingWindows } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [smartCharging, setSmartCharging] = useState<any>(null);
    const [isCalculating, setIsCalculating] = useState(false);

    // Calculate Daily Goal (kWh) - Same as modal
    // Includes seasonal adjustments for winter
    const dailyGoal = useMemo(() => {
        if (!summary || !stats) return 0;

        const totalKwh = parseFloat(summary.drivingKwh || '0');
        const days = summary.daysActive || 30;
        const avgDailyKwh = days > 0 ? totalKwh / days : 0;

        // Use the same seasonal factor calculation as the modal
        const monthlyStats = (stats?.monthly || []).map(m => ({
            ...m,
            efficiency: m.efficiency || 0
        }));
        const seasonalFactorResult = ChargingLogic.calculateSeasonalFactor(monthlyStats);
        const seasonalFactor = seasonalFactorResult.factor || 1;

        return avgDailyKwh * seasonalFactor;
    }, [summary, stats]);

    // Create a stable cache key based on actual data content (not object references)
    const tripsCacheKey = useMemo(() => {
        if (!trips || trips.length === 0) return '';
        const firstTs = trips[0]?.start_timestamp || 0;
        const lastTs = trips[trips.length - 1]?.start_timestamp || 0;
        return `${trips.length}-${firstTs}-${lastTs}`;
    }, [trips]);

    // Calculate Smart Charging Windows in background (only when data content changes)
    useEffect(() => {
        if (!settings || !findSmartChargingWindows) return;

        setIsCalculating(true);
        findSmartChargingWindows(trips || [], settings)
            .then(result => {
                setSmartCharging(result);
                setIsCalculating(false);
            })
            .catch(() => {
                setIsCalculating(false);
            });
    }, [tripsCacheKey, settings?.batterySize, settings?.homeChargerRating, findSmartChargingWindows]);

    return (
        <>
            <StatCard
                icon={Zap}
                label={isCalculating ? t('stats.analyzing', 'Analizando...') : t('stats.estimatedDailyCharge')}
                value={isCalculating ? '--' : dailyGoal.toFixed(1)}
                unit={isCalculating ? '' : t('units.kWh')}
                color={isCalculating ? 'bg-slate-500/20 text-slate-400 animate-pulse' : 'bg-blue-500/20 text-blue-400'}
                onClick={() => setIsModalOpen(true)}
                isCompact={isCompact}
                isLarger={isLargerCard}
                isVerticalMode={isVertical}
            />

            <ChargingInsightsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                stats={stats}
                settings={settings}
                charges={charges}
                summary={summary}
                trips={trips}
                smartCharging={smartCharging}
                isCalculating={isCalculating}
            />
        </>
    );
};

export default EstimatedChargeCard;
