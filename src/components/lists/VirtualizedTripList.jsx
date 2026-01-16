// BYD Stats - Virtualized Trip List Component
// Uses TanStack Virtual for efficient rendering of large trip lists
import { memo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import TripCard from '../cards/TripCard';
import PropTypes from 'prop-types';

const ITEM_SIZE = 150; // Increased to prevent overlap

const VirtualizedTripList = memo(({ trips, minEff, maxEff, onTripClick, scrollRef }) => {
    const listRef = useRef(null);

    const virtualizer = useVirtualizer({
        count: trips.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => ITEM_SIZE,
        overscan: 5,
    });

    return (
        <div ref={listRef} style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualItem) => (
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
                        <TripCard
                            trip={trips[virtualItem.index]}
                            minEff={minEff}
                            maxEff={maxEff}
                            onClick={onTripClick}
                            isCompact={false}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
});

VirtualizedTripList.displayName = 'VirtualizedTripList';

VirtualizedTripList.propTypes = {
    trips: PropTypes.array.isRequired,
    minEff: PropTypes.number.isRequired,
    maxEff: PropTypes.number.isRequired,
    onTripClick: PropTypes.func.isRequired,
    scrollRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) })
    ])
};

export default VirtualizedTripList;
