import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Minimize, Maximize, Database, Settings, Filter, ChevronDown, Plus, Car, Check, Cloud, RefreshCw, AlertCircle } from '../../components/Icons';
import { useLayout } from '../../context/LayoutContext';
import { useData } from '../../providers/DataProvider';
import { useCar } from '../../context/CarContext';
// import useModalState from '../../hooks/useModalState';
import AddCarModal from '../../components/modals/AddCarModal';
import { useState, useRef, useEffect, useCallback } from 'react';

const Header: React.FC = memo(() => {
    const { t } = useTranslation();
    const { layoutMode } = useLayout();
    const { trips, openModal, googleSync } = useData();
    const { cars, activeCar, activeCarId, setActiveCarId, addCar } = useCar();
    const [showCarDropdown, setShowCarDropdown] = useState(false);
    const [showAddCarModal, setShowAddCarModal] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowCarDropdown(false);
            }
        };

        if (showCarDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showCarDropdown]);

    const handleCarSelect = useCallback((carId: string) => {
        setActiveCarId(carId);
        setShowCarDropdown(false);
    }, [setActiveCarId]);

    const handleAddCar = useCallback((carData: { name: string; type: 'ev' | 'phev'; isHybrid: boolean }) => {
        addCar(carData);
    }, [addCar]);
    // Removed local useModalState

    const rawTripsCount = trips ? trips.length : 0;
    // const isFullscreen = !!document.fullscreenElement; // Unused

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
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setShowCarDropdown(!showCarDropdown)}
                                className="text-left group flex items-center gap-1.5 focus:outline-none"
                            >
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                                            {activeCar?.name || t('header.title')}
                                        </h1>
                                        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${showCarDropdown ? 'rotate-180' : ''}`} />
                                    </div>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">{t('header.trips', { count: rawTripsCount })}</p>
                                </div>
                            </button>

                            {/* Dropdown Menu */}
                            {showCarDropdown && (
                                <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                    <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto">
                                        <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                            {t('cars.yourCars', 'Tus Coches')}
                                        </div>
                                        {cars.map(car => (
                                            <button
                                                key={car.id}
                                                onClick={() => handleCarSelect(car.id)}
                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${activeCarId === car.id
                                                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Car className="w-4 h-4 opacity-70" />
                                                    <span className="font-medium truncate">{car.name}</span>
                                                </div>
                                                {activeCarId === car.id && <Check className="w-4 h-4" />}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="p-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                                        <button
                                            onClick={() => {
                                                setShowCarDropdown(false);
                                                setShowAddCarModal(true);
                                            }}
                                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all"
                                        >
                                            <Plus className="w-4 h-4" />
                                            {t('cars.addCar', 'Añadir Coche')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Sync Status Indicator */}
                        {/* Sync Status Indicator / Button */}
                        <button
                            onClick={() => {
                                if (googleSync.isAuthenticated) {
                                    googleSync.syncNow();
                                } else {
                                    googleSync.login();
                                }
                            }}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${!googleSync.isAuthenticated
                                ? 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
                                : googleSync.error
                                    ? 'text-red-500 bg-red-50 dark:bg-red-900/10'
                                    : googleSync.isSyncing
                                        ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/10'
                                        : 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/10'
                                } hover:bg-white dark:hover:bg-slate-800`}
                            title={
                                !googleSync.isAuthenticated
                                    ? t('sync.login', 'Iniciar sesión para sincronizar')
                                    : googleSync.error
                                        ? t('sync.error', 'Error de sincronización')
                                        : googleSync.isSyncing
                                            ? t('sync.syncing', 'Sincronizando...')
                                            : t('sync.upToDate', 'Sincronizado')
                            }
                        >
                            {googleSync.isSyncing ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : googleSync.error ? (
                                <AlertCircle className="w-5 h-5" />
                            ) : (
                                <Cloud className="w-5 h-5" />
                            )}
                        </button>
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

            {/* Add Car Modal */}
            <AddCarModal
                isOpen={showAddCarModal}
                onClose={() => setShowAddCarModal(false)}
                onSave={handleAddCar}
            />
        </div>
    );
});

Header.displayName = 'Header';
export default Header;


