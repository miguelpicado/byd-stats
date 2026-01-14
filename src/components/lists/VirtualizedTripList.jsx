// BYD Stats - Virtualized Trip List Component
// Uses TanStack Virtual for efficient rendering of large trip lists
import { memo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import TripCard from '../cards/TripCard';
import PropTypes from 'prop-types';

const VirtualizedTripList = memo(({ trips, minEff, maxEff, onTripClick }) => {
    const parentRef = useRef(null);

    const virtualizer = useVirtualizer({
        count: trips.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 110, // TripCard height (100px) + gap (10px)
        overscan: 20 // Render 20 extra items above/below for smooth scrolling
    });

    return (
        <div
            ref={parentRef}
            style={{
                height: '600px',
                overflow: 'auto',
                contain: 'strict'
            }}
        >
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
                            transform: `translateY(${virtualItem.start}px)`,
                            paddingBottom: '12px'
                        }}
                    >
                        <TripCard
                            trip={trips[virtualItem.index]}
                            minEff={minEff}
                            maxEff={maxEff}
                            onClick={onTripClick}
                            isCompact={false}
                        />
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
