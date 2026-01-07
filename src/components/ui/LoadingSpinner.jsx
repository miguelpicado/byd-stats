// BYD Stats - Loading Spinner Component

import React from 'react';
import { BYD_RED } from '../../utils/constants';

/**
 * Loading spinner component with BYD branding
 * @param {Object} props - Component props
 * @param {string} props.message - Optional loading message
 * @param {string} props.size - Size variant: 'sm', 'md', 'lg'
 */
export const LoadingSpinner = ({ message = 'Procesando...', size = 'md' }) => {
    const sizes = {
        sm: 'w-8 h-8 border-2',
        md: 'w-16 h-16 border-4',
        lg: 'w-24 h-24 border-4'
    };

    const textSizes = {
        sm: 'text-sm',
        md: 'text-lg md:text-xl',
        lg: 'text-xl md:text-2xl'
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center px-4">
            <div className="text-center">
                <div
                    className={`${sizes[size]} rounded-full animate-spin mx-auto mb-4`}
                    style={{ borderColor: BYD_RED, borderTopColor: 'transparent' }}
                />
                <p className={`text-slate-900 dark:text-white ${textSizes[size]}`}>{message}</p>
            </div>
        </div>
    );
};

/**
 * Inline loading spinner for use within components
 */
export const InlineSpinner = ({ className = 'w-5 h-5' }) => (
    <div
        className={`${className} border-2 rounded-full animate-spin`}
        style={{ borderColor: BYD_RED, borderTopColor: 'transparent' }}
    />
);

export default LoadingSpinner;
