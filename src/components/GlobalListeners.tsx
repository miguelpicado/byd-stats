import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { logger } from '@core/logger';
import { useData } from '@/providers/DataProvider';

const GlobalListeners = ({ activeTab }) => {
    const { t } = useTranslation();
    const isNative = Capacitor.isNativePlatform();

    const {
        trips: rawTrips,
        setRawTrips,
        // File handling
        fileHandling,
        // Database
        database,
        // Modals
        modals,
        openModal,
        closeModal,
        isAnyModalOpen,
        // Selection
        setSelectedTrip
    } = useData();

    const { pendingFile, clearPendingFile, readFile } = fileHandling;
    const { sqlReady, processDB: processDBHook } = database;

    // Modal convenience vars
    const showTripDetailModal = modals.tripDetail;
    const showSettingsModal = modals.settings;
    const showAllTripsModal = modals.allTrips;

    // Handle Android back button
    useEffect(() => {
        if (!isNative) return;

        const backHandler = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
            // Always handle the back button - prevent default Android behavior

            if (showTripDetailModal) {
                closeModal('tripDetail');
                setSelectedTrip(null);
            } else if (showSettingsModal) {
                closeModal('settings');
            } else if (showAllTripsModal) {
                closeModal('allTrips');
            } else {
                // No modals open - only now check if we should exit
                if (!canGoBack) {
                    CapacitorApp.exitApp();
                }
            }
        });

        return () => {
            backHandler.then(h => h.remove());
        };
    }, [showTripDetailModal, showSettingsModal, showAllTripsModal, isNative, closeModal, setSelectedTrip]);

    // Handle file opening and sharing (both Android native and PWA)
    useEffect(() => {
        if (!pendingFile || !sqlReady) return;

        const handleSharedFile = async () => {
            try {
                // Read file using unified handler (works for both Android and PWA)
                const file = await readFile(pendingFile);

                // Validate file
                const fileName = file.name.toLowerCase();
                if (!fileName.endsWith('.db') && !fileName.endsWith('.jpg') && !fileName.endsWith('.jpeg')) {
                    alert(t('errors.invalidFile') || 'Archivo inválido. Solo se permiten archivos .db');
                    clearPendingFile();
                    return;
                }

                // Process the database file
                const trips = await processDBHook(file, rawTrips, false);
                if (trips) {
                    setRawTrips(trips);

                    // Show success message
                    alert(t('upload.success') || 'Archivo cargado correctamente');
                }

                clearPendingFile();
            } catch (err) {
                logger.error('[FileHandling] Error processing file:', err);
                alert(t('errors.processingFile') || 'Error al procesar el archivo: ' + err.message);
                clearPendingFile();
            }
        };

        handleSharedFile();
    }, [pendingFile, sqlReady, readFile, processDBHook, clearPendingFile, rawTrips, t, setRawTrips]);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isAnyModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isAnyModalOpen]);

    // Scroll to top Effect - Reset all containers when activeTab changes
    useEffect(() => {
        if (!activeTab) return;
        const containers = document.querySelectorAll('.tab-content-container');
        containers.forEach(container => {
            container.scrollTop = 0;
        });
    }, [activeTab]);

    return null; // This component handles side effects only
};

export default GlobalListeners;
