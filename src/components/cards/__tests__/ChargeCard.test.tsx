/**
 * Tests for ChargeCard
 *
 * Strategy:
 * - ChargeCard is a pure presentational component (React.memo)
 * - Render with @testing-library/react and assert on text content and interaction
 * - Test: kwh/cost rendering, date/time, charger name, SOC display variants,
 *   isSOCEstimated styling, onClick callback, and memo comparison function
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
// React import removed as it is not used in vitest testing when not needed
import ChargeCard from '../ChargeCard';
import type { Charge } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeCharge = (overrides: Partial<Charge> = {}): Charge => ({
    id: 'c1',
    date: '2024-03-01',
    time: '10:30',
    kwhCharged: 40.5,
    totalCost: 8.10,
    pricePerKwh: 0.2,
    chargerTypeId: 'home',
    ...overrides,
});

const defaultProps = {
    charge: makeCharge(),
    onClick: vi.fn(),
    formattedDate: '01/03/2024',
    chargerTypeName: 'Casa',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ChargeCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ─── Core content rendering ───────────────────────────────────────────────

    describe('content rendering', () => {
        it('displays the formatted date and charge time', () => {
            render(<ChargeCard {...defaultProps} />);
            expect(screen.getByText('01/03/2024 - 10:30')).toBeInTheDocument();
        });

        it('displays kWh charged formatted to 2 decimal places', () => {
            render(<ChargeCard {...defaultProps} />);
            expect(screen.getByText('40.50 kWh')).toBeInTheDocument();
        });

        it('displays "0.00 kWh" when kwhCharged is zero', () => {
            render(<ChargeCard {...defaultProps} charge={makeCharge({ kwhCharged: 0 })} />);
            expect(screen.getByText('0.00 kWh')).toBeInTheDocument();
        });

        it('displays total cost formatted to 2 decimal places', () => {
            render(<ChargeCard {...defaultProps} />);
            expect(screen.getByText('8.10 €')).toBeInTheDocument();
        });

        it('displays "0.00 €" when totalCost is zero', () => {
            render(<ChargeCard {...defaultProps} charge={makeCharge({ totalCost: 0 })} />);
            expect(screen.getByText('0.00 €')).toBeInTheDocument();
        });

        it('displays the charger type name', () => {
            render(<ChargeCard {...defaultProps} chargerTypeName="Cargador Rápido" />);
            expect(screen.getByText('Cargador Rápido')).toBeInTheDocument();
        });
    });

    // ─── SOC display ─────────────────────────────────────────────────────────

    describe('SOC display', () => {
        it('hides the SOC section when finalPercentage is absent', () => {
            render(<ChargeCard {...defaultProps} charge={makeCharge({ initialPercentage: 20 })} />);
            // No percentage signs should appear (no SoC row)
            expect(screen.queryByText(/→/)).not.toBeInTheDocument();
            expect(screen.queryByText(/20%/)).not.toBeInTheDocument();
        });

        it('shows only finalPercentage when initialPercentage is absent', () => {
            const charge = makeCharge({ finalPercentage: 85 });
            render(<ChargeCard {...defaultProps} charge={charge} />);
            expect(screen.getByText('85%')).toBeInTheDocument();
            expect(screen.queryByText('→')).not.toBeInTheDocument();
        });

        it('shows both percentages with arrow separator when both are present', () => {
            const charge = makeCharge({ initialPercentage: 20, finalPercentage: 85 });
            render(<ChargeCard {...defaultProps} charge={charge} />);
            // The arrow is a text node inside the <p>; query the parent paragraph
            const socParagraph = screen.getByText('20%').closest('p');
            expect(socParagraph).toHaveTextContent('→');
            expect(socParagraph).toHaveTextContent('85%');
        });

        it('applies orange styling to initialPercentage when isSOCEstimated is true', () => {
            const charge = makeCharge({ initialPercentage: 20, finalPercentage: 85, isSOCEstimated: true });
            render(<ChargeCard {...defaultProps} charge={charge} />);

            const initialPctSpan = screen.getByText('20%');
            expect(initialPctSpan).toHaveClass('text-orange-500');
            expect(initialPctSpan).toHaveClass('font-bold');
        });

        it('does not apply orange styling when isSOCEstimated is false', () => {
            const charge = makeCharge({ initialPercentage: 20, finalPercentage: 85, isSOCEstimated: false });
            render(<ChargeCard {...defaultProps} charge={charge} />);

            const initialPctSpan = screen.getByText('20%');
            expect(initialPctSpan).not.toHaveClass('text-orange-500');
        });

        it('does not apply orange styling when isSOCEstimated is undefined', () => {
            const charge = makeCharge({ initialPercentage: 20, finalPercentage: 85 });
            render(<ChargeCard {...defaultProps} charge={charge} />);

            const initialPctSpan = screen.getByText('20%');
            expect(initialPctSpan).not.toHaveClass('text-orange-500');
        });
    });

    // ─── Interaction ──────────────────────────────────────────────────────────

    describe('onClick interaction', () => {
        it('calls onClick with the charge object when the card is clicked', () => {
            const onClick = vi.fn();
            const charge = makeCharge({ id: 'click-test' });
            render(<ChargeCard {...defaultProps} charge={charge} onClick={onClick} />);

            fireEvent.click(screen.getByText('40.50 kWh').closest('div')!);
            expect(onClick).toHaveBeenCalledTimes(1);
            expect(onClick).toHaveBeenCalledWith(charge);
        });

        it('does not call onClick when not clicked', () => {
            const onClick = vi.fn();
            render(<ChargeCard {...defaultProps} onClick={onClick} />);
            expect(onClick).not.toHaveBeenCalled();
        });
    });

    // ─── displayName ─────────────────────────────────────────────────────────

    it('has displayName "ChargeCard"', () => {
        expect(ChargeCard.displayName).toBe('ChargeCard');
    });
});
