import { Capacitor } from '@capacitor/core';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

/**
 * Secure wrapper around localStorage that obfuscates sensitive values.
 * Uses AES-GCM with a device-derived key to prevent casual token theft on Web.
 * On Native (Android/iOS), uses the hardware-backed secure Keystore/Keychain.
 */

const STORAGE_PREFIX = 'sec_';
const DEVICE_SALT_KEY = 'byd_device_salt';

let cryptoKey: CryptoKey | null = null;

function getOrCreateDeviceSalt(): string {
  let salt = localStorage.getItem(DEVICE_SALT_KEY);
  if (!salt) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    salt = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(DEVICE_SALT_KEY, salt);
  }
  return salt;
}

async function getKey(): Promise<CryptoKey> {
    if (cryptoKey) return cryptoKey;
    const encoder = new TextEncoder();
    const deviceSalt = getOrCreateDeviceSalt();
    const keyMaterial = encoder.encode('byd-stats-v2-' + deviceSalt);
    const salt = encoder.encode('byd-stats-salt-' + deviceSalt);
    
    const baseKey = await crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    cryptoKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256',
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
    return cryptoKey;
}

export async function secureSet(key: string, value: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
        try {
            await SecureStoragePlugin.set({ key, value });
            return;
        } catch (e) {
            console.error('[SecureStorage] Native set failed', e);
            // Fallback to web implementation if plugin fails
        }
    }

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
    if (Capacitor.isNativePlatform()) {
        try {
            const { value } = await SecureStoragePlugin.get({ key });
            return value;
        } catch (e) {
            // Item not found or error
        }
    }

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

export async function secureRemove(key: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
        try {
            await SecureStoragePlugin.remove({ key });
        } catch (e) {
            // Ignore error if item doesn't exist
        }
    }
    localStorage.removeItem(STORAGE_PREFIX + key);
    localStorage.removeItem(key); // Also remove legacy unencrypted
}
