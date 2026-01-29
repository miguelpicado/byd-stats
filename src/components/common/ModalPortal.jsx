import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';

// Use a stable element for portal, or default to document.body
// This ensures we always have a valid container
const ModalPortal = ({ children }) => {
    const [container] = useState(() => {
        // Only run on client
        if (typeof document !== 'undefined') {
            return document.body;
        }
        return null;
    });

    if (!container) return null;

    return ReactDOM.createPortal(children, container);
};

ModalPortal.propTypes = {
    children: PropTypes.node.isRequired
};

export default ModalPortal;


