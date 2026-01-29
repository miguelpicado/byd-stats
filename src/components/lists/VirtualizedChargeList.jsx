// BYD Stats - Virtualized Charge List Component
// Uses TanStack Virtual for efficient rendering of large charge lists
import { memo, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import PropTypes from 'prop-types';
import ChargeCard from '../cards/ChargeCard';

const ITEM_SIZE = 100; // Estimated height for Charge Card

const VirtualizedChargeList = memo(({
    charges,
    onChargeClick,
    scrollElement,
    formatDate,
    getChargerTypeName
}) => {
    const listRef = useRef(null);

    // Pre-compute formatted dates and charger names to avoid re-computation during scroll
    const enhancedCharges = useMemo(() =>
        charges.map(charge => ({
            ...charge,
            _formattedDate: formatDate(charge.date),
            _chargerTypeName: getChargerTypeName(charge.chargerTypeId)
        })),
        [charges, formatDate, getChargerTypeName]
    );

    const virtualizer = useVirtualizer({
        count: enhancedCharges.length,
        getScrollElement: () => scrollElement,
        estimateSize: () => ITEM_SIZE,
        overscan: 5,
    });

    return (
        <div ref={listRef} style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
                const charge = enhancedCharges[virtualItem.index];
                return (
                    <div
                        key={charge.id || virtualItem.index}
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
                            <ChargeCard
                                charge={charge}
                                onClick={onChargeClick}
                                formattedDate={charge._formattedDate}
                                chargerTypeName={charge._chargerTypeName}
                            />
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
    scrollElement: PropTypes.instanceOf(Element),
    formatDate: PropTypes.func.isRequired,
    getChargerTypeName: PropTypes.func.isRequired
};

export default VirtualizedChargeList;


