// BYD Stats - Floating Action Button Component
// Reusable FAB for adding new items

import React from 'react';
import PropTypes from 'prop-types';
import { Plus } from '../Icons.jsx';
import { BYD_RED } from '@core/constants';

/**
 * Floating Action Button component
 * Positioned at bottom-right, above the tab bar in vertical mode
 */
const FloatingActionButton = ({ onClick, icon: Icon = Plus, label, className = '' }) => {
    return (
        <button
            onClick={onClick}
            aria-label={label}
            className={`fixed z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-all duration-200 hover:scale-110 active:scale-95 hover:shadow-xl ${className}`}
            style={{
                backgroundColor: BYD_RED,
                right: '1rem',
                // Position above tab bar (80px) + safe area + some margin
                bottom: 'calc(5.5rem + env(safe-area-inset-bottom))'
            }}
        >
            <Icon className="w-7 h-7" />
        </button>
    );
};

FloatingActionButton.propTypes = {
    onClick: PropTypes.func.isRequired,
    icon: PropTypes.elementType,
    label: PropTypes.string,
    className: PropTypes.string
};

export default FloatingActionButton;



