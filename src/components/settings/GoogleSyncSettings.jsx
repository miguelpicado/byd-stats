import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { BYD_RED } from '../../utils/constants';

const GoogleSyncSettings = ({ googleSync }) => {
    const { t } = useTranslation();

    return (
        <div className="pt-4 border-t border-slate-200 dark:border-slate-700 mt-4">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{t('settings.googleDrive')}</h4>

            {!googleSync.isAuthenticated ? (
                <button
                    onClick={googleSync.login}
                    className="w-full flex items-center justify-center gap-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-white border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 font-medium rounded-xl px-4 py-2.5 transition-colors"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {t('settings.signInWithGoogle')}
                </button>
            ) : (
                <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-3">
                        {googleSync.userProfile?.imageUrl ? (
                            <img src={googleSync.userProfile.imageUrl} alt="User" className="w-10 h-10 rounded-full" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center text-slate-600 font-bold">
                                {googleSync.userProfile?.name?.charAt(0) || 'U'}
                            </div>
                        )}
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate flex items-center gap-2">
                                {googleSync.userProfile?.name}
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                    {t('settings.connected')}
                                </span>
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {googleSync.userProfile?.email}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={googleSync.syncNow}
                            disabled={googleSync.isSyncing}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium text-white transition-colors flex items-center justify-center gap-1.5 ${googleSync.isSyncing ? 'opacity-75 cursor-not-allowed' : ''}`}
                            style={{ backgroundColor: BYD_RED }}
                        >
                            {googleSync.isSyncing ? (
                                <>
                                    <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    {t('settings.syncing')}
                                </>
                            ) : (
                                <>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                                    {t('settings.syncNow')}
                                </>
                            )}
                        </button>
                        <button
                            onClick={googleSync.logout}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
                        >
                            {t('settings.logout')}
                        </button>
                    </div>
                    {googleSync.lastSyncTime && (
                        <p className="text-[10px] text-center text-slate-400 mt-2">
                            {t('settings.lastSync')}: {googleSync.lastSyncTime.toLocaleTimeString()}
                        </p>
                    )}
                    {googleSync.error && (
                        <p className="text-[10px] text-center text-red-500 mt-1">
                            {googleSync.error}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

GoogleSyncSettings.propTypes = {
    googleSync: PropTypes.shape({
        isAuthenticated: PropTypes.bool,
        isSyncing: PropTypes.bool,
        lastSyncTime: PropTypes.instanceOf(Date),
        error: PropTypes.string,
        userProfile: PropTypes.object,
        login: PropTypes.func,
        logout: PropTypes.func,
        syncNow: PropTypes.func
    }).isRequired
};

export default GoogleSyncSettings;
