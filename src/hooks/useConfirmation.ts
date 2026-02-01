import { useState, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Trip } from '@/types';

export interface UseConfirmationProps {
    rawClearData: () => void;
    rawSaveToHistory: () => { success: boolean; total?: number; added?: number; reason?: string };
    rawClearHistory: () => void;
    rawLoadFromHistory: () => { success: boolean; reason?: string };
    tripHistory: Trip[];
}

export interface ConfirmModalState {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDangerous: boolean;
}

export const useConfirmation = ({
    rawClearData,
    rawSaveToHistory,
    rawClearHistory,
    rawLoadFromHistory,
    tripHistory
}: UseConfirmationProps) => {
    const { t } = useTranslation();

    const [confirmModalState, setConfirmModalState] = useState<ConfirmModalState>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        isDangerous: false
    });

    const showConfirmation = useCallback((title: string, message: string, onConfirm: () => void, isDangerous: boolean = false) => {
        setConfirmModalState({
            isOpen: true,
            title,
            message,
            onConfirm,
            isDangerous
        });
    }, []);

    const closeConfirmation = useCallback(() => {
        setConfirmModalState(prev => ({ ...prev, isOpen: false }));
    }, []);

    const clearData = useCallback(() => {
        showConfirmation(
            t('settings.dangerZone'),
            t('confirmations.deleteAllData'),
            () => {
                rawClearData();
                toast.success(t('upload.success', 'Datos eliminados correctamente'));
            },
            true
        );
    }, [showConfirmation, rawClearData, t]);

    const saveToHistory = useCallback(() => {
        const result = rawSaveToHistory();
        if (!result.success) {
            if (result.reason === 'no_trips') {
                toast.error(t('confirmations.noTripsToSave'));
            }
            return;
        }
        toast.success(t('confirmations.historySaved', {
            total: result.total,
            new: result.added
        }));
    }, [rawSaveToHistory, t]);

    const loadFromHistory = useCallback(() => {
        const result = rawLoadFromHistory(); // Check if history exists (simulated check here or in hook)
        // Note: existing rawLoadFromHistory might execute immediately. 
        // Ideally we check *before* calling rawLoadFromHistory if we want to confirm.
        // But based on App.jsx logic:
        if (!result.success && result.reason === 'no_history') {
            toast.error(t('confirmations.noHistory'));
            return;
        }

        showConfirmation(
            t('settings.history'),
            t('confirmations.loadHistory', { count: tripHistory.length }),
            () => {
                const res = rawLoadFromHistory();
                if (res.success) {
                    toast.success(t('upload.success', 'Historial cargado correctamente'));
                }
            }
        );
    }, [tripHistory, rawLoadFromHistory, showConfirmation, t]);

    const clearHistory = useCallback(() => {
        showConfirmation(
            t('settings.clearHistory'),
            t('confirmations.clearHistory'),
            () => {
                rawClearHistory();
                toast.success(t('confirmations.historyCleared'));
            },
            true
        );
    }, [showConfirmation, rawClearHistory, t]);

    return useMemo(() => ({
        confirmModalState,
        closeConfirmation,
        showConfirmation,
        clearData,
        saveToHistory,
        loadFromHistory,
        clearHistory
    }), [confirmModalState, closeConfirmation, showConfirmation, clearData, saveToHistory, loadFromHistory, clearHistory]);
};
