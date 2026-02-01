import { memo, useRef, FC } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Trip } from '@/types';
import TripCard from '../cards/TripCard';

const ITEM_SIZE = 150; // Estimated height for Trip Card

interface VirtualizedTripListProps {
    trips: Trip[];
    minEff: number;
    maxEff: number;
    onTripClick: (trip: Trip) => void;
    scrollElement: HTMLElement | null;
}

const VirtualizedTripList: FC<VirtualizedTripListProps> = memo(({ trips, minEff, maxEff, onTripClick, scrollElement }) => {
    const listRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: trips.length,
        getScrollElement: () => scrollElement,
        estimateSize: () => ITEM_SIZE, // Fallback estimate
        overscan: 5,
    });

    return (
        <div ref={listRef} style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualItem) => (
                <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
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

export default VirtualizedTripList;


