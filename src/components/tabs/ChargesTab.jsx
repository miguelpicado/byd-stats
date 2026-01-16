// BYD Stats - Charges Tab Component
// Displays last 10 charges with insights, similar to HistoryTab

import React, { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useLayout } from '../../context/LayoutContext';
import { BYD_RED } from '../../utils/constants';
import { Battery, Zap, Calendar, Euro, TrendingUp } from '../Icons.jsx';
import FloatingActionButton from '../common/FloatingActionButton';

// Electric blue color for the "New charge" button
const ELECTRIC_BLUE = '#0ea5e9';

/**
 * Format date string from YYYY-MM-DD to localized format
 */
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
};

/**
 * Charges tab showing last 10 charges with summary and insights
 */
const ChargesTab = React.memo(({
    charges = [],
    chargerTypes = [],
    onChargeClick,
    onAddClick,
    setShowAllChargesModal
}) => {
    const { t } = useTranslation();
    const { isCompact, isVertical, isFullscreenBYD } = useLayout();

    // Sort charges by timestamp descending (newest first)
    const sortedCharges = useMemo(() => {
        return [...charges].sort((a, b) => b.timestamp - a.timestamp);
    }, [charges]);

    // Get last 10 charges split into columns
    const { firstColumn, secondColumn, last10 } = useMemo(() => {
        const last = sortedCharges.slice(0, 10);
        return {
            last10: last,
            firstColumn: last.slice(0, 5),
            secondColumn: last.slice(5, 10)
        };
    }, [sortedCharges]);

    // Calculate summary statistics for last 10 charges
    const summary = useMemo(() => {
        if (last10.length === 0) return null;

        const len = last10.length;
        const totalKwh = last10.reduce((sum, c) => sum + (c.kwhCharged || 0), 0);
        const totalCost = last10.reduce((sum, c) => sum + (c.totalCost || 0), 0);
        const avgKwh = totalKwh / len;
        const avgCost = totalCost / len;
        const avgPricePerKwh = last10.reduce((sum, c) => sum + (c.pricePerKwh || 0), 0) / len;

        return {
            chargeCount: charges.length,
            avgKwh,
            avgCost,
            avgPricePerKwh
        };
    }, [last10, charges.length]);

    // Get charger type name by ID
    const getChargerTypeName = useCallback((chargerTypeId) => {
        const chargerType = chargerTypes.find(ct => ct.id === chargerTypeId);
        return chargerType?.name || chargerTypeId || '-';
    }, [chargerTypes]);

    // Stat card padding logic: Compact very tight, Fullscreen slightly relaxed, Normal generous
    const statCardPadding = isCompact ? 'p-2' : (isFullscreenBYD ? 'p-3' : 'p-4');
    const statIconSize = isCompact ? 'w-8 h-8' : (isFullscreenBYD ? 'w-9 h-9' : 'w-10 h-10');
    const statIconInner = isCompact ? 'w-4 h-4' : (isFullscreenBYD ? 'w-4.5 h-4.5' : 'w-5 h-5');
    const statLabelText = isCompact ? 'text-[10px]' : 'text-xs';
    const statValueText = isCompact ? 'text-xl' : (isFullscreenBYD ? 'text-[22px]' : 'text-2xl');

    // Render stat card helper
    const renderStatCard = useCallback((icon, label, value, unit, color) => (
        <div className={`bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 flex-1 flex items-center justify-center ${statCardPadding}`}>
            <div className="flex flex-col items-center text-center gap-1">
                <div className={`rounded-lg ${color} flex items-center justify-center ${statIconSize}`}>
                    {React.createElement(icon, { className: statIconInner })}
                </div>
                <div>
                    <p className={`text-slate-600 dark:text-slate-400 ${statLabelText}`}>{label}</p>
                    <p className={`font-bold text-slate-900 dark:text-white ${statValueText}`}>
                        {value} <span className={`text-slate-500 dark:text-slate-400 ${isCompact ? 'text-xs' : 'text-sm'}`}>{unit}</span>
                    </p>
                </div>
            </div>
        </div>
    ), [isCompact, isFullscreenBYD, statCardPadding, statIconSize, statIconInner, statLabelText, statValueText]);

    // Charge card padding: Compact tight, Fullscreen slightly relaxed
    const chargeCardPadding = isCompact ? 'p-[13px]' : (isFullscreenBYD ? 'p-[15px]' : 'p-[15px]');
    const dateText = isCompact ? 'text-xs' : 'text-sm';
    const kwhText = isCompact ? 'text-base' : (isFullscreenBYD ? 'text-[17px]' : 'text-lg');

    // Render charge card
    const renderChargeCard = useCallback((charge) => (
        <div
            key={charge.id}
            onClick={() => onChargeClick && onChargeClick(charge)}
            className={`bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${chargeCardPadding}`}
        >
            <div className="flex justify-between items-center">
                <div className="flex-1">
                    <p className={`text-slate-500 dark:text-slate-400 ${dateText}`}>
                        {formatDate(charge.date)} - {charge.time}
                    </p>
                    <p className={`font-bold text-slate-900 dark:text-white ${kwhText}`}>
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
    ), [onChargeClick, getChargerTypeName, chargeCardPadding, dateText, kwhText]);

    // Empty state
    if (charges.length === 0) {
        return (
            <>
                <div className={`flex flex-col items-center justify-center ${isCompact ? 'py-12' : 'py-20'}`}>
                    <div
                        className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                        style={{ backgroundColor: `${ELECTRIC_BLUE}15` }}
                    >
                        <Battery className="w-10 h-10" style={{ color: ELECTRIC_BLUE }} />
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
                            style={{ backgroundColor: ELECTRIC_BLUE }}
                        >
                            <Battery className="w-5 h-5" />
                            {t('charges.addCharge')}
                        </button>
                    )}
                </div>
                {isVertical && onAddClick && (
                    <FloatingActionButton onClick={onAddClick} label={t('charges.addCharge')} />
                )}
            </>
        );
    }

    // Render vertical layout
    if (isVertical) {
        return (
            <div className="space-y-4">
                {/* Header with title */}
                <div className="flex items-center justify-between">
                    <h2 className="font-bold text-slate-900 dark:text-white text-xl">
                        {t('charges.last10Charges')}
                    </h2>
                </div>

                {/* Stats grid */}
                {summary && (
                    <div className="grid grid-cols-2 gap-3">
                        {renderStatCard(Zap, t('charges.avgKwh'), summary.avgKwh.toFixed(2), 'kWh', 'bg-emerald-500/20 text-emerald-400')}
                        {renderStatCard(Euro, t('charges.avgCost'), summary.avgCost.toFixed(2), '€', 'bg-amber-500/20 text-amber-400')}
                        {renderStatCard(TrendingUp, t('charges.avgPrice'), summary.avgPricePerKwh.toFixed(3), '€/kWh', 'bg-purple-500/20 text-purple-400')}
                        {renderStatCard(Calendar, t('charges.chargeCount'), summary.chargeCount, '', 'bg-blue-500/20 text-blue-400')}
                    </div>
                )}

                {/* Charges list */}
                <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-3">
                        {firstColumn.map(charge => renderChargeCard(charge))}
                    </div>
                    <div className="space-y-3">
                        {secondColumn.map(charge => renderChargeCard(charge))}
                    </div>
                </div>

                {/* Show all button */}
                {charges.length > 10 && setShowAllChargesModal && (
                    <button
                        onClick={() => setShowAllChargesModal(true)}
                        className="w-full py-3 rounded-xl font-medium text-white"
                        style={{ backgroundColor: BYD_RED }}
                    >
                        {t('common.showAll')} ({charges.length})
                    </button>
                )}

                {isVertical && onAddClick && (
                    <FloatingActionButton onClick={onAddClick} label={t('charges.addCharge')} />
                )}
            </div>
        );
    }

    // Render horizontal layout (compact and fullscreenBYD)
    // Layout: Title row, then grid with charges (6 cols) and stats (2 cols), then buttons row
    // Apply "compact" layout structure for both compact and fullscreenBYD modes

    // Spacing configuration driven by mode
    // Compact: gap-1.5, space-y-2
    // Fullscreen: gap-2, space-y-3 - slightly more breathing room than compact, but tight enough for 720px
    const cardGap = isCompact ? 'gap-1.5' : (isFullscreenBYD ? 'gap-2' : 'gap-3');
    const columnGap = isCompact ? 'gap-3' : 'gap-4';
    const verticalSpace = isCompact ? 'space-y-2' : (isFullscreenBYD ? 'space-y-3' : 'space-y-4');
    const headerMargin = isCompact ? 'mb-2' : (isFullscreenBYD ? 'mb-2' : 'mb-3');
    const headerText = isCompact ? 'text-lg' : (isFullscreenBYD ? 'text-xl' : 'text-xl');
    const buttonPadding = isCompact ? 'py-2' : (isFullscreenBYD ? 'py-2.5' : 'py-3');

    // Charge list spacing
    const listSpace = isCompact || isFullscreenBYD ? cardGap : 'space-y-3';
    // Actually gaps are handled by grid gap, so list items just need margin or gap
    // Using space-y for list items inside col
    const listY = isCompact ? 'space-y-1.5' : (isFullscreenBYD ? 'space-y-2' : 'space-y-3');

    return (
        <div className={verticalSpace}>
            {/* Title */}
            <h2 className={`font-bold text-slate-900 dark:text-white ${headerText} ${headerMargin}`}>
                {t('charges.last10Charges')}
            </h2>

            {/* Main content: 8-column grid */}
            <div className={`grid lg:grid-cols-8 ${columnGap}`}>
                {/* Left: Charges (6 cols) - two columns of 5 cards each */}
                <div className={`lg:col-span-6 grid lg:grid-cols-2 ${cardGap}`}>
                    <div className={listY}>
                        {firstColumn.map(charge => renderChargeCard(charge))}
                    </div>
                    <div className={listY}>
                        {secondColumn.map(charge => renderChargeCard(charge))}
                    </div>
                </div>

                {/* Right: Stats (2 cols) - use flex column with justify-between to match height */}
                <div className={`lg:col-span-2 flex flex-col ${cardGap}`}>
                    {summary && (
                        <>
                            {renderStatCard(Zap, t('charges.avgKwh'), summary.avgKwh.toFixed(2), 'kWh', 'bg-emerald-500/20 text-emerald-400')}
                            {renderStatCard(Euro, t('charges.avgCost'), summary.avgCost.toFixed(2), '€', 'bg-amber-500/20 text-amber-400')}
                            {renderStatCard(TrendingUp, t('charges.avgPrice'), summary.avgPricePerKwh.toFixed(3), '€/kWh', 'bg-purple-500/20 text-purple-400')}
                            {renderStatCard(Calendar, t('charges.chargeCount'), summary.chargeCount, '', 'bg-blue-500/20 text-blue-400')}
                        </>
                    )}
                </div>
            </div>

            {/* Bottom row: Buttons aligned with columns above */}
            <div className={`grid lg:grid-cols-8 ${columnGap}`}>
                {/* Mostrar todo spans 6 columns (under charges) */}
                <div className="lg:col-span-6">
                    {charges.length > 10 && setShowAllChargesModal && (
                        <button
                            onClick={() => setShowAllChargesModal(true)}
                            className={`w-full rounded-xl font-medium text-white ${buttonPadding}`}
                            style={{ backgroundColor: BYD_RED }}
                        >
                            {t('common.showAll')} ({charges.length})
                        </button>
                    )}
                </div>

                {/* Nueva carga spans 2 columns (under stats) */}
                <div className="lg:col-span-2">
                    {onAddClick && (
                        <button
                            onClick={onAddClick}
                            className={`w-full rounded-xl text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 ${buttonPadding}`}
                            style={{ backgroundColor: ELECTRIC_BLUE }}
                        >
                            <Battery className="w-4 h-4" />
                            {t('charges.addCharge')}
                        </button>
                    )}
                </div>
            </div>
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
    onAddClick: PropTypes.func,
    setShowAllChargesModal: PropTypes.func
};

ChargesTab.displayName = 'ChargesTab';

export default ChargesTab;
