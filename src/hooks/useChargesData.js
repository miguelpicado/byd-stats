// BYD Stats - Charges Data Management Hook
// Manages charging session data persistence and CRUD operations

import { useState, useCallback, useEffect, useMemo } from 'react';
import { CHARGES_STORAGE_KEY as BASE_CHARGES_KEY } from '../utils/constants';
import { logger } from '../utils/logger';

// ... (comments)

/**
 * Hook to manage charging session data
 * Provides CRUD operations with localStorage persistence
 * @returns {Object} Charges state and management functions
 */
const useChargesData = (activeCarId = null) => {
    // specific keys for current car
    const storageKey = activeCarId ? `${BASE_CHARGES_KEY}_${activeCarId}` : null;

    // Initialize state
    const [charges, setCharges] = useState([]);

    // Load data when activeCarId changes
    useEffect(() => {
        if (!storageKey) {
            setCharges([]);
            return;
        }

        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Sort by timestamp descending (newest first)
                if (Array.isArray(parsed)) {
                    setCharges(parsed.sort((a, b) => b.timestamp - a.timestamp));
                } else {
                    setCharges([]);
                }
            } else {
                setCharges([]);
            }
        } catch (e) {
            logger.error('Error loading charges from localStorage:', e);
            setCharges([]);
        }
    }, [storageKey]);

    // Persist changes to localStorage
    useEffect(() => {
        if (storageKey && charges.length > 0) {
            try {
                localStorage.setItem(storageKey, JSON.stringify(charges));
            } catch (e) {
                logger.error('Error saving charges to localStorage:', e);
            }
        } else if (storageKey && charges.length === 0) {
            // Optional: clean up?
        }
    }, [charges, storageKey]);

    /**
     * Add a new charge
     * @param {Object} chargeData - Charge data without id and timestamp
     * @returns {Object} The created charge with id and timestamp
     */
    const addCharge = useCallback((chargeData) => {
        const newCharge = {
            ...chargeData,
            id: crypto.randomUUID(),
            timestamp: new Date(`${chargeData.date}T${chargeData.time}`).getTime()
        };

        setCharges(prev => {
            const updated = [newCharge, ...prev];
            // Keep sorted by timestamp descending
            return updated.sort((a, b) => b.timestamp - a.timestamp);
        });

        logger.info('Charge added:', newCharge.id);
        return newCharge;
    }, []);

    /**
     * Add multiple charges at once (for CSV import)
     * @param {Array} chargesArray - Array of charge data without id and timestamp
     * @returns {number} Number of charges imported
     */
    const addMultipleCharges = useCallback((chargesArray) => {
        if (!Array.isArray(chargesArray) || chargesArray.length === 0) {
            return 0;
        }

        const newCharges = chargesArray.map(chargeData => ({
            ...chargeData,
            id: crypto.randomUUID(),
            timestamp: new Date(`${chargeData.date}T${chargeData.time}`).getTime()
        }));

        setCharges(prev => {
            // Combine existing and new, avoiding duplicates by timestamp
            const existingTimestamps = new Set(prev.map(c => c.timestamp));
            const uniqueNew = newCharges.filter(c => !existingTimestamps.has(c.timestamp));
            const combined = [...prev, ...uniqueNew];
            // Sort by timestamp descending
            return combined.sort((a, b) => b.timestamp - a.timestamp);
        });

        logger.info(`${newCharges.length} charges imported`);
        return newCharges.length;
    }, []);

    /**
     * Update an existing charge
     * @param {string} id - Charge ID to update
     * @param {Object} updates - Fields to update
     */
    const updateCharge = useCallback((id, updates) => {
        setCharges(prev => {
            const updated = prev.map(charge => {
                if (charge.id !== id) return charge;

                const updatedCharge = { ...charge, ...updates };
                // Recalculate timestamp if date or time changed
                if (updates.date || updates.time) {
                    const date = updates.date || charge.date;
                    const time = updates.time || charge.time;
                    updatedCharge.timestamp = new Date(`${date}T${time}`).getTime();
                }
                return updatedCharge;
            });
            // Re-sort after update
            return updated.sort((a, b) => b.timestamp - a.timestamp);
        });

        logger.info('Charge updated:', id);
    }, []);

    /**
     * Delete a charge by ID
     * @param {string} id - Charge ID to delete
     */
    const deleteCharge = useCallback((id) => {
        setCharges(prev => prev.filter(charge => charge.id !== id));
        logger.info('Charge deleted:', id);
    }, []);

    /**
     * Get a charge by ID
     * @param {string} id - Charge ID to find
     * @returns {Object|undefined} The charge or undefined
     */
    const getChargeById = useCallback((id) => {
        return charges.find(charge => charge.id === id);
    }, [charges]);

    /**
     * Clear all charges
     */
    const clearCharges = useCallback(() => {
        setCharges([]);
        logger.info('All charges cleared');
    }, []);

    /**
     * Replace all charges with a new array (for cloud sync)
     * @param {Array} newCharges - Array of charge objects
     */
    const replaceCharges = useCallback((newCharges) => {
        if (!Array.isArray(newCharges)) {
            logger.error('replaceCharges: expected array, got:', typeof newCharges);
            return;
        }
        const sorted = [...newCharges].sort((a, b) => b.timestamp - a.timestamp);
        setCharges(sorted);
        logger.info(`Charges replaced with ${newCharges.length} items`);
    }, []);

    /**
     * Export charges to CSV file
     */
    const exportCharges = useCallback(() => {
        if (charges.length === 0) {
            return false;
        }

        try {
            // CSV Header matching the import format
            const headers = [
                'Fecha/Hora',
                'Km Totales',
                'kWh Facturados',
                'Precio Total',
                'Duración (min)',
                'Tipo Cargador',
                'Precio/kWh',
                '% Final'
            ].join(',');

            // CSV Rows
            const rows = charges.map(c => {
                // Format date/time: YYYY-MM-DD HH:MM
                const dateTime = `${c.date} ${c.time}`;
                // Fields
                const km = c.odometer || 0;
                // Handle different charge types (electric vs fuel)
                // For fuel, we use liters as 'kWh Facturados' equivalent for CSV structure, 
                // but import logic handles them differently based on 'Tipo Cargador' logic if implemented.
                // Current import implementation assumes electric fields mostly, but let's stick to standard format.
                const kwh = c.type === 'fuel' ? (c.litersCharged || 0) : (c.kwhCharged || 0);
                const price = c.totalCost || 0;
                const duration = 0; // Duration not currently tracked in model, default to 0
                const type = c.chargerTypeId || (c.type === 'fuel' ? 'Gasolina' : 'Desconocido');
                const priceUnit = c.type === 'fuel' ? (c.pricePerLiter || 0) : (c.pricePerKwh || 0);
                const finalPct = c.finalPercentage || 0;

                return [
                    dateTime,
                    km,
                    kwh,
                    price,
                    duration,
                    type,
                    priceUnit,
                    finalPct
                ].join(',');
            });

            const csvContent = [headers, ...rows].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `REGISTRO_CARGAS_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            return true;
        } catch (e) {
            logger.error('Error exporting charges:', e);
            return false;
        }
    }, [charges]);

    // Calculate summary statistics (separate for electric and fuel)
    const summary = useMemo(() => {
        if (charges.length === 0) return null;

        // Separate electric and fuel charges
        const electricCharges = charges.filter(c => (c.type || 'electric') === 'electric');
        const fuelCharges = charges.filter(c => c.type === 'fuel');

        // Electric stats
        const totalKwh = electricCharges.reduce((sum, c) => sum + (c.kwhCharged || 0), 0);
        const electricCost = electricCharges.reduce((sum, c) => sum + (c.totalCost || 0), 0);
        const avgPricePerKwh = electricCharges.length > 0
            ? electricCharges.reduce((sum, c) => sum + (c.pricePerKwh || 0), 0) / electricCharges.length
            : 0;

        // Fuel stats
        const totalLiters = fuelCharges.reduce((sum, c) => sum + (c.litersCharged || 0), 0);
        const fuelCost = fuelCharges.reduce((sum, c) => sum + (c.totalCost || 0), 0);
        const avgPricePerLiter = fuelCharges.length > 0
            ? fuelCharges.reduce((sum, c) => sum + (c.pricePerLiter || 0), 0) / fuelCharges.length
            : 0;

        return {
            chargeCount: charges.length,
            electricCount: electricCharges.length,
            fuelCount: fuelCharges.length,
            totalKwh,
            totalLiters,
            totalCost: electricCost + fuelCost,
            electricCost,
            fuelCost,
            avgPricePerKwh,
            avgPricePerLiter
        };
    }, [charges]);

    return {
        charges,
        addCharge,
        addMultipleCharges,
        updateCharge,
        deleteCharge,
        getChargeById,
        clearCharges,
        replaceCharges,
        exportCharges,
        summary
    };
};

export default useChargesData;
