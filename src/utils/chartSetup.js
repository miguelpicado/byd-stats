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
    LogarithmicScale
);

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
ChartJS.defaults.plugins.tooltip.enabled = true; // Ensure tooltips are enabled
ChartJS.defaults.plugins.tooltip.titleFont = { size: 13, weight: 'bold' };
ChartJS.defaults.plugins.tooltip.bodyFont = { size: 12 };

// Animation defaults for smooth chart transitions
ChartJS.defaults.animation = {
    duration: 500,
    easing: 'easeOutQuart'
};
ChartJS.defaults.resizeDelay = 200; // Wait for layout to stabilize before rendering/animating

// Dark mode defaults...
