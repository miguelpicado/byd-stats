import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TripDetailModal from '../TripDetailModal';

// Mock context dependencies
const mockCloseModal = vi.fn();
const mockSetSelectedTrip = vi.fn();
const mockShowConfirmation = vi.fn();

// Mock the context hooks directly
vi.mock('../../../context/AppContext', () => ({
    useApp: () => ({
        settings: {
            electricPrice: 0.15,
            fuelPrice: 1.50
        }
    }),
    AppProvider: ({ children }: any) => <>{children}</>
}));

vi.mock('../../../providers/DataProvider', () => ({
    useData: () => ({
        selectedTrip: {
            id: 'trip1',
            date: '20240101',
            start_timestamp: 1704100000,
            gpsDistanceKm: 50,
            trip: 48,
            duration: 3600, // 1 hour
            electricity: 10,
            fuel: 0,
            source: 'byd'
        },
        trips: [
            { id: 'trip1', gpsDistanceKm: 50, electricity: 10 },
            { id: 'trip2', gpsDistanceKm: 100, electricity: 15 }
        ],
        stats: {
            summary: {
                avgEff: 18,
                isHybrid: false
            }
        },
        closeModal: mockCloseModal,
        setSelectedTrip: mockSetSelectedTrip,
        showConfirmation: mockShowConfirmation,
        modals: { tripDetail: true } // Modal is open
    }),
    DataProvider: ({ children }: any) => <>{children}</>
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

// Mock sub-components that might lazy load or cause issues
vi.mock('../TripMapModal', () => ({
    TripMapModal: () => <div data-testid="mock-trip-map">Mocked Map</div>
}));

// Mock firebase
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    getDocs: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
    query: vi.fn(),
    orderBy: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
    deleteDoc: vi.fn(),
    initializeFirestore: vi.fn(),
    getFirestore: vi.fn(),
    persistentLocalCache: vi.fn(),
    persistentMultipleTabManager: vi.fn()
}));
vi.mock('../../services/firebase', () => ({
    db: {}
}));


describe('TripDetailModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Provide mock implementation for setSystemTime if we needed time dependent tests.
    });

    it('renders correctly when open', async () => {
        render(<TripDetailModal />);

        expect(await screen.findByText('tripDetail.title')).toBeInTheDocument();
        // Check for specific stats blocks
        expect(screen.getByText('stats.distance')).toBeInTheDocument();

        const textElements = screen.getAllByText((content) => content.includes('50.0'));
        expect(textElements.length).toBeGreaterThan(0);

        const textElements10 = screen.getAllByText((content) => content.includes('10.00'));
        expect(textElements10.length).toBeGreaterThan(0);
    });

    it('calculates efficiency and costs based on mocked data', async () => {
        render(<TripDetailModal />);

        // Wait for modal to load completely
        await screen.findByText('tripDetail.title');

        // Efficiency = 10kwh / 50km * 100 = 20 kWh/100km
        expect(screen.getByText('20.00')).toBeInTheDocument();

        // Check computed cost => 10 kWh * 0.15 = 1.50€
        expect(screen.getByText('1.50€')).toBeInTheDocument();

        // Percentile/Comparison: Avg is 18, efficiency 20 -> (20-18)/18 = +11.1%
        expect(screen.getByText('+11.1%')).toBeInTheDocument();
    });

    it('calls close handlers when clicking X button', async () => {
        render(<TripDetailModal />);

        // Wait for modal components
        await screen.findByRole('button', { name: 'Close trip detail' });

        const closeBtn = screen.getByRole('button', { name: 'Close trip detail' });

        fireEvent.click(closeBtn);

        expect(mockCloseModal).toHaveBeenCalledWith('tripDetail');
        expect(mockSetSelectedTrip).toHaveBeenCalledWith(null);
    });

    it('triggers hidden delete confirmation on 10 quick score clicks', async () => {
        render(<TripDetailModal />);

        // Wait for modal parts
        await screen.findByTitle('tripDetail.tapToDelete');

        // Find the score block. The text format is "8.0" or similar.
        const scoreBlock = screen.getByTitle('tripDetail.tapToDelete');

        // Click 10 times
        for (let i = 0; i < 10; i++) {
            fireEvent.click(scoreBlock);
        }

        // Should show confirmation dialog
        expect(await screen.findByText('tripDetail.confirmDeleteTitle')).toBeInTheDocument();
    });
});
