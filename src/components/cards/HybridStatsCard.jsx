// BYD Stats - Hybrid Stats Card Component
// Displays hybrid vehicle specific stats with fuel/electric split visualization

import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { HYBRID_COLORS } from '../../utils/constants';

/**
 * HybridStatsCard - Shows energy split between electric and fuel modes
 * Only rendered when the vehicle is detected as a hybrid (PHEV)
 */
const HybridStatsCard = React.memo(({ summary, isCompact = false, isVertical = false }) => {
    const { t } = useTranslation();

    if (!summary?.isHybrid) return null;

    const electricPct = parseFloat(summary.electricPercentage) || 0;
    const fuelPct = parseFloat(summary.fuelPercentage) || 0;

    return (
        <div className={`col-span-2 bg-gradient-to-r from-emerald-500/10 via-amber-500/10 to-emerald-500/10 dark:from-emerald-900/20 dark:via-amber-900/20 dark:to-emerald-900/20 rounded-xl sm:rounded-2xl border border-emerald-200/50 dark:border-emerald-800/30 ${isCompact ? 'p-3' : 'p-4'}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🔌⛽</span>
                    <h3 className={`font-bold text-slate-900 dark:text-white ${isCompact ? 'text-sm' : 'text-base'}`}>
                        {t('hybrid.hybridPhev')}
                    </h3>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${electricPct > 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'}`}>
                    {summary.evModeUsage}% EV
                </span>
            </div>

            {/* Energy Split Bar */}
            <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {t('hybrid.electricLabel')} {electricPct.toFixed(0)}%
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {t('hybrid.fuelLabel')} {fuelPct.toFixed(0)}%
                    </span>
                </div>
                <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                    <div
                        className="h-full transition-all duration-500"
                        style={{ width: `${electricPct}%`, backgroundColor: HYBRID_COLORS.electric }}
                    />
                    <div
                        className="h-full transition-all duration-500"
                        style={{ width: `${fuelPct}%`, backgroundColor: HYBRID_COLORS.fuel }}
                    />
                </div>
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

HybridStatsCard.propTypes = {
    summary: PropTypes.shape({
        isHybrid: PropTypes.bool,
        totalFuel: PropTypes.string,
        avgFuelEff: PropTypes.string,
        electricPercentage: PropTypes.string,
        fuelPercentage: PropTypes.string,
        electricOnlyTrips: PropTypes.number,
        fuelUsedTrips: PropTypes.number,
        evModeUsage: PropTypes.string
    }),
    isCompact: PropTypes.bool,
    isVertical: PropTypes.bool
};

export default HybridStatsCard;
