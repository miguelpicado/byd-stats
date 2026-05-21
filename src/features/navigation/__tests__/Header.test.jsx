import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import Header from '../Header';

// Static spies and variables to ensure stability and control
const openModalSpy = vi.fn();
const setActiveCarIdSpy = vi.fn();
const addCarSpy = vi.fn();
const syncNowSpy = vi.fn();
const toggleFullscreenSpy = vi.fn();
let mockTrips = [];

// Mock dependencies
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key, options) => {
            if (key === 'header.trips') return `${options?.count || 0} trips`;
            return key;
        },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: () => { },
    },
}));

// Mock Contexts
vi.mock('../../../context/LayoutContext', () => ({
    useLayout: () => ({
        layoutMode: 'vertical',
        isFullscreenBYD: false,
        toggleFullscreen: toggleFullscreenSpy,
    }),
}));

vi.mock('../../../providers/DataProvider', () => ({
    useData: () => ({
        trips: mockTrips,
        openModal: openModalSpy,
        googleSync: { isAuthenticated: false, isSyncing: false, error: null, syncNow: syncNowSpy }
    }),
}));

vi.mock('../../../context/CarContext', () => ({
    useCar: () => ({
        cars: [],
        activeCar: { name: 'Test Car' },
        activeCarId: 'test',
        setActiveCarId: setActiveCarIdSpy,
        addCar: addCarSpy,
    }),
}));

vi.mock('../../../components/modals/AddCarModal', () => ({
    default: () => <div data-testid="add-car-modal" />
}));

describe('Header', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockTrips = [];
    });

    it('renders title and logo', () => {
        render(<Header />);
        expect(screen.getByText('Test Car')).toBeInTheDocument();
        expect(screen.getByAltText('BYD Logo')).toBeInTheDocument();
    });

    it('displays correct trip count', () => {
        mockTrips = [1, 2, 3];
        render(<Header />);
        expect(screen.getByText('3 trips')).toBeInTheDocument();
    });

    it('opens help modal when help button is clicked', () => {
        render(<Header />);

        const helpButton = screen.getByTitle('tooltips.help');
        fireEvent.click(helpButton);

        expect(openModalSpy).toHaveBeenCalledWith('help');
    });

    it('opens history modal when database button is clicked', () => {
        render(<Header />);

        const historyButton = screen.getByTitle('tooltips.history');
        fireEvent.click(historyButton);

        expect(openModalSpy).toHaveBeenCalledWith('history');
    });

    it('adapts layout based on layoutMode', () => {
        const { container } = render(<Header />);
        expect(container.firstChild).toBeInTheDocument();
    });
});
