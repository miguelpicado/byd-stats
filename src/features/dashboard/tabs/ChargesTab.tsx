import React, { useMemo, useCallback, useState, FC } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { useLayout } from '@/context/LayoutContext';
import { useData } from '@/providers/DataProvider';
import { BYD_RED } from '@core/constants';
import { Zap, Euro, Battery, Calendar, TrendingUp, Fuel, IconProps } from '@components/Icons';
import FloatingActionButton from '@components/common/FloatingActionButton';
import ChargeInsightsModal from '@components/modals/ChargeInsightsModal';
import { Charge, ChargerType } from '@/types';

interface ChargesTabProps {
    charges: Charge[];
    chargerTypes: ChargerType[];
    onChargeClick: (charge: Charge) => void;
    onAddClick: () => void;
    setShowAllChargesModal: (show: boolean) => void;
    batterySize?: number;
    isActive?: boolean;
}

// Electric blue color for the "New charge" button
const ELECTRIC_BLUE = '#0ea5e9';

/**
 * Format date string from YYYY-MM-DD to localized format
 */
const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
};

/**
 * Charges tab showing last 10 charges with summary and insights
 */
const ChargesTab: FC<ChargesTabProps> = React.memo(({
    charges = [],
    chargerTypes = [],
    onChargeClick,
    onAddClick,
    setShowAllChargesModal,
    batterySize = 60.48
}) => {
    const { t } = useTranslation();
    const { isCompact, isVertical, isFullscreenBYD } = useLayout();
    const { replaceCharges } = useData();

    // State for insights modal
    const [insightType, setInsightType] = useState<'kwh' | 'cost' | 'price' | 'count' | 'fuel' | null>(null);
    const [eggCount, setEggCount] = useState(0);

    // Easter Egg: Recalculate Initial SoC
    const handleEggClick = useCallback(() => {
        const newCount = eggCount + 1;
        setEggCount(newCount);

        if (newCount === 10) {
            toast.loading(t('common.recalculating', 'Recalculating...'), { duration: 2000 });

            // Ensure batterySize is valid number
            const validBatterySize = parseFloat(String(batterySize)) || 60.48;
            let updatedCount = 0;

            // Logic to recalc missing initial SoC
            const updatedArgs = charges.map(c => {
                let initial = c.initialPercentage;
                let final = c.finalPercentage;
                let isEstimated = c.isSOCEstimated || false;

                // Round final percentage if it exists
                if (final !== undefined && final !== null) {
                    final = Math.round(final);
                }

                // Condition: 
                // 1. Initial is missing/0
                // 2. OR it is ALREADY estimated
                // 3. OR Final Percentage has decimals (needs rounding)
                const finalHasDecimals = c.finalPercentage !== final;

                if ((initial === undefined || initial === 0 || initial === null || isEstimated || finalHasDecimals) && final && c.kwhCharged) {
                    // Estimate: Start = End - (kWh / Capacity * 100)
                    const percentAdded = (c.kwhCharged / validBatterySize) * 100;
                    // Round to nearest integer (unity)
                    initial = Math.max(0, Math.round(final - percentAdded));
                    isEstimated = true;
                    updatedCount++;
                }

                return { ...c, initialPercentage: initial, finalPercentage: final, isSOCEstimated: isEstimated };
            });

            if (updatedCount > 0) {
                replaceCharges(updatedArgs);
                toast.success(t('common.chargesUpdated', `Updated ${updatedCount} charges!`));
            } else {
                toast(t('common.noUpdatesNeeded', 'No charges needed updating.'));
            }
            setEggCount(0);
        }
    }, [eggCount, charges, batterySize, replaceCharges, t]);

    // Get last 10 charges split into columns (assuming charges are already sorted descending by useChargesData)
    const { firstColumn, secondColumn, last10 } = useMemo(() => {
        const last = charges.slice(0, 10);
        return {
            last10: last,
            firstColumn: last.slice(0, 5),
            secondColumn: last.slice(5, 10)
        };
    }, [charges]);

    // Calculate summary statistics for last 10 charges
    const summary = useMemo(() => {
        if (last10.length === 0) return null;

        const len = last10.length;

        // Single pass reduction
        const { totalKwh, totalCost, totalPrice, totalLiters, fuelCount } = last10.reduce((acc, c) => ({
            totalKwh: acc.totalKwh + (c.kwhCharged || 0),
            totalCost: acc.totalCost + (c.totalCost || 0),
            totalPrice: acc.totalPrice + (c.type === 'fuel' ? (c.pricePerLiter || 0) : (c.pricePerKwh || 0)),
            totalLiters: acc.totalLiters + (c.litersCharged || 0),
            fuelCount: acc.fuelCount + (c.type === 'fuel' ? 1 : 0)
        }), { totalKwh: 0, totalCost: 0, totalPrice: 0, totalLiters: 0, fuelCount: 0 });

        return {
            chargeCount: charges.length,
            avgKwh: (len - fuelCount) > 0 ? totalKwh / (len - fuelCount) : 0,
            avgLiters: fuelCount > 0 ? totalLiters / fuelCount : 0,
            avgCost: totalCost / len,
            avgPrice: totalPrice / len, // Combined average
            hasFuel: fuelCount > 0
        };
    }, [last10, charges.length]);

    // Get charger type name by ID
    const getChargerTypeName = useCallback((chargerTypeId: string) => {
        const chargerType = chargerTypes.find(ct => ct.id === chargerTypeId);
        return chargerType?.name || chargerTypeId || '-';
    }, [chargerTypes]);

    // Stat card padding logic: Compact very tight, Fullscreen slightly relaxed, Normal generous
    const statCardPadding = isCompact ? 'p-2' : (isFullscreenBYD ? 'p-3' : 'p-4');
    const statIconSize = isCompact ? 'w-8 h-8' : (isFullscreenBYD ? 'w-9 h-9' : 'w-10 h-10');
    const statIconInner = isCompact ? 'w-4 h-4' : (isFullscreenBYD ? 'w-4.5 h-4.5' : 'w-5 h-5');
    const statLabelText = isCompact ? 'text-[10px]' : 'text-xs';
    const statValueText = isCompact ? 'text-xl' : (isFullscreenBYD ? 'text-[22px]' : 'text-2xl');

    // Render stat card helper - now with onClick support
    const renderStatCard = useCallback((
        icon: FC<IconProps>,
        label: string,
        value: string | number,
        unit: string,
        color: string,
        onClick?: () => void
    ) => (
        <div
            className={`bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 flex-1 flex items-center justify-center ${statCardPadding} ${onClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all active:scale-[0.98]' : ''}`}
            onClick={onClick}
        >
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
    const renderChargeCard = useCallback((charge: Charge) => {
        const isFuel = charge.type === 'fuel';

        return (
            <div
                key={charge.id}
                onClick={() => onChargeClick && onChargeClick(charge)}
                className={`bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${chargeCardPadding}`}
            >
                <div className="flex justify-between items-center">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                            {isFuel && <Fuel className="w-3.5 h-3.5 text-amber-500" />}
                            <p className={`text-slate-500 dark:text-slate-400 ${dateText}`}>
                                {formatDate(charge.date)} - {charge.time}
                            </p>
                        </div>
                        <p className={`font-bold ${isFuel ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'} ${kwhText}`}>
                            {isFuel
                                ? `${charge.litersCharged?.toFixed(2) || '0.00'} L`
                                : `${charge.kwhCharged?.toFixed(2) || '0.00'} kWh`
                            }
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                            {isFuel
                                ? `${charge.pricePerLiter?.toFixed(3) || '0.000'} €/L`
                                : getChargerTypeName(charge.chargerTypeId)
                            }
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-900 dark:text-white font-semibold">
                            {charge.totalCost?.toFixed(2) || '0.00'} €
                        </p>
                        {!isFuel && charge.finalPercentage && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {(charge.initialPercentage !== undefined && charge.initialPercentage !== null) ? `${Math.round(charge.initialPercentage)}% → ` : ''}
                                {Math.round(charge.finalPercentage)}%
                            </p>
                        )}
                        {isFuel && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {t('charges.typeFuel')}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }, [onChargeClick, getChargerTypeName, chargeCardPadding, dateText, kwhText, t]);

    // Empty state
    if (charges.length === 0) {
        return (
            <>
                <div className={`flex flex-col items-center justify-center ${isCompact ? 'py-12' : 'py-20'}`}>
                    <div
                        className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                        style={{ backgroundColor: `${ELECTRIC_BLUE}15` }}
                    >
                        <Battery className="w-10 h-10" color={ELECTRIC_BLUE} />
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
                            <Battery className="w-5 h-5" color="white" />
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
                    <h2
                        className="font-bold text-slate-900 dark:text-white text-xl cursor-pointer select-none active:scale-95 transition-transform"
                        onClick={handleEggClick}
                    >
                        {t('charges.last10Charges')}
                    </h2>
                </div>

                {/* Stats grid */}
                {summary && (
                    <div className="grid grid-cols-2 gap-3">
                        {renderStatCard(
                            summary.hasFuel ? Fuel : Zap,
                            summary.hasFuel ? t('charges.litersCharged') : t('charges.avgKwh'),
                            summary.hasFuel ? summary.avgLiters.toFixed(2) : summary.avgKwh.toFixed(2),
                            summary.hasFuel ? 'L' : 'kWh',
                            summary.hasFuel ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400',
                            () => setInsightType(summary.hasFuel ? 'fuel' : 'kwh')
                        )}
                        {renderStatCard(Euro, t('charges.avgCost'), summary.avgCost.toFixed(2), '€', 'bg-blue-500/20 text-blue-400', () => setInsightType('cost'))}
                        {renderStatCard(TrendingUp, t('charges.avgPrice'), summary.avgPrice.toFixed(3), '€', 'bg-purple-500/20 text-purple-400', () => setInsightType('price'))}
                        {renderStatCard(Calendar, t('charges.chargeCount'), summary.chargeCount, '', 'bg-slate-500/20 text-slate-400', () => setInsightType('count'))}
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

                {/* Charge Insights Modal */}
                <ChargeInsightsModal
                    isOpen={!!insightType}
                    onClose={() => setInsightType(null)}
                    type={insightType || 'kwh'}
                    charges={charges}
                    batterySize={batterySize}
                    chargerTypes={chargerTypes}
                />
            </div>
        );
    }

    // Render horizontal layout (compact and fullscreenBYD)
    // Spacing configuration driven by mode
    const cardGap = isCompact ? 'gap-1.5' : (isFullscreenBYD ? 'gap-2' : 'gap-3');
    const columnGap = isCompact ? 'gap-3' : 'gap-4';
    const verticalSpace = isCompact ? 'space-y-2' : (isFullscreenBYD ? 'space-y-3' : 'space-y-4');
    const headerMargin = isCompact ? 'mb-2' : (isFullscreenBYD ? 'mb-2' : 'mb-3');
    const headerText = isCompact ? 'text-lg' : (isFullscreenBYD ? 'text-xl' : 'text-xl');
    const buttonPadding = isCompact ? 'py-2' : (isFullscreenBYD ? 'py-2.5' : 'py-3');

    // Charge list spacing
    const listY = isCompact ? 'space-y-1.5' : (isFullscreenBYD ? 'space-y-2' : 'space-y-3');

    return (
        <div className={verticalSpace}>
            {/* Title */}
            <h2
                className={`font-bold text-slate-900 dark:text-white ${headerText} ${headerMargin} cursor-pointer select-none active:scale-95 transition-transform`}
                onClick={handleEggClick}
            >
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
                            {renderStatCard(
                                summary.hasFuel ? Fuel : Zap,
                                summary.hasFuel ? t('charges.litersCharged') : t('charges.avgKwh'),
                                summary.hasFuel ? summary.avgLiters.toFixed(2) : summary.avgKwh.toFixed(2),
                                summary.hasFuel ? 'L' : 'kWh',
                                summary.hasFuel ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400',
                                () => setInsightType(summary.hasFuel ? 'fuel' : 'kwh')
                            )}
                            {renderStatCard(Euro, t('charges.avgCost'), summary.avgCost.toFixed(2), '€', 'bg-blue-500/20 text-blue-400', () => setInsightType('cost'))}
                            {renderStatCard(TrendingUp, t('charges.avgPrice'), summary.avgPrice.toFixed(3), '€', 'bg-purple-500/20 text-purple-400', () => setInsightType('price'))}
                            {renderStatCard(Calendar, t('charges.chargeCount'), summary.chargeCount, '', 'bg-slate-500/20 text-slate-400', () => setInsightType('count'))}
                        </>
                    )}
                </div>
            </div>

            {/* Charge Insights Modal */}
            <ChargeInsightsModal
                isOpen={!!insightType}
                onClose={() => setInsightType(null)}
                type={insightType || 'kwh'}
                charges={charges}
                batterySize={batterySize}
                chargerTypes={chargerTypes}
            />

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

ChargesTab.displayName = 'ChargesTab';

export default ChargesTab;



