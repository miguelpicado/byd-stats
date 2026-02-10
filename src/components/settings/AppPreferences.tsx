import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/context/AppContext';
import { languages } from '@/i18n';
import { Eye, EyeOff } from '../Icons';
import { GaliciaFlag, CataloniaFlag, BasqueFlag, SpainFlag, UKFlag, PortugalFlag } from '../FlagIcons';
import { TAB_ORDER } from '@core/constants';

export const AppPreferences: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { settings, updateSettings } = useApp();

    const handleLanguageChange = useCallback((langCode: string) => {
        i18n.changeLanguage(langCode);
    }, [i18n]);

    return (
        <div className="space-y-4">
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
                    {(['auto', 'light', 'dark'] as const).map(theme => (
                        <button
                            key={theme}
                            onClick={() => updateSettings({ ...settings, theme })}
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
                                            ? currentHidden.filter((id: string) => id !== tabId)
                                            : [...currentHidden, tabId];
                                        updateSettings({ ...settings, hiddenTabs: newHidden });
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
        </div>
    );
};
