import React from 'react';
import { useTranslation } from 'react-i18next';
import { HYBRID_COLORS } from '@core/constants';
import { Summary } from '@/types';

interface HybridStatsCardProps {
    summary: Summary | null;
    isCompact?: boolean;
    isVertical?: boolean;
}

/**
 * HybridStatsCard - Shows energy split between electric and fuel modes
 * Only rendered when the vehicle is detected as a hybrid (PHEV)
 */
const HybridStatsCard: React.FC<HybridStatsCardProps> = React.memo(({ summary, isCompact = false, isVertical = false }) => {
    const { t } = useTranslation();

    if (!summary?.isHybrid) return null;

    const electricPct = parseFloat(summary.electricPercentage) || 0;
    const fuelPct = parseFloat(summary.fuelPercentage) || 0;
    const evModePct = parseFloat(summary.evModeUsage) || 0;
    const hybridModePct = 100 - evModePct;

    const renderProgressBar = (label: string, pct1: number, pct2: number, color1: string, color2: string, label1: string, label2: string) => (
        <div className="w-full">
            <div className="flex justify-between items-end mb-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{label}</span>
            </div>
            <div className="flex justify-between text-[10px] mb-1 opacity-80">
                <span style={{ color: color1 }} className="font-medium">
                    {label1} {pct1.toFixed(0)}%
                </span>
                <span style={{ color: color2 }} className="font-medium">
                    {label2} {pct2.toFixed(0)}%
                </span>
            </div>
            <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                <div
                    className="h-full transition-all duration-500"
                    style={{ width: `${pct1}%`, backgroundColor: color1 }}
                />
                <div
                    className="h-full transition-all duration-500"
                    style={{ width: `${pct2}%`, backgroundColor: color2 }}
                />
            </div>
        </div>
    );

    return (
        <div className={`col-span-2 bg-gradient-to-r from-emerald-500/10 via-amber-500/10 to-emerald-500/10 dark:from-emerald-900/20 dark:via-amber-900/20 dark:to-emerald-900/20 rounded-xl sm:rounded-2xl border border-emerald-200/50 dark:border-emerald-800/30 ${isCompact ? 'p-3' : 'p-4'}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🔌⛽</span>
                    <h3 className={`font-bold text-slate-900 dark:text-white ${isCompact ? 'text-sm' : 'text-base'}`}>
                        {t('hybrid.hybridPhev')}
                    </h3>
                </div>
            </div>

            {/* Dual Energy Split Bars */}
            <div className={`grid ${!isVertical ? 'grid-cols-2 gap-4' : 'grid-cols-1 gap-3'} mb-4`}>
                {renderProgressBar(
                    t('stats.distance'),
                    electricPct,
                    fuelPct,
                    HYBRID_COLORS.electric,
                    HYBRID_COLORS.fuel,
                    t('hybrid.electricLabel'),
                    t('hybrid.fuelLabel')
                )}
                {renderProgressBar(
                    t('stats.trips'),
                    evModePct,
                    hybridModePct,
                    '#3b82f6', // Blue-500 (EV Trips)
                    '#f97316', // Orange-500 (Hybrid Trips)
                    'EV',
                    'Hybrid'
                )}
            </div>

            {/* Stats Grid */}
            <div className={`grid ${isVertical ? 'grid-cols-2' : 'grid-cols-4'} gap-2`}>
                <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('hybrid.totalFuel')}</p>
                    <p className="font-bold text-slate-900 dark:text-white text-lg">{summary.totalFuel}<span className="text-xs text-slate-500 ml-1">L</span></p>
                </div>
                <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('hybrid.avgFuelEfficiency')}</p>
                    <p className="font-bold text-slate-900 dark:text-white text-lg">{summary.avgFuelEff}<span className="text-xs text-slate-500 ml-1">L/100km</span></p>
                </div>
                <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('hybrid.evOnlyTrips')}</p>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">{summary.electricOnlyTrips}</p>
                </div>
                <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('hybrid.hybridTrips')}</p>
                    <p className="font-bold text-amber-600 dark:text-amber-400 text-lg">{summary.fuelUsedTrips}</p>
                </div>
            </div>
        </div>
    );
});

HybridStatsCard.displayName = 'HybridStatsCard';

export default HybridStatsCard;



