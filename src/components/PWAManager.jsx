import React, { useState, useEffect, useCallback } from 'react';
import { X, Download } from './Icons.jsx';

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

/**
 * PWA Manager Component
 * Handles PWA installation prompt, exit button, and update notifications
 */
export default function PWAManager() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallBanner, setShowInstallBanner] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [showUpdateBanner, setShowUpdateBanner] = useState(false);
    const [waitingWorker, setWaitingWorker] = useState(null);

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

    // Listen for Service Worker updates
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const handleUpdate = async () => {
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                if (!registration) return;

                // Check for waiting worker (update ready)
                if (registration.waiting) {
                    setWaitingWorker(registration.waiting);
                    setShowUpdateBanner(true);
                }

                // Listen for new updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New version available
                            setWaitingWorker(newWorker);
                            setShowUpdateBanner(true);
                        }
                    });
                });

                // Listen for controller change (update applied)
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    // Reload to apply new version
                    window.location.reload();
                });

            } catch (e) {
                console.error('[PWA] Update check error:', e);
            }
        };

        handleUpdate();

        // Check for updates periodically (every 5 minutes)
        const interval = setInterval(() => {
            navigator.serviceWorker.getRegistration().then(reg => {
                if (reg) reg.update();
            });
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, []);

    // Listen for install prompt
    useEffect(() => {
        const handleInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallBanner(true);
        };

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
        if (!waitingWorker) {
            // No waiting worker, just reload
            window.location.reload();
            return;
        }

        // Tell the waiting worker to skip waiting
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        setShowUpdateBanner(false);
    }, [waitingWorker]);

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
                                <p className="font-semibold text-sm">Nueva versión disponible</p>
                                <p className="text-xs opacity-90">Pulsa actualizar para obtener las últimas mejoras</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleUpdate}
                                className="px-4 py-1.5 bg-white text-green-600 rounded-full text-sm font-bold hover:bg-gray-100 transition-colors"
                            >
                                Actualizar
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
                <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-red-600 to-red-700 text-white p-3 shadow-lg animate-slide-down">
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

            {/* Exit Button - Only show when running as PWA */}
            {isStandalone && (
                <button
                    onClick={handleExit}
                    className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full shadow-lg hover:from-red-700 hover:to-red-800 transition-all"
                    title="Cerrar aplicación"
                >
                    <LogOut className="w-5 h-5" />
                    <span className="font-semibold text-sm">Salir</span>
                </button>
            )}

            {/* Exit Confirmation Modal */}
            {showExitConfirm && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-slate-800 rounded-xl p-6 m-4 max-w-sm w-full shadow-2xl border border-slate-700">
                        <h3 className="text-lg font-bold text-white mb-2">¿Cerrar BYD Stats?</h3>
                        <p className="text-slate-400 text-sm mb-4">
                            Puedes volver a abrir la app desde el icono en tu pantalla de inicio.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowExitConfirm(false)}
                                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmExit}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                            >
                                Salir
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
                .animate-slide-down {
                    animation: slide-down 0.3s ease-out;
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
