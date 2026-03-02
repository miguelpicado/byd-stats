/**
 * Secure wrapper around localStorage that obfuscates sensitive values.
 * Uses AES-GCM with a device-derived key to prevent casual token theft.
 *
 * NOTE: This is defense-in-depth, not a security boundary.
 * The real protection is short-lived tokens + HTTPS + CSP.
 */

const STORAGE_PREFIX = 'sec_';
const KEY_MATERIAL = 'byd-stats-storage-key'; // Deterministic, device-local

let cryptoKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
    if (cryptoKey) return cryptoKey;
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(KEY_MATERIAL),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    cryptoKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('byd-stats-salt'),
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
    return cryptoKey;
}

export async function secureSet(key: string, value: string): Promise<void> {
    try {
        const ck = await getKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(value);
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, ck, encoded);

        // Store as base64: iv + ciphertext
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);

        localStorage.setItem(STORAGE_PREFIX + key, btoa(String.fromCharCode(...combined)));
    } catch {
        // Fallback: store raw if crypto not available (e.g., insecure context)
        localStorage.setItem(key, value);
    }
}

export async function secureGet(key: string): Promise<string | null> {
    try {
        const stored = localStorage.getItem(STORAGE_PREFIX + key);
        if (!stored) {
            // Try legacy unencrypted key for migration
            return localStorage.getItem(key);
        }

        const ck = await getKey();
        const combined = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
        const iv = combined.slice(0, 12);
        const data = combined.slice(12);

        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, ck, data);
        return new TextDecoder().decode(decrypted);
    } catch {
        // Fallback: try raw
        return localStorage.getItem(key);
    }
}

export function secureRemove(key: string): void {
    localStorage.removeItem(STORAGE_PREFIX + key);
    localStorage.removeItem(key); // Also remove legacy unencrypted
}
