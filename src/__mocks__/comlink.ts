import { vi } from 'vitest';

export const wrap = () => ({
    processData: vi.fn().mockResolvedValue({
        summary: {},
        monthly: [],
        daily: [],
        hourly: [],
        weekday: [],
        tripDist: [],
        effScatter: [],
        top: { km: [], kwh: [], dur: [], fuel: [] }
    })
});

export const expose = vi.fn();
