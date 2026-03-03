import React, { memo } from 'react';
import { Charge } from '@/types';

interface ChargeCardProps {
    charge: Charge;
    onClick: (charge: Charge) => void;
    formattedDate: string;
    chargerTypeName: string;
}

/**
 * ChargeCard component displaying charge session details
 */
const ChargeCard: React.FC<ChargeCardProps> = memo(({ charge, onClick, formattedDate, chargerTypeName }) => {
    return (
        <div
            onClick={() => onClick(charge)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(charge); } }}
            role="button"
            tabIndex={0}
            aria-label={`Carga del ${formattedDate}, ${charge.kwhCharged?.toFixed(2) || '0.00'} kWh, ${chargerTypeName}`}
            className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EA0029]"
        >
            <div className="flex justify-between items-center">
                <div className="flex-1">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {formattedDate} - {charge.time}
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {charge.kwhCharged?.toFixed(2) || '0.00'} kWh
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                        {chargerTypeName}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-amber-600 dark:text-amber-400 font-semibold">
                        {charge.totalCost?.toFixed(2) || '0.00'} €
                    </p>
                    {charge.finalPercentage && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {charge.initialPercentage ? (
                                <span className={charge.isSOCEstimated ? 'text-orange-500 font-bold' : ''}>
                                    {charge.initialPercentage}%
                                </span>
                            ) : ''}
                            {charge.initialPercentage ? ' → ' : ''}
                            {charge.finalPercentage}%
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison - only re-render if charge data changed
    return prevProps.charge.id === nextProps.charge.id &&
        prevProps.charge.kwhCharged === nextProps.charge.kwhCharged &&
        prevProps.charge.totalCost === nextProps.charge.totalCost &&
        prevProps.charge.initialPercentage === nextProps.charge.initialPercentage &&
        prevProps.charge.finalPercentage === nextProps.charge.finalPercentage &&
        prevProps.charge.isSOCEstimated === nextProps.charge.isSOCEstimated &&
        prevProps.formattedDate === nextProps.formattedDate &&
        prevProps.chargerTypeName === nextProps.chargerTypeName;
});

ChargeCard.displayName = 'ChargeCard';

export default ChargeCard;


