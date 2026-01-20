import React, { memo } from 'react';
import { HelpCircle, Minimize, Maximize, Database, Settings, Filter } from '../Icons';

const AppHeader = memo(({
    t,
    layoutMode,
    rawTripsCount,
    setShowHelpModal,
    toggleFullscreen,
    isFullscreen,
    setShowHistoryModal,
    setShowSettingsModal,
    setShowFilterModal
}) => {
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
                            onClick={() => setShowHelpModal(true)}
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors"
                            title={t('tooltips.help')}
                        >
                            <HelpCircle className="w-5 h-5" />
                        </button>
                        <button
                            onClick={toggleFullscreen}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors ${layoutMode === 'vertical' ? 'hidden' : ''}`}
                            title={isFullscreen ? t('tooltips.exitFullscreen') : t('tooltips.fullscreen')}
                        >
                            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={() => setShowHistoryModal(true)}
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors"
                            title={t('tooltips.history')}
                        >
                            <Database className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setShowSettingsModal(true)}
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors"
                            title={t('tooltips.settings')}
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setShowFilterModal(true)}
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

AppHeader.displayName = 'AppHeader';

export default AppHeader;
