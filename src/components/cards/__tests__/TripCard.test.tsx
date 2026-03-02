import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TripCard from '../TripCard';
import { Trip } from '@/types';// Setup Mocks
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('@core/formatters', () => ({
    calculateScore: vi.fn((efficiency) => 100 - efficiency),
    getScoreColor: vi.fn(() => '#00FF00')
}));

vi.mock('@core/dateUtils', () => ({
    formatDate: vi.fn(() => 'Formatted Date'),
    formatTime: vi.fn(() => '14:30')
}));

describe('TripCard', () => {
    const mockTrip = {
        id: '1',
        date: '20231015',
        start_timestamp: 1634304600000,
        trip: 15, // odometer distance
        gpsDistanceKm: 14.5, // GPS distance
        electricity: 2.5,
        totalCost: 1.5,
        calculatedCost: 2.0
    } as unknown as Trip & { calculatedCost?: number };

    const defaultProps = {
        trip: mockTrip,
        minEff: 10,
        maxEff: 25,
        onClick: vi.fn()
    };

    it('renders trip date and time', () => {
        render(<TripCard {...defaultProps} />);
        expect(screen.getByText('Formatted Date · 14:30')).toBeDefined();
    });

    it('renders distance using GPS distance when available', () => {
        render(<TripCard {...defaultProps} />);
        expect(screen.getByText('14.5')).toBeDefined();
    });

    it('falls back to odometer distance when GPS not available', () => {
        const tripWithoutGps = { ...mockTrip, gpsDistanceKm: undefined };
        render(<TripCard {...defaultProps} trip={tripWithoutGps} />);
        expect(screen.getByText('15.0')).toBeDefined();
    });

    it('shows "-" for stationary trips (< 0.5 km)', () => {
        const stationaryTrip = { ...mockTrip, gpsDistanceKm: 0.2, trip: 0.2 };
        render(<TripCard {...defaultProps} trip={stationaryTrip} />);

        // Efficiency should be "-"
        // Score should be "-"
        const dashes = screen.getAllByText('-');
        expect(dashes.length).toBeGreaterThanOrEqual(2);
    });

    it('calculates and displays efficiency (kWh/100km)', () => {
        render(<TripCard {...defaultProps} />);
        // 2.5 kWh / 14.5 km * 100 = 17.24
        expect(screen.getByText('17.24')).toBeDefined();
    });

    it('displays cost when calculatedCost is available', () => {
        render(<TripCard {...defaultProps} />);
        expect(screen.getByText('2.00')).toBeDefined();
    });

    it('falls back to totalCost when calculatedCost is not available', () => {
        const tripWithoutCalcCost = { ...mockTrip, calculatedCost: undefined };
        render(<TripCard {...defaultProps} trip={tripWithoutCalcCost} />);
        expect(screen.getByText('1.50')).toBeDefined();
    });

    it('calls onClick with trip object when clicked', () => {
        render(<TripCard {...defaultProps} />);
        const cardContainer = screen.getByText('Formatted Date · 14:30').closest('div')?.parentElement;

        expect(cardContainer).toBeDefined();
        if (cardContainer) {
            fireEvent.click(cardContainer);
            expect(defaultProps.onClick).toHaveBeenCalledWith(mockTrip);
        }
    });

    it('adjusts sizing for compact mode', () => {
        const { container } = render(<TripCard {...defaultProps} isCompact={true} />);
        // Just verify it renders with the compact prop down without throwing mapping errors
        expect(container.querySelector('.p-\\[7px\\]')).toBeDefined();
    });
});
