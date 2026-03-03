import { useCallback } from 'react';
import { useData } from '@/providers/DataProvider';
import { useChargeImporter } from '@hooks/useChargeImporter';
import { Trip, Charge } from '@/types';

/**
 * useModalOrchestration
 * Centralizes modal open/close logic and selection state for trips and charges.
 * Extracted from useAppOrchestrator for single-responsibility.
 */
export const useModalOrchestration = () => {
    const {
        openModal,
        closeModal,
        modals,
        isAnyModalOpen,
        selectedTrip,
        setSelectedTrip,
        selectedCharge,
        setSelectedCharge,
        setLegalInitialSection,
        legalInitialSection,
    } = useData();

    const { loadChargeRegistry } = useChargeImporter();

    const openTripDetail = useCallback((trip: Trip) => {
        setSelectedTrip(trip);
        openModal('tripDetail');
    }, [openModal, setSelectedTrip]);

    const handleChargeSelect = useCallback((charge: Charge) => {
        setSelectedCharge(charge);
        openModal('chargeDetail');
    }, [openModal, setSelectedCharge]);

    return {
        openModal,
        closeModal,
        modals,
        isAnyModalOpen,
        selectedTrip,
        setSelectedTrip,
        selectedCharge,
        setSelectedCharge,
        setLegalInitialSection,
        legalInitialSection,
        openTripDetail,
        handleChargeSelect,
        loadChargeRegistry,
    };
};
