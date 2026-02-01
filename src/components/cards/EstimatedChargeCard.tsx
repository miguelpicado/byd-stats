
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap } from '../Icons';
import { Summary, Settings, ProcessedData, Charge, Trip } from '../../types';
import ChargingInsightsModal from '../modals/ChargingInsightsModal';
import StatCard from '../ui/StatCard';
import { useLayout } from '@/context/LayoutContext';

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
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Calculate Estimated Daily Charge (kWh)
    // Logic: Driving kWh / Days Active (or more sophisticated window)
    // Summary has 'drivingKwh' and 'daysActive' or 'totalDays'
    const dailyKwh = useMemo(() => {
        if (!summary) return 0;
        // Parse drivingKwh (string "123.45")
        const kwh = parseFloat(summary.drivingKwh) || 0;
        const days = summary.daysActive || 1;
        return days > 0 ? (kwh / days) : 0;
    }, [summary]);

    return (
        <>
            <StatCard
                icon={Zap}
                label={t('stats.estimatedDailyCharge')}
                value={dailyKwh.toFixed(1)}
                unit={t('units.kWh')}
                color="bg-blue-500/20 text-blue-400"
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
                trips={trips}
            />
        </>
    );
};

export default EstimatedChargeCard;
