import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { logger } from '@core/logger';
import { UseGoogleSyncReturn } from '@hooks/useGoogleSync';

export function useSoHAutoSync(googleSync: UseGoogleSyncReturn) {
    const { t } = useTranslation();

    useEffect(() => {
        const handleSoHCalculated = (event: CustomEvent) => {
            const { soh, samples } = event.detail;
            logger.info(`[SyncProvider] SoH calculated (${soh}%, ${samples} samples), triggering auto-sync...`);

            if (googleSync.isAuthenticated && !googleSync.isSyncing) {
                googleSync.syncNow(null).then(() => {
                    logger.info('[SyncProvider] Auto-sync after SoH calculation completed');
                    toast.success(t('sync.sohSynced', 'SoH actualizado y sincronizado'));
                }).catch((err: unknown) => {
                    logger.error('[SyncProvider] Auto-sync after SoH failed:', err);
                });
            }
        };

        window.addEventListener('sohCalculated', handleSoHCalculated as EventListener);
        return () => window.removeEventListener('sohCalculated', handleSoHCalculated as EventListener);
    }, [googleSync, t]);
}
