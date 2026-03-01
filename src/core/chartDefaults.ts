import type { ChartOptions, ScaleOptionsByType } from 'chart.js';

export const defaultGridConfig = {
    color: 'rgba(203, 213, 225, 0.3)',
    borderDash: [3, 3],
    drawBorder: false,
};

export const defaultTooltipConfig = {
    // Shared tooltip configuration can go here if needed in the future
};

export function createLineChartOptions(overrides?: Partial<ChartOptions<'line'>>): ChartOptions<'line'> {
    return {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: false },
            ...overrides?.plugins
        },
        elements: {
            line: { tension: 0.4 },
            point: { hitRadius: 20, hoverRadius: 6 },
            ...overrides?.elements
        },
        scales: {
            y: {
                ...(overrides?.scales?.y as ScaleOptionsByType<'linear'>)
            },
            x: {
                ...(overrides?.scales?.x as ScaleOptionsByType<'category'>)
            },
            ...overrides?.scales
        },
        ...overrides,
    };
}
