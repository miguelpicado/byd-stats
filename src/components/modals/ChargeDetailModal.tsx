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
        setSelectedCharge
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
