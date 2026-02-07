import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Battery, Zap, Trash2, Edit, X, BYD_RED } from '../Icons';
import { useApp } from '../../context/AppContext';
import { useData } from '../../providers/DataProvider';

const ChargeDetailModal: React.FC = () => {
    const { t } = useTranslation();
    const { settings } = useApp();
    const {
        selectedCharge: charge,
        deleteCharge,
        setEditingCharge,
        closeModal,
        openModal,
        modals,
        setSelectedCharge,
        charges
    } = useData();

    // Access styling or data via context
    const chargerTypes = settings?.chargerTypes || [];
    const isOpen = modals.chargeDetail;

    const chargerType = useMemo(() => {
        if (!charge || !chargerTypes) return null;
        return chargerTypes.find(ct => ct.id === charge.chargerTypeId);
    }, [charge, chargerTypes]);

    // Calculate real kWh added to battery
    const realKwh = useMemo(() => {
        if (!charge || !charge.kwhCharged) return 0;
        const efficiency = chargerType?.efficiency || 1;
        return charge.kwhCharged * efficiency;
    }, [charge, chargerType]);

    // Calculate efficiency between charges (kWh/100km)
    const efficiencyBetweenCharges = useMemo(() => {
        if (!charge || !charges || charges.length < 2 || !charge.odometer) return null;

        // Sort charges by odometer to find the previous one
        const sortedCharges = [...charges]
            .filter(c => c.odometer && c.odometer > 0)
            .sort((a, b) => (b.odometer || 0) - (a.odometer || 0));

        // Find current charge index
        const currentIndex = sortedCharges.findIndex(c => c.id === charge.id);
        if (currentIndex === -1 || currentIndex >= sortedCharges.length - 1) return null;

        // Get previous charge (next in sorted array since it's descending)
        const previousCharge = sortedCharges[currentIndex + 1];
        if (!previousCharge || !previousCharge.odometer) return null;

        // Calculate distance traveled between charges
        const distanceKm = charge.odometer - previousCharge.odometer;
        if (distanceKm <= 0) return null;

        // Calculate efficiency: realKwh / distance * 100 = kWh/100km
        const efficiency = (realKwh / distanceKm) * 100;

        return {
            distanceKm,
            efficiencyKwhPer100km: efficiency,
            previousOdometer: previousCharge.odometer
        };
    }, [charge, charges, realKwh]);

    // Internal Handlers
    const onClose = () => {
        closeModal('chargeDetail');
        setSelectedCharge(null);
    };

    const handleDelete = () => {
        if (!charge) return;
        if (window.confirm(t('charges.confirmDelete'))) {
            deleteCharge(charge.id);
            onClose();
        }
    };

    const handleEdit = () => {
        if (!charge) return;
        setEditingCharge(charge);
        closeModal('chargeDetail');
        // setTimeout because we are closing one modal and opening another? 
        // Logic in Coordinator was direct.
        openModal('addCharge');
    };

    if (!isOpen || !charge) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-backdrop" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

            <div
                role="dialog"
                aria-modal="true"
                className="relative bg-white dark:bg-slate-800 rounded-2xl p-0 max-w-md w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700 shadow-2xl animate-modal-content"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with actions */}
                <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-700">
                            <Battery className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                {t('charges.chargeDetail')}
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {charge.date} • {charge.time}
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

                <div className="p-5 space-y-6">
                    {/* Main Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 space-y-1">
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('charges.kwhCharged')}</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {charge.kwhCharged?.toFixed(2)} <span className="text-sm font-normal text-slate-500">kWh</span>
                            </p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 space-y-1">
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('charges.totalCost')}</p>
                            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                {charge.totalCost?.toFixed(2)} <span className="text-sm font-normal text-slate-500">€</span>
                            </p>
                        </div>
                    </div>

                    {/* Efficiency & Real Energy */}
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-4 h-4 text-amber-500" />
                            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                                {t('charges.energyAnalysis')}
                            </h3>
                        </div>

                        <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700/50">
                            <span className="text-sm text-slate-600 dark:text-slate-400">{t('charges.chargerType')}</span>
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                                {chargerType?.name || charge.chargerTypeId}
                            </span>
                        </div>

                        <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700/50">
                            <span className="text-sm text-slate-600 dark:text-slate-400">{t('charges.efficiency')}</span>
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                                {chargerType ? `${(chargerType.efficiency * 100).toFixed(0)}%` : '-'}
                            </span>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                            <span className="text-sm font-medium text-slate-900 dark:text-white">{t('charges.realKwh')}</span>
                            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                {realKwh.toFixed(2)} <span className="text-xs font-normal text-slate-500">kWh</span>
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400 text-center pt-1">
                            {t('charges.realKwhExplanation')}
                        </p>
                    </div>

                    {/* Efficiency between charges */}
                    {efficiencyBetweenCharges && (
                        <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/20 space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                                    {t('charges.efficiencyBetweenCharges', 'Eficiencia entre cargas')}
                                </h3>
                            </div>

                            <div className="flex justify-between items-center py-2 border-b border-blue-200/50 dark:border-blue-800/50">
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                    {t('charges.distanceSincePrevious', 'Distancia recorrida')}
                                </span>
                                <span className="text-sm font-medium text-slate-900 dark:text-white">
                                    {efficiencyBetweenCharges.distanceKm.toLocaleString()} km
                                </span>
                            </div>

                            <div className="flex justify-between items-center py-2 border-b border-blue-200/50 dark:border-blue-800/50">
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                    {t('charges.previousOdometer', 'Odómetro anterior')}
                                </span>
                                <span className="text-sm font-medium text-slate-900 dark:text-white">
                                    {efficiencyBetweenCharges.previousOdometer.toLocaleString()} km
                                </span>
                            </div>

                            <div className="flex justify-between items-center pt-2">
                                <span className="text-sm font-medium text-slate-900 dark:text-white">
                                    {t('charges.calculatedEfficiency', 'Eficiencia calculada')}
                                </span>
                                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                    {efficiencyBetweenCharges.efficiencyKwhPer100km.toFixed(2)} <span className="text-xs font-normal text-slate-500">kWh/100km</span>
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 text-center pt-1">
                                {t('charges.efficiencyExplanation', 'kWh reales consumidos por cada 100km entre esta carga y la anterior')}
                            </p>
                        </div>
                    )}

                    {/* Other Details */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            {t('charges.details')}
                        </h3>

                        <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                            <div>
                                <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
                                    {t('charges.odometer')}
                                </p>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">
                                    {charge.odometer?.toLocaleString()} km
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
                                    {t('charges.pricePerKwh')}
                                </p>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">
                                    {charge.pricePerKwh?.toFixed(3)} €/kWh
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
                                    {t('charges.initialPercentage')}
                                </p>
                                <p className={`text-sm font-medium ${charge.isSOCEstimated ? 'text-orange-500 font-bold' : 'text-slate-900 dark:text-white'}`}>
                                    {charge.initialPercentage ? `${charge.initialPercentage}%` : '-'}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
                                    {t('charges.finalPercentage')}
                                </p>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">
                                    {charge.finalPercentage}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-5 border-t border-slate-100 dark:border-slate-700 flex gap-3">
                    <button
                        onClick={handleDelete}
                        className="flex-1 py-2.5 rounded-xl border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                        <Trash2 className="w-4 h-4" />
                        {t('charges.delete')}
                    </button>
                    <button
                        onClick={handleEdit}
                        className="flex-1 py-2.5 rounded-xl text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm font-medium"
                        style={{ backgroundColor: BYD_RED }}
                    >
                        <Edit className="w-4 h-4" />
                        {t('charges.edit')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChargeDetailModal;
