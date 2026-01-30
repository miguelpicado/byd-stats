import ReactDOM from 'react-dom';
import React, { ReactNode, useState } from 'react';

interface ModalPortalProps {
    children: ReactNode;
}

// Use a stable element for portal, or default to document.body
// This ensures we always have a valid container
const ModalPortal: React.FC<ModalPortalProps> = ({ children }) => {
    const [container] = useState<HTMLElement | null>(() => {
        // Only run on client
        if (typeof document !== 'undefined') {
            return document.body;
        }
        return null;
    });

    if (!container) return null;

    return ReactDOM.createPortal(children, container);
};

export default ModalPortal;
