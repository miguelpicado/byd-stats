/**
 * Tests for bydFunctions.ts
 *
 * Strategy:
 * - `onCall` is mocked to return the raw handler (strips Firebase wrapper)
 * - `firebase-admin` Firestore is mocked with a controllable chain
 * - `HttpsError` is a real class so `rejects.toMatchObject` works on thrown errors
 * - All BYD API and Google Maps calls are mocked to avoid network activity
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks (available inside vi.mock factories) ────────────────────────

const { MockHttpsError, mockVehicleDocGet, mockVehicleDocUpdate, mockCredDocDelete, mockBatchCommit, mockDb } =
    vi.hoisted(() => {
        class MockHttpsError extends Error {
            code: string;
            constructor(code: string, message: string) {
                super(message);
                this.code = code;
                this.name = 'HttpsError';
            }
        }

        const mockVehicleDocGet = vi.fn();
        const mockVehicleDocUpdate = vi.fn().mockResolvedValue(undefined);
        const mockCredDocDelete = vi.fn().mockResolvedValue(undefined);
        const mockCredDocSet = vi.fn().mockResolvedValue(undefined);
        const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

        // Credentials subcollection doc
        const mockCredDoc = {
            get: vi.fn(),
            set: mockCredDocSet,
            delete: mockCredDocDelete,
        };

        // Vehicle doc: get + update + subcollection
        const mockVehicleDoc = {
            get: mockVehicleDocGet,
            update: mockVehicleDocUpdate,
            collection: vi.fn(() => ({ doc: vi.fn(() => mockCredDoc) })),
        };

        // Batch used in bydConnectV2
        const mockBatch = {
            set: vi.fn(),
            commit: mockBatchCommit,
        };

        // Rate limit doc — returned for collection('rateLimits')
        // Returns a non-existent doc so checkRateLimit initialises a fresh window
        const mockRateLimitDoc = {
            get: vi.fn().mockResolvedValue({ data: () => null }),
            set: vi.fn().mockResolvedValue(undefined),
            update: vi.fn().mockResolvedValue(undefined),
        };

        const mockTransaction = {
            get: vi.fn().mockResolvedValue({ data: () => null }),
            update: vi.fn(),
            set: vi.fn()
        };

        const mockDb = {
            collection: vi.fn().mockImplementation((name: string) => {
                if (name === 'rateLimits') {
                    return { doc: vi.fn(() => mockRateLimitDoc) };
                }
                return { doc: vi.fn(() => mockVehicleDoc) };
            }),
            batch: vi.fn(() => mockBatch),
            runTransaction: vi.fn(async (cb) => cb(mockTransaction)),
        };

        return {
            MockHttpsError,
            mockVehicleDocGet,
            mockVehicleDocUpdate,
            mockCredDocDelete,
            mockBatchCommit,
            mockDb,
        };
    });

// ─── Module mocks (hoisted before imports) ────────────────────────────────────

vi.mock('firebase-admin', () => ({
    initializeApp: vi.fn(),
    firestore: Object.assign(vi.fn(() => mockDb), {
        Timestamp: {
            now: vi.fn(() => ({ seconds: 0, nanoseconds: 0 })),
        },
    }),
}));

vi.mock('firebase-functions/v2/https', () => ({
    // Strip the onCall wrapper — expose the raw handler for direct testing
    onCall: (_opts: unknown, handler: unknown) => handler,
    onRequest: (_opts: unknown, handler: unknown) => handler,
    HttpsError: MockHttpsError,
}));

vi.mock('firebase-functions/v2/scheduler', () => ({
    onSchedule: vi.fn(() => () => { }),
}));

vi.mock('../byd', () => ({
    BydClient: vi.fn(),
    initBydModule: vi.fn(),
    BydRealtime: {},
    BydGps: {},
    BydCharging: {},
}));

vi.mock('../googleMaps', () => ({
    snapToRoads: vi.fn(),
    calculatePathDistanceKm: vi.fn(),
}));

// ─── Import functions AFTER mocks are set up ──────────────────────────────────
// With vi.mock hoisting this import sees the mocked modules.
import { bydConnectV2, bydDisconnectV2 } from '../bydFunctions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal authenticated CallableRequest */
const authRequest = (data: Record<string, unknown> = {}, uid = 'user-1') => ({
    auth: { uid, token: {} },
    data,
    rawRequest: {},
});

/** CallableRequest without auth */
const unauthRequest = (data: Record<string, unknown> = {}) => ({
    auth: undefined,
    data,
    rawRequest: {},
});

// ─── requireAuth (tested via bydConnectV2) ────────────────────────────────────

