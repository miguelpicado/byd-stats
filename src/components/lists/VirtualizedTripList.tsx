import { memo, useRef, FC, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Trip } from '@/types';
import TripCard from '../cards/TripCard';

const ITEM_SIZE = 150;

interface VirtualizedTripListProps {
    trips: Trip[];
    minEff: number;
    maxEff: number;
    onTripClick: (trip: Trip) => void;
    scrollElement: HTMLElement | null;
    onEndReached?: () => void;
    isLoading?: boolean;
}

const VirtualizedTripList: FC<VirtualizedTripListProps> = memo(({
    trips,
    minEff,
    maxEff,
    onTripClick,
    scrollElement,
    onEndReached,
    isLoading
}) => {
    const listRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: trips.length,
        getScrollElement: () => scrollElement,
        estimateSize: () => ITEM_SIZE, // Fallback estimate
        overscan: 5,
    });

    // Detect end of scroll
    useEffect(() => {
        if (!scrollElement || !onEndReached) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = scrollElement;
            // Trigger when within 200px of bottom
            if (scrollHeight - scrollTop - clientHeight < 200) {
                onEndReached();
            }
        };

        scrollElement.addEventListener('scroll', handleScroll);
        return () => scrollElement.removeEventListener('scroll', handleScroll);
    }, [scrollElement, onEndReached]);

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
            {isLoading && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: -40,
                        width: '100%',
                        textAlign: 'center',
                        padding: '10px'
                    }}
                >
                    <span className="inline-block w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></span>
                </div>
            )}
        </div>
    );
});

VirtualizedTripList.displayName = 'VirtualizedTripList';

export default VirtualizedTripList;


