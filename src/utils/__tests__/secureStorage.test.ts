import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { secureSet, secureGet, secureRemove } from '../secureStorage';

describe('secureStorage', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();

        // Mock crypto.subtle for testing
        // Creating a simple mock that adds a "prefix" instead of real encryption
        // just to verify the logic flow and localStorage prefixing
        const mockEncrypt = vi.fn().mockImplementation(async (_algo, _key, data: Uint8Array) => {
            return new Uint8Array(data).buffer;
        });

        const mockDecrypt = vi.fn().mockImplementation(async (_algo, _key, data: Uint8Array) => {
            return new Uint8Array(data).buffer;
        });

        // Mock getRandomValues
        const mockGetRandomValues = vi.fn().mockImplementation((arr: Uint8Array) => {
            arr.fill(1); // Fill with 1s for predictable "IV"
            return arr;
        });

        Object.defineProperty(global, 'crypto', {
            value: {
                getRandomValues: mockGetRandomValues,
                subtle: {
                    importKey: vi.fn().mockResolvedValue({ type: 'secret' }),
                    deriveKey: vi.fn().mockResolvedValue({ type: 'secret' }),
                    encrypt: mockEncrypt,
                    decrypt: mockDecrypt
                }
            },
            configurable: true
        });
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('secureSet stores encrypted data with sec_ prefix', async () => {
        await secureSet('testKey', 'testValue');

        expect(localStorage.getItem('sec_testKey')).toBeDefined();
        expect(localStorage.getItem('sec_testKey')).not.toBeNull();
        expect(localStorage.getItem('testKey')).toBeNull(); // Should not store original raw key
    });

    it('secureGet decrypts and returns original value', async () => {
        await secureSet('my_secret', 'hello_world');
        const retrieved = await secureGet('my_secret');

        expect(retrieved).toBe('hello_world');
    });

    it('secureGet returns null for non-existent key', async () => {
        const retrieved = await secureGet('non_existent');
        expect(retrieved).toBeNull();
    });

    it('secureGet migrates legacy unencrypted keys transparently', async () => {
        // Manually insert legacy unencrypted key
        localStorage.setItem('legacy_token', 'raw_value_123');

        const retrieved = await secureGet('legacy_token');
        expect(retrieved).toBe('raw_value_123');
    });

    it('secureRemove deletes both encrypted and legacy keys', async () => {
        // Setup both encrypted and legacy
        await secureSet('mixed_key', 'encrypted_val');
        localStorage.setItem('mixed_key', 'legacy_val');

        secureRemove('mixed_key');

        expect(localStorage.getItem('sec_mixed_key')).toBeNull();
        expect(localStorage.getItem('mixed_key')).toBeNull();
    });

    it('round-trip: set then get returns same value', async () => {
        const complexString = '{"token":"abc.123.xyz","expires":123456}';
        await secureSet('auth_data', complexString);

        const retrieved = await secureGet('auth_data');
        expect(retrieved).toBe(complexString);
    });

    it('encrypted value in localStorage is not readable as plaintext', async () => {
        await secureSet('secret_pass', 'my_password123');

        const rawStorageValue = localStorage.getItem('sec_secret_pass');
        expect(rawStorageValue).not.toContain('my_password123');
        expect(typeof rawStorageValue).toBe('string');
        // It's base64 encoded binary data
        expect(() => atob(rawStorageValue!)).not.toThrow();
    });

    it('falls back to raw localStorage if crypto.subtle is unavailable', async () => {
        // Remove subtle crypto entirely
        Object.defineProperty(global, 'crypto', {
            value: {},
            configurable: true
        });

        await secureSet('fallback_key', 'fallback_val');

        // It should have fallen back to raw storage
        expect(localStorage.getItem('sec_fallback_key')).toBeNull(); // Not encrypted
        expect(localStorage.getItem('fallback_key')).toBe('fallback_val'); // Raw saved

        const retrieved = await secureGet('fallback_key');
        expect(retrieved).toBe('fallback_val'); // Retrieved securely from fallback
    });
});
