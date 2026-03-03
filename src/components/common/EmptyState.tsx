import React from 'react';
import { useTranslation } from 'react-i18next';

interface EmptyStateProps {
    icon: React.ReactNode;
    titleKey: string;
    descriptionKey: string;
    actionLabel?: string;
    onAction?: () => void;
}

/**
 * EmptyState — UI contextual para mostrar cuando no hay datos disponibles.
 * Uso: en listas de viajes/cargas cuando no hay items que mostrar.
 */
const EmptyState: React.FC<EmptyStateProps> = ({ icon, titleKey, descriptionKey, actionLabel, onAction }) => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="text-slate-300 dark:text-slate-600 mb-4" aria-hidden="true">
                {icon}
            </div>
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                {t(titleKey)}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
                {t(descriptionKey)}
            </p>
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="mt-4 px-4 py-2 bg-[#EA0029] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EA0029]"
                >
                    {t(actionLabel)}
                </button>
            )}
        </div>
    );
};

export default EmptyState;
