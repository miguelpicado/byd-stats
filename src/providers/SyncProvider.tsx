import { createContext, useContext, useMemo, useCallback, ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { logger } from '@core/logger';
import { useApp } from '@/context/AppContext';
import { useCar } from '@/context/CarContext';
import { useLayout } from '@/context/LayoutContext';
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
    const { isNative } = useLayout();

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
        carName: activeCar?.name || ''
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

    // File Loading
    const loadFile = useCallback(async (file: File, merge: boolean = false) => {
        try {
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
    }, [database, tripsContext.rawTrips, tripsContext.setRawTrips, googleSync]);

    const exportData = useCallback(async () => {
        if (!database.sqlReady) {
            await database.initSql();
        }
        return database.exportDatabase(tripsContext.rawTrips);
    }, [database, tripsContext.rawTrips]);

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
        loadChargeRegistry
    }), [googleSync, database, fileHandling, loadFile, exportData, loadChargeRegistry]);

    return (
        <SyncContext.Provider value={value}>
            {children}
        </SyncContext.Provider>
    );
}
