// BYD Stats - Add Charge Modal Component
// Form for adding/editing charging sessions

import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { BYD_RED, DEFAULT_FUEL_PRICE } from '../../utils/constants';
import { Battery, Fuel } from '../Icons.jsx';
import ModalHeader from '../common/ModalHeader';
import { useApp } from '../../context/AppContext';
import { useData } from '../../providers/DataProvider';

/**
 * Modal for adding or editing a charging session
 */
const AddChargeModal = () => {
    const { t } = useTranslation();
    const { settings } = useApp();
    const {
        modals,
        closeModal,
        addCharge: onSave,
        updateCharge,
        editingCharge,
        setEditingCharge,
        stats
    } = useData();

    // ... (rest of the file until handleSubmit)

    const handleSubmit = () => {
        const isElectric = formData.type === 'electric';

        // Basic validation based on type
        if (isElectric) {
            if (!formData.kwhCharged || !formData.odometer || !formData.finalPercentage) {
                alert(t('charges.fillRequired'));
                return;
            }
        } else {
            if (!formData.litersCharged || !formData.odometer) {
                alert(t('charges.fillRequired'));
                return;
            }
        }

        const chargeData = {
            type: formData.type,
            date: formData.date,
            time: formData.time,
            odometer: parseFloat(formData.odometer) || 0,
            totalCost: parseFloat(formData.totalCost) || 0
        };

        if (isElectric) {
            chargeData.kwhCharged = parseFloat(formData.kwhCharged) || 0;
            chargeData.chargerTypeId = formData.chargerTypeId;
            chargeData.pricePerKwh = parseFloat(formData.pricePerKwh) || 0;
            chargeData.finalPercentage = parseFloat(formData.finalPercentage) || 0;
            chargeData.initialPercentage = formData.initialPercentage ? parseFloat(formData.initialPercentage) : null;
        } else {
            chargeData.litersCharged = parseFloat(formData.litersCharged) || 0;
            chargeData.pricePerLiter = parseFloat(formData.pricePerLiter) || 0;
        }

        // If editing, update instead of add
        if (editingCharge?.id) {
            updateCharge(editingCharge.id, chargeData);
        } else {
            onSave(chargeData);
        }

        onClose();
    };

    if (!isOpen) return null;

    const inputClass = "w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 border border-slate-200 dark:border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50";
    const labelClass = "block text-sm text-slate-600 dark:text-slate-400 mb-1.5";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-charge-modal-title"
                className="relative bg-white dark:bg-slate-800 rounded-2xl p-5 max-w-md w-full max-h-[85vh] overflow-y-auto border border-slate-200 dark:border-slate-700"
                style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
                onClick={(e) => e.stopPropagation()}
            >
                <ModalHeader
                    title={editingCharge ? t('charges.editCharge') : t('charges.addCharge')}
                    Icon={formData.type === 'fuel' ? Fuel : Battery}
                    onClose={onClose}
                    id="add-charge-modal-title"
                    iconColor={formData.type === 'fuel' ? '#f59e0b' : BYD_RED}
                    className="mb-4"
                />

                <div className="space-y-4">
                    {/* Type selector - only for hybrid vehicles */}
                    {isHybrid && (
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => handleChange('type', 'electric')}
                                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-sm transition-all border-2 ${formData.type === 'electric'
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-slate-100 dark:bg-slate-700/50 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                            >
                                <Battery className="w-4 h-4" />
                                {t('charges.typeElectric')}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleChange('type', 'fuel')}
                                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-sm transition-all border-2 ${formData.type === 'fuel'
                                    ? 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300'
                                    : 'bg-slate-100 dark:bg-slate-700/50 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                            >
                                <Fuel className="w-4 h-4" />
                                {t('charges.typeFuel')}
                            </button>
                        </div>
                    )}

                    {/* Date and Time */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>{t('charges.date')}</label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={(e) => handleChange('date', e.target.value)}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>{t('charges.time')}</label>
                            <input
                                type="time"
                                value={formData.time}
                                onChange={(e) => handleChange('time', e.target.value)}
                                className={inputClass}
                            />
                        </div>
                    </div>

                    {/* Odometer */}
                    <div>
                        <label className={labelClass}>{t('charges.odometer')} (km)</label>
                        <input
                            type="number"
                            inputMode="decimal"
                            value={formData.odometer}
                            onChange={(e) => handleChange('odometer', e.target.value)}
                            placeholder="12345"
                            className={inputClass}
                        />
                    </div>

                    {/* Electric-specific fields */}
                    {formData.type === 'electric' && (
                        <>
                            {/* kWh and Charger Type */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>{t('charges.kwhCharged')}</label>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        step="0.01"
                                        value={formData.kwhCharged}
                                        onChange={(e) => handleChange('kwhCharged', e.target.value)}
                                        placeholder="45.5"
                                        className={inputClass}
                                    />
                                    {getRealKwh() && (
                                        <p className="text-xs text-slate-500 mt-1">
                                            {t('charges.real')}: <span className="font-medium text-slate-700 dark:text-slate-300">{getRealKwh()} kWh</span>
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className={labelClass}>{t('charges.chargerType')}</label>
                                    <select
                                        value={formData.chargerTypeId}
                                        onChange={(e) => handleChange('chargerTypeId', e.target.value)}
                                        className={inputClass}
                                    >
                                        {chargerTypes.map(ct => (
                                            <option key={ct.id} value={ct.id}>{ct.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Price and Total Cost (electric) */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>{t('charges.pricePerKwh')} (€)</label>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        step="0.001"
                                        value={formData.pricePerKwh}
                                        onChange={(e) => handleChange('pricePerKwh', e.target.value)}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>{t('charges.totalCost')} (€)</label>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        step="0.01"
                                        value={formData.totalCost}
                                        onChange={(e) => handleChange('totalCost', e.target.value)}
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            {/* Battery Percentages */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>{t('charges.finalPercentage')}</label>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min="0"
                                        max="100"
                                        value={formData.finalPercentage}
                                        onChange={(e) => handleChange('finalPercentage', e.target.value)}
                                        placeholder="80"
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>{t('charges.initialPercentage')}</label>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min="0"
                                        max="100"
                                        value={formData.initialPercentage}
                                        onChange={(e) => handleChange('initialPercentage', e.target.value)}
                                        placeholder={t('charges.optional')}
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Fuel-specific fields */}
                    {formData.type === 'fuel' && (
                        <>
                            {/* Liters */}
                            <div>
                                <label className={labelClass}>{t('charges.litersCharged')}</label>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    step="0.01"
                                    value={formData.litersCharged}
                                    onChange={(e) => handleChange('litersCharged', e.target.value)}
                                    placeholder="35.5"
                                    className={inputClass}
                                />
                            </div>

                            {/* Price per liter and Total Cost */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>{t('charges.pricePerLiter')} (€)</label>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        step="0.001"
                                        value={formData.pricePerLiter}
                                        onChange={(e) => handleChange('pricePerLiter', e.target.value)}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>{t('charges.totalCost')} (€)</label>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        step="0.01"
                                        value={formData.totalCost}
                                        onChange={(e) => handleChange('totalCost', e.target.value)}
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <button
                    onClick={handleSubmit}
                    className="w-full mt-6 py-3 rounded-xl font-medium text-white transition-colors hover:opacity-90 active:opacity-80"
                    style={{ backgroundColor: BYD_RED }}
                >
                    {t('charges.save')}
                </button>
            </div>
        </div>
    );
};

AddChargeModal.propTypes = {};

export default AddChargeModal;
