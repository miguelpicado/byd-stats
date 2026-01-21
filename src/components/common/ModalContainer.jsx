import React, { Suspense } from 'react';
import { useData } from '../../providers/DataProvider';

// Lazy loaded modals
const SettingsModalLazy = React.lazy(() => import('../modals/SettingsModal'));
const FilterModalLazy = React.lazy(() => import('../modals/FilterModal'));
const TripDetailModalLazy = React.lazy(() => import('../modals/TripDetailModal'));
const DatabaseUploadModalLazy = React.lazy(() => import('../modals/DatabaseUploadModal'));
const LegalModalLazy = React.lazy(() => import('../modals/LegalModal'));
const AddChargeModalLazy = React.lazy(() => import('../modals/AddChargeModal'));
const ChargeDetailModalLazy = React.lazy(() => import('../modals/ChargeDetailModal'));
const HelpModalLazy = React.lazy(() => import('../modals/HelpModal'));
const UploadOptionsModalLazy = React.lazy(() => import('../modals/UploadOptionsModal'));
const SyncConflictModalLazy = React.lazy(() => import('../modals/SyncConflictModal'));
const ConfirmationModalLazy = React.lazy(() => import('../common/ConfirmationModal'));

const ModalContainer = () => {
    const { modals, googleSync, confirmModalState } = useData();

    return (
        <Suspense fallback={null}>
            {/* Trip Detail Modal */}
            {modals.tripDetail && <TripDetailModalLazy />}

            {/* Settings Modal */}
            {modals.settings && <SettingsModalLazy />}

            {/* Database Management Modal (History) */}
            {modals.history && <DatabaseUploadModalLazy />}

            {/* Upload Options Modal (Simple) */}
            {modals.upload && <UploadOptionsModalLazy />}

            {/* Filter Modal */}
            {modals.filter && <FilterModalLazy />}

            {/* Legal Modal */}
            {modals.legal && <LegalModalLazy />}

            {/* Add/Edit Charge Modal */}
            {modals.addCharge && <AddChargeModalLazy />}

            {/* Charge Detail Modal */}
            {modals.chargeDetail && <ChargeDetailModalLazy />}

            {/* Help/Bug Report Modal */}
            {modals.help && <HelpModalLazy />}

            {/* Sync Conflict Modal */}
            {googleSync?.pendingConflict && <SyncConflictModalLazy />}

            {/* Confirmation Modal */}
            {confirmModalState?.isOpen && <ConfirmationModalLazy />}
        </Suspense>
    );
};

export default React.memo(ModalContainer);
