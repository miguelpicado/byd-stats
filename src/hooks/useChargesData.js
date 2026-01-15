// BYD Stats - Charges Data Management Hook
// Manages charging session data persistence and CRUD operations

import { useState, useCallback, useEffect, useMemo } from 'react';
import { CHARGES_STORAGE_KEY } from '../constants/layout';
import { logger } from '../utils/logger';

/**
 * Charge data schema:
 * {
 *   id: string (uuid),
 *   date: string (YYYY-MM-DD),
 *   time: string (HH:MM),
 *   timestamp: number (unix ms),
 *   odometer: number (km),
 *   kwhCharged: number,
 *   chargerTypeId: string,
 *   pricePerKwh: number (€),
 *   totalCost: number (€),
 *   finalPercentage: number (0-100),
 *   initialPercentage: number|null (0-100, optional)
 * }
 */

/**
 * Hook to manage charging session data
 * Provides CRUD operations with localStorage persistence
 * @returns {Object} Charges state and management functions
 */
const useChargesData = () => {
    // Initialize state from localStorage
    const [charges, setCharges] = useState(() => {
        try {
            const saved = localStorage.getItem(CHARGES_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Sort by timestamp descending (newest first)
                return Array.isArray(parsed)
                    ? parsed.sort((a, b) => b.timestamp - a.timestamp)
                    : [];
            }
            return [];
        } catch (e) {
            logger.error('Error loading charges from localStorage:', e);
            return [];
        }
    });

    // Persist changes to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(CHARGES_STORAGE_KEY, JSON.stringify(charges));
        } catch (e) {
            logger.error('Error saving charges to localStorage:', e);
        }
    }, [charges]);

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

    // Calculate summary statistics
    const summary = useMemo(() => {
        if (charges.length === 0) return null;

        const totalKwh = charges.reduce((sum, c) => sum + (c.kwhCharged || 0), 0);
        const totalCost = charges.reduce((sum, c) => sum + (c.totalCost || 0), 0);
        const avgPricePerKwh = charges.reduce((sum, c) => sum + (c.pricePerKwh || 0), 0) / charges.length;

        return {
            chargeCount: charges.length,
            totalKwh,
            totalCost,
            avgPricePerKwh
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
        summary
    };
};

export default useChargesData;
