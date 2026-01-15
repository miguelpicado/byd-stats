// BYD Stats - Virtualized Trip List Component
// Uses TanStack Virtual for efficient rendering of large trip lists
import { memo, useRef } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import TripCard from '../cards/TripCard';
import PropTypes from 'prop-types';

const ITEM_SIZE = 120; // TripCard height + gap

const VirtualizedTripList = memo(({ trips, minEff, maxEff, onTripClick }) => {
    const listRef = useRef(null);

    const virtualizer = useWindowVirtualizer({
        count: trips.length,
        estimateSize: () => ITEM_SIZE,
        overscan: 10,
        scrollMargin: listRef.current?.offsetTop ?? 0,
    });

    return (
        <div ref={listRef}>
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative'
                }}
            >
                {virtualizer.getVirtualItems().map((virtualItem) => (
                    <div
                        key={virtualItem.index}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualItem.size}px`,
                            transform: `translateY(${virtualItem.start - virtualizer.options.scrollMargin}px)`,
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
        </div>
    );
});

VirtualizedTripList.displayName = 'VirtualizedTripList';

VirtualizedTripList.propTypes = {
    trips: PropTypes.array.isRequired,
    minEff: PropTypes.number.isRequired,
    maxEff: PropTypes.number.isRequired,
    onTripClick: PropTypes.func.isRequired
};

export default VirtualizedTripList;
