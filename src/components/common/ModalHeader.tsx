import React, { ElementType } from 'react';
import { Plus } from '../Icons';

interface ModalHeaderProps {
    className?: string;
    title: string;
    Icon?: ElementType;
    onClose: () => void;
    id?: string;
    iconColor?: string;
    iconClassName?: string;
}

/**
 * Reusable header for modals
 */
const ModalHeader: React.FC<ModalHeaderProps> = ({
    className = "mb-6",
    title,
    Icon,
    onClose,
    id,
    iconColor,
    iconClassName = "w-6 h-6"
}) => {
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

export default ModalHeader;
