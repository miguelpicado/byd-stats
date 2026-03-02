import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { googleDriveService, invalidateCache } from '../googleDrive';

// Helper for fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('googleDriveService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        invalidateCache();
        googleDriveService.setAccessToken('test-token');
        googleDriveService.setOnUnauthorized(vi.fn());
    });

    afterEach(() => {
        invalidateCache();
        googleDriveService.setAccessToken(null);
    });

    describe('auth & initialization', () => {
        it('isSignedIn returns true when token is set', () => {
            expect(googleDriveService.isSignedIn()).toBe(true);
        });

        it('signOut clears token and cache', async () => {
            await googleDriveService.signOut();
            expect(googleDriveService.isSignedIn()).toBe(false);
        });

        it('throws if trying to make request without token', () => {
            googleDriveService.setAccessToken(null);
            expect(() => googleDriveService._getHeaders()).toThrow('No access token set');
        });
    });

    describe('_handleResponse', () => {
        it('throws and clears token on 401 Unauthorized', async () => {
            const mockUnauthorizedCallback = vi.fn();
            googleDriveService.setOnUnauthorized(mockUnauthorizedCallback);

            const mockResponse = { status: 401, statusText: 'Unauthorized' } as Response;

            await expect(googleDriveService._handleResponse(mockResponse, 'test')).rejects.toThrow('Google session expired');

            expect(googleDriveService.isSignedIn()).toBe(false);
            expect(mockUnauthorizedCallback).toHaveBeenCalled();
        });

        it('throws error with details on non-ok response', async () => {
            const mockResponse = {
                status: 500,
                statusText: 'Internal Server Error',
                ok: false,
                text: vi.fn().mockResolvedValue('Server exploded')
            } as unknown as Response;

            await expect(googleDriveService._handleResponse(mockResponse, 'testing limit')).rejects.toThrow('Error during testing limit: 500 Internal Server Error - Server exploded');
        });

        it('returns response if ok', async () => {
            const mockResponse = { ok: true, status: 200 } as Response;
            const res = await googleDriveService._handleResponse(mockResponse, 'test');
            expect(res).toBe(mockResponse);
        });
    });

    describe('cache and listFiles', () => {
        const mockFilesResponse = {
            files: [{ id: '1', name: 'byd_stats_data.json', modifiedTime: '2023-10-15T00:00:00.000Z' }]
        };

        beforeEach(() => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue(mockFilesResponse)
            });
        });

        it('returns cached file list when TTL not expired', async () => {
            // First call hits API
            await googleDriveService.listFiles();
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Second call hits cache
            const files = await googleDriveService.listFiles();
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(files).toEqual(mockFilesResponse.files);
        });

        it('fetches fresh list when forceRefresh is true', async () => {
            // First call
            await googleDriveService.listFiles();
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Force refresh call
            await googleDriveService.listFiles(undefined, { forceRefresh: true });
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('invalidates cache correctly', async () => {
            await googleDriveService.listFiles();
            invalidateCache(); // Or invalidateCache('listFiles')
            await googleDriveService.listFiles();

            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('downloadFile', () => {
        it('parses JSON response correctly', async () => {
            const mockSyncData = {
                trips: [{ id: 'trip1' }],
                settings: { someSetting: true },
                charges: [{ id: 'charge1' }]
            };

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue(mockSyncData)
            });

            const data = await googleDriveService.downloadFile('file_id_1');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/files/file_id_1?alt=media'),
                expect.objectContaining({ headers: expect.objectContaining({ 'Authorization': 'Bearer test-token' }) })
            );
            expect(data).toEqual(mockSyncData);
        });

        it('handles array fallback format', async () => {
            const mockOldData = [{ id: 'legacyTrip1' }];

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue(mockOldData)
            });

            const data = await googleDriveService.downloadFile('file_id_old');

            expect(data.trips).toEqual(mockOldData);
            expect(data.settings).toEqual({});
            expect(data.charges).toEqual([]);
        });
    });

    describe('uploadFile', () => {
        it('creates new file when no fileId is provided', async () => {
            // Mock Create Metadata Call
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue({ id: 'new_file_id' })
            });

            // Mock Upload Content Call
            const finalMockResponse = { id: 'new_file_id', name: 'byd_stats_data.json' };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue(finalMockResponse)
            });

            const dummyData = { trips: [], settings: {}, charges: [] } as any;
            const res = await googleDriveService.uploadFile(dummyData);

            expect(mockFetch).toHaveBeenCalledTimes(2);
            // 1st request should be POST (create metadata)
            expect(mockFetch.mock.calls[0][1].method).toBe('POST');
            // 2nd request should be PATCH with the ID returned from POST
            expect(mockFetch.mock.calls[1][0]).toContain('/files/new_file_id');
            expect(mockFetch.mock.calls[1][1].method).toBe('PATCH');

            expect(res).toEqual(finalMockResponse);
        });

        it('updates existing file when fileId is provided', async () => {
            const finalMockResponse = { id: 'existing_file_id', name: 'byd_stats_data.json' };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue(finalMockResponse)
            });

            const dummyData = { trips: [], settings: {}, charges: [] } as any;
            const res = await googleDriveService.uploadFile(dummyData, 'existing_file_id');

            // Only 1 call if file ID is provided
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch.mock.calls[0][0]).toContain('/files/existing_file_id');
            expect(mockFetch.mock.calls[0][1].method).toBe('PATCH');
            expect(res).toEqual(finalMockResponse);
        });
    });

    describe('mergeData', () => {
        it('merges trips by deduplicating on date + start_timestamp', () => {
            const local = {
                trips: [{ id: '1', date: '20231001', start_timestamp: 1000, trip: 10 }],
                settings: {},
                charges: []
            } as any;

            const remote = {
                trips: [
                    { id: '1_remote', date: '20231001', start_timestamp: 1000, trip: 10 }, // Duplicate date/ts
                    { id: '2', date: '20231002', start_timestamp: 2000, trip: 20 }
                ],
                settings: {},
                charges: []
            } as any;

            const merged = googleDriveService.mergeData(local, remote);

            // Should keep 2 distinct trips. Remote is first mapped, then local overwrites the first.
            expect(merged.trips).toHaveLength(2);
            // Result trips are sorted by date
            expect(merged.trips[0].id).toBe('1'); // Local takes precedence over remote when same date/ts 
            expect(merged.trips[1].id).toBe('2');
        });

        it('merges settings, non-default wins', () => {
            const local = {
                trips: [], charges: [],
                settings: {
                    someGenericValue: 90, // Not default
                    odometerOffset: 0 // Default
                }
            } as any;

            const remote = {
                trips: [], charges: [],
                settings: {
                    someGenericValue: 100,
                    odometerOffset: 1500 // Not default
                }
            } as any;

            const merged = googleDriveService.mergeData(local, remote);

            // someGenericValue: both non-default -> local takes precedence
            // odometerOffset: remote non-default, local default -> remote wins
            expect((merged.settings as any).someGenericValue).toBe(90);
            expect(merged.settings.odometerOffset).toBe(1500);
        });

        it('merges AI Cache keeping the one with more training samples', () => {
            const local = {
                trips: [], charges: [], settings: {},
                aiCache: {
                    efficiency: { hash: 'count:100|hash_xyz' }
                }
            } as any;

            const remote = {
                trips: [], charges: [], settings: {},
                aiCache: {
                    efficiency: { hash: 'count:150|hash_abc' }
                }
            } as any;

            const merged = googleDriveService.mergeData(local, remote);

            // Remote has 150 count, local has 100
            expect(merged.aiCache?.efficiency?.hash).toBe('count:150|hash_abc');
        });
    });
});
