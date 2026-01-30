// BYD Stats - Test Setup
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key) => key,
        i18n: {
            changeLanguage: () => Promise.resolve(),
            language: 'es',
        },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: () => { },
    },
}));

// Mock Chart.js using React.createElement instead of JSX
vi.mock('react-chartjs-2', () => ({
    Bar: () => React.createElement('div', { 'data-testid': 'mock-bar-chart' }),
    Line: () => React.createElement('div', { 'data-testid': 'mock-line-chart' }),
    Pie: () => React.createElement('div', { 'data-testid': 'mock-pie-chart' }),
    Radar: () => React.createElement('div', { 'data-testid': 'mock-radar-chart' }),
    Scatter: () => React.createElement('div', { 'data-testid': 'mock-scatter-chart' }),
    Doughnut: () => React.createElement('div', { 'data-testid': 'mock-doughnut-chart' }),
}));

// Mock ResizeObserver which is often missing in JSDOM
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        loading: vi.fn(),
        dismiss: vi.fn(),
    },
    default: {
        success: vi.fn(),
        error: vi.fn(),
        loading: vi.fn(),
        dismiss: vi.fn(),
    }
}));

// Mock matchMedia
if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(), // deprecated
            removeListener: vi.fn(), // deprecated
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
}

// Mock scrollIntoView
if (typeof window !== 'undefined' && window.HTMLElement) {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
}
