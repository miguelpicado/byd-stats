import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '@core/logger';
import { useData } from '@/providers/DataProvider';

const GlobalListeners = ({ activeTab }) => {
    const { t } = useTranslation();

    const {
        trips: rawTrips,
        setRawTrips,
        // File handling
        fileHandling,
        // Database
        database,
        // Modals
        isAnyModalOpen,
    } = useData();

    const { pendingFile, clearPendingFile, readFile } = fileHandling;
    const { sqlReady, processDB: processDBHook } = database;

    // Handle file opening and sharing (PWA)
    useEffect(() => {
        if (!pendingFile || !sqlReady) return;

        const handleSharedFile = async () => {
            try {
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
