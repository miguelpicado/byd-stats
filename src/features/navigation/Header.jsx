import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Minimize, Maximize, Database, Settings, Filter } from '../../components/Icons';
import { useLayout } from '../../context/LayoutContext';
import { useData } from '../../providers/DataProvider';
import useModalState from '../../hooks/useModalState';

const Header = memo(() => {
    const { t } = useTranslation();
    const { layoutMode, isFullscreenBYD, toggleFullscreen } = useLayout();
    const { trips, openModal } = useData();
    // Removed local useModalState

    const rawTripsCount = trips ? trips.length : 0;
    const isFullscreen = !!document.fullscreenElement; // Or use useLayout logic if we move that state there

    // Note: App.jsx was passing toggleFullscreen from its own state. 
    // We should probably move toggleFullscreen logic to LayoutContext or utilize the one passed.
    // However, for now, let's implement the local fullscreen toggle if it's not in LayoutContext.
    // Checking LayoutContext... it doesn't seem to export toggleFullscreen based on previous file view.
    // I will check LayoutContext content again or just implement the toggle here since it's UI logic.
    // Actually, App.jsx has the toggleFullscreen logic. 
    // Ideally, this should be in LayoutContext. I'll add it to internal logic here for modularity.

    const handleToggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((e) => {
                console.error(`Error attempting to enable fullscreen mode: ${e.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    return (
        <div className="flex-shrink-0 sticky top-0 z-40 bg-slate-100 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700/50" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className={`${layoutMode === 'horizontal' ? 'px-3 sm:px-4' : 'max-w-7xl mx-auto px-3 sm:px-4'} py-3 sm:py-4`}>
                <div className="flex items-center justify-between">
                    {/* Logo y título */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        <img
                            src="app_logo.png"
                            className={`${layoutMode === 'horizontal' ? 'h-10 w-auto' : 'w-12 sm:w-16 md:w-20'} object-contain`}
                            alt="BYD Logo"
                        />
                        <div>
                            <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-white">{t('header.title')}</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">{t('header.trips', { count: rawTripsCount })}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => openModal('help')}
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors"
                            title={t('tooltips.help')}
                        >
                            <HelpCircle className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleToggleFullscreen}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors ${layoutMode === 'vertical' ? 'hidden' : ''}`}
                            title={document.fullscreenElement ? t('tooltips.exitFullscreen') : t('tooltips.fullscreen')}
                        >
                            {document.fullscreenElement ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={() => openModal('history')}
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors"
                            title={t('tooltips.history')}
                        >
                            <Database className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => openModal('settings')}
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors"
                            title={t('tooltips.settings')}
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => openModal('filter')}
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors"
                            title={t('tooltips.filters')}
                        >
                            <Filter className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});

Header.displayName = 'Header';
export default Header;
