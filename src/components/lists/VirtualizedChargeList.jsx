// BYD Stats - Virtualized Charge List Component
// Uses TanStack Virtual for efficient rendering of large charge lists
import { memo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import PropTypes from 'prop-types';

const ITEM_SIZE = 100; // Estimated height for Charge Card

const VirtualizedChargeList = memo(({
    charges,
    onChargeClick,
    scrollRef,
    formatDate,
    getChargerTypeName
}) => {
    const listRef = useRef(null);

    const virtualizer = useVirtualizer({
        count: charges.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => ITEM_SIZE,
        overscan: 5,
    });

    return (
        <div ref={listRef} style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
                const charge = charges[virtualItem.index];
                return (
                    <div
                        key={virtualItem.index}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualItem.size}px`,
                            transform: `translateY(${virtualItem.start}px)`,
                        }}
                    >
                        <div style={{ paddingBottom: '12px' }}>
                            {/* Inline Charge Card Render to avoid creating a new file if possible, or we can extract it */}
                            <div
                                onClick={() => onChargeClick(charge)}
                                className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                            >
                                <div className="flex justify-between items-center">
                                    <div className="flex-1">
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {formatDate(charge.date)} - {charge.time}
                                        </p>
                                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                                            {charge.kwhCharged?.toFixed(2) || '0.00'} kWh
                                        </p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500">
                                            {getChargerTypeName(charge.chargerTypeId)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-amber-600 dark:text-amber-400 font-semibold">
                                            {charge.totalCost?.toFixed(2) || '0.00'} €
                                        </p>
                                        {charge.finalPercentage && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {charge.initialPercentage ? `${charge.initialPercentage}% → ` : ''}
                                                {charge.finalPercentage}%
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
});

VirtualizedChargeList.displayName = 'VirtualizedChargeList';

VirtualizedChargeList.propTypes = {
    charges: PropTypes.array.isRequired,
    onChargeClick: PropTypes.func.isRequired,
    scrollRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) })
    ]),
    formatDate: PropTypes.func.isRequired,
    getChargerTypeName: PropTypes.func.isRequired
};

export default VirtualizedChargeList;
