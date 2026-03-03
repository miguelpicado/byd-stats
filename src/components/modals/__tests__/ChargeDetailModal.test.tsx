import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChargeDetailModal from '../ChargeDetailModal';

// Mock context dependencies
const mockCloseModal = vi.fn();
const mockOpenModal = vi.fn();
const mockDeleteCharge = vi.fn();
const mockSetEditingCharge = vi.fn();
const mockSetSelectedCharge = vi.fn();

// Mock the context hooks directly
vi.mock('../../../context/AppContext', () => ({
    useApp: () => ({
        settings: {
            chargerTypes: [
                { id: 'home', name: 'Casa', efficiency: 0.9 }
            ]
        }
    }),
    AppProvider: ({ children }: any) => <>{children}</>
}));

vi.mock('../../../providers/DataProvider', () => ({
    useData: () => ({
        selectedCharge: {
            id: 'charge1',
            date: '2024-01-01',
            time: '14:00',
            kwhCharged: 50,
            totalCost: 10,
            chargerTypeId: 'home',
            odometer: 10500,
            pricePerKwh: 0.20,
            initialPercentage: 20,
            finalPercentage: 80,
            isSOCEstimated: false
        },
        charges: [
            { id: 'charge0', odometer: 10200 }, // Previous charge
            { id: 'charge1', odometer: 10500 }
        ],
        deleteCharge: mockDeleteCharge,
        setEditingCharge: mockSetEditingCharge,
        closeModal: mockCloseModal,
        openModal: mockOpenModal,
        setSelectedCharge: mockSetSelectedCharge,
        modals: { chargeDetail: true } // Modal is open
    }),
    DataProvider: ({ children }: any) => <>{children}</>
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

describe('ChargeDetailModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock window.confirm
        vi.stubGlobal('confirm', vi.fn(() => true));
    });

    it('renders correctly when open', () => {
        render(<ChargeDetailModal />);

        // Check if main elements are present
        expect(screen.getByText('charges.chargeDetail')).toBeInTheDocument();
        expect(screen.getByText('2024-01-01 • 14:00')).toBeInTheDocument();
        expect(screen.getByText('50.00')).toBeInTheDocument(); // kwh
        expect(screen.getByText('10.00')).toBeInTheDocument(); // cost
    });

    it('calculates real kwh and efficiency correctly', () => {
        render(<ChargeDetailModal />);

        // Charger efficiency is 0.9. 50 * 0.9 = 45 real kwh
        expect(screen.getByText('45.00')).toBeInTheDocument();

        // Distance between charge0 and charge1 is 300km.
        // Efficiency: (45 / 300) * 100 = 15 kWh/100km
        expect(screen.getByText('15.00')).toBeInTheDocument();
        expect(screen.getByText('300 km')).toBeInTheDocument(); // target distance visible
    });

    it('calls close handlers when clicking X button', () => {
        render(<ChargeDetailModal />);

        // We find the X button by its click handler or surrounding elements. 
        // It's the button inside the header.
        const headerButtons = screen.getAllByRole('button');
        const closeBtn = headerButtons[0]; // first button is typically close in this layout

        fireEvent.click(closeBtn);

        expect(mockCloseModal).toHaveBeenCalledWith('chargeDetail');
        expect(mockSetSelectedCharge).toHaveBeenCalledWith(null);
    });

    it('handles delete action correctly', () => {
        render(<ChargeDetailModal />);

        const deleteBtn = screen.getByText('charges.delete');
        fireEvent.click(deleteBtn);

        expect(window.confirm).toHaveBeenCalled();
        expect(mockDeleteCharge).toHaveBeenCalledWith('charge1');
        expect(mockCloseModal).toHaveBeenCalledWith('chargeDetail');
    });

    it('handles edit action correctly', () => {
        render(<ChargeDetailModal />);

        const editBtn = screen.getByText('charges.edit');
        fireEvent.click(editBtn);

        expect(mockSetEditingCharge).toHaveBeenCalled();
        expect(mockCloseModal).toHaveBeenCalledWith('chargeDetail');
        expect(mockOpenModal).toHaveBeenCalledWith('addCharge');
    });
});
