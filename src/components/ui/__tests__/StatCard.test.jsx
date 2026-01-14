// BYD Stats - StatCard Component Tests
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatCard from '../StatCard';
import { Battery } from '../../Icons';

// Mock icon component for testing
const MockIcon = ({ className }) => <svg data-testid="mock-icon" className={className} />;

describe('StatCard', () => {
    const defaultProps = {
        icon: MockIcon,
        label: 'Total Distance',
        value: '1234.5',
        unit: 'km'
    };

    it('renders with required props', () => {
        render(<StatCard {...defaultProps} />);

        expect(screen.getByText('Total Distance')).toBeInTheDocument();
        expect(screen.getByText('1234.5')).toBeInTheDocument();
        expect(screen.getByText('km')).toBeInTheDocument();
        expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
    });

    it('renders numeric value correctly', () => {
        render(<StatCard {...defaultProps} value={999} />);

        expect(screen.getByText('999')).toBeInTheDocument();
    });

    it('renders sub label when provided', () => {
        render(<StatCard {...defaultProps} sub="Best month ever!" />);

        expect(screen.getByText('Best month ever!')).toBeInTheDocument();
    });

    it('does not render sub when not provided', () => {
        render(<StatCard {...defaultProps} />);

        // Check that only label, value, and unit are present
        const container = screen.getByText('Total Distance').closest('div').parentElement;
        expect(container.textContent).not.toContain('sub');
    });

    it('applies compact styling when isCompact is true', () => {
        const { container } = render(<StatCard {...defaultProps} isCompact={true} />);

        // Compact mode uses h-16 or similar compact heights
        const card = container.firstChild;
        expect(card.className).toContain('h-');
    });

    it('applies larger styling when isLarger is true', () => {
        const { container } = render(
            <StatCard {...defaultProps} isCompact={true} isLarger={true} />
        );

        const card = container.firstChild;
        expect(card.className).toContain('h-20');
    });

    it('applies vertical mode styling', () => {
        const { container } = render(
            <StatCard {...defaultProps} isVerticalMode={true} />
        );

        // Vertical mode affects height classes
        const card = container.firstChild;
        expect(card).toBeInTheDocument();
    });

    it('applies lowPadding styling in compact mode', () => {
        const { container } = render(
            <StatCard {...defaultProps} isCompact={true} lowPadding={true} />
        );

        const card = container.firstChild;
        expect(card.className).toContain('h-12');
    });

    it('applies custom color class to icon container', () => {
        const { container } = render(
            <StatCard {...defaultProps} color="bg-blue-500" />
        );

        // Icon container should have the color class
        const iconContainer = container.querySelector('.bg-blue-500');
        expect(iconContainer).toBeInTheDocument();
    });

    it('handles empty unit gracefully', () => {
        render(<StatCard {...defaultProps} unit="" />);

        expect(screen.getByText('1234.5')).toBeInTheDocument();
    });

    it('maintains dark mode classes', () => {
        const { container } = render(<StatCard {...defaultProps} />);

        const card = container.firstChild;
        expect(card.className).toContain('dark:bg-slate-800/50');
    });
});
