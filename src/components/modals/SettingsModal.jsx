// BYD Stats - Settings Modal Component

import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { languages } from '../../i18n';
import { BYD_RED } from '../../utils/constants';
import { Settings, Zap, Trash2 } from '../Icons.jsx';
import ModalHeader from '../common/ModalHeader';
import { GaliciaFlag, CataloniaFlag, BasqueFlag, SpainFlag, UKFlag, PortugalFlag } from '../FlagIcons.jsx';
import GoogleSyncSettings from '../settings/GoogleSyncSettings';


/**
 * Settings modal for app configuration
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Modal visibility
 * @param {Function} props.onClose - Close handler
 * @param {Object} props.settings - Current settings object
 * @param {Function} props.onSettingsChange - Settings change handler
 */
const SettingsModal = ({ isOpen, onClose, settings, onSettingsChange, googleSync }) => {
    const { t, i18n } = useTranslation();

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
                            value={settings.carModel}
                            onChange={(e) => onSettingsChange({ ...settings, carModel: e.target.value })}
                            placeholder="BYD Seal"
                            className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">{t('settings.licensePlate')}</label>
                        <input
                            type="text"
                            value={settings.licensePlate}
                            onChange={(e) => onSettingsChange({ ...settings, licensePlate: e.target.value.toUpperCase() })}
                            placeholder="1234ABC"
                            className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600 uppercase"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">{t('settings.insurancePolicy')}</label>
                        <input
                            type="text"
                            value={settings.insurancePolicy}
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
                            value={settings.batterySize}
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
                            value={settings.soh}
                            onChange={(e) => onSettingsChange({ ...settings, soh: parseInt(e.target.value) || 100 })}
                            className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">{t('settings.electricityPrice')} (€/kWh)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={settings.electricityPrice}
                            onChange={(e) => onSettingsChange({ ...settings, electricityPrice: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600"
                        />
                    </div>

                    {/* Charger Types Section */}
                    <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Zap className="w-4 h-4" style={{ color: BYD_RED }} />
                            {t('settings.chargerTypes')}
                        </h3>

                        {(settings.chargerTypes || []).map((charger, index) => (
                            <div key={charger.id} className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={charger.name}
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
                                            value={charger.speedKw}
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
                                            value={charger.efficiency}
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
                        <div className="grid grid-cols-3 gap-2">
                            {languages.map(lang => (
                                <button
                                    key={lang.code}
                                    onClick={() => handleLanguageChange(lang.code)}
                                    className={`py-2 px-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 border ${i18n.language === lang.code || i18n.language?.startsWith(lang.code)
                                        ? 'byd-active-item'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'
                                        }`}
                                >
                                    {lang.code === 'gl' ? <GaliciaFlag className="w-5 h-auto rounded-sm overflow-hidden" /> :
                                        lang.code === 'ca' ? <CataloniaFlag className="w-5 h-auto rounded-sm overflow-hidden" /> :
                                            lang.code === 'eu' ? <BasqueFlag className="w-5 h-auto rounded-sm overflow-hidden" /> :
                                                lang.code === 'es' ? <SpainFlag className="w-5 h-auto rounded-sm overflow-hidden" /> :
                                                    lang.code === 'en' ? <UKFlag className="w-5 h-auto rounded-sm overflow-hidden" /> :
                                                        lang.code === 'pt' ? <PortugalFlag className="w-5 h-auto rounded-sm overflow-hidden" /> :
                                                            <span className="text-lg leading-none">{lang.flag}</span>}
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
                                    className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors border ${settings.theme === theme
                                        ? 'byd-active-item'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'
                                        }`}
                                >
                                    {theme === 'auto' ? t('settings.themeAuto') : theme === 'light' ? t('settings.themeLight') : t('settings.themeDark')}
                                </button>
                            ))}
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

SettingsModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    settings: PropTypes.shape({
        carModel: PropTypes.string,
        licensePlate: PropTypes.string,
        insurancePolicy: PropTypes.string,
        batterySize: PropTypes.number,
        soh: PropTypes.number,
        electricityPrice: PropTypes.number,
        theme: PropTypes.string,
        chargerTypes: PropTypes.arrayOf(PropTypes.shape({
            id: PropTypes.string,
            name: PropTypes.string,
            speedKw: PropTypes.number,
            efficiency: PropTypes.number
        }))
    }).isRequired,
    onSettingsChange: PropTypes.func.isRequired,
    googleSync: PropTypes.shape({
        isAuthenticated: PropTypes.bool,
        isSyncing: PropTypes.bool,
        lastSyncTime: PropTypes.instanceOf(Date),
        error: PropTypes.string,
        userProfile: PropTypes.object,
        login: PropTypes.func,
        logout: PropTypes.func,
        syncNow: PropTypes.func
    })
};

export default SettingsModal;

