// BYD Stats - Charges Data Management Hook
// Manages charging session data persistence and CRUD operations

import { useState, useCallback, useEffect, useMemo } from 'react';
import { CHARGES_STORAGE_KEY as BASE_CHARGES_KEY } from '@core/constants';
import { logger } from '@core/logger';
import { Charge } from '@/types';

interface ChargeData {
    date: string;
    time: string;
    kwhCharged?: number;
    kwh?: number;
    totalCost?: number;
    chargerTypeId?: string;
    pricePerKwh?: number;
    finalPercentage?: number;
    initialPercentage?: number;
    odometer?: number;
    type?: 'electric' | 'fuel';
    litersCharged?: number;
    pricePerLiter?: number;
    speedKw?: number;
    efficiency?: number;
}

interface ChargeSummary {
    chargeCount: number;
    electricCount: number;
    fuelCount: number;
    totalKwh: number;
    totalLiters: number;
    totalCost: number;
    electricCost: number;
    fuelCost: number;
    avgPricePerKwh: number;
    avgPricePerLiter: number;
}

interface UseChargesDataReturn {
    charges: Charge[];
    addCharge: (chargeData: ChargeData) => Charge;
    addMultipleCharges: (chargesArray: ChargeData[]) => number;
    updateCharge: (id: string, updates: Partial<Charge>) => void;
    deleteCharge: (id: string) => void;
    getChargeById: (id: string) => Charge | undefined;
    clearCharges: () => void;
    replaceCharges: (newCharges: Charge[]) => void;
    exportCharges: () => boolean;
    summary: ChargeSummary | null;
}

/**
 * Hook to manage charging session data
 * Provides CRUD operations with localStorage persistence
 */
const useChargesData = (activeCarId: string | null = null): UseChargesDataReturn => {
    // specific keys for current car
    const storageKey = activeCarId ? `${BASE_CHARGES_KEY}_${activeCarId}` : null;

    // Initialize state
    const [charges, setCharges] = useState<Charge[]>([]);

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
                    setCharges(parsed.sort((a: Charge, b: Charge) => (b.timestamp || 0) - (a.timestamp || 0)));
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
     */
    const addCharge = useCallback((chargeData: ChargeData) => {
        const newCharge: Charge = {
            ...chargeData,
            id: crypto.randomUUID(),
            timestamp: new Date(`${chargeData.date}T${chargeData.time}`).getTime(),
            kwhCharged: chargeData.kwhCharged || chargeData.kwh || 0,
            totalCost: chargeData.totalCost || 0,
            pricePerKwh: chargeData.pricePerKwh || 0,
            chargerTypeId: chargeData.chargerTypeId || 'unknown'
        };

        setCharges(prev => {
            const updated = [newCharge, ...prev];
            // Keep sorted by timestamp descending
            return updated.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        });

        logger.info('Charge added:', newCharge.id);
        return newCharge;
    }, []);

    /**
     * Add multiple charges at once (for CSV import)
     */
    const addMultipleCharges = useCallback((chargesArray: ChargeData[]) => {
        if (!Array.isArray(chargesArray) || chargesArray.length === 0) {
            return 0;
        }

        const newCharges: Charge[] = chargesArray.map(chargeData => ({
            ...chargeData,
            id: crypto.randomUUID(),
            timestamp: new Date(`${chargeData.date}T${chargeData.time}`).getTime(),
            kwhCharged: chargeData.kwhCharged || chargeData.kwh || 0,
            totalCost: chargeData.totalCost || 0,
            pricePerKwh: chargeData.pricePerKwh || 0,
            chargerTypeId: chargeData.chargerTypeId || 'unknown'
        }));

        setCharges(prev => {
            // Combine existing and new, avoiding duplicates by timestamp
            const existingTimestamps = new Set(prev.map(c => c.timestamp));
            const uniqueNew = newCharges.filter(c => !existingTimestamps.has(c.timestamp));
            const combined = [...prev, ...uniqueNew];
            // Sort by timestamp descending
            return combined.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        });

        logger.info(`${newCharges.length} charges imported`);
        return newCharges.length;
    }, []);

    /**
     * Update an existing charge
     */
    const updateCharge = useCallback((id: string, updates: Partial<Charge>) => {
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
            return updated.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        });

        logger.info('Charge updated:', id);
    }, []);

    /**
     * Delete a charge by ID
     */
    const deleteCharge = useCallback((id: string) => {
        setCharges(prev => prev.filter(charge => charge.id !== id));
        logger.info('Charge deleted:', id);
    }, []);

    /**
     * Get a charge by ID
     */
    const getChargeById = useCallback((id: string) => {
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
     */
    const replaceCharges = useCallback((newCharges: Charge[]) => {
        if (!Array.isArray(newCharges)) {
            logger.error('replaceCharges: expected array, got:', typeof newCharges);
            return;
        }
        const sorted = [...newCharges].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
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
                const kwh = c.type === 'fuel' ? (c.litersCharged || 0) : (c.kwhCharged || 0);
                const price = c.totalCost || 0;
                const duration = 0; // Duration not currently tracked in model, default to 0
                const type = c.chargerTypeId || (c.type === 'fuel' ? 'Gasolina' : 'Desconocido');
                // Cast to any to access pricePerLiter if it exists on Charge or assume dynamic mismatch
                const priceUnit = c.type === 'fuel' ? ((c as any).pricePerLiter || 0) : (c.pricePerKwh || 0);
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
    const summary = useMemo<ChargeSummary | null>(() => {
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
            ? fuelCharges.reduce((sum, c) => sum + ((c as any).pricePerLiter || 0), 0) / fuelCharges.length
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