describe('requireAuth', () => {
    it('throws unauthenticated when request has no auth', async () => {
        await expect(
            (bydConnectV2 as Function)(unauthRequest())
        ).rejects.toMatchObject({
            code: 'unauthenticated',
            message: 'Authentication required',
        });
    });

    it('does not throw unauthenticated when request has valid auth', async () => {
        // Auth passes but validation of missing fields throws invalid-argument, not unauthenticated
        const error = await (bydConnectV2 as Function)(
            authRequest({ username: '', password: '', countryCode: '', userId: '' })
        ).catch((e: MockHttpsError) => e);

        expect(error.code).not.toBe('unauthenticated');
    });
});

// ─── Input validation (bydConnectV2) ──────────────────────────────────────────

describe('bydConnectV2 — input validation', () => {
    it('throws invalid-argument when username is missing', async () => {
        await expect(
            (bydConnectV2 as Function)(authRequest({ password: 'pw', countryCode: 'ES', userId: 'u1' }))
        ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('throws invalid-argument when password is missing', async () => {
        await expect(
            (bydConnectV2 as Function)(authRequest({ username: 'user', countryCode: 'ES', userId: 'u1' }))
        ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('throws invalid-argument when countryCode is missing', async () => {
        await expect(
            (bydConnectV2 as Function)(authRequest({ username: 'user', password: 'pw', userId: 'u1' }))
        ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('throws invalid-argument when userId is missing', async () => {
        await expect(
            (bydConnectV2 as Function)(authRequest({ username: 'user', password: 'pw', countryCode: 'ES' }))
        ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('error message lists the missing required fields', async () => {
        const error = await (bydConnectV2 as Function)(authRequest({})).catch((e: MockHttpsError) => e);
        expect(error.message).toContain('username');
        expect(error.message).toContain('password');
        expect(error.message).toContain('countryCode');
        expect(error.message).toContain('userId');
    });
});

// ─── bydDisconnectV2 — input validation ───────────────────────────────────────

describe('bydDisconnectV2 — input validation', () => {
    it('throws invalid-argument when vin is missing', async () => {
        await expect(
            (bydDisconnectV2 as Function)(authRequest({}))
        ).rejects.toMatchObject({
            code: 'invalid-argument',
            message: 'Missing VIN',
        });
    });

    it('throws invalid-argument when vin is an empty string', async () => {
        await expect(
            (bydDisconnectV2 as Function)(authRequest({ vin: '' }))
        ).rejects.toMatchObject({ code: 'invalid-argument' });
    });
});

// ─── requireAuthAndOwnership (tested via bydDisconnectV2) ────────────────────

describe('requireAuthAndOwnership', () => {
    const VIN = 'LFCE10B33PA123456';

    beforeEach(() => {
        vi.clearAllMocks();
        mockVehicleDocUpdate.mockResolvedValue(undefined);
        mockCredDocDelete.mockResolvedValue(undefined);
    });

    it('throws unauthenticated when request has no auth', async () => {
        await expect(
            (bydDisconnectV2 as Function)(unauthRequest({ vin: VIN }))
        ).rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('throws not-found when vehicle does not exist in Firestore', async () => {
        mockVehicleDocGet.mockResolvedValue({ exists: false });

        await expect(
            (bydDisconnectV2 as Function)(authRequest({ vin: VIN }))
        ).rejects.toMatchObject({
            code: 'not-found',
            message: expect.stringContaining(VIN),
        });
    });

    it('throws permission-denied when user does not own the vehicle', async () => {
        mockVehicleDocGet.mockResolvedValue({
            exists: true,
            data: () => ({ userId: 'someone-else' }),
        });

        await expect(
            (bydDisconnectV2 as Function)(authRequest({ vin: VIN }, 'user-1'))
        ).rejects.toMatchObject({
            code: 'permission-denied',
            message: 'You do not own this vehicle',
        });
    });

    it('succeeds when the authenticated user owns the vehicle', async () => {
        mockVehicleDocGet.mockResolvedValue({
            exists: true,
            data: () => ({ userId: 'user-1' }),
        });

        const result = await (bydDisconnectV2 as Function)(authRequest({ vin: VIN }, 'user-1'));
        expect(result).toEqual({ success: true });
    });

    it('calls delete on the credentials subcollection on successful disconnect', async () => {
        mockVehicleDocGet.mockResolvedValue({
            exists: true,
            data: () => ({ userId: 'user-1' }),
        });

        await (bydDisconnectV2 as Function)(authRequest({ vin: VIN }, 'user-1'));

        expect(mockCredDocDelete).toHaveBeenCalledTimes(1);
    });

    it('calls update on the vehicle doc with disconnectedAt on success', async () => {
        mockVehicleDocGet.mockResolvedValue({
            exists: true,
            data: () => ({ userId: 'user-1' }),
        });

        await (bydDisconnectV2 as Function)(authRequest({ vin: VIN }, 'user-1'));

        expect(mockVehicleDocUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ disconnectedAt: expect.anything() })
        );
    });
});
