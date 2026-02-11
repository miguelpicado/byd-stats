import { memo, useRef, useMemo, FC } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Charge } from '@/types';
import ChargeCard from '../cards/ChargeCard';

const ITEM_SIZE = 100; // Estimated height for Charge Card

interface VirtualizedChargeListProps {
    charges: Charge[];
    onChargeClick: (charge: Charge) => void;
    scrollElement: HTMLElement | null;
    formatDate: (date: string) => string;
    getChargerTypeName: (id: string) => string;
}

const VirtualizedChargeList: FC<VirtualizedChargeListProps> = memo(({
    charges,
    onChargeClick,
    scrollElement,
    formatDate,
    getChargerTypeName
}) => {
    const listRef = useRef<HTMLDivElement>(null);

    interface EnhancedCharge extends Charge {
        _formattedDate: string;
        _chargerTypeName: string;
    }

    // Pre-compute formatted dates and charger names to avoid re-computation during scroll
    const enhancedCharges: EnhancedCharge[] = useMemo(() =>
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
        estimateSize: () => ITEM_SIZE, // Fallback estimate
        overscan: 5,
    });

    return (
        <div ref={listRef} style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
                const charge = enhancedCharges[virtualItem.index];
                return (
                    <div
                        key={charge.id || virtualItem.key} // Prefer ID if available
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

export default VirtualizedChargeList;


