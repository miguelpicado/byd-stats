// BYD Stats - ChartCard Component Tests
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChartCard from '../ChartCard';

describe('ChartCard', () => {
    it('renders children content', () => {
        render(
            <ChartCard>
                <div data-testid="chart-content">Chart goes here</div>
            </ChartCard>
        );

        expect(screen.getByTestId('chart-content')).toBeInTheDocument();
        expect(screen.getByText('Chart goes here')).toBeInTheDocument();
    });

    it('renders title when provided', () => {
        render(
            <ChartCard title="Monthly Overview">
                <div>Chart</div>
            </ChartCard>
        );

        expect(screen.getByText('Monthly Overview')).toBeInTheDocument();
    });

    it('does not render title when not provided', () => {
        render(
            <ChartCard>
                <div>Chart</div>
            </ChartCard>
        );

        // Should not have any h3 elements
        const heading = document.querySelector('h3');
        expect(heading).toBeNull();
    });

    it('applies custom className', () => {
        const { container } = render(
            <ChartCard className="custom-class">
                <div>Chart</div>
            </ChartCard>
        );

        const card = container.firstChild;
        expect(card.className).toContain('custom-class');
    });

    it('applies compact styling when isCompact is true', () => {
        const { container } = render(
            <ChartCard isCompact={true}>
                <div>Chart</div>
            </ChartCard>
        );

        const card = container.firstChild;
        expect(card.className).toContain('p-2');
    });

    it('applies normal padding when isCompact is false', () => {
        const { container } = render(
            <ChartCard isCompact={false}>
                <div>Chart</div>
            </ChartCard>
        );

        const card = container.firstChild;
        expect(card.className).toContain('p-4');
    });

    it('has proper card styling classes', () => {
        const { container } = render(
            <ChartCard>
                <div>Chart</div>
            </ChartCard>
        );

        const card = container.firstChild;
        expect(card.className).toContain('bg-white');
        expect(card.className).toContain('dark:bg-slate-800/50');
        expect(card.className).toContain('rounded-2xl');
        expect(card.className).toContain('border');
    });

    it('title has correct styling based on compact mode', () => {
        const { rerender } = render(
            <ChartCard title="Test Title" isCompact={true}>
                <div>Chart</div>
            </ChartCard>
        );

        let heading = screen.getByText('Test Title');
        expect(heading.className).toContain('text-xs');

        rerender(
            <ChartCard title="Test Title" isCompact={false}>
                <div>Chart</div>
            </ChartCard>
        );

        heading = screen.getByText('Test Title');
        expect(heading.className).toContain('text-base');
    });

    it('handles complex children', () => {
        render(
            <ChartCard title="Complex Chart">
                <div>
                    <canvas data-testid="chart-canvas" />
                    <div className="legend">Legend here</div>
                </div>
            </ChartCard>
        );

        expect(screen.getByTestId('chart-canvas')).toBeInTheDocument();
        expect(screen.getByText('Legend here')).toBeInTheDocument();
    });
});


