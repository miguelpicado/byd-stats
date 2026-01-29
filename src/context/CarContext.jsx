import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { logger } from '@core/logger';
import { STORAGE_KEY, TRIP_HISTORY_KEY, CHARGES_STORAGE_KEY, SETTINGS_KEY } from '@core/constants';

const CarContext = createContext();

export const useCar = () => {
    const context = useContext(CarContext);
    if (!context) {
        throw new Error('useCar must be used within a CarProvider');
    }
    return context;
};

const CARS_STORAGE_KEY = 'byd_cars';
const ACTIVE_CAR_KEY = 'byd_active_car_id';

export const CarProvider = ({ children }) => {
    const [cars, setCars] = useState(() => {
        try {
            const saved = localStorage.getItem(CARS_STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            logger.error('Error loading cars:', e);
            return [];
        }
    });

    const [activeCarId, setActiveCarId] = useState(() => {
        return localStorage.getItem(ACTIVE_CAR_KEY) || null;
    });

    // --- Migration Logic ---
    useEffect(() => {
        const initialize = () => {
            // Check if we need migration (no cars but legacy data exists)
            if (cars.length === 0) {
                const legacySettings = localStorage.getItem(SETTINGS_KEY);
                const legacyStats = localStorage.getItem(STORAGE_KEY);

                if (legacySettings || legacyStats) {
                    logger.info('Legacy data detected, starting migration...');

                    const newCarId = crypto.randomUUID();
                    const initialSettings = legacySettings ? JSON.parse(legacySettings) : {};
                    const carName = initialSettings.carModel || 'Mi BYD';

                    const newCar = {
                        id: newCarId,
                        name: carName,
                        type: 'ev', // Default, logic below could rely on stats to detect hybrid?
                        // But settings don't strictly have type. We'll default to EV or check later.
                        isHybrid: false // Can be updated by user later if needed
                    };

                    // 1. Create Default Car
                    const newCars = [newCar];
                    setCars(newCars);
                    setActiveCarId(newCarId);

                    // 2. Move Legacy Data to Car-Specific Keys
                    const legacyCharges = localStorage.getItem(CHARGES_STORAGE_KEY);
                    const legacyHistory = localStorage.getItem(TRIP_HISTORY_KEY);

                    // We COPY, not move, to be safe during dev (or we move?)
                    // Let's COPY.
                    if (legacySettings) localStorage.setItem(`${SETTINGS_KEY}_${newCarId}`, legacySettings);
                    if (legacyStats) localStorage.setItem(`${STORAGE_KEY}_${newCarId}`, legacyStats);
                    if (legacyCharges) localStorage.setItem(`${CHARGES_STORAGE_KEY}_${newCarId}`, legacyCharges);
                    if (legacyHistory) localStorage.setItem(`${TRIP_HISTORY_KEY}_${newCarId}`, legacyHistory);

                    // Save new state
                    localStorage.setItem(CARS_STORAGE_KEY, JSON.stringify(newCars));
                    localStorage.setItem(ACTIVE_CAR_KEY, newCarId);

                    logger.info(`Migration complete. Created car: ${newCarId}`);
                    // Reload page to ensure all downstream hooks read new keys? 
                    // No, context updates should propagate if we structure it right.
                    // But AppProvider reads localStorage on mount. It needs to re-mount or watch ID.
                } else {
                    // Fresh install - Create default empty car?
                    // Let's create one so the app works out of the box
                    const newCarId = crypto.randomUUID();
                    const newCar = { id: newCarId, name: 'Mi BYD', type: 'ev', isHybrid: false };
                    const newCars = [newCar];
                    setCars(newCars);
                    setActiveCarId(newCarId);
                    localStorage.setItem(CARS_STORAGE_KEY, JSON.stringify(newCars));
                    localStorage.setItem(ACTIVE_CAR_KEY, newCarId);
                }
            } else if (!activeCarId && cars.length > 0) {
                // Cars exist but no active selection (shouldn't happen but defensive)
                setActiveCarId(cars[0].id);
                localStorage.setItem(ACTIVE_CAR_KEY, cars[0].id);
            }
        };

        initialize();
    }, []); // Run once on mount

    // Persist changes
    useEffect(() => {
        if (cars.length > 0) {
            localStorage.setItem(CARS_STORAGE_KEY, JSON.stringify(cars));
        }
    }, [cars]);

    useEffect(() => {
        if (activeCarId) {
            localStorage.setItem(ACTIVE_CAR_KEY, activeCarId);
        }
    }, [activeCarId]);

    const addCar = useCallback((car) => {
        setCars(prev => {
            const newCar = { ...car, id: crypto.randomUUID() };
            return [...prev, newCar];
        });
    }, []);

    const updateCar = useCallback((id, updates) => {
        setCars(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    }, []);

    const deleteCar = useCallback((id) => {
        setCars(prev => prev.filter(c => c.id !== id));
        if (activeCarId === id) {
            setActiveCarId(null); // Should trigger logic to select another
        }
    }, [activeCarId]);

    const value = {
        cars,
        activeCarId,
        setActiveCarId,
        activeCar: cars.find(c => c.id === activeCarId),
        addCar,
        updateCar,
        deleteCar
    };

    return (
        <CarContext.Provider value={value}>
            {children}
        </CarContext.Provider>
    );
};

export default CarContext;


