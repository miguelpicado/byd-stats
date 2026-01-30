// BYD Stats - Charge Insights Modal Component
// Displays advanced statistics for charges when clicking on stat cards

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Zap, Euro, TrendingUp, Calendar, Fuel } from '../Icons';
// import { LucideIcon } from 'lucide-react'; // Not installed
import StatItem from '../ui/StatItem';
import ModalPortal from '../common/ModalPortal';
import { Charge } from '../../types';

type LucideIcon = React.FC<any>;

interface ChargeInsightsModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'kwh' | 'cost' | 'price' | 'count' | 'fuel';
    charges: Charge[];
    batterySize?: number;
    chargerTypes?: any[];
}

/**
 * Calculate advanced charge statistics
 */
const useChargeInsights = (charges: Charge[], batterySize: number, chargerTypes: any[] = []) => {
    return useMemo(() => {
        if (!charges || charges.length === 0) return null;

        const len = charges.length;

        // Basic calculations
        const kwhValues = charges.map(c => c.kwhCharged || 0);
        const costValues = charges.map(c => c.totalCost || 0);
        const priceValues = charges.map(c => c.pricePerKwh || 0);
        const paidPriceValues = priceValues.filter(p => p > 0);

        const totalKwh = kwhValues.reduce((a, b) => a + b, 0);
        const totalCost = costValues.reduce((a, b) => a + b, 0);

        // Calculate Real kWh (entering battery) using charger efficiency
        const realKwhValues = charges.map(c => {
            const kwh = c.kwhCharged || 0;
            if (c.type === 'fuel') return 0; // Skip fuel for cycles/kwh stats if any mixed data

            const chargerType = chargerTypes.find(ct => ct.id === c.chargerTypeId);
            const efficiency = chargerType?.efficiency || 1;
            return kwh * efficiency;
        });
        const totalRealKwh = realKwhValues.reduce((a, b) => a + b, 0);

        // Date range for monthly calculations
        const timestamps = charges.map(c => c.timestamp).filter(Boolean) as number[];
        const minDate = new Date(Math.min(...timestamps));
        const maxDate = new Date(Math.max(...timestamps));
        const monthsDiff = Math.max(1,
            (maxDate.getFullYear() - minDate.getFullYear()) * 12 +
            (maxDate.getMonth() - minDate.getMonth()) + 1
        );

        // Percentage calculations
        const chargesWithPercentages = charges.filter(c =>
            c.finalPercentage !== undefined && c.finalPercentage !== null
        );
        const chargesWithBothPercentages = charges.filter(c =>
            c.initialPercentage !== undefined &&
            c.initialPercentage !== null &&
            c.finalPercentage !== undefined
        );

        // Full charges = reached exactly 100%
        const fullCharges = chargesWithPercentages.filter(c => c.finalPercentage === 100);
        // Complete charges = also reached 100% (same definition for clarity)
        const completeCharges = fullCharges;

        const avgPercentageRecovered = chargesWithBothPercentages.length > 0
            ? chargesWithBothPercentages.reduce((sum, c) =>
                sum + ((c.finalPercentage || 0) - (c.initialPercentage || 0)), 0) / chargesWithBothPercentages.length
            : 0;

        // Battery cycles calculation - USE REAL ENERGY (battery side)
        const cycles = batterySize > 0 ? totalRealKwh / batterySize : 0;

        // Free charges
        const freeCharges = charges.filter(c => !c.totalCost || c.totalCost === 0);

        // Calculate cost of last complete month
        const now = new Date();
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthYear = lastMonthDate.getFullYear();
        const lastMonth = lastMonthDate.getMonth(); // 0-11

        const lastMonthCharges = charges.filter(c => {
            if (!c.timestamp) return false;
            const chargeDate = new Date(c.timestamp);
            return chargeDate.getFullYear() === lastMonthYear && chargeDate.getMonth() === lastMonth;
        });
        const lastMonthCost = lastMonthCharges.reduce((sum, c) => sum + (c.totalCost || 0), 0);

        return {
            // kWh insights
            kwh: {
                avg: totalKwh / len,
                min: Math.min(...kwhValues),
                max: Math.max(...kwhValues),
                total: totalKwh,
                fullChargeCount: fullCharges.length,
                fullChargePercent: (fullCharges.length / len * 100).toFixed(1),
                avgPercentageRecovered: avgPercentageRecovered.toFixed(1)
            },
            // Cost insights
            cost: {
                avg: totalCost / len,
                max: Math.max(...costValues),
                total: totalCost,
                monthlyAvg: totalCost / monthsDiff,
                lastMonthCost: lastMonthCost,
                freeCount: freeCharges.length,
                freePercent: (freeCharges.length / len * 100).toFixed(1)
            },
            // Price insights
            price: {
                avg: paidPriceValues.length > 0
                    ? paidPriceValues.reduce((a, b) => a + b, 0) / paidPriceValues.length
                    : 0,
                min: paidPriceValues.length > 0 ? Math.min(...paidPriceValues) : 0,
                max: paidPriceValues.length > 0 ? Math.max(...paidPriceValues) : 0,
                freePercent: (freeCharges.length / len * 100).toFixed(1),
                potentialSavings: paidPriceValues.length > 0
                    ? (Math.max(...paidPriceValues) - (paidPriceValues.reduce((a, b) => a + b, 0) / paidPriceValues.length)) * totalKwh
                    : 0
            },
            // Count insights
            count: {
                total: len,
                monthlyAvg: (len / monthsDiff).toFixed(1),
                completeCharges: completeCharges.length,
                cycles: cycles.toFixed(2),
                firstCharge: minDate.toLocaleDateString(),
                lastCharge: maxDate.toLocaleDateString(),
                daysActive: Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
            }
        };
    }, [charges, batterySize, chargerTypes]);
};

