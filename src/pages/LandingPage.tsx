import React, { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { BYD_RED } from '../components/Icons'; // Assuming BYD_RED is exported from Icons or another constant file
import { Upload, Cloud } from '../components/Icons';

// Note: BYD_RED might be in constants, let's check imports in App.jsx.
// App.jsx imports { ..., BYD_RED } from './components/Icons';
// But usually constants are in utils/constants.js. 
// However, assuming App.jsx import is correct for now.

const LandingPage = ({
    isCompact,
    sqlReady,
    error,
    googleSync,
    isNative,
    onFileProcess, // Wrapper around processDB to handle file object
}) => {
    const { t } = useTranslation();
    const [dragOver, setDragOver] = useState(false);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f) {
            const fileName = f.name.toLowerCase();
            if (!fileName.endsWith('.db') && !fileName.endsWith('.jpg') && !fileName.endsWith('.jpeg')) {
                toast.error(t('errors.invalidFile'));
                return;
            }
            onFileProcess(f, false);
        }
    }, [onFileProcess, t]);

    const handleFileChange = useCallback((e) => {
        const f = e.target.files[0];
        if (f) {
            const fileName = f.name.toLowerCase();
            if (!fileName.endsWith('.db') && !fileName.endsWith('.jpg') && !fileName.endsWith('.jpeg')) {
                toast.error(t('errors.invalidFile'));
                e.target.value = '';
                return;
            }
            onFileProcess(f, false);
        }
        e.target.value = '';
    }, [onFileProcess, t]);

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-start justify-center p-4 pt-8 pb-4 overflow-y-auto">
            <div className="w-full max-w-xl">
                <div className="text-center mb-6">
                    <img src="app_icon_v2.png" className={`h-auto mx-auto mb-3 md:mb-4 ${isCompact ? 'w-24 sm:w-32' : 'w-32 sm:w-40 md:w-48'}`} alt="App Logo" />
                    <h1 className={`${isCompact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl md:text-4xl'} font-bold text-white mb-1`}>{t('landing.title')}</h1>
                    <p className="text-xs sm:text-sm text-slate-400">{t('landing.subtitle')}</p>
                </div>

                {!sqlReady && !error && (
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center gap-3 px-4 py-2 bg-white dark:bg-slate-800/50 rounded-xl">
                            <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: BYD_RED, borderTopColor: 'transparent' }} />
                            <span className="text-slate-400">{t('landing.loading')}</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
                        <p style={{ color: BYD_RED }}>{error}</p>
                    </div>
                )}

                <div
                    className={`border-2 border-dashed rounded-3xl text-center transition-all cursor-pointer ${isCompact ? 'p-6' : 'p-8 sm:p-12'}`}
                    style={{
                        borderColor: dragOver ? BYD_RED : '#475569',
                        backgroundColor: dragOver ? 'rgba(234,0,41,0.1)' : 'transparent'
                    }}
                    onDragOver={(e) => { if (sqlReady && !isNative) { e.preventDefault(); setDragOver(true); } }}
                    onDragLeave={() => !isNative && setDragOver(false)}
                    onDrop={(e) => !isNative && sqlReady && handleDrop(e)}
                    onClick={() => sqlReady && document.getElementById('fileInput')?.click()}
                >
                    <input
                        id="fileInput"
                        type="file"
                        accept="*/*,image/*,.db,.jpg,.jpeg"
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={!sqlReady}
                    />
                    <div
                        className={`${isCompact ? 'w-12 h-12 mb-4' : 'w-16 h-16 mb-6'} rounded-2xl mx-auto flex items-center justify-center`}
                        style={{ backgroundColor: dragOver ? BYD_RED : '#334155' }}
                    >
                        <Upload className={`${isCompact ? 'w-6 h-6' : 'w-8 h-8'}`} style={{ color: dragOver ? 'white' : BYD_RED }} />
                    </div>
                    <p className={`text-white mb-2 ${isCompact ? 'text-base' : 'text-lg sm:text-xl'}`}>
                        {sqlReady ? (isNative ? t('landing.tapToSelect') : t('landing.clickToSelect')) : t('landing.preparing')}
                    </p>
                    <p className="text-slate-400 text-xs mt-4">
                        {t('landing.hint')}
                    </p>
                    <p className="text-slate-500 text-xs mt-2">
                        {t('landing.tip')}
                    </p>
                </div>

                {/* Divider */}
                <div className="flex items-center w-full my-6">
                    <div className="h-px bg-slate-700 flex-1 opacity-50"></div>
                    <span className="px-4 text-slate-500 text-sm font-medium">{t('common.or')}</span>
                    <div className="h-px bg-slate-700 flex-1 opacity-50"></div>
                </div>

                {/* Compact Cloud Sync Section */}
                <div className="flex justify-center">
                    {googleSync.isAuthenticated ? (
                        <button
                            onClick={() => googleSync.syncNow()}
                            disabled={googleSync.isSyncing}
                            className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-all text-white shadow-lg"
                        >
                            <div className="relative">
                                {googleSync.userProfile?.imageUrl ? (
                                    <img src={googleSync.userProfile.imageUrl} className="w-6 h-6 rounded-full" alt="User" />
                                ) : (
                                    <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold">
                                        {googleSync.userProfile?.name?.charAt(0) || 'U'}
                                    </div>
                                )}
                                {googleSync.isSyncing && (
                                    <div className="absolute -right-1 -bottom-1 w-3 h-3 bg-slate-800 rounded-full flex items-center justify-center">
                                        <div className="w-2 h-2 border-[1.5px] border-white/30 border-t-white rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>
                            <div className="text-left">
                                <p className="text-xs text-slate-400 leading-none mb-0.5">{t('landing.cloudConnected')}</p>
                                <p className="text-sm font-medium leading-none">{googleSync.isSyncing ? t('landing.syncing') : t('landing.syncNow')}</p>
                            </div>
                            {!googleSync.isSyncing && <Cloud className="w-4 h-4 text-slate-400 ml-1" />}
                        </button>
                    ) : (
                        <button
                            onClick={() => googleSync.login()}
                            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-800 px-4 py-2 rounded-xl text-sm"
                        >
                            <span className="flex items-center justify-center w-5 h-5 bg-white rounded-full">
                                <img src="https://www.google.com/favicon.ico" alt="G" className="w-3 h-3" />
                            </span>
                            {t('landing.signInToSync')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LandingPage;

