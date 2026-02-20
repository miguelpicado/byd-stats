import React from 'react';
import { VehicleStatus } from '@/hooks/useVehicleStatus';
import { Summary } from '@/types';
import { useTranslation } from 'react-i18next';

interface BatteryHeaderProps {
    status: VehicleStatus | null;
    summary: Summary | null;
    isAiReady?: boolean;
    onOpenModal?: (modal: string) => void;
}

const BatteryHeader: React.FC<BatteryHeaderProps> = ({ status, summary, isAiReady, onOpenModal }) => {
    const { t } = useTranslation();
    const rawSoC = status?.lastSoC ?? 0;
    const soc = rawSoC <= 1 && rawSoC > 0 ? Math.round(rawSoC * 100) : Math.round(rawSoC);

    // Determine color based on SoC
    const getBarColor = (level: number) => {
        if (level <= 20) return 'bg-red-500';
        if (level <= 40) return 'bg-orange-500';
        return 'bg-green-500'; // Standard green for 40+
    };

    const rangeLabel = isAiReady ? t('stats.aiRange', 'AI Range') : t('dashboard.range', 'Range');
    const baseRange = Number(summary?.estimatedRange ?? 0);
    const rangeValue = Math.round(baseRange * (soc / 100));

    return (
        <div className="grid grid-cols-4 gap-2 w-full h-12 shrink-0">
            {/* Battery Bar (Col Span 3) */}
            <div className="col-span-3 relative h-full bg-slate-200 dark:bg-gray-700 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none">
                <div
                    className={`h-full ${getBarColor(soc)} transition-all duration-500 flex items-center justify-end pr-4 text-white dark:text-black font-bold text-lg`}
                    style={{ width: `${soc}%` }}
                >
                    {soc > 15 && `${soc}%`}
                </div>
                {soc <= 15 && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-900 dark:text-white font-bold text-lg">
                        {soc}%
                    </div>
                )}
                {/* Charging Indicator Overlay */}
                {status?.chargingActive && (
                    <div className="absolute top-1 left-2 px-1.5 py-0.5 bg-black/40 rounded text-[10px] text-white font-medium animate-pulse">
                        {t('common.charging', 'Cargando...')}
                    </div>
                )}
            </div>

            {/* AI Range Button (Col Span 1) */}
            <button
                onClick={() => onOpenModal && onOpenModal('range')}
                className="col-span-1 flex flex-col items-center justify-center p-0.5 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors h-full shadow-sm dark:shadow-none"
            >
                <div className="text-[8px] uppercase text-slate-500 dark:text-slate-500 font-bold leading-none text-center mb-0.5">
                    {rangeLabel}
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate w-full text-center leading-none">
                    {rangeValue} <span className="text-[8px] font-normal text-slate-500 dark:text-slate-400">km</span>
                </span>
            </button>
        </div>
    );
};

export default BatteryHeader;
