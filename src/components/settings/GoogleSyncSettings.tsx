import React from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../../providers/DataProvider';
import { Cloud, LogOut, RefreshCw, Database } from '../Icons';

interface GoogleSyncSettingsProps {
    googleSync: {
        isAuthenticated: boolean;
        isSyncing: boolean;
        lastSyncTime: Date | null;
        error: string | null;
        userProfile: any;
        login: () => void;
        logout: () => void;
        syncNow: () => void;
    };
}

const GoogleSyncSettings: React.FC<GoogleSyncSettingsProps> = ({ googleSync }) => {
    const { t } = useTranslation();
    const { openModal } = useData();
    const [imgError, setImgError] = React.useState(false);

    // Reset error when profile changes
    React.useEffect(() => {
        setImgError(false);
    }, [googleSync.userProfile?.picture, googleSync.userProfile?.imageUrl]);

    const userImage = googleSync.userProfile?.picture || googleSync.userProfile?.imageUrl;
    const showImage = userImage && !imgError;

    return (
        <div className="pt-4 border-t border-slate-200 dark:border-slate-700 mt-4">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-500" />
                {t('settings.googleDrive')}
            </h4>

            {!googleSync.isAuthenticated ? (
                <button
                    onClick={googleSync.login}
                    className="w-full flex items-center justify-center gap-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-white border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 font-medium rounded-xl px-4 py-3 transition-all shadow-sm active:scale-[0.98]"
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
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                    {/* Header: User Info & Logout */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3 overflow-hidden">
                            {showImage ? (
                                <img
                                    src={userImage}
                                    alt="User"
                                    className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-600"
                                    referrerPolicy="no-referrer"
                                    onError={() => setImgError(true)}
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800">
                                    {googleSync.userProfile?.name?.charAt(0) || 'U'}
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate flex items-center gap-2">
                                    {googleSync.userProfile?.name}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                    {googleSync.userProfile?.email}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                    <span className="text-[10px] font-medium text-green-600 dark:text-green-400">
                                        {t('settings.connected')}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={googleSync.logout}
                            className="p-2 -mr-2 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"
                            title={t('settings.logout')}
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Actions Grid */}
                    <div className="space-y-2.5">
                        {/* Sync Button */}
                        <button
                            onClick={googleSync.syncNow}
                            disabled={googleSync.isSyncing}
                            className={`w-full py-3 px-4 rounded-xl text-sm font-bold text-white transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 ${googleSync.isSyncing
                                ? 'bg-blue-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                                }`}
                        >
                            <RefreshCw className={`w-4 h-4 ${googleSync.isSyncing ? 'animate-spin' : ''}`} />
                            {googleSync.isSyncing ? t('settings.syncing') : t('settings.syncNow')}
                        </button>

                        {/* Manage Backups Button */}
                        <button
                            onClick={() => (openModal as any)('backups')}
                            className="w-full py-3 px-4 rounded-xl text-sm font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-600 transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
                        >
                            <Database className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                            {t('settings.cloudBackups', 'Gestionar Copias en la Nube')}
                        </button>
                    </div>

                    {/* Footer Info */}
                    <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 px-1">
                        <span>
                            {googleSync.lastSyncTime
                                ? `${t('settings.lastSync')}: ${googleSync.lastSyncTime.toLocaleTimeString()}`
                                : t('sync.neverSynced', 'Nunca sincronizado')
                            }
                        </span>
                        {googleSync.error && (
                            <span className="text-red-500 truncate max-w-[150px]" title={googleSync.error}>
                                {googleSync.error}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GoogleSyncSettings;


