import React from 'react';
import PropTypes from 'prop-types';
import { BYD_RED } from '../../utils/constants';
import { Plus } from '../Icons';

/**
 * Reusable header for modals
 * @param {Object} props
 * @param {string} props.title - Modal title
 * @param {Function} props.Icon - Icon component to display
 * @param {Function} props.onClose - Close handler
 * @param {string} props.id - ID for aria-labelledby
 * @param {string} [props.iconColor] - Custom color for the icon
 */
const ModalHeader = ({ className = "mb-6", title, Icon, onClose, id, iconColor, iconClassName = "w-6 h-6" }) => {
    return (
        <div className={`flex items-center justify-between ${className}`}>
            <h2 id={id} className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                {Icon && <Icon className={iconClassName} style={iconColor ? { color: iconColor } : {}} />}
                {title}
            </h2>
            <button
                onClick={onClose}
                aria-label="Close modal"
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
                <Plus className="w-6 h-6 rotate-45" />
            </button>
        </div>
    );
};

ModalHeader.propTypes = {
    className: PropTypes.string,
    title: PropTypes.string.isRequired,
    Icon: PropTypes.elementType,
    onClose: PropTypes.func.isRequired,
    id: PropTypes.string,
    iconColor: PropTypes.string,
    iconClassName: PropTypes.string
};

export default ModalHeader;
