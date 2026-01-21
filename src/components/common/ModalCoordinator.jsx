// BYD Stats - Modal Coordinator
// Centralized modal management that fetches its own data from context
// This reduces prop drilling and re-renders in App.jsx

import React, { memo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useData } from '../../providers/DataProvider';
import { useChargeImporter } from '../../hooks/useChargeImporter';
import useAppVersion from '../../hooks/useAppVersion';

import ModalContainer from './ModalContainer';
import ConfirmationModal from './ConfirmationModal';
import SyncConflictModal from '../modals/SyncConflictModal';

/**
 * ModalCoordinator - Centralizes all modal rendering and state management
 * Fetches data from context internally to avoid prop drilling through App.jsx
 */
const ModalCoordinator = memo(() => {
    // App Context
    const { settings, updateSettings } = useApp();

    // Data Context
    const {
        // Data
        trips: rawTrips,
        stats: data,
        charges,

        // Database
        database,
        googleSync,

        // Modal State
        modals,
        openModal,
        closeModal,
        setLegalInitialSection,
        legalInitialSection,

        // Selected items for detail modals (shared state)
        selectedTrip,
        setSelectedTrip,
        selectedCharge,
        setSelectedCharge,
        editingCharge,
        setEditingCharge,

        // Confirmation
        confirmModalState,
        closeConfirmation,

        // Actions
        clearData,
        addCharge,
        deleteCharge
    } = useData();

    const { sqlReady, processDB, exportDatabase } = database;

    // Charge Importer Hook
    const { loadChargeRegistry } = useChargeImporter();

    // App Version
    const { version: appVersion } = useAppVersion();

    // Handlers
    const handleDeleteCharge = useCallback((chargeId) => {
        deleteCharge(chargeId);
        closeModal('chargeDetail');
        setSelectedCharge(null);
    }, [deleteCharge, closeModal]);

    const handleEditCharge = useCallback((charge) => {
        setEditingCharge(charge);
        closeModal('chargeDetail');
        openModal('addCharge');
    }, [closeModal, openModal]);

    const handleSaveCharge = useCallback((chargeData) => {
        addCharge(chargeData);
        closeModal('addCharge');
        setEditingCharge(null);
    }, [addCharge, closeModal]);

    return (
        <>
            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={confirmModalState.isOpen}
                onClose={closeConfirmation}
                onConfirm={confirmModalState.onConfirm}
                title={confirmModalState.title}
                message={confirmModalState.message}
                confirmText={confirmModalState.confirmText}
                isWarning={confirmModalState.isWarning}
            />

            {/* Sync Conflict Resolution Modal */}
            <SyncConflictModal
                isOpen={!!googleSync.pendingConflict}
                onClose={googleSync.dismissConflict}
                conflict={googleSync.pendingConflict}
                onResolve={googleSync.resolveConflict}
            />

            {/* All Other Modals */}
            <ModalContainer
                modals={modals}
                closeModal={closeModal}
                openModal={openModal}
                setLegalInitialSection={setLegalInitialSection}
                legalInitialSection={legalInitialSection}
                settings={settings}
                updateSettings={updateSettings}
                googleSync={googleSync}
                rawTrips={rawTrips}
                selectedTrip={selectedTrip}
                setSelectedTrip={setSelectedTrip}
                data={data}
                sqlReady={sqlReady}
                processDB={processDB}
                exportDatabase={exportDatabase}
                clearData={clearData}
                onLoadChargeRegistry={loadChargeRegistry}
                /* Charge specific props */
                selectedCharge={selectedCharge}
                setSelectedCharge={setSelectedCharge}
                editingCharge={editingCharge}
                setEditingCharge={setEditingCharge}
                charges={charges}
                onDeleteCharge={handleDeleteCharge}
                onEditCharge={handleEditCharge}
                onSaveCharge={handleSaveCharge}
                appVersion={appVersion}
            />
        </>
    );
});

ModalCoordinator.displayName = 'ModalCoordinator';

export default ModalCoordinator;
