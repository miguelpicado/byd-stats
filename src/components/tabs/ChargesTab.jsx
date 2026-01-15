// BYD Stats - Charges Tab Component
// Displays charging history and statistics

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useLayout } from '../../context/LayoutContext';
import { BYD_RED } from '../../utils/constants';
import { Battery, Zap, Calendar, Euro } from '../Icons.jsx';
import StatCard from '../ui/StatCard';
import FloatingActionButton from '../common/FloatingActionButton';

/**
 * Format date string from YYYY-MM-DD to localized format
 */
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
};

/**
 * Charges tab showing charging history and summary
 */
const ChargesTab = React.memo(({
    charges = [],
    chargerTypes = [],
    onChargeClick,
    onAddClick
}) => {
    const { t } = useTranslation();
    const { isCompact, isVertical } = useLayout();

    // Sort charges by timestamp descending (newest first)
    const sortedCharges = useMemo(() => {
        return [...charges].sort((a, b) => b.timestamp - a.timestamp);
    }, [charges]);

    // Calculate summary statistics
    const summary = useMemo(() => {
        if (charges.length === 0) return null;

        const totalKwh = charges.reduce((sum, c) => sum + (c.kwhCharged || 0), 0);
        const totalCost = charges.reduce((sum, c) => sum + (c.totalCost || 0), 0);
        const avgPricePerKwh = charges.length > 0
            ? charges.reduce((sum, c) => sum + (c.pricePerKwh || 0), 0) / charges.length
            : 0;

        return {
            chargeCount: charges.length,
            totalKwh,
            totalCost,
            avgPricePerKwh
        };
    }, [charges]);

    // Get charger type name by ID
    const getChargerTypeName = (chargerTypeId) => {
        const chargerType = chargerTypes.find(ct => ct.id === chargerTypeId);
        return chargerType?.name || chargerTypeId || '-';
    };

    // Empty state
    if (charges.length === 0) {
        return (
            <>
                <div className={`flex flex-col items-center justify-center ${isCompact ? 'py-12' : 'py-20'}`}>
                    <div
                        className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                        style={{ backgroundColor: `${BYD_RED}15` }}
                    >
                        <Battery className="w-10 h-10" style={{ color: BYD_RED }} />
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-center font-medium">
                        {t('charges.noCharges')}
                    </p>
                    <p className="text-slate-400 dark:text-slate-500 text-sm text-center mt-1">
                        {t('charges.addFirst')}
                    </p>

                    {!isVertical && onAddClick && (
                        <button
                            onClick={onAddClick}
                            className="mt-6 py-2 px-6 rounded-xl text-white font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg"
                            style={{ backgroundColor: BYD_RED }}
                        >
                            <Battery className="w-5 h-5" />
                            {t('charges.addCharge')}
                        </button>
                    )}
                </div>
                {isVertical && onAddClick && (
                    <FloatingActionButton
                        onClick={onAddClick}
                        label={t('charges.addCharge')}
                    />
                )}
            </>
        );
    }

    return (
        <div className={`space-y-4 ${isCompact ? 'space-y-3' : ''}`}>
            {/* Header */}
            <div className="flex items-center gap-2">
                <Battery className="w-5 h-5" style={{ color: BYD_RED }} />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {t('charges.title')}
                </h2>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                    ({summary?.chargeCount || 0})
                </span>

                {/* Action Button - Visible in all modes, positioned in header for non-vertical */}
                {!isVertical && onAddClick && (
                    <button
                        onClick={onAddClick}
                        className="ml-auto py-2 px-4 rounded-xl text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm"
                        style={{ backgroundColor: BYD_RED }}
                    >
                        <Battery className="w-4 h-4" />
                        {t('charges.addCharge')}
                    </button>
                )}
            </div>

            {/* Header spacer to prevent overlap if needed, though absolute positioning puts it in corner */}
            <div className="h-1"></div>

            {/* Summary Cards */}
            {summary && (
                <div className={`grid ${isVertical ? 'grid-cols-2' : 'grid-cols-4'} gap-3`}>
                    <StatCard
                        icon={Zap}
                        label={t('charges.totalKwh')}
                        value={summary.totalKwh.toFixed(1)}
                        unit="kWh"
                        color="bg-emerald-500"
                        isCompact={isCompact}
                        isVerticalMode={isVertical}
                    />
                    <StatCard
                        icon={Euro}
                        label={t('charges.totalCost')}
                        value={summary.totalCost.toFixed(2)}
                        unit="€"
                        color="bg-amber-500"
                        isCompact={isCompact}
                        isVerticalMode={isVertical}
                    />
                    <StatCard
                        icon={Calendar}
                        label={t('charges.chargeCount')}
                        value={summary.chargeCount}
                        unit=""
                        color="bg-blue-500"
                        isCompact={isCompact}
                        isVerticalMode={isVertical}
                    />
                    <StatCard
                        icon={Zap}
                        label={t('charges.avgPrice')}
                        value={summary.avgPricePerKwh.toFixed(3)}
                        unit="€/kWh"
                        color="bg-purple-500"
                        isCompact={isCompact}
                        isVerticalMode={isVertical}
                    />
                </div>
            )}

            {/* Charges List */}
            <div className={`space-y-2 ${isCompact ? 'space-y-1' : ''}`}>
                {sortedCharges.map(charge => (
                    <div
                        key={charge.id}
                        onClick={() => onChargeClick && onChargeClick(charge)}
                        className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                        <div className="flex justify-between items-center">
                            <div className="flex-1">
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {formatDate(charge.date)} - {charge.time}
                                </p>
                                <p className="text-lg font-bold text-slate-900 dark:text-white">
                                    {charge.kwhCharged?.toFixed(2) || '0.00'} kWh
                                </p>
                                <p className="text-xs text-slate-400 dark:text-slate-500">
                                    {getChargerTypeName(charge.chargerTypeId)}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-amber-600 dark:text-amber-400 font-semibold">
                                    {charge.totalCost?.toFixed(2) || '0.00'} €
                                </p>
                                {charge.finalPercentage && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {charge.initialPercentage ? `${charge.initialPercentage}% → ` : ''}
                                        {charge.finalPercentage}%
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Floating Action Button - Only in vertical mode */}
            {isVertical && onAddClick && (
                <FloatingActionButton
                    onClick={onAddClick}
                    label={t('charges.addCharge')}
                />
            )}
        </div>
    );
});

ChargesTab.propTypes = {
    charges: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string,
        date: PropTypes.string,
        time: PropTypes.string,
        timestamp: PropTypes.number,
        odometer: PropTypes.number,
        kwhCharged: PropTypes.number,
        chargerTypeId: PropTypes.string,
        pricePerKwh: PropTypes.number,
        totalCost: PropTypes.number,
        finalPercentage: PropTypes.number,
        initialPercentage: PropTypes.number
    })),
    chargerTypes: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        speedKw: PropTypes.number,
        efficiency: PropTypes.number
    })),
    onChargeClick: PropTypes.func,
    onAddClick: PropTypes.func
};

ChargesTab.displayName = 'ChargesTab';

export default ChargesTab;
