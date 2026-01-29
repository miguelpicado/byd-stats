import React from 'react';
import PropTypes from 'prop-types';

/**
 * Reusable Stat Item Component for Insights Modals
 */
const StatItem = ({ label, value, unit, sub, highlight, color, className }) => (
    <div className={`p-3 rounded-xl ${highlight
        ? 'bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-200 dark:border-red-900/30'
        : 'bg-slate-50 dark:bg-slate-700/30 border border-transparent'
        } ${className || ''}`}>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
            <span className={`text-lg font-bold ${color || (highlight ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white')}`}>
                {value}
            </span>
            {unit && <span className="text-sm font-normal text-slate-500">{unit}</span>}
        </div>
        {sub && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
    </div>
);

StatItem.propTypes = {
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    unit: PropTypes.string,
    sub: PropTypes.string,
    highlight: PropTypes.bool,
    color: PropTypes.string,
    className: PropTypes.string
};

export default React.memo(StatItem);


