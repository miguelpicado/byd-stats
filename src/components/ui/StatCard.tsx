import React, { ElementType } from 'react';


interface StatCardProps {
    icon: ElementType;
    label: string;
    value: string | number;
    unit?: string;
    color?: string;
    sub?: string;
    isCompact?: boolean;
    lowPadding?: boolean;
    isLarger?: boolean;
    isVerticalMode?: boolean;
    onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = React.memo(({
    icon: Icon,
    label,
    value,
    unit,
    color,
    sub,
    isCompact,
    lowPadding,
    isLarger,
    isVerticalMode,
    onClick
}) => (
    <div
        className={`bg-white dark:bg-slate-800/50 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700/50 flex items-stretch overflow-hidden ${isCompact ? (isLarger ? 'h-20' : (lowPadding ? 'h-12' : 'h-16')) : (isVerticalMode ? 'h-20' : 'min-h-[80px] sm:min-h-[100px]')} ${onClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors' : ''}`}
        onClick={onClick}
    >
        <div className={`flex items-center justify-center shrink-0 ${isCompact ? (isLarger ? 'w-14' : 'w-10') : (isVerticalMode ? 'w-14' : 'w-14 sm:w-16')} ${color}`} >
            <Icon className={`${isCompact ? (isLarger ? 'w-6 h-6' : 'w-5 h-5') : (isVerticalMode ? 'w-6 h-6' : 'w-6 h-6 sm:w-7 sm:h-7')}`} />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-2 py-1 min-w-0">
            <p className="text-slate-600 dark:text-slate-400 leading-tight uppercase tracking-wider font-semibold truncate w-full" style={{ fontSize: isCompact ? (isLarger ? '11px' : '9px') : (isVerticalMode ? '9px' : '11px') }}>{label}</p>
            <p className="font-black text-slate-900 dark:text-white leading-none mt-1" style={{ fontSize: isCompact ? (isLarger ? '28px' : '22px') : (isVerticalMode ? '22px' : '28px') }}>
                {value}<span className="text-slate-500 dark:text-slate-400 ml-1 font-bold" style={{ fontSize: isCompact ? (isLarger ? '14px' : '10px') : (isVerticalMode ? '10px' : '14px') }}>{unit}</span>
            </p>
            {sub && <p className="leading-tight font-bold mt-1 truncate w-full text-slate-500 dark:text-slate-400" style={{ fontSize: isCompact ? (isLarger ? '11px' : '9px') : (isVerticalMode ? '9px' : '11px') }}>{sub}</p>}
        </div>
    </div>
));

export default StatCard;
