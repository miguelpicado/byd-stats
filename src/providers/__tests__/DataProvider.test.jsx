import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DataProvider, useData } from '../DataProvider';

// Mock all dependencies
vi.mock('@/context/AppContext', () => ({
    useApp: () => ({
        settings: {},
        updateSettings: vi.fn()
    })
}));

vi.mock('@/hooks/useAppData', () => ({
    default: () => ({
        rawTrips: [],
        setRawTrips: vi.fn(),
        tripHistory: [],
        filtered: [],
        data: {},
        clearData: vi.fn(),
        saveToHistory: vi.fn(),
        clearHistory: vi.fn(),
        loadFromHistory: vi.fn()
    })
}));

vi.mock('@/hooks/useChargesData', () => ({
    default: () => ({
        charges: [],
        replaceCharges: vi.fn()
    })
}));

vi.mock('@/hooks/useDatabase', () => ({
    useDatabase: () => ({
        sqlReady: true
    })
}));

vi.mock('@/hooks/useFileHandling', () => ({
    useFileHandling: () => ({})
}));

vi.mock('@/hooks/useGoogleSync', () => ({
    useGoogleSync: () => ({})
}));

vi.mock('@/hooks/useConfirmation', () => ({
    useConfirmation: () => ({
        clearData: vi.fn(),
        saveToHistory: vi.fn(),
        loadFromHistory: vi.fn(),
        clearHistory: vi.fn()
    })
}));

vi.mock('@/hooks/useModalState', () => ({
    default: () => ({})
}));

// Test Component to consume context
const TestComponent = () => {
    const data = useData();
    return (
        <div>
            <span data-testid="sql-status">{data.sqlReady ? 'Ready' : 'Not Ready'}</span>
        </div>
    );
};

describe('DataProvider', () => {
    it('provides data to children', () => {
        render(
            <DataProvider>
                <TestComponent />
            </DataProvider>
        );

        expect(screen.getByTestId('sql-status')).toHaveTextContent('Ready');
    });

    it('throws error if useData is used outside provider', () => {
        // Suppress console.error for this test
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        expect(() => render(<TestComponent />)).toThrow('useData must be used within a DataProvider');

        consoleSpy.mockRestore();
    });
});
