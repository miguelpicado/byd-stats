import React from 'react';
import { useTranslation } from 'react-i18next';
import { Gauge, Zap, Activity, Info } from '@/components/Icons'; // Using available icons

interface MiniStatsRowProps {
    odo: string;
    energy: string;
    soh: string;
    systemStatus: string;
    onOpenModal: (modal: string) => void;
}

const MiniStatsRow: React.FC<MiniStatsRowProps> = ({ odo, energy, soh, systemStatus, onOpenModal }) => {
    const { t } = useTranslation();

    const stats = [
        {
            id: 'general',
            icon: Gauge,
            label: t('dashboard.odo', 'Odo'),
            value: odo,
            modal: 'generalInfo'
        },
        {
            id: 'energy',
            icon: Zap,
            label: t('dashboard.energy', 'Energy'),
            value: energy,
            modal: 'consumption'
        },
        {
            id: 'soh',
            icon: Activity,
            label: t('dashboard.soh', 'SoH'),
            value: soh,
            modal: 'soh'
        },
        {
            id: 'system',
            icon: Info,
            label: t('dashboard.system', 'System'),
            value: systemStatus,
            modal: 'healthReport'
        }
    ];

    return (
        <div className="grid grid-cols-4 gap-2 w-full h-12 shrink-0">
            {stats.map((stat) => (
                <button
                    key={stat.id}
                    onClick={() => onOpenModal(stat.modal)}
                    className="flex flex-col items-center justify-center p-1 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors h-full shadow-sm dark:shadow-none"
                >
                    <div className="flex items-center gap-1 mb-0.5">
                        <stat.icon className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400" />
                        <span className="text-[8px] uppercase text-slate-500 dark:text-slate-500 font-bold leading-none">{stat.label}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate w-full text-center leading-none">
                        {stat.value}
                    </span>
                </button>
            ))}
        </div>
    );
};

export default MiniStatsRow;
