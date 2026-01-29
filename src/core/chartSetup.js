import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    RadialLinearScale,
    Title,
    Tooltip,
    Legend,
    Filler,
    TimeScale,
    LogarithmicScale
} from 'chart.js';

// Register all necessary components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    RadialLinearScale,
    Title,
    Tooltip,
    Legend,
    Filler,
    TimeScale,
    LogarithmicScale
);

// Custom plugin to prevent subpixel rounding issues from canceling animations
// This solves the compact mode animation issue where canvas width mismatches by 1px
const subpixelResizePlugin = {
    id: 'subpixelResizePlugin',

    // Intercept resize events before they trigger re-renders
    beforeInit(chart) {
        // Store the original resize function
        const originalResize = chart.resize.bind(chart);

        // Track initial mount time and dimensions
        chart._mountTime = Date.now();
        chart._firstResize = true;

        // Override resize function
        chart.resize = function(width, height) {
            const now = Date.now();
            const timeSinceMount = now - chart._mountTime;

            // During the first 300ms (animation period), ignore small resizes
            if (timeSinceMount < 300) {
                const currentWidth = chart.width || 0;
                const currentHeight = chart.height || 0;

                // Allow first resize to establish dimensions
                if (chart._firstResize) {
                    chart._firstResize = false;
                    return originalResize(width, height);
                }

                // Calculate dimension changes
                const widthDiff = Math.abs((width || currentWidth) - currentWidth);
                const heightDiff = Math.abs((height || currentHeight) - currentHeight);

                // Ignore resizes ≤2px during animation period
                // This prevents subpixel rounding (481px vs 482px) from canceling animations
                if (widthDiff <= 2 && heightDiff <= 2) {
                    return; // Suppress the resize
                }
            }

            // Allow all other resizes
            return originalResize(width, height);
        };
    }
};

// Register the plugin globally
ChartJS.register(subpixelResizePlugin);

// Global defaults
ChartJS.defaults.font.family = "'Inter', sans-serif";
ChartJS.defaults.color = '#64748b';
ChartJS.defaults.scale.grid.color = 'rgba(203, 213, 225, 0.3)'; // slate-300 with opacity
ChartJS.defaults.scale.grid.borderDash = [3, 3];
ChartJS.defaults.plugins.tooltip.backgroundColor = 'rgba(255, 255, 255, 0.95)';
ChartJS.defaults.plugins.tooltip.titleColor = '#0f172a';
ChartJS.defaults.plugins.tooltip.bodyColor = '#334155';
ChartJS.defaults.plugins.tooltip.borderColor = '#e2e8f0';
ChartJS.defaults.plugins.tooltip.borderWidth = 1;
ChartJS.defaults.plugins.tooltip.padding = 10;
ChartJS.defaults.plugins.tooltip.cornerRadius = 8;
ChartJS.defaults.plugins.tooltip.titleFont = { size: 13, weight: 'bold' };
ChartJS.defaults.plugins.tooltip.bodyFont = { size: 12 };
// Dark mode defaults will be handled by updating ChartJS.defaults dynamically or using CSS variables if possible,
// but typically Chart.js needs explicit colors. We might need a helper to update defaults on theme change.

