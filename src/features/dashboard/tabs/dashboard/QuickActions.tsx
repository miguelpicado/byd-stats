import React from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Zap, Wind, Thermometer } from '@/components/Icons';

interface QuickActionsProps {
    // onAction triggers
}

const QuickActions: React.FC<QuickActionsProps> = () => {
    const { t } = useTranslation();

    const actions = [
        { id: 'lock', label: t('actions.lock', 'Lock'), icon: Lock, color: 'bg-blue-600' },
        { id: 'windows', label: t('actions.windows', 'Windows'), icon: Wind, color: 'bg-slate-600' },
        { id: 'flash', label: t('actions.flash', 'Flash'), icon: Zap, color: 'bg-yellow-600' },
        { id: 'heat', label: t('actions.heat', 'Preheat'), icon: Thermometer, color: 'bg-red-600' },
    ];

    return (
        <div className="grid grid-cols-4 gap-2 w-full shrink-0">
            {actions.map((action) => (
                <button
                    key={action.id}
                    className={`${action.color} rounded-xl p-2 flex flex-row items-center justify-center gap-2 text-white shadow-lg active:scale-95 transition-transform h-12`}
                >
                    <action.icon className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase hidden sm:block">{action.label}</span>
                </button>
            ))}
        </div>
    );
};

export default QuickActions;
