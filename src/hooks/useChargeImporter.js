import { useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/context/AppContext';
import { useData } from '@/providers/DataProvider';

export const useChargeImporter = () => {
    const { t } = useTranslation();
    const { settings, updateSettings } = useApp();
    const { addMultipleCharges, googleSync } = useData();

    /**
     * Load charges from a CSV file with REGISTRO_CARGAS.csv format
     * Auto-creates missing charger types with default values
     */
    const loadChargeRegistry = useCallback(async (file) => {
        try {
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim());

            if (lines.length < 2) {
                toast.error(t('errors.noDataFound'));
                return;
            }

            const charges = [];
            const newChargerTypes = [];
            const existingChargerNames = new Set(
                (settings.chargerTypes || []).map(ct => ct.name.toLowerCase())
            );

            // Parse each line (skip header)
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                // Parse CSV respecting quoted fields
                const values = line.match(/("[^"]*"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim());

                if (!values || values.length < 8) continue;

                const [fechaHora, kmTotales, kwhFacturados, precioTotal, , tipoCargador, precioKw, porcentajeFinal] = values;

                // Validate date format - stop if we hit non-charge data
                if (!fechaHora || !fechaHora.match(/^\d{4}-\d{2}-\d{2}/)) {
                    break;
                }

                // Parse date and time
                const dateMatch = fechaHora.match(/(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2})/);
                if (!dateMatch) continue;

                const date = dateMatch[1];
                const time = dateMatch[2];

                // Find or create charger type
                let chargerTypeId = null;
                const chargerName = tipoCargador?.trim();

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
                        )?.id;
                    }
                }

                charges.push({
                    date,
                    time,
                    odometer: parseFloat(kmTotales) || 0,
                    kwhCharged: parseFloat(kwhFacturados) || 0,
                    totalCost: parseFloat(precioTotal) || 0,
                    chargerTypeId,
                    pricePerKwh: parseFloat(precioKw) || 0,
                    finalPercentage: parseFloat(porcentajeFinal) || 0
                });
            }

            // Add new charger types to settings
            if (newChargerTypes.length > 0) {
                const updatedChargerTypes = [...(settings.chargerTypes || []), ...newChargerTypes];
                updateSettings({ ...settings, chargerTypes: updatedChargerTypes });
            }

            // Import charges
            if (charges.length > 0) {
                const count = addMultipleCharges(charges);

                // Show success message
                let message = t('charges.chargesImported', { count });
                if (newChargerTypes.length > 0) {
                    message += '\n' + t('charges.chargerTypesCreated', {
                        types: newChargerTypes.map(ct => ct.name).join(', ')
                    });
                }
                toast.success(message);

                // Auto-sync after import
                if (googleSync.isAuthenticated) {
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


