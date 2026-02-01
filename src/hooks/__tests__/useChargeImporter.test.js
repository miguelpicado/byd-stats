import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChargeImporter } from '../useChargeImporter';
import { toast } from 'react-hot-toast';

// Mock dependencies
const mockT = vi.fn((key, params) => key + (params ? JSON.stringify(params) : ''));
const mockUpdateSettings = vi.fn();
const mockAddMultipleCharges = vi.fn();
const mockSyncNow = vi.fn();

vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT })
}));

vi.mock('@/context/AppContext', () => ({
    useApp: () => ({
        settings: {
            chargerTypes: [
                { id: 'home', name: 'Home Charger' }
            ]
        },
        updateSettings: mockUpdateSettings
    })
}));

vi.mock('@/providers/DataProvider', () => ({
    useData: () => ({
        addMultipleCharges: mockAddMultipleCharges,
        googleSync: {
            isAuthenticated: true,
            syncNow: mockSyncNow
        }
    })
}));

// No need to mock alert as we use toast now

describe('useChargeImporter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should load charges and create new charger types', async () => {
        const { result } = renderHook(() => useChargeImporter());

        // Mock File
        const csvContent =
            `Fecha,Km totales,kWh facturados,Importe total,Duracion,Tipo de carga,Precio/kWh,Porcentaje carga final
2025-01-20 14:30,10000,50.5,15.25,01:30,Super Charger,0.30,80
2025-01-21 18:00,10200,20.0,6.00,00:45,Home Charger,0.30,90`;

        const file = new File([csvContent], 'REGISTRO_CARGAS.csv', { type: 'text/csv' });

        // Simulate file reader text() promise
        file.text = () => Promise.resolve(csvContent);

        mockAddMultipleCharges.mockReturnValue(2);

        await act(async () => {
            await result.current.loadChargeRegistry(file);
        });

        // Verify correct charges were parsed
        expect(mockAddMultipleCharges).toHaveBeenCalledWith([
            expect.objectContaining({
                date: '2025-01-20',
                time: '14:30',
                kwhCharged: 50.5,
                chargerTypeId: expect.stringMatching(/^csv_\d+_\d+$/), // New ID generated
            }),
            expect.objectContaining({
                date: '2025-01-21',
                time: '18:00',
                kwhCharged: 20.0,
                chargerTypeId: 'home' // Existing ID matched
            })
        ]);

        // Verify settings update for new charger type
        expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({
            chargerTypes: expect.arrayContaining([
                expect.objectContaining({ name: 'Super Charger' })
            ])
        }));

        // Verify sync triggered
        expect(mockSyncNow).toHaveBeenCalled();

        // Verify toast shown
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('charges.chargesImported'));
    });

    it('should handle empty or invalid files', async () => {
        const { result } = renderHook(() => useChargeImporter());
        const file = new File([''], 'empty.csv', { type: 'text/csv' });
        file.text = () => Promise.resolve('');

        await act(async () => {
            await result.current.loadChargeRegistry(file);
        });

        expect(toast.error).toHaveBeenCalledWith('errors.noDataFound');
        expect(mockAddMultipleCharges).not.toHaveBeenCalled();
    });
});

