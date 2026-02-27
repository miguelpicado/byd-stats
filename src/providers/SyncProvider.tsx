import { createContext, useContext, useMemo, useCallback, ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { logger } from '@core/logger';
import { useApp } from '@/context/AppContext';
import { useCar } from '@/context/CarContext';
import { useTripsContext } from './TripsProvider';
import { useChargesContext } from './ChargesProvider';
import { useModalContext } from './ModalProvider';
import { useDatabase, UseDatabaseReturn } from '@hooks/useDatabase';
import { useGoogleSync, UseGoogleSyncReturn } from '@hooks/useGoogleSync';
import { useFileHandling, UseFileHandlingReturn } from '@hooks/useFileHandling';
import { useAutoChargeDetection } from '@hooks/useAutoChargeDetection';

interface SyncContextType {
    googleSync: UseGoogleSyncReturn;
    database: UseDatabaseReturn;
    fileHandling: UseFileHandlingReturn;
    loadFile: (file: File, merge?: boolean) => Promise<void>;
    exportData: () => Promise<{ success: boolean; reason?: string }>;
    exportSyncData: () => Promise<{ success: boolean; reason?: string; message?: string }>;
    importSyncData: (file: File, merge?: boolean) => Promise<void>;
    loadChargeRegistry: (file: File) => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const useSyncContext = () => {
    const context = useContext(SyncContext);
    if (!context) throw new Error('useSyncContext must be used within a SyncProvider');
    return context;
};

export function SyncProvider({ children }: { children: ReactNode }) {
    const { t } = useTranslation();
    const { settings, updateSettings } = useApp();
    const { activeCarId, cars, updateCar, activeCar } = useCar();

    // Dependencies
    const tripsContext = useTripsContext();
    const chargesContext = useChargesContext();
    const modalContext = useModalContext();

    // Database & File Handling
    const database = useDatabase();
    const fileHandling = useFileHandling();

    // Google Sync
    const googleSync = useGoogleSync({
        localTrips: tripsContext.rawTrips,
        setLocalTrips: tripsContext.setRawTrips,
        settings,
        setSettings: updateSettings,
        localCharges: chargesContext.charges,
        setLocalCharges: chargesContext.replaceCharges,
        activeCarId: activeCarId || '',
        totalCars: cars.length,
        openRegistryModal: modalContext.openRegistryModal,
        isRegistryModalOpen: modalContext.modals?.registryRestore,
        updateCar,
        carName: activeCar?.name || '',
        setActiveCarId: useCar().setActiveCarId
    });

    // Auto Charge Detection - monitors vehicle status and auto-registers charge sessions
    // NOTE: Relies on MQTT listener to update Firestore when charging starts/stops
    // The car automatically sends data to BYD Cloud when charging begins (same as official app)
    useAutoChargeDetection();

    // Auto-Sync on SoH Calculation
    useEffect(() => {
        const handleSoHCalculated = (event: CustomEvent) => {
            const { soh, samples } = event.detail;
            logger.info(`[SyncProvider] SoH calculated (${soh}%, ${samples} samples), triggering auto-sync...`);

            if (googleSync.isAuthenticated && !googleSync.isSyncing) {
                googleSync.syncNow(null).then(() => {
                    logger.info('[SyncProvider] Auto-sync after SoH calculation completed');
                    toast.success(t('sync.sohSynced', 'SoH actualizado y sincronizado'));
                }).catch((err) => {
                    logger.error('[SyncProvider] Auto-sync after SoH failed:', err);
                });
            }
        };

        window.addEventListener('sohCalculated', handleSoHCalculated as EventListener);
        return () => window.removeEventListener('sohCalculated', handleSoHCalculated as EventListener);
    }, [googleSync, t]);

    // Auto-Sync Effect
    useEffect(() => {
        if (!googleSync.isAuthenticated || googleSync.isSyncing) return;
        if ((tripsContext.rawTrips?.length || 0) === 0 && (chargesContext.charges?.length || 0) === 0) return;
        if (modalContext.modals?.registryRestore) return;

        const timer = setTimeout(() => {
            googleSync.syncNow(null);
        }, 10000);

        return () => clearTimeout(timer);
    }, [
        tripsContext.rawTrips?.length,
        chargesContext.charges?.length,
        settings,
        googleSync.isAuthenticated,
        modalContext.modals?.registryRestore,
        googleSync
    ]);

    const exportData = useCallback(async () => {
        if (!database.sqlReady) {
            await database.initSql();
        }
        return database.exportDatabase(tripsContext.rawTrips);
    }, [database, tripsContext.rawTrips]);

    // Export complete SyncData (trips, charges, settings, aiCache) as JSON
    const exportSyncData = useCallback(async () => {
        try {
            const syncData = {
                trips: tripsContext.rawTrips || [],
                charges: chargesContext.charges || [],
                settings: settings,
                aiCache: {
                    efficiency: tripsContext.aiScenarios && tripsContext.aiLoss !== null ? {
                        hash: `count:${tripsContext.rawTrips?.length || 0}`,
                        scenarios: tripsContext.aiScenarios,
                        loss: tripsContext.aiLoss
                    } : undefined,
                    soh: tripsContext.aiSoH !== null && tripsContext.aiSoHStats ? {
                        hash: `count:${tripsContext.rawTrips?.length || 0}`,
                        soh: tripsContext.aiSoH,
                        stats: tripsContext.aiSoHStats
                    } : undefined,
                    parking: undefined
                }
            };

            const jsonString = JSON.stringify(syncData, null, 2);
            const fileName = `BYD_Stats_Data_${activeCarId || 'backup'}_${new Date().toISOString().slice(0, 10)}.json`;

            // Standard Web Download approach
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');

            link.href = url;
            link.setAttribute('download', fileName);
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();

            // Cleanup with a much safer delay
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 5000); // 5 seconds is very safe

            toast.success(t('sync.exportSuccess', 'Datos exportados correctamente'));
            return { success: true };
        } catch (e) {
            console.error('Export Error:', e);
            toast.error(t('sync.exportFailed', 'Error al exportar datos'));
            return { success: false };
        }
    }, [tripsContext, chargesContext, settings, activeCarId, t]);    // Import SyncData from JSON file
    const importSyncData = useCallback(async (file: File, merge: boolean = true) => {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Validate structure
            if (!data || typeof data !== 'object') {
                throw new Error('Formato de archivo inválido');
            }

            const importedTrips = Array.isArray(data.trips) ? data.trips : [];
            const importedCharges = Array.isArray(data.charges) ? data.charges : [];
            const importedSettings = data.settings || {};

            // SAFETY: Show confirmation dialog with data summary
            const currentTrips = tripsContext.rawTrips?.length || 0;
            const currentCharges = chargesContext.charges?.length || 0;

            const message = `⚠️ IMPORTANTE - Confirma la importación:\n\n` +
                `📊 DATOS ACTUALES:\n` +
                `• Viajes: ${currentTrips}\n` +
                `• Cargas: ${currentCharges}\n\n` +
                `📦 DATOS A IMPORTAR:\n` +
                `• Viajes: ${importedTrips.length}\n` +
                `• Cargas: ${importedCharges.length}\n\n` +
                `${merge ? '🔀 Se FUSIONARÁN los datos (sin duplicados)' : '⚠️ Se REEMPLAZARÁN todos los datos actuales'}\n\n` +
                `¿Continuar con la importación?`;

            if (!confirm(message)) {
                logger.info('Import cancelled by user');
                toast.error(t('sync.importCancelled', 'Importación cancelada'));
                return;
            }

            logger.info(`[IMPORT START] Current: ${currentTrips} trips, ${currentCharges} charges`);
            logger.info(`[IMPORT START] Importing: ${importedTrips.length} trips, ${importedCharges.length} charges`);

            let finalTrips = 0;
            let finalCharges = 0;

            if (merge) {
                // Merge trips (avoid duplicates by date-timestamp)
                const tripMap = new Map<string, typeof importedTrips[0]>();
                (tripsContext.rawTrips || []).forEach((t: typeof importedTrips[0]) => tripMap.set(`${t.date}-${t.start_timestamp}`, t));
                importedTrips.forEach((t: typeof importedTrips[0]) => {
                    const key = `${t.date}-${t.start_timestamp}`;
                    if (!tripMap.has(key)) {
                        tripMap.set(key, t);
                    }
                });
                const mergedTrips = Array.from(tripMap.values()).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
                tripsContext.setRawTrips(mergedTrips);
                finalTrips = mergedTrips.length;

                // Merge charges (avoid duplicates by timestamp)
                const chargeMap = new Map<string, typeof importedCharges[0]>();
                (chargesContext.charges || []).forEach((c: typeof importedCharges[0]) => {
                    const key = c.timestamp ? String(c.timestamp) : `${c.date}T${c.time}`;
                    chargeMap.set(key, c);
                });
                importedCharges.forEach((c: typeof importedCharges[0]) => {
                    const key = c.timestamp ? String(c.timestamp) : `${c.date}T${c.time}`;
                    if (!chargeMap.has(key)) {
                        chargeMap.set(key, c);
                    }
                });
                const mergedCharges = Array.from(chargeMap.values());
                chargesContext.replaceCharges(mergedCharges);
                finalCharges = mergedCharges.length;

                // Merge settings (non-default values from import take precedence)
                const mergedSettings = { ...settings, ...importedSettings };
                updateSettings(mergedSettings);
            } else {
                // Replace all data
                tripsContext.setRawTrips(importedTrips);
                chargesContext.replaceCharges(importedCharges);
                finalTrips = importedTrips.length;
                finalCharges = importedCharges.length;
                if (Object.keys(importedSettings).length > 0) {
                    updateSettings(importedSettings);
                }
            }

            logger.info(`[IMPORT COMPLETE] Final: ${finalTrips} trips, ${finalCharges} charges`);
            logger.info(`[IMPORT COMPLETE] Delta: ${finalTrips - currentTrips > 0 ? '+' : ''}${finalTrips - currentTrips} trips, ${finalCharges - currentCharges > 0 ? '+' : ''}${finalCharges - currentCharges} charges`);

            toast.success(
                t('sync.importSuccess', 'Datos importados correctamente') +
                `\n\nViajes: ${currentTrips} → ${finalTrips} (${finalTrips - currentTrips > 0 ? '+' : ''}${finalTrips - currentTrips})\n` +
                `Cargas: ${currentCharges} → ${finalCharges} (${finalCharges - currentCharges > 0 ? '+' : ''}${finalCharges - currentCharges})`
            );

            // SAFETY: Ask before syncing to cloud
            if (googleSync.isAuthenticated) {
                const syncConfirm = confirm(
                    `✅ Importación completada:\n\n` +
                    `Viajes: ${currentTrips} → ${finalTrips}\n` +
                    `Cargas: ${currentCharges} → ${finalCharges}\n\n` +
                    `¿Sincronizar ahora con Google Drive?\n\n` +
                    `⚠️ Esto sobrescribirá la copia de seguridad en la nube.`
                );

                if (syncConfirm) {
                    logger.info('[IMPORT] User confirmed sync to cloud');
                    setTimeout(() => googleSync.syncNow(null), 1000);
                } else {
                    logger.info('[IMPORT] User skipped cloud sync');
                    toast('ℹ️ Sincronización con Drive omitida. Puedes sincronizar manualmente desde Settings.', { duration: 5000 });
                }
            }
        } catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            logger.error('Error importing sync data:', e);
            toast.error(t('sync.importFailed', 'Error al importar datos: ') + error.message);
            throw error;
        }
    }, [tripsContext, chargesContext, settings, updateSettings, googleSync, t]);

    // File Loading
    const loadFile = useCallback(async (file: File, merge: boolean = false) => {
        try {
            // Check if it's a JSON SyncData file
            if (file.name.toLowerCase().endsWith('.json')) {
                const isSyncData = await database.isJsonSyncData(file);
                if (isSyncData) {
                    // Use importSyncData for complete data files
                    await importSyncData(file, merge);
                    return;
                }
            }

            if (!database.sqlReady) {
                await database.initSql();
            }
            const newTrips = await database.processDB(file, tripsContext.rawTrips, merge);
            if (newTrips && newTrips.length > 0) {
                tripsContext.setRawTrips(newTrips);
                logger.info(`Loaded ${newTrips.length} trips (merge: ${merge})`);
                if (googleSync.isAuthenticated) {
                    googleSync.syncNow(newTrips);
                }
            }
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('Error loading file:', error);
            database.setError(err.message);
        }
    }, [database, tripsContext.rawTrips, tripsContext.setRawTrips, googleSync, importSyncData]);

    // Logic moved from DataProvider
    const loadChargeRegistry = useCallback(async (file: File) => {
        try {
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim());

            if (lines.length < 2) {
                toast.error(t('errors.noDataFound'));
                return;
            }

            const chargesArray: Array<{
                date: string;
                time: string;
                odometer: number;
                kwhCharged: number;
                totalCost: number;
                chargerTypeId: string | undefined;
                pricePerKwh: number;
                finalPercentage: number;
            }> = [];
            const newChargerTypes: Array<{
                id: string;
                name: string;
                speedKw: number;
                efficiency: number;
            }> = [];
            const existingChargerNames = new Set(
                (settings.chargerTypes || []).map(ct => ct.name.toLowerCase())
            );

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                const values = line.match(/("[^"]*"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim());

                if (!values || values.length < 8) continue;
                const [fechaHora, kmTotales, kwhFacturados, precioTotal, , tipoCargador, precioKw, porcentajeFinal] = values;

                if (!fechaHora || !fechaHora.match(/^\d{4}-\d{2}-\d{2}/)) break;

                const dateMatch = fechaHora.match(/(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2})/);
                if (!dateMatch) continue;

                const date = dateMatch[1];
                const time = dateMatch[2];

                let chargerTypeId: string | null = null;
                const chargerName = tipoCargador?.trim();

                if (chargerName) {
                    const existing = (settings.chargerTypes || []).find(
                        ct => ct.name.toLowerCase() === chargerName.toLowerCase()
                    );

                    if (existing) {
                        chargerTypeId = existing.id;
                    } else if (!existingChargerNames.has(chargerName.toLowerCase())) {
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
                        chargerTypeId = newChargerTypes.find(
                            ct => ct.name.toLowerCase() === chargerName.toLowerCase()
                        )?.id || null;
                    }
                }

                chargesArray.push({
                    date,
                    time,
                    odometer: parseFloat(kmTotales) || 0,
                    kwhCharged: parseFloat(kwhFacturados) || 0,
                    totalCost: parseFloat(precioTotal) || 0,
                    chargerTypeId: chargerTypeId || '',
                    pricePerKwh: parseFloat(precioKw) || 0,
                    finalPercentage: parseFloat(porcentajeFinal) || 0
                });
            }

            if (newChargerTypes.length > 0) {
                const updatedChargerTypes = [...(settings.chargerTypes || []), ...newChargerTypes];
                updateSettings({ ...settings, chargerTypes: updatedChargerTypes });
            }

            if (chargesArray.length > 0) {
                const count = chargesContext.addMultipleCharges(chargesArray);
                let message = t('charges.chargesImported', { count });
                if (newChargerTypes.length > 0) {
                    message += '\n' + t('charges.chargerTypesCreated', {
                        types: newChargerTypes.map(ct => ct.name).join(', ')
                    });
                }
                toast.success(message);
                if (googleSync.isAuthenticated) {
                    googleSync.syncNow(null);
                }
            } else {
                toast.error(t('errors.noDataFound'));
            }
        } catch (error) {
            logger.error('Error loading charge registry:', error);
            toast.error(t('errors.processingFile') || 'Error processing file');
        }
    }, [settings, updateSettings, chargesContext, googleSync, t]);

    const value = useMemo(() => ({
        googleSync,
        database,
        fileHandling,
        loadFile,
        exportData,
        exportSyncData,
        importSyncData,
        loadChargeRegistry
    }), [googleSync, database, fileHandling, loadFile, exportData, exportSyncData, importSyncData, loadChargeRegistry]);

    return (
        <SyncContext.Provider value={value}>
            {children}
        </SyncContext.Provider>
    );
}
