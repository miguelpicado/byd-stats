// BYD Stats - SettingsModal Component

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { languages } from '../../i18n';
import { BYD_RED, TAB_ORDER } from '../../utils/constants';
import { Settings, Zap, Trash2, Eye, EyeOff } from '../Icons.jsx';
import ModalHeader from '../common/ModalHeader';
import { GaliciaFlag, CataloniaFlag, BasqueFlag, SpainFlag, UKFlag, PortugalFlag } from '../FlagIcons.jsx';
import GoogleSyncSettings from '../settings/GoogleSyncSettings';
import { useApp } from '../../context/AppContext';
import { useData } from '../../providers/DataProvider';
import { useCar } from '../../context/CarContext';

/**
 * Settings modal for app configuration
 */
const SettingsModal = () => {
    const { t, i18n } = useTranslation();
    const { settings, updateSettings: onSettingsChange } = useApp();
    const { activeCar, updateCar, activeCarId } = useCar();
    const { googleSync, charges = [], modals, closeModal, stats } = useData();

    // Derived State
    const isOpen = modals.settings;
    const onClose = () => closeModal('settings');

    // Calculate average electricity price from charges (must be before early return)
    // Calculate average electricity and fuel prices
    const { avgElectricPrice, avgFuelPrice, electricStats, fuelStats } = useMemo(() => {
        if (!charges || charges.length === 0) return { avgElectricPrice: 0, avgFuelPrice: 0, electricStats: {}, fuelStats: {} };

        const electricCharges = charges.filter(c => !c.type || c.type === 'electric');
        const fuelCharges = charges.filter(c => c.type === 'fuel');

        // Electric stats
        const eCost = electricCharges.reduce((sum, c) => sum + (c.totalCost || 0), 0);
        const eKwh = electricCharges.reduce((sum, c) => sum + (c.kwhCharged || 0), 0);
        const avgElectricPrice = eKwh > 0 ? eCost / eKwh : 0;

        // Fuel stats
        const fCost = fuelCharges.reduce((sum, c) => sum + (c.totalCost || 0), 0);
        const fLiters = fuelCharges.reduce((sum, c) => sum + (c.litersCharged || 0), 0);
        const avgFuelPrice = fLiters > 0 ? fCost / fLiters : 0;

        return {
            avgElectricPrice,
            avgFuelPrice,
            electricStats: { count: electricCharges.length, total: eCost, kwh: eKwh },
            fuelStats: { count: fuelCharges.length, total: fCost, liters: fLiters }
        };
    }, [charges]);

    if (!isOpen) return null;

    const handleLanguageChange = (langCode) => {
        i18n.changeLanguage(langCode);
    };

    // Charger types management
    const handleChargerTypeChange = (index, field, value) => {
        const updatedTypes = [...(settings.chargerTypes || [])];
        updatedTypes[index] = { ...updatedTypes[index], [field]: value };
        onSettingsChange({ ...settings, chargerTypes: updatedTypes });
    };

    const handleAddChargerType = () => {
        const newType = {
            id: `custom_${Date.now()}`,
            name: t('settings.newChargerType'),
            speedKw: 7.4,
            efficiency: 0.90
        };
        const updatedTypes = [...(settings.chargerTypes || []), newType];
        onSettingsChange({ ...settings, chargerTypes: updatedTypes });
    };

    const handleDeleteChargerType = (index) => {
        const updatedTypes = (settings.chargerTypes || []).filter((_, i) => i !== index);
        onSettingsChange({ ...settings, chargerTypes: updatedTypes });
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-modal-title"
                className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 max-h-[70vh] overflow-y-auto"
                style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
                onClick={(e) => e.stopPropagation()}
            >
                <ModalHeader
                    title={t('settings.title')}
                    Icon={Settings}
                    onClose={onClose}
                    id="settings-modal-title"
                    className="mb-4"
                    iconColor={BYD_RED}
                />

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">{t('settings.carModel')}</label>
                        <input
                            type="text"
                            value={activeCar?.name || settings?.carModel || ''}
                            onChange={(e) => {
                                const newName = e.target.value;
                                onSettingsChange({ ...settings, carModel: newName });
                                updateCar(activeCarId, { name: newName });
                            }}
                            placeholder="BYD Seal"
                            className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">{t('settings.licensePlate')}</label>
                        <input
                            type="text"
                            value={settings?.licensePlate || ''}
                            onChange={(e) => onSettingsChange({ ...settings, licensePlate: e.target.value.toUpperCase() })}
                            placeholder="1234ABC"
                            className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600 uppercase"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">{t('settings.insurancePolicy')}</label>
                        <input
                            type="text"
                            value={settings?.insurancePolicy || ''}
                            onChange={(e) => onSettingsChange({ ...settings, insurancePolicy: e.target.value })}
                            placeholder="123456789"
                            className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">{t('settings.batterySize')}</label>
                        <input
                            type="number"
                            step="0.01"
                            value={settings?.batterySize || 0}
                            onChange={(e) => onSettingsChange({ ...settings, batterySize: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">{t('settings.soh')}</label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            value={settings?.soh || 100}
                            onChange={(e) => onSettingsChange({ ...settings, soh: parseInt(e.target.value) || 100 })}
                            className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">{t('settings.electricityPrice')} (€/kWh)</label>

                        {/* Pricing Strategy Selector */}
                        <div className="flex gap-2 mb-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
                            {['custom', 'average', 'dynamic'].map(strategy => {
                                const isActive = (settings.priceStrategy === strategy) ||
                                    (!settings.priceStrategy && (
                                        (strategy === 'average' && settings.useCalculatedPrice) ||
                                        (strategy === 'custom' && !settings.useCalculatedPrice)
                                    ));

                                return (
                                    <button
                                        key={strategy}
                                        onClick={() => onSettingsChange({
                                            ...settings,
                                            priceStrategy: strategy,
                                            // Maintain legacy compatibility temporarily
                                            useCalculatedPrice: strategy === 'average'
                                        })}
                                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${isActive
                                            ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                            }`}
                                        title={strategy === 'average' && (!charges || charges.length === 0) ? t('settings.priceCalculatedNoData') : ''}
                                    >
                                        {strategy === 'custom' ? t('settings.priceCustom') :
                                            strategy === 'average' ? t('settings.priceCalculated') :
                                                t('settings.priceDynamics')}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Dynamic Price Hint */}
                        {(settings.priceStrategy === 'dynamic') && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 italic">
                                {t('settings.priceDynamicsHint')}
                            </p>
                        )}

                        {/* Price input - Only show if not dynamic */}
                        {settings.priceStrategy !== 'dynamic' && (
                            <input
                                type="number"
                                step="0.001"
                                value={
                                    (settings.priceStrategy === 'average' || (!settings.priceStrategy && settings.useCalculatedPrice))
                                        ? avgElectricPrice.toFixed(3)
                                        : (settings?.electricityPrice || 0)
                                }
                                onChange={(e) => onSettingsChange({ ...settings, electricityPrice: parseFloat(e.target.value) || 0 })}
                                disabled={settings.priceStrategy === 'average' || settings.useCalculatedPrice}
                                className={`w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600 ${(settings.priceStrategy === 'average' || settings.useCalculatedPrice) ? 'opacity-60 cursor-not-allowed' : ''
                                    }`}
                                placeholder={
                                    (settings.priceStrategy === 'average' || (!settings.priceStrategy && settings.useCalculatedPrice))
                                        ? t('settings.priceCalculatedAuto')
                                        : '0.15'
                                }
                            />
                        )}

                        {/* Info text */}
                        {(settings.priceStrategy === 'average' || (!settings.priceStrategy && settings.useCalculatedPrice)) && (
                            electricStats.count > 0 ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {t('settings.priceCalculatedInfo', {
                                        count: electricStats.count,
                                        total: electricStats.total.toFixed(2),
                                        kwh: electricStats.kwh.toFixed(2)
                                    })}
                                </p>
                            ) : (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                    {t('settings.priceCalculatedNoCharges')}
                                </p>
                            )
                        )}
                    </div>

                    {/* Fuel Price - Only for hybrid vehicles */}
                    {activeCar?.isHybrid && (
                        <div className="space-y-2">
                            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
                                <span className="text-lg">⛽</span>
                                {t('settings.fuelPrice')} (€/L)
                            </label>

                            {/* Fuel Pricing Strategy Selector */}
                            <div className="flex gap-2 mb-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
                                {['custom', 'average', 'dynamic'].map(strategy => {
                                    const isActive = (settings.fuelPriceStrategy === strategy) ||
                                        (!settings.fuelPriceStrategy && (
                                            (strategy === 'average' && settings.useCalculatedFuelPrice) ||
                                            (strategy === 'custom' && !settings.useCalculatedFuelPrice)
                                        ));

                                    return (
                                        <button
                                            key={strategy}
                                            onClick={() => onSettingsChange({
                                                ...settings,
                                                fuelPriceStrategy: strategy,
                                                useCalculatedFuelPrice: strategy === 'average'
                                            })}
                                            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${isActive
                                                ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                                }`}
                                            title={strategy === 'average' && fuelStats.count === 0 ? t('settings.priceCalculatedNoData') : ''}
                                        >
                                            {strategy === 'custom' ? t('settings.priceCustom') :
                                                strategy === 'average' ? t('settings.priceCalculated') :
                                                    t('settings.priceDynamics')}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Dynamic Price Hint */}
                            {(settings.fuelPriceStrategy === 'dynamic') && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 italic">
                                    {t('settings.priceDynamicsHint')}
                                </p>
                            )}

                            {/* Fuel Price Input - Only show if not dynamic */}
                            {settings.fuelPriceStrategy !== 'dynamic' && (
                                <input
                                    type="number"
                                    step="0.01"
                                    value={
                                        (settings.fuelPriceStrategy === 'average' || (!settings.fuelPriceStrategy && settings.useCalculatedFuelPrice))
                                            ? avgFuelPrice.toFixed(3)
                                            : (settings?.fuelPrice || 1.50)
                                    }
                                    onChange={(e) => onSettingsChange({ ...settings, fuelPrice: parseFloat(e.target.value) || 1.50 })}
                                    disabled={settings.fuelPriceStrategy === 'average' || settings.useCalculatedFuelPrice}
                                    className={`w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600 ${(settings.fuelPriceStrategy === 'average' || settings.useCalculatedFuelPrice) ? 'opacity-60 cursor-not-allowed' : ''
                                        }`}
                                    placeholder={
                                        (settings.fuelPriceStrategy === 'average' || (!settings.fuelPriceStrategy && settings.useCalculatedFuelPrice))
                                            ? t('settings.priceCalculatedAuto')
                                            : '1.50'
                                    }
                                />
                            )}

                            {/* Info text for fuel */}
                            {(settings.fuelPriceStrategy === 'average' || (!settings.fuelPriceStrategy && settings.useCalculatedFuelPrice)) && (
                                fuelStats.count > 0 ? (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        {t('settings.priceCalculatedInfoFuel', {
                                            count: fuelStats.count,
                                            total: fuelStats.total.toFixed(2),
                                            liters: fuelStats.liters.toFixed(2)
                                        })}
                                    </p>
                                ) : (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                        {t('settings.priceCalculatedNoCharges')}
                                    </p>
                                )
                            )}

                            {(!settings.fuelPriceStrategy || settings.fuelPriceStrategy === 'custom') && !settings.useCalculatedFuelPrice && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {t('settings.fuelPriceHint')}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Charger Types Section */}
                    <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Zap className="w-4 h-4" style={{ color: BYD_RED }} />
                            {t('settings.chargerTypes')}
                        </h3>

                        {(settings?.chargerTypes || []).map((charger, index) => (
                            <div key={charger.id} className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={charger?.name || ''}
                                        onChange={(e) => handleChargerTypeChange(index, 'name', e.target.value)}
                                        className="flex-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm border border-slate-200 dark:border-slate-600"
                                        placeholder={t('settings.chargerName')}
                                    />
                                    <button
                                        onClick={() => handleDeleteChargerType(index)}
                                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title={t('settings.deleteChargerType')}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-slate-500 dark:text-slate-400">{t('settings.chargerSpeed')}</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={charger?.speedKw || 0}
                                            onChange={(e) => handleChargerTypeChange(index, 'speedKw', parseFloat(e.target.value) || 0)}
                                            className="w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm border border-slate-200 dark:border-slate-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 dark:text-slate-400">{t('settings.chargerEfficiency')}</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="1"
                                            value={charger?.efficiency || 0}
                                            onChange={(e) => handleChargerTypeChange(index, 'efficiency', parseFloat(e.target.value) || 0)}
                                            className="w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm border border-slate-200 dark:border-slate-600"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={handleAddChargerType}
                            className="w-full py-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-sm"
                        >
                            + {t('settings.addChargerType')}
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">{t('settings.language')}</label>
                        <div className="flex flex-wrap gap-2">
                            {languages.map(lang => (
                                <button
                                    key={lang.code}
                                    onClick={() => handleLanguageChange(lang.code)}
                                    className={`py-2 px-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 border ${i18n.language === lang.code || i18n.language?.startsWith(lang.code)
                                        ? 'byd-active-item'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'
                                        }`}
                                >
                                    <span className="inline-flex items-center justify-center" style={{ width: '20px', height: '15px' }}>
                                        {lang.code === 'gl' ? <GaliciaFlag className="w-full h-full rounded-sm" /> :
                                            lang.code === 'ca' ? <CataloniaFlag className="w-full h-full rounded-sm" /> :
                                                lang.code === 'eu' ? <BasqueFlag className="w-full h-full rounded-sm" /> :
                                                    lang.code === 'es' ? <SpainFlag className="w-full h-full rounded-sm" /> :
                                                        lang.code === 'en' ? <UKFlag className="w-full h-full rounded-sm" /> :
                                                            lang.code === 'pt' ? <PortugalFlag className="w-full h-full rounded-sm" /> :
                                                                <span className="text-lg leading-none">{lang.flag}</span>}
                                    </span>
                                    {lang.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">{t('settings.theme')}</label>
                        <div className="flex gap-2">
                            {['auto', 'light', 'dark'].map(theme => (
                                <button
                                    key={theme}
                                    onClick={() => onSettingsChange({ ...settings, theme })}
                                    className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors border ${settings?.theme === theme
                                        ? 'byd-active-item'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'
                                        }`}
                                >
                                    {theme === 'auto' ? t('settings.themeAuto') : theme === 'light' ? t('settings.themeLight') : t('settings.themeDark')}
                                </button>
                            ))}
                        </div>

                        <div>
                            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">{t('settings.customizeTabs')}</label>
                            <div className="grid grid-cols-2 gap-2">
                                {TAB_ORDER.filter(tab => tab !== 'overview').map(tabId => {
                                    const isHidden = (settings.hiddenTabs || []).includes(tabId);
                                    return (
                                        <button
                                            key={tabId}
                                            onClick={() => {
                                                const currentHidden = settings.hiddenTabs || [];
                                                const newHidden = isHidden
                                                    ? currentHidden.filter(id => id !== tabId)
                                                    : [...currentHidden, tabId];
                                                onSettingsChange({ ...settings, hiddenTabs: newHidden });
                                            }}
                                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors border ${!isHidden
                                                ? 'byd-active-item'
                                                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600'
                                                }`}
                                        >
                                            <span>{t(`tabs.${tabId}`)}</span>
                                            {!isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div>
                        {/* Google Sync Section - Extracted */}
                        <GoogleSyncSettings googleSync={googleSync} />
                    </div>

                </div>

                <button
                    onClick={onClose}
                    className="w-full mt-6 py-3 rounded-xl font-medium text-white"
                    style={{ backgroundColor: BYD_RED }}
                >
                    {t('common.save')}
                </button>
            </div>
        </div>
    );
};

SettingsModal.propTypes = {};

export default SettingsModal;
