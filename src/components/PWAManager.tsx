import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Download } from './Icons';
import { logger } from '@core/logger';

// Simple icons for PWA Manager (not in Icons.jsx)
const LogOut = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
);

const RefreshCw = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
);

import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * PWA Manager Component
 * Handles PWA installation prompt, exit button, and update notifications
 * @param {string} layoutMode - 'horizontal' or 'vertical' from parent
 * @param {boolean} isCompact - Whether compact mode is active
 */
export default function PWAManager({ layoutMode = 'vertical', isCompact = false }) {
    const { t } = useTranslation();
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallBanner, setShowInstallBanner] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [showUpdateBanner, setShowUpdateBanner] = useState(false);

    // Check if running as PWA
    useEffect(() => {
        const checkStandalone = () => {
            const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                window.matchMedia('(display-mode: fullscreen)').matches ||
                window.navigator.standalone;
            setIsStandalone(standalone);
        };

        checkStandalone();

        // Listen for display mode changes
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        mediaQuery.addEventListener('change', checkStandalone);

        return () => mediaQuery.removeEventListener('change', checkStandalone);
    }, []);

    // Virtual PWA Register Hook
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredPO(r) {
        },
        onRegisterError(error) {
            logger.error('[PWA] SW Registration Error:', error);
        },
    });

    // Check availability of updates
    useEffect(() => {
        if (needRefresh) {
            setShowUpdateBanner(true);
        }
    }, [needRefresh]);

    // Cleanup manual interval as the hook handles it or we can keep a simple one
    useEffect(() => {
        if (offlineReady) {
            // Ready for offline
        }
    }, [offlineReady]);

    // Exit button only shows in horizontal + standalone mode, but NOT in compact mode
    const showExitButton = isStandalone && layoutMode === 'horizontal' && !isCompact;

    // Listen for install prompt
    useEffect(() => {
        const handleInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallBanner(true);
        };

        // Check if event was already captured in global scope
        if (window.deferredPrompt) {
            setDeferredPrompt(window.deferredPrompt);
            setShowInstallBanner(true);
            window.deferredPrompt = null; // Clean up
        }

        window.addEventListener('beforeinstallprompt', handleInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    }, []);

    // Install PWA
    const handleInstall = useCallback(async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setShowInstallBanner(false);
        }
        setDeferredPrompt(null);
    }, [deferredPrompt]);

    // Apply update
    const handleUpdate = useCallback(() => {
        updateServiceWorker(true);
        setShowUpdateBanner(false);
    }, [updateServiceWorker]);

    // Exit app
    const handleExit = useCallback(() => {
        setShowExitConfirm(true);
    }, []);

    const confirmExit = useCallback(() => {
        window.close();
        // Fallback if window.close() doesn't work
        setTimeout(() => {
            window.location.href = 'about:blank';
        }, 100);
    }, []);

    return (
        <>
            {/* Update Banner - Shows when new version is available */}
            {showUpdateBanner && (
                <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-green-600 to-emerald-600 text-white p-3 shadow-lg animate-slide-down">
                    <div className="flex items-center justify-between max-w-screen-xl mx-auto">
                        <div className="flex items-center gap-3">
                            <RefreshCw className="w-5 h-5 animate-spin-slow" />
                            <div>
                                <p className="font-semibold text-sm">{t('pwa.newVersion')}</p>
                                <p className="text-xs opacity-90">{t('pwa.updateHint')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleUpdate}
                                className="px-4 py-1.5 bg-white text-green-600 rounded-full text-sm font-bold hover:bg-gray-100 transition-colors"
                            >
                                {t('pwa.update')}
                            </button>
                            <button
                                onClick={() => setShowUpdateBanner(false)}
                                className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Install Banner - Only show when not installed and no update banner */}
            {showInstallBanner && !isStandalone && !showUpdateBanner && (
                <div className={`fixed ${layoutMode === 'horizontal' ? 'bottom-0 animate-slide-up' : 'top-0 animate-slide-down'} left-0 right-0 z-[9999] bg-gradient-to-r from-red-600 to-red-700 text-white p-3 shadow-lg`}>
                    <div className="flex items-center justify-between max-w-screen-xl mx-auto">
                        <div className="flex items-center gap-3">
                            <Download className="w-5 h-5" />
                            <div>
                                <p className="font-semibold text-sm">Instalar BYD Stats</p>
                                <p className="text-xs opacity-90">Acceso rápido y pantalla completa</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleInstall}
                                className="px-4 py-1.5 bg-white text-red-600 rounded-full text-sm font-bold hover:bg-gray-100 transition-colors"
                            >
                                Instalar
                            </button>
                            <button
                                onClick={() => setShowInstallBanner(false)}
                                className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Exit Button - Only show when running as PWA in horizontal mode */}
            {showExitButton && (
                <button
                    onClick={handleExit}
                    className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full shadow-lg hover:from-red-700 hover:to-red-800 transition-all"
                    title={t('pwa.closeApp')}
                >
                    <LogOut className="w-5 h-5" />
                    <span className="font-semibold text-sm">{t('pwa.exit')}</span>
                </button>
            )}

            {/* Exit Confirmation Modal */}
            {showExitConfirm && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-slate-800 rounded-xl p-6 m-4 max-w-sm w-full shadow-2xl border border-slate-700">
                        <h3 className="text-lg font-bold text-white mb-2">{t('pwa.exitConfirmTitle')}</h3>
                        <p className="text-slate-400 text-sm mb-4">
                            {t('pwa.exitConfirmText')}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowExitConfirm(false)}
                                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={confirmExit}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                            >
                                {t('pwa.exit')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slide-down {
                    from { transform: translateY(-100%); }
                    to { transform: translateY(0); }
                }
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-down {
                    animation: slide-down 0.3s ease-out;
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 2s linear infinite;
                }
            `}</style>
        </>
    );
}