/**
 * Charge Insights Modal
 * Shows detailed statistics when clicking on a stat card
 */
const ChargeInsightsModal: React.FC<ChargeInsightsModalProps> = ({
    isOpen,
    onClose,
    type, // 'kwh' | 'cost' | 'price' | 'count'
    charges,
    batterySize = 60.48,
    chargerTypes = []
}) => {
    const { t } = useTranslation();
    const insights = useChargeInsights(charges, batterySize, chargerTypes);

    if (!isOpen || !insights) return null;

    interface InsightConfig {
        icon: LucideIcon;
        title: string;
        color: string;
        bgColor: string;
    }

    // Modal config by type
    const config: Record<string, InsightConfig> = {
        kwh: {
            icon: Zap,
            title: t('chargeInsights.kwhTitle', 'Insights de Energía'),
            color: 'text-emerald-500',
            bgColor: 'bg-emerald-500/20'
        },
        cost: {
            icon: Euro,
            title: t('chargeInsights.costTitle', 'Insights de Costes'),
            color: 'text-amber-500',
            bgColor: 'bg-amber-500/20'
        },
        price: {
            icon: TrendingUp,
            title: t('chargeInsights.priceTitle', 'Insights de Precios'),
            color: 'text-purple-500',
            bgColor: 'bg-purple-500/20'
        },
        count: {
            icon: Calendar,
            title: t('chargeInsights.countTitle', 'Insights de Uso'),
            color: 'text-blue-500',
            bgColor: 'bg-blue-500/20'
        },
        fuel: {
            icon: Fuel,
            title: t('chargeInsights.fuelTitle', 'Insights de Combustible'),
            color: 'text-amber-500',
            bgColor: 'bg-amber-500/20'
        }
    };

    const currentConfig = config[type] || config.kwh;
    const Icon = currentConfig.icon;

    const renderContent = () => {
        switch (type) {
            case 'kwh':
                return (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <StatItem
                                label={t('chargeInsights.avgKwh', 'Media por carga')}
                                value={insights.kwh.avg.toFixed(2)}
                                unit="kWh"
                                highlight
                            />
                            <StatItem
                                label={t('chargeInsights.totalKwh', 'Total cargado')}
                                value={insights.kwh.total.toFixed(0)}
                                unit="kWh"
                            />
                            <StatItem
                                label={t('chargeInsights.minKwh', 'Carga mínima')}
                                value={insights.kwh.min.toFixed(2)}
                                unit="kWh"
                            />
                            <StatItem
                                label={t('chargeInsights.maxKwh', 'Carga máxima')}
                                value={insights.kwh.max.toFixed(2)}
                                unit="kWh"
                            />
                        </div>
                        <div className="mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                    {t('chargeInsights.fullCharges', 'Cargas al 100%')}
                                </span>
                                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                    {insights.kwh.fullChargeCount} ({insights.kwh.fullChargePercent}%)
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                    {t('chargeInsights.avgRecovered', '% medio recuperado')}
                                </span>
                                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                    +{insights.kwh.avgPercentageRecovered}%
                                </span>
                            </div>
                        </div>
                    </>
                );

            case 'cost':
                return (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <StatItem
                                label={t('chargeInsights.avgCost', 'Coste medio')}
                                value={insights.cost.avg.toFixed(2)}
                                unit="€"
                                highlight
                            />
                            <StatItem
                                label={t('chargeInsights.totalCost', 'Gasto total')}
                                value={insights.cost.total.toFixed(2)}
                                unit="€"
                            />
                            <StatItem
                                label={t('chargeInsights.lastMonthCost', 'Último mes')}
                                value={insights.cost.lastMonthCost.toFixed(2)}
                                unit="€"
                            />
                            <StatItem
                                label={t('chargeInsights.maxCost', 'Coste máximo')}
                                value={insights.cost.max.toFixed(2)}
                                unit="€"
                            />
                        </div>
                        <div className="mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                    {t('chargeInsights.monthlyCost', 'Gasto mensual aprox.')}
                                </span>
                                <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                                    {insights.cost.monthlyAvg.toFixed(2)} €/mes
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                    {t('chargeInsights.freeCharges', 'Cargas gratuitas')}
                                </span>
                                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                    {insights.cost.freeCount} ({insights.cost.freePercent}%)
                                </span>
                            </div>
                        </div>
                    </>
                );

            case 'price':
                return (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <StatItem
                                label={t('chargeInsights.avgPrice', 'Precio medio')}
                                value={insights.price.avg.toFixed(3)}
                                unit="€/kWh"
                                highlight
                            />
                            <StatItem
                                label={t('chargeInsights.freePercent', '% cargas gratis')}
                                value={insights.price.freePercent}
                                unit="%"
                            />
                            <StatItem
                                label={t('chargeInsights.minPrice', 'Precio mínimo')}
                                value={insights.price.min.toFixed(3)}
                                unit="€/kWh"
                            />
                            <StatItem
                                label={t('chargeInsights.maxPrice', 'Precio máximo')}
                                value={insights.price.max.toFixed(3)}
                                unit="€/kWh"
                            />
                        </div>
                        {insights.price.potentialSavings > 0 && (
                            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 border border-emerald-200 dark:border-emerald-900/30">
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {t('chargeInsights.savings', 'Ahorro vs. precio máximo')}
                                </p>
                                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                                    {insights.price.potentialSavings.toFixed(2)} €
                                </p>
                            </div>
                        )}
                    </>
                );

            case 'count':
                return (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <StatItem
                                label={t('chargeInsights.totalCount', 'Total cargas')}
                                value={insights.count.total}
                                highlight
                            />
                            <StatItem
                                label={t('chargeInsights.monthlyAvg', 'Media mensual')}
                                value={insights.count.monthlyAvg}
                                unit="cargas"
                            />
                            <StatItem
                                label={t('chargeInsights.completeCharges', 'Cargas completas')}
                                value={insights.count.completeCharges}
                            />
                            <StatItem
                                label={t('chargeInsights.cycles', 'Ciclos consumidos')}
                                value={insights.count.cycles}
                            />
                        </div>
                        <div className="mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                    {t('chargeInsights.firstCharge', 'Primera carga')}
                                </span>
                                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                    {insights.count.firstCharge}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                    {t('chargeInsights.lastCharge', 'Última carga')}
                                </span>
                                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                    {insights.count.lastCharge}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                    {t('chargeInsights.daysActive', 'Días activos')}
                                </span>
                                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                    {insights.count.daysActive} días
                                </span>
                            </div>
                        </div>
                        <p className="mt-3 text-xs text-slate-400 text-center">
                            {t('chargeInsights.cyclesExplanation', 'Un ciclo = uso del 100% de la capacidad de la batería')}
                        </p>
                    </>
                );

            case 'fuel':
                return (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <StatItem
                                label={t('chargeInsights.avgLiters', 'Media por repostaje')}
                                value={insights?.kwh.avg.toFixed(2) || '0.00'} // Reusing avg logic but should ideally be specific
                                unit="L"
                                highlight
                            />
                            {/* Add more fuel specific stats if needed */}
                        </div>
                    </>
                );

            default:
                return null;
        }
    };

    // Render using Portal
    return (
        <ModalPortal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-backdrop" onClick={onClose}>
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

                <div
                    role="dialog"
                    aria-modal="true"
                    className="relative bg-white dark:bg-slate-800 rounded-2xl p-0 max-w-sm w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700 shadow-2xl animate-modal-content"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${currentConfig.bgColor}`}>
                                <Icon className={`w-5 h-5 ${currentConfig.color}`} />
                            </div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                {currentConfig.title}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
};

export default ChargeInsightsModal;
