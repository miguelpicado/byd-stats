import React, { memo, lazy, Suspense } from 'react';

// Lazy load ModalContainer to defer loading of all modal code until necessary
const ModalContainerLazy = lazy(() => import('./ModalContainer'));

const ModalCoordinator = memo(() => {
    return (
        <Suspense fallback={null}>
            <ModalContainerLazy />
        </Suspense>
    );
});

ModalCoordinator.displayName = 'ModalCoordinator';

export default ModalCoordinator;
