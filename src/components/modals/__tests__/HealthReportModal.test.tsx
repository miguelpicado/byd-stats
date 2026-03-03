import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HealthReportModal from '../HealthReportModal';
import { Anomaly } from '../../../services/AnomalyService';

const mockUpdateCar = vi.fn();
const mockOnClose = vi.fn();
const mockOnAcknowledge = vi.fn();

// Mock dependencies
vi.mock('../../../context/CarContext', () => ({
    useCar: () => ({
        activeCar: { vin: '12345678901234567', tires: { frontLeft: 2.5, frontRight: 2.5, backLeft: 2.5, backRight: 2.5 } },
        activeCarId: 'car1',
        updateCar: mockUpdateCar
    })
}));

vi.mock('@/context/LayoutContext', () => ({
    useLayout: () => ({
        isNative: false // Let's test non-native first to skip firestore sub
    })
}));

// Mock firestore
vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(),
    doc: vi.fn(),
    onSnapshot: vi.fn(() => vi.fn()), // returns unsubscribe func
    Timestamp: { now: vi.fn() }
}));

vi.mock('firebase/app', () => ({
    getApp: vi.fn()
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, _defaultText?: string) => key
    })
}));

vi.mock('../AlertHistoryModal', () => ({
    default: ({ isOpen }: { isOpen: boolean }) =>
        isOpen ? <div data-testid="mock-alert-history">Mocked History</div> : null
}));

describe('HealthReportModal', () => {

    const batteryAnomaly: Anomaly = {
        id: '1', title: 'High Temp', description: 'Battery too hot',
        severity: 'critical', type: 'battery', timestamp: 123456
    };

    const bmsCalibration: Anomaly = {
        id: 'bms_calibration', title: 'Calibrate Battery', description: 'Please charge to 100%',
        severity: 'info', type: 'battery', timestamp: 123456
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null if not open', () => {
        const { container } = render(
            <HealthReportModal isOpen={false} onClose={mockOnClose} anomalies={[]} />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('renders correctly when open with no anomalies', async () => {
        render(<HealthReportModal isOpen={true} onClose={mockOnClose} anomalies={[]} />);

        // Should indicate all systems normal
        expect(screen.getByText('health.allSystemsNormal')).toBeInTheDocument();

        // 4 Status Rows should display their "Ok" messages
        expect(screen.getByText('health.batteryOk')).toBeInTheDocument();
        expect(screen.getByText('health.drainOk')).toBeInTheDocument();
        expect(screen.getByText('health.chargingOk')).toBeInTheDocument();
        expect(screen.getByText('health.efficiencyOk')).toBeInTheDocument();
    });

    it('displays anomalies categorized correctly', async () => {
        render(<HealthReportModal isOpen={true} onClose={mockOnClose} anomalies={[batteryAnomaly, bmsCalibration]} />);

        // Should indicate anomalies detected
        expect(screen.getByText('health.anomaliesDetected')).toBeInTheDocument();

        // Should display the specific battery anomaly
        expect(screen.getByText('High Temp')).toBeInTheDocument();
        expect(screen.getByText('Battery too hot')).toBeInTheDocument();

        // Should display AI calibration block specifically since id === bms_calibration
        expect(screen.getByText('Calibrate Battery')).toBeInTheDocument();
        expect(screen.getByText('AI Insight')).toBeInTheDocument();
    });

    it('calls acknowledge handler when checking off an anomaly', async () => {
        render(
            <HealthReportModal
                isOpen={true}
                onClose={mockOnClose}
                anomalies={[batteryAnomaly]}
                onAcknowledge={mockOnAcknowledge}
            />
        );

        // Find the acknowledge button (check circle icon) inside the anomaly card
        const ackBtn = screen.getByTitle('common.dismiss');

        act(() => {
            fireEvent.click(ackBtn);
        });

        expect(mockOnAcknowledge).toHaveBeenCalledWith('1');
    });

    it('calls close handler when clicking close or backdrop', async () => {
        render(<HealthReportModal isOpen={true} onClose={mockOnClose} anomalies={[]} />);

        // Note: the header close button has no aria-label, wait let's just use first button
        const buttons = screen.getAllByRole('button');

        act(() => {
            fireEvent.click(buttons[0]); // Typically close button on header
        });

        expect(mockOnClose).toHaveBeenCalled();
    });

    it('opens history modal when clicking view history', async () => {
        render(<HealthReportModal isOpen={true} onClose={mockOnClose} anomalies={[]} historyAnomalies={[batteryAnomaly]} />);

        const historyBtn = screen.getByText('health.viewHistory');

        act(() => {
            fireEvent.click(historyBtn);
        });

        // We check for the mocked AlertHistoryModal presence
        expect(screen.getByTestId('mock-alert-history')).toBeInTheDocument();
    });
});
