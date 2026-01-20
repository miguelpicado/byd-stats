// BYD Stats - TripCard Component Tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TripCard from '../TripCard';

// Mock i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key) => {
            const translations = {
                'stats.distance': 'Distance',
                'stats.efficiency': 'Efficiency',
                'tripDetail.consumption': 'Consumption'
            };
            return translations[key] || key;
        },
        i18n: {
            changeLanguage: () => new Promise(() => { }),
        }
    }),
    initReactI18next: {
        type: '3rdParty',
        init: () => { },
    }
}));

describe('TripCard', () => {
    const mockTrip = {
        trip: 25.5,
        electricity: 3.82,
        date: '2026-01-14',
        start_timestamp: 1705200000
    };

    const defaultProps = {
        trip: mockTrip,
        minEff: 12,
        maxEff: 20,
        onClick: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders trip data correctly', () => {
        render(<TripCard {...defaultProps} />);

        // Check distance
        expect(screen.getByText('25.5')).toBeInTheDocument();
        expect(screen.getByText('Distance')).toBeInTheDocument();

        // Check consumption
        expect(screen.getByText('3.82')).toBeInTheDocument();
        expect(screen.getByText('Consumption')).toBeInTheDocument();
    });

    it('calculates and displays efficiency', () => {
        render(<TripCard {...defaultProps} />);

        // Efficiency = (electricity / trip) * 100 = (3.82 / 25.5) * 100 ≈ 14.98
        expect(screen.getByText('14.98')).toBeInTheDocument();
        expect(screen.getByText('Efficiency')).toBeInTheDocument();
    });

    it('displays efficiency score', () => {
        render(<TripCard {...defaultProps} />);

        // Score should be between 0 and 10
        expect(screen.getByText('Score')).toBeInTheDocument();
        // The score value is calculated based on efficiency
    });

    it('calls onClick when clicked', () => {
        render(<TripCard {...defaultProps} />);

        const card = screen.getByText('25.5').closest('div[class*="cursor-pointer"]');
        fireEvent.click(card);

        expect(defaultProps.onClick).toHaveBeenCalledTimes(1);
        expect(defaultProps.onClick).toHaveBeenCalledWith(mockTrip);
    });

    it('applies compact styling when isCompact is true', () => {
        const { container } = render(<TripCard {...defaultProps} isCompact={true} />);

        const card = container.firstChild;
        expect(card.className).toContain('p-[7px]');
    });

    it('applies normal styling when isCompact is false', () => {
        const { container } = render(<TripCard {...defaultProps} isCompact={false} />);

        const card = container.firstChild;
        expect(card.className).toContain('p-3');
    });

    it('handles trip with zero distance gracefully', () => {
        const tripWithZeroDistance = {
            ...mockTrip,
            trip: 0
        };

        render(<TripCard {...defaultProps} trip={tripWithZeroDistance} />);

        // Should not crash, efficiency should be 0
        expect(screen.getByText('0.00')).toBeInTheDocument();
    });

    it('handles trip with null electricity gracefully', () => {
        const tripWithNullElectricity = {
            ...mockTrip,
            electricity: null
        };

        render(<TripCard {...defaultProps} trip={tripWithNullElectricity} />);

        // Should not crash
        expect(screen.getByText('Distance')).toBeInTheDocument();
    });

    it('has hover effect classes', () => {
        const { container } = render(<TripCard {...defaultProps} />);

        const card = container.firstChild;
        expect(card.className).toContain('hover:bg-slate-100');
        expect(card.className).toContain('cursor-pointer');
    });

    it('displays units correctly', () => {
        render(<TripCard {...defaultProps} />);

        expect(screen.getByText('km')).toBeInTheDocument();
        expect(screen.getByText('kWh')).toBeInTheDocument();
        expect(screen.getByText('kWh/100km')).toBeInTheDocument();
    });

    it('applies score color based on efficiency', () => {
        render(<TripCard {...defaultProps} />);

        // The score element should have inline color style
        const scoreElements = screen.getAllByText(/\d+\.\d/);
        const scoreElement = scoreElements.find(el => el.style.color);
        expect(scoreElement).toBeTruthy();
    });
});
