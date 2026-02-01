
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ModalPortal from '../common/ModalPortal';
import { X, Zap, Calendar, TrendingUp, Info, ChevronLeft, ChevronRight } from '../Icons';
import { ChargingLogic } from '../../core/chargingLogic';
import { ProcessedData, Settings, Charge, Trip } from '../../types';

interface ChargingInsightsModalProps {
    isOpen: boolean;
    onClose: () => void;
    stats: ProcessedData | null;
    settings: Settings;
    charges?: Charge[];
    summary?: any;
    trips?: Trip[];
}

type InsightView = 'main' | 'daily' | 'optimal' | 'type';

const ChargingInsightsModal: React.FC<ChargingInsightsModalProps> = ({
    isOpen,
    onClose,
    stats,
    settings,
    charges = [],
    summary,
    trips = []
}) => {
    const { t } = useTranslation();
    const [view, setView] = useState<InsightView>('main');

    // Reset view when opening/closing
    React.useEffect(() => {
        if (isOpen) setView('main');
    }, [isOpen]);

    // --- Insights Calculations ---
    const { recommendation, optimalDay, smartCharging, comfortZone, costAnalysis, seasonalFactor, dailyGoal } = useMemo(() => {
        if (!charges || charges.length === 0) return {};

        const validSummary = summary || stats?.summary;
        const totalKwh = validSummary ? parseFloat(validSummary.drivingKwh || '0') : 0;
        const days = validSummary?.daysActive || 30;
        const avgDailyKwh = days > 0 ? totalKwh / days : 5;

        // Calculate Cost Savings first
        const costAnalysis = ChargingLogic.calculateCostSavings(charges, settings, avgDailyKwh);

        // Smart Charging Windows
        const smartCharging = ChargingLogic.findSmartChargingWindows(trips, settings);

        // Fallback to simple day
        const dayStats = stats?.weekday || [];
        const simpleOptimalDay = ChargingLogic.calculateOptimalChargeDay(dayStats, settings);

        // Recommendation
        const lastSlowCharge = charges.find(c => c.finalPercentage === 100 && (c.speedKw || 0) < 11);
        const recommendation = ChargingLogic.getChargingRecommendation(
            undefined,
            lastSlowCharge?.date,
            costAnalysis,
            smartCharging?.weeklyKwh,
            settings
        );

        const comfortZone = ChargingLogic.calculateComfortZone(charges);

        const monthlyStats = (stats?.monthly || []).map(m => ({
            ...m,
            efficiency: m.efficiency || 0
        }));
        const seasonalFactor = ChargingLogic.calculateSeasonalFactor(monthlyStats);

        return {
            recommendation,
            optimalDay: simpleOptimalDay,
            smartCharging,
            comfortZone,
            costAnalysis,
            seasonalFactor,
            dailyGoal: avgDailyKwh * (seasonalFactor.factor || 1)
        };
    }, [charges, stats, settings, summary, trips]);

    if (!isOpen) return null;

    // --- Sub-Views ---

    const renderDailyDetail = () => (
        <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('insights.dailyGoal')}</h3>
                <p className="text-3xl font-black text-slate-900 dark:text-white mb-4">
                    {dailyGoal?.toFixed(1) || '--'} <span className="text-lg font-medium text-slate-400">kWh</span>
                </p>
                <div className="prose prose-sm dark:prose-invert">
                    <p className="text-slate-600 dark:text-slate-400">
                        {t('insights.dailyDesc', { kwh: dailyGoal?.toFixed(1) || '--' }).replace('{{kwh}}', dailyGoal?.toFixed(1) || '--')}
                    </p>
                    {seasonalFactor?.season === 'winter' && (
                        <p className="text-amber-600 dark:text-amber-400 text-xs font-semibold mt-2">
                            ❄️ {t('season.winterAdjustment', 'Ajustado por alto consumo en invierno')}
                            <span className="block font-normal text-slate-500 mt-1">
                                Factor: x{seasonalFactor.factor?.toFixed(2)}
                            </span>
                        </p>
                    )}
                </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
                <h4 className="font-bold text-blue-700 dark:text-blue-300 mb-1">{t('insights.howItWorks', 'Cómo funciona')}</h4>
                <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
                    {t('insights.dailyExplanation', 'La IA analiza tu consumo medio diario y aplica correcciones estacionales para sugerir una carga que mantenga el SoC estable sin ciclos profundos innecesarios.')}
                </p>
            </div>
        </div>
    );

    const renderOptimalDetail = () => (
        <div className="space-y-4 animate-fadeIn">
            <div className="bg-blue-50/50 dark:bg-blue-900/20 p-5 rounded-2xl flex flex-col items-center justify-center text-center border border-blue-100 dark:border-blue-800/30">
                <Calendar className="w-12 h-12 text-blue-500 mb-3" />

                {/* Hours Utilization Metric */}
                {smartCharging && smartCharging.requiredHours > 0 && (
                    <div className="w-full mb-4 px-2">
                        <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                            <span>{t('insights.hoursFound', 'Horas Encontradas')}: {smartCharging.hoursFound.toFixed(1)}h</span>
                            <span>{t('insights.hoursNeeded', 'Objetivo')}: {smartCharging.requiredHours.toFixed(1)}h</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${smartCharging.hoursFound >= smartCharging.requiredHours ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                style={{ width: `${Math.min(100, (smartCharging.hoursFound / smartCharging.requiredHours) * 100)}%` }}
                            />
                        </div>
                    </div>
                )}

                <div className="text-lg font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide w-full">
                    {smartCharging && smartCharging.windows.length > 0 ? (
                        <div className="flex flex-col gap-2 w-full">
                            {smartCharging.windows.map((w, i) => (
                                <div key={i} className="bg-white/50 dark:bg-slate-800/50 px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-800/30 flex items-center justify-between shadow-sm text-sm">
                                    <span className="font-black text-blue-800 dark:text-blue-200">{t(`daysShort.${w.day.toLowerCase().substring(0, 3)}`, w.day)}</span>
                                    <span className="font-medium text-slate-700 dark:text-slate-300">{w.start} - {w.end}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        optimalDay ? t(`days.${optimalDay.toLowerCase()}`) : '--'
                    )}
                </div>

                <p className="text-xs text-blue-500 dark:text-blue-400 font-medium mt-3">
                    {smartCharging && smartCharging.windows.length > 1 ? t('insights.bestWindows', 'Ventanas Óptimas') : t('insights.bestDay')}
                </p>
            </div>

            <div className="space-y-3">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">{t('insights.analysis', 'Análisis')}</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {smartCharging
                        ? t('insights.optimalWindowDesc', 'Hemos seleccionado estas franjas para cubrir las {{hours}}h de carga semanales necesarias, priorizando períodos largos en tarifa valle.', { hours: smartCharging.requiredHours.toFixed(0) }).replace('{{hours}}', smartCharging.requiredHours.toFixed(0))
                        : t('insights.optimalDayDesc', 'Tus patrones de conducción indican que este es el día con menor uso del vehículo o mayor disponibilidad para carga lenta, ideal para equilibrar celdas.')}
                </p>
            </div>
        </div>
    );

    const renderTypeDetail = () => {
        const isSlow = recommendation?.type === 'slow';
        const isMixed = recommendation?.type === 'mixed';

        let bgColor = 'bg-amber-50 dark:bg-amber-900/20';
        let borderColor = 'border-amber-100 dark:border-amber-800/30';
        let iconColor = 'text-amber-500';
        let textColor = 'text-amber-700 dark:text-amber-300';
        let label = t('insights.fast');

        if (isSlow) {
            bgColor = 'bg-emerald-50 dark:bg-emerald-900/20';
            borderColor = 'border-emerald-100 dark:border-emerald-800/30';
            iconColor = 'text-emerald-500';
            textColor = 'text-emerald-700 dark:text-emerald-300';
            label = t('insights.slow');
        } else if (isMixed) {
            bgColor = 'bg-purple-50 dark:bg-purple-900/20';
            borderColor = 'border-purple-100 dark:border-purple-800/30';
            iconColor = 'text-purple-500';
            textColor = 'text-purple-700 dark:text-purple-300';
            label = t('insights.mixed', 'Mixta (Lenta + Rápida)');
        }

        return (
            <div className="space-y-4 animate-fadeIn">
                <div className={`p-5 rounded-2xl flex flex-col items-center justify-center text-center border ${bgColor} ${borderColor}`}>
                    <TrendingUp className={`w-12 h-12 mb-3 ${iconColor}`} />
                    <h3 className={`text-lg font-bold uppercase tracking-wide ${textColor}`}>
                        {label}
                    </h3>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm mb-2">{t('insights.recommendation', 'Recomendación')}</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        {recommendation && t(`insights.${recommendation.reason}`, recommendation.translationParams)}
                    </p>
                </div>
            </div>
        );
    };

    const renderOptimalButtonContent = () => {
        if (smartCharging && smartCharging.windows.length > 0) {
            const first = smartCharging.windows[0];
            const count = smartCharging.windows.length;
            return (
                <>
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-bold uppercase mb-0.5">{t('insights.bestDay')}</p>
                    <div className="flex items-center gap-2">
                        <p className="text-lg font-bold text-blue-700 dark:text-blue-300 truncate">
                            {t(`daysShort.${first.day.toLowerCase().substring(0, 3)}`, first.day)} {first.start}
                        </p>
                        {count > 1 && (
                            <span className="text-xs font-bold bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 px-1.5 py-0.5 rounded-full">
                                +{count - 1}
                            </span>
                        )}
                    </div>
                </>
            );
        }
        return (
            <>
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-bold uppercase mb-0.5">{t('insights.bestDay')}</p>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300 truncate">
                    {optimalDay ? t(`days.${optimalDay.toLowerCase()}`) : '--'}
                </p>
            </>
        );
    };

    const renderMain = () => {
        const isSlow = recommendation?.type === 'slow';
        const isMixed = recommendation?.type === 'mixed';

        let typeBg = 'bg-amber-50 dark:bg-amber-900/20';
        let typeBorder = 'border-amber-100 dark:border-amber-800/30';
        let typeIcon = 'text-amber-500';
        let typeText = 'text-amber-700 dark:text-amber-300';
        let typeLabel = t('insights.fast');

        if (isSlow) {
            typeBg = 'bg-emerald-50 dark:bg-emerald-900/20';
            typeBorder = 'border-emerald-100 dark:border-emerald-800/30';
            typeIcon = 'text-emerald-500';
            typeText = 'text-emerald-700 dark:text-emerald-300';
            typeLabel = t('insights.slow');
        } else if (isMixed) {
            typeBg = 'bg-purple-50 dark:bg-purple-900/20';
            typeBorder = 'border-purple-100 dark:border-purple-800/30';
            typeIcon = 'text-purple-500';
            typeText = 'text-purple-700 dark:text-purple-300';
            typeLabel = t('insights.mixed', 'Mixta');
        }

        return (
            <div className="space-y-3 animate-fadeIn">
                {/* 1. Daily Goal Card */}
                <button
                    onClick={() => setView('daily')}
                    className="w-full text-left bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 relative overflow-hidden group hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-[0.98]"
                >
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Zap className="w-24 h-24 text-slate-900 dark:text-white" />
                    </div>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                            {t('insights.dailyGoal')}
                        </h3>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-slate-800 dark:text-white">
                                {dailyGoal?.toFixed(1) || '--'} <span className="text-lg font-medium text-slate-400">kWh</span>
                            </span>
                        </div>
                    </div>
                </button>

                {/* 2. Grid for Optimal & Type */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setView('optimal')}
                        className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800/30 text-left hover:brightness-95 dark:hover:bg-blue-900/30 transition-all active:scale-[0.98]"
                    >
                        {renderOptimalButtonContent()}
                    </button>

                    <button
                        onClick={() => setView('type')}
                        className={`${typeBg} ${typeBorder} rounded-xl p-3 border text-left hover:brightness-95 transition-all active:scale-[0.98]`}
                    >
                        <div className="flex flex-col h-full justify-between pointer-events-none">
                            <TrendingUp className={`w-5 h-5 ${typeIcon} mb-2`} />
                            <div>
                                <p className={`text-xs ${typeIcon} font-bold uppercase mb-0.5 opacity-80`}>{t('insights.type')}</p>
                                <p className={`text-sm font-bold ${typeText} truncate`}>
                                    {t('insights.habitual', { type: typeLabel })}
                                </p>
                            </div>
                        </div>
                    </button>
                </div>

                {/* 3. Cost (Non-clickable for now or separate) - Kept as information */}
                {settings.offPeakEnabled && costAnalysis && costAnalysis.potentialMonthlySavings > 1 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 border border-amber-100 dark:border-amber-800/30">
                        <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-1 flex items-center gap-2">
                            💰 {t('insights.costSavings')}
                        </h4>
                        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed mb-2">
                            {t('insights.costDesc', {
                                window: `${settings.offPeakStart}-${settings.offPeakEnd}`,
                                amount: costAnalysis.potentialMonthlySavings.toFixed(0)
                            }).replace('{{window}}', `${settings.offPeakStart}-${settings.offPeakEnd}`).replace('{{amount}}', costAnalysis.potentialMonthlySavings.toFixed(0))}
                        </p>
                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded inline-block uppercase tracking-wider ${costAnalysis.feasibleInOffPeak ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                            {costAnalysis.feasibleInOffPeak ? 'OK' : '⚠️ Limit'}
                        </div>
                    </div>
                )}

                {/* 4. Comfort Zone */}
                {comfortZone && comfortZone.minSoC > 0 && (
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-1">
                            <Info className="w-3.5 h-3.5" /> {t('insights.comfortZone')}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {t('insights.comfortDesc', {
                                soc: comfortZone.minSoC.toFixed(0),
                                days: comfortZone.canExtendInterval ? '3' : '2'
                            }).replace('{{soc}}', comfortZone.minSoC.toFixed(0)).replace('{{days}}', comfortZone.canExtendInterval ? '3' : '2')}
                        </p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <ModalPortal>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-modal-backdrop" onClick={onClose}>
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

                <div
                    role="dialog"
                    aria-modal="true"
                    className="relative bg-white dark:bg-slate-800 rounded-3xl max-w-sm w-full shadow-2xl animate-modal-content overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[85vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            {view !== 'main' ? (
                                <button onClick={() => setView('main')} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                    <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                                </button>
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                    <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                            )}

                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                    {t('insights.chargingTitle')}
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {t('insights.aiPowered')}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
                        {view === 'main' && renderMain()}
                        {view === 'daily' && renderDailyDetail()}
                        {view === 'optimal' && renderOptimalDetail()}
                        {view === 'type' && renderTypeDetail()}
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-700 text-center">
                        <button
                            onClick={onClose}
                            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                        >
                            {t('common.close')}
                        </button>
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
};

export default ChargingInsightsModal;
