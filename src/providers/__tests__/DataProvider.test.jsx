import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { DataProvider, useData, useDataState, useDataDispatch } from '../DataProvider';

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
    useConfirmation: () => ({})
}));

vi.mock('@/hooks/useModalState', () => ({
    default: () => ({
        modals: {},
        openModal: vi.fn(),
        closeModal: vi.fn()
    })
}));

vi.mock('@/context/CarContext', () => ({
    useCar: () => ({
        activeCarId: 'test',
        cars: [],
        updateCar: vi.fn()
    })
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key) => key,
        i18n: {
            changeLanguage: () => Promise.resolve(),
            language: 'en'
        }
    }),
    initReactI18next: {
        type: '3rdParty',
        init: () => { }
    }
}));

describe('DataProvider', () => {
    const wrapper = ({ children }) => <DataProvider>{children}</DataProvider>;

    it('provides data via useDataState', () => {
        const { result } = renderHook(() => useDataState(), { wrapper });
        expect(result.current).toBeDefined();
        expect(result.current.database.sqlReady).toBe(true);
    });

    it('provides actions via useDataDispatch', () => {
        const { result } = renderHook(() => useDataDispatch(), { wrapper });
        expect(result.current).toBeDefined();
        expect(typeof result.current.openModal).toBe('function');
    });

    it('provides unified data via useData', () => {
        const { result } = renderHook(() => useData(), { wrapper });
        expect(result.current.database.sqlReady).toBe(true);
        expect(typeof result.current.openModal).toBe('function');
    });

    it('throws error if used outside provider', () => {
        // Suppress console.error as React will log the error even if we catch it
        vi.spyOn(console, 'error').mockImplementation(() => { });

        expect(() => renderHook(() => useData())).toThrow(/must be used within a DataProvider/);
        expect(() => renderHook(() => useDataState())).toThrow(/must be used within a DataProvider/);
        expect(() => renderHook(() => useDataDispatch())).toThrow(/must be used within a DataProvider/);
    });
});
