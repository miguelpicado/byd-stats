// BYD Stats - Chart Tooltip Component

import React from 'react';
import { BYD_RED } from '../../utils/constants';

/**
 * Custom tooltip component for Recharts
 */
const ChartTip = React.memo(({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-slate-800 border border-slate-600 rounded-xl p-3 shadow-xl">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: payload[0]?.color || BYD_RED }}></div>
                    <p className="text-slate-900 dark:text-white font-medium">{label}</p>
                </div>
                {payload.map((p, i) => (
                    <p key={i} style={{ color: p.color }} className="text-sm font-medium">
                        {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
                    </p>
                ))}
            </div>
        );
    }
    return null;
});

ChartTip.displayName = 'ChartTip';

export default ChartTip;
