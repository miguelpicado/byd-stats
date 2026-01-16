// BYD Stats - Stat Card Component

import React from 'react';
import { BYD_RED } from '../../utils/constants';

/**
 * Statistics card component for displaying metrics
 * @param {Object} props - Component props
 * @param {React.ComponentType} props.icon - Icon component
 * @param {string} props.label - Card label
 * @param {string|number} props.value - Main value to display
 * @param {string} props.unit - Unit of measurement
 * @param {string} props.color - Tailwind color classes for icon background
 * @param {string} props.sub - Optional subtitle
 * @param {boolean} props.isCompact - Compact mode flag
 * @param {boolean} props.lowPadding - Low padding mode flag
 * @param {boolean} props.isLarger - Larger card variant
 * @param {boolean} props.isVerticalMode - Vertical layout mode
 */
const StatCard = React.memo(({
    icon: Icon,
    label,
    value,
    unit,
    color,
    sub,
    isCompact,
    lowPadding,
    isLarger,
    isLarger,
    isVerticalMode,
    onClick
}) => (
    <div
        className={`bg-white dark:bg-slate-800/50 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700/50 flex items-stretch overflow-hidden ${isCompact ? (isLarger ? 'h-20' : (lowPadding ? 'h-12' : 'h-16')) : (isVerticalMode ? 'h-20' : 'min-h-[80px] sm:min-h-[100px]')} ${onClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all active:scale-[0.98]' : ''}`}
        onClick={onClick}
    >
        <div className={`flex items-center justify-center shrink-0 ${isCompact ? (isLarger ? 'w-14' : 'w-10') : (isVerticalMode ? 'w-14' : 'w-14 sm:w-16')} ${color}`} >
            <Icon className={`${isCompact ? (isLarger ? 'w-6 h-6' : 'w-5 h-5') : (isVerticalMode ? 'w-6 h-6' : 'w-6 h-6 sm:w-7 sm:h-7')}`} />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-2 py-1 min-w-0">
            <p className="text-slate-600 dark:text-slate-400 leading-tight uppercase tracking-wider font-semibold truncate w-full" style={{ fontSize: isCompact ? (isLarger ? '9.5px' : '8px') : (isVerticalMode ? '9px' : '11px') }}>{label}</p>
            <p className="font-black text-slate-900 dark:text-white leading-none mt-1" style={{ fontSize: isCompact ? (isLarger ? '21.5px' : '17px') : (isVerticalMode ? '22px' : '28px') }}>
                {value}<span className="text-slate-500 dark:text-slate-400 ml-1 font-bold" style={{ fontSize: isCompact ? (isLarger ? '11px' : '7.5px') : (isVerticalMode ? '10px' : '14px') }}>{unit}</span>
            </p>
            {sub && <p className="leading-tight font-bold mt-1 truncate w-full" style={{ color: BYD_RED, fontSize: isCompact ? (isLarger ? '8.5px' : '7px') : (isVerticalMode ? '9px' : '11px') }}>{sub}</p>}
        </div>
    </div>
));

StatCard.displayName = 'StatCard';

export default StatCard;
