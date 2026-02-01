import React from 'react';

interface StatItemProps {
    label: string;
    value: string | number;
    unit?: string;
    sub?: string;
    highlight?: boolean;
    color?: string;
    className?: string;
    center?: boolean;
}

/**
 * Reusable Stat Item Component for Insights Modals
 */
const StatItem: React.FC<StatItemProps & { onClick?: () => void }> = ({
    label,
    value,
    unit,
    sub,
    highlight,
    color,
    className,
    onClick,
    center
}) => (
    <div
        onClick={onClick}
        className={`p-3 rounded-xl ${highlight
            ? 'bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-200 dark:border-red-900/30'
            : 'bg-slate-50 dark:bg-slate-700/30 border border-transparent'
            } ${onClick ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors' : ''} ${className || ''} ${center ? 'flex flex-col items-center justify-center text-center' : ''}`}
    >
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
        <div className={`flex items-baseline gap-1 ${center ? 'justify-center' : ''}`}>
            <span className={`text-lg font-bold ${color || (highlight ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white')}`}>
                {value}
            </span>
            {unit && <span className="text-sm font-normal text-slate-500">{unit}</span>}
        </div>
        {sub && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
    </div>
);

export default React.memo(StatItem);
