import { useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/context/AppContext';
import { useData } from '@/providers/DataProvider';
import { Charge, ChargerType } from '@/types';
import { ChargeCsvRowSchema, parseChargeCsvLine } from '@/utils/validation';

export const useChargeImporter = () => {
    const { t } = useTranslation();
    const { settings, updateSettings } = useApp();
    const { addMultipleCharges, googleSync } = useData();

    /**
     * Load charges from a CSV file with REGISTRO_CARGAS.csv format
     * Auto-creates missing charger types with default values
     */
    const loadChargeRegistry = useCallback(async (file: File) => {
        try {
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim());

            if (lines.length < 2) {
                toast.error(t('errors.noDataFound'));
                return;
            }

            const charges: Partial<Charge>[] = [];
            const newChargerTypes: ChargerType[] = [];
            const existingChargerNames = new Set(
                (settings.chargerTypes || []).map(ct => ct.name.toLowerCase())
            );

            // Parse each line (skip header)
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                const values = line.match(/("[^"]*"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim());

                if (!values) continue;

                // 1. Pre-parse raw values
                const rawData = parseChargeCsvLine(values);
                if (!rawData) continue;

                // 2. Validate with Zod
                const validation = ChargeCsvRowSchema.safeParse(rawData);
                if (!validation.success) {
                    console.warn(`Skipping invalid row ${i}:`, validation.error.format());
                    continue;
                }

                const data = validation.data;

                // Find or create charger type
                let chargerTypeId: string | null = null;
                const chargerName = data.chargerType;

                if (chargerName) {
                    const existing = (settings.chargerTypes || []).find(
                        ct => ct.name.toLowerCase() === chargerName.toLowerCase()
                    );

                    if (existing) {
                        chargerTypeId = existing.id;
                    } else if (!existingChargerNames.has(chargerName.toLowerCase())) {
                        // Create new charger type
                        const newId = `csv_${Date.now()}_${i}`;
                        newChargerTypes.push({
                            id: newId,
                            name: chargerName,
                            speedKw: 11,
                            efficiency: 1
                        });
                        chargerTypeId = newId;
                        existingChargerNames.add(chargerName.toLowerCase());
                    } else {
                        // Already queued for creation
                        chargerTypeId = newChargerTypes.find(
                            ct => ct.name.toLowerCase() === chargerName.toLowerCase()
                        )?.id || null;
                    }
                }

                if (chargerTypeId) {
                    charges.push({
                        date: data.date,
                        time: data.time,
                        odometer: data.odometer,
                        kwhCharged: data.kwhCharged,
                        totalCost: data.totalCost,
                        chargerTypeId,
                        pricePerKwh: data.pricePerKwh,
                        initialPercentage: data.initialPercentage,
                        finalPercentage: data.finalPercentage
                    });
                }
            }

            // Add new charger types to settings
            if (newChargerTypes.length > 0) {
                const updatedChargerTypes = [...(settings.chargerTypes || []), ...newChargerTypes];
                updateSettings({ ...settings, chargerTypes: updatedChargerTypes });
            }

            // Get battery capacity for estimation
            const batterySize = parseFloat(String(settings.batterySize)) || 60.48;

            // Import charges with estimation logic
            const processedCharges = charges.map(c => {
                let initial = c.initialPercentage;
                let final = c.finalPercentage;
                let isEstimated = false;

                // Round final percentage
                if (final !== undefined && final !== null) {
                    final = Math.round(final);
                }

                // Estimate Initial SoC if missing (0 or null/undefined)
                // Logic: Start = End - (kWh / Capacity * 100)
                if ((initial === undefined || initial === 0) && final && c.kwhCharged) {
                    const percentAdded = (c.kwhCharged / batterySize) * 100;
                    // Round to nearest integer (unity)
                    initial = Math.max(0, Math.round(final - percentAdded));
                    isEstimated = true;
                }

                return {
                    ...c,
                    initialPercentage: initial,
                    finalPercentage: final,
                    isSOCEstimated: isEstimated
                } as Charge;
            });

            if (processedCharges.length > 0) {
                const count = addMultipleCharges(processedCharges);

                // Show success message
                let message = t('charges.chargesImported', { count });
                if (newChargerTypes.length > 0) {
                    message += '\n' + t('charges.chargerTypesCreated', {
                        types: newChargerTypes.map(ct => ct.name).join(', ')
                    });
                }
                toast.success(message);

                // Auto-sync after import
                if (googleSync && googleSync.isAuthenticated) {
                    googleSync.syncNow();
                }
            } else {
                toast.error(t('errors.noDataFound'));
            }
        } catch (error) {
            console.error('Error loading charge registry:', error);
            toast.error(t('errors.processingFile') || 'Error processing file');
        }
    }, [settings, updateSettings, addMultipleCharges, googleSync, t]);

    return { loadChargeRegistry };
};
