// BYD Stats - Add Charge Modal Component
// Form for adding/editing charging sessions

import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { BYD_RED } from '../../utils/constants';
import { Battery } from '../Icons.jsx';
import ModalHeader from '../common/ModalHeader';

/**
 * Modal for adding or editing a charging session
 */
const AddChargeModal = ({
    isOpen,
    onClose,
    onSave,
    chargerTypes = [],
    defaultPricePerKwh = 0.15,
    editingCharge = null
}) => {
    const { t } = useTranslation();

    // Get current date and time in proper format
    const getCurrentDate = () => new Date().toISOString().split('T')[0];
    const getCurrentTime = () => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    };

    const getInitialState = useCallback(() => ({
        date: getCurrentDate(),
        time: getCurrentTime(),
        odometer: '',
        kwhCharged: '',
        chargerTypeId: chargerTypes[0]?.id || '',
        pricePerKwh: defaultPricePerKwh,
        totalCost: '',
        finalPercentage: '',
        initialPercentage: ''
    }), [chargerTypes, defaultPricePerKwh]);

    const [formData, setFormData] = useState(getInitialState);

    // Reset form when modal opens or editingCharge changes
    useEffect(() => {
        if (isOpen) {
            if (editingCharge) {
                setFormData({
                    date: editingCharge.date || getCurrentDate(),
                    time: editingCharge.time || getCurrentTime(),
                    odometer: editingCharge.odometer?.toString() || '',
                    kwhCharged: editingCharge.kwhCharged?.toString() || '',
                    chargerTypeId: editingCharge.chargerTypeId || chargerTypes[0]?.id || '',
                    pricePerKwh: editingCharge.pricePerKwh ?? defaultPricePerKwh,
                    totalCost: editingCharge.totalCost?.toString() || '',
                    finalPercentage: editingCharge.finalPercentage?.toString() || '',
                    initialPercentage: editingCharge.initialPercentage?.toString() || ''
                });
            } else {
                setFormData(getInitialState());
            }
        }
    }, [isOpen, editingCharge, chargerTypes, defaultPricePerKwh, getInitialState]);

    // Auto-calculate total cost when kWh or price changes
    // useEffect removed to avoid cascading renders

    const handleChange = (field, value) => {
        setFormData(prev => {
            const newState = { ...prev, [field]: value };

            // Auto-calculate total cost or price per kwh
            if (field === 'kwhCharged' || field === 'pricePerKwh') {
                const kwh = parseFloat(field === 'kwhCharged' ? value : prev.kwhCharged);
                const price = parseFloat(field === 'pricePerKwh' ? value : prev.pricePerKwh);
                if (!isNaN(kwh) && !isNaN(price) && kwh > 0 && price > 0) {
                    newState.totalCost = (kwh * price).toFixed(2);
                }
            }
            // Reverse calculation: if totalCost changes, update pricePerKwh (keeping kwh constant)
            else if (field === 'totalCost') {
                const cost = parseFloat(value);
                const kwh = parseFloat(prev.kwhCharged);
                if (!isNaN(cost) && !isNaN(kwh) && kwh > 0) {
                    newState.pricePerKwh = (cost / kwh).toFixed(4); // higher precision for price
                }
            }

            return newState;
        });
    };

    // Calculate Real kWh based on efficiency
    const getRealKwh = () => {
        const kwh = parseFloat(formData.kwhCharged);
        if (isNaN(kwh) || !formData.chargerTypeId) return null;

        const type = chargerTypes.find(t => t.id === formData.chargerTypeId);
        if (!type || !type.efficiency) return null;

        return (kwh * type.efficiency).toFixed(2);
    };

    const handleSubmit = () => {
        // Basic validation
        if (!formData.kwhCharged || !formData.odometer || !formData.finalPercentage) {
            alert(t('charges.fillRequired'));
            return;
        }

        const chargeData = {
            date: formData.date,
            time: formData.time,
            odometer: parseFloat(formData.odometer) || 0,
            kwhCharged: parseFloat(formData.kwhCharged) || 0,
            chargerTypeId: formData.chargerTypeId,
            pricePerKwh: parseFloat(formData.pricePerKwh) || 0,
            totalCost: parseFloat(formData.totalCost) || 0,
            finalPercentage: parseFloat(formData.finalPercentage) || 0,
            initialPercentage: formData.initialPercentage ? parseFloat(formData.initialPercentage) : null
        };

        // If editing, preserve the ID
        if (editingCharge?.id) {
            chargeData.id = editingCharge.id;
        }

        onSave(chargeData);
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
                    Icon={Battery}
                    onClose={onClose}
                    id="add-charge-modal-title"
                    iconColor={BYD_RED}
                    className="mb-4"
                />

                <div className="space-y-4">
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

                    {/* Price and Total Cost */}
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

AddChargeModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    chargerTypes: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        speedKw: PropTypes.number,
        efficiency: PropTypes.number
    })),
    defaultPricePerKwh: PropTypes.number,
    editingCharge: PropTypes.object
};

export default AddChargeModal;
