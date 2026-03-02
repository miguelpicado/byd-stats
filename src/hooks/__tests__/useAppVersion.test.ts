import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useAppVersion from '../useAppVersion';

const CACHE_KEY = 'byd_app_version';
const CACHE_EXPIRY_KEY = 'byd_app_version_expiry';
const CACHE_DURATION = 24 * 60 * 60 * 1000;
const FALLBACK_VERSION = 'v1.6.0';

describe('useAppVersion', () => {
    beforeEach(() => {
        // Clear mocks and local storage before each test
        vi.clearAllMocks();
        localStorage.clear();

        // Mock global fetch
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns default version while loading', async () => {
        // Return an unresolved promise to keep it loading
        (global.fetch as any).mockImplementationOnce(() => new Promise(() => { }));

        const { result } = renderHook(() => useAppVersion());

        expect(result.current.version).toBe(FALLBACK_VERSION);
        expect(result.current.isLoading).toBe(true);
    });

    it('fetches latest release from GitHub API on mount', async () => {
        const mockResponse = { tag_name: 'v2.0.0' };
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
        });

        const { result } = renderHook(() => useAppVersion());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(global.fetch).toHaveBeenCalledWith(
            'https://api.github.com/repos/miguelpicado/byd-stats/releases/latest',
            expect.objectContaining({
                headers: { 'Accept': 'application/vnd.github.v3+json' }
            })
        );
        expect(result.current.version).toBe('v2.0.0');
    });

    it('caches result in localStorage with expiry timestamp', async () => {
        const mockResponse = { tag_name: 'v2.0.0' };
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
        });

        const now = 1600000000000;
        vi.spyOn(Date, 'now').mockReturnValue(now);

        const { result } = renderHook(() => useAppVersion());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(localStorage.getItem(CACHE_KEY)).toBe('v2.0.0');
        expect(localStorage.getItem(CACHE_EXPIRY_KEY)).toBe((now + CACHE_DURATION).toString());
    });

    it('returns cached version without fetch when cache is fresh (<24h)', async () => {
        const now = 1600000000000;
        vi.spyOn(Date, 'now').mockReturnValue(now);

        localStorage.setItem(CACHE_KEY, 'v2.5.0');
        localStorage.setItem(CACHE_EXPIRY_KEY, (now + 1000).toString());

        const { result } = renderHook(() => useAppVersion());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(global.fetch).not.toHaveBeenCalled();
        expect(result.current.version).toBe('v2.5.0');
    });

    it('fetches again when cache is expired (>24h)', async () => {
        const now = 1600000000000;
        vi.spyOn(Date, 'now').mockReturnValue(now);

        localStorage.setItem(CACHE_KEY, 'v1.0.0');
        localStorage.setItem(CACHE_EXPIRY_KEY, (now - 1000).toString()); // Expired

        const mockResponse = { tag_name: 'v2.0.0' };
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
        });

        const { result } = renderHook(() => useAppVersion());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(global.fetch).toHaveBeenCalled();
        expect(result.current.version).toBe('v2.0.0');
    });

    it('returns cached version on fetch error', async () => {
        localStorage.setItem(CACHE_KEY, 'v1.5.0');
        // No expiry to simulate old cache where we try to fetch but fail

        (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

        const { result } = renderHook(() => useAppVersion());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.version).toBe('v1.5.0');
    });

    it('returns default version when no cache and fetch fails', async () => {
        (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

        const { result } = renderHook(() => useAppVersion());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.version).toBe(FALLBACK_VERSION);
    });
});
