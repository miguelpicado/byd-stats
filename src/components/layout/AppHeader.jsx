import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { HelpCircle, Minimize, Maximize, Database, Settings, Filter, ChevronDown, Plus, Car } from '../Icons';
import { useCar } from '../../context/CarContext';
import { Check } from 'lucide-react';
import AddCarModal from '../modals/AddCarModal';
import { logger } from '../../utils/logger';

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
    const { cars, activeCar, activeCarId, setActiveCarId, addCar } = useCar();
    // Debug
    // console.log('AppHeader Render:', { cars, activeCar, activeCarId, showDropdown: false }); // commented out to avoid noise, enabled if needed

    // TEMPORARY DEBUG
    useEffect(() => {
        logger.debug('AppHeader State:', { activeCar, activeCarId, carCount: cars.length });
    }, [activeCar, activeCarId, cars]);

    const [showCarDropdown, setShowCarDropdown] = useState(false);
    const [showAddCarModal, setShowAddCarModal] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
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

    const handleCarSelect = useCallback((carId) => {
        setActiveCarId(carId);
        setShowCarDropdown(false);
    }, [setActiveCarId]);

    const handleAddCar = useCallback((carData) => {
        addCar(carData);
        // addCar implicitly doesn't switch? 
        // We probably want to switch to new car.
        // addCar implementation appends.
        // We can find the new car after it's added? 
        // Or modify addCar to return ID? 
        // The context implementation: setCars helper. doesn't return ID easily unless we refactor.
        // But activeCarId is not auto-updated in addCar unless we change context.
        // For now, let's just add. User can switch. 
        // Improved UX: Context `addCar` could automatically switch or return id.
        // Let's refactor context later if needed.
    }, [addCar]);

    return (
        <div className="flex-shrink-0 sticky top-0 z-40 bg-slate-100 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700/50" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className={`${layoutMode === 'horizontal' ? 'px-3 sm:px-4' : 'max-w-7xl mx-auto px-3 sm:px-4'} py-3 sm:py-4`}>
                <div className="flex items-center justify-between">
                    {/* Logo y título / Selector de Coche */}
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

            {/* Add Car Modal */}
            <AddCarModal
                isOpen={showAddCarModal}
                onClose={() => setShowAddCarModal(false)}
                onSave={handleAddCar}
            />
        </div>
    );
});

AppHeader.displayName = 'AppHeader';

export default AppHeader;
