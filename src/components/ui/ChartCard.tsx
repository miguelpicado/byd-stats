import React, { ReactNode } from 'react';

interface ChartCardProps {
    title?: string;
    children: ReactNode;
    className?: string;
    isCompact?: boolean;
}

const ChartCard: React.FC<ChartCardProps> = React.memo(({
    title,
    children,
    className = "",
    isCompact
}) => (
    <div className={`bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 ${className} ${isCompact ? 'p-2' : 'p-4 sm:p-6'}`}>
        {title && <h3 className={`font-semibold text-slate-900 dark:text-white ${isCompact ? 'text-xs sm:text-sm mb-1.5' : 'text-base sm:text-lg mb-3 sm:mb-4'}`}>{title}</h3>}
        {children}
    </div>
));

export default ChartCard;
