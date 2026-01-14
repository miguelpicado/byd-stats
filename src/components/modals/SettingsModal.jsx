// BYD Stats - Settings Modal Component

import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { languages } from '../../i18n';
import { BYD_RED } from '../../utils/constants';
import { Settings } from '../Icons.jsx';
import ModalHeader from '../common/ModalHeader';
import { GaliciaFlag, CataloniaFlag, BasqueFlag } from '../FlagIcons.jsx';
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

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">{t('settings.language')}</label>
                        <div className="grid grid-cols-3 gap-2">
                            {languages.map(lang => (
                                <button
                                    key={lang.code}
                                    onClick={() => handleLanguageChange(lang.code)}
                                    className={`py-2 px-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${i18n.language === lang.code || i18n.language?.startsWith(lang.code)
                                        ? 'text-white'
                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                                        }`}
                                    style={{
                                        backgroundColor: (i18n.language === lang.code || i18n.language?.startsWith(lang.code)) ? BYD_RED : ''
                                    }}
                                >
                                    {lang.code === 'gl' ? <GaliciaFlag className="w-5 h-auto rounded-sm overflow-hidden" /> :
                                        lang.code === 'ca' ? <CataloniaFlag className="w-5 h-auto rounded-sm overflow-hidden" /> :
                                            lang.code === 'eu' ? <BasqueFlag className="w-5 h-auto rounded-sm overflow-hidden" /> :
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
                                    className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${settings.theme === theme
                                        ? 'text-white'
                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                                        }`}
                                    style={{
                                        backgroundColor: settings.theme === theme ? BYD_RED : ''
                                    }}
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
        theme: PropTypes.string
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

