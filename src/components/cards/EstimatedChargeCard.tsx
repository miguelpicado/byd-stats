
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap } from '../Icons';
import { Settings, Charge } from '../../types';
import ChargeInsightsModal from '../modals/ChargeInsightsModal';
import StatCard from '../ui/StatCard';
import { useLayout } from '@/context/LayoutContext';

interface EstimatedChargeCardProps {
    settings: Settings;
    charges?: Charge[];
}

const EstimatedChargeCard: React.FC<EstimatedChargeCardProps> = ({ settings, charges = [] }) => {
    const { t } = useTranslation();
    const { isCompact, isLargerCard, isVertical } = useLayout();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Average kWh from last 10 electric charges
    const avgKwh = useMemo(() => {
        const electricCharges = charges.filter(c => c.type !== 'fuel' && (c.kwhCharged || 0) > 0);
        const last10 = electricCharges.slice(0, 10);
        if (last10.length === 0) return 0;
        const total = last10.reduce((acc, c) => acc + (c.kwhCharged || 0), 0);
        return total / last10.length;
    }, [charges]);

    const batterySize = typeof settings.batterySize === 'string'
        ? parseFloat(settings.batterySize)
        : (settings.batterySize || 0);

    return (
        <>
            <StatCard
                icon={Zap}
                label={t('charges.avgKwh')}
                value={avgKwh.toFixed(2)}
                unit={t('units.kWh')}
                color="bg-emerald-500/20 text-emerald-400"
                onClick={() => setIsModalOpen(true)}
                isCompact={isCompact}
                isLarger={isLargerCard}
                isVerticalMode={isVertical}
            />

            <ChargeInsightsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                type="kwh"
                charges={charges}
                batterySize={batterySize}
                chargerTypes={settings.chargerTypes || []}
            />
        </>
    );
};

export default EstimatedChargeCard;
