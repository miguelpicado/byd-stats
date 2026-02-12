/**
 * BYD API Crypto Module
 * Ported from pyBYD (https://github.com/jkaberg/pyBYD)
 */

import * as crypto from 'crypto';

// =============================================================================
// MD5 & SHA1 HASHING
// =============================================================================

/**
 * Compute MD5 hash of a string, returns uppercase hex
 */
export function md5Hex(input: string): string {
    return crypto.createHash('md5').update(input, 'utf8').digest('hex').toUpperCase();
}

/**
 * Compute SHA1 with special mixed-case formatting
 * Each byte is converted to hex with alternating case (even=upper, odd=lower)
 * Then removes '0' characters at even positions
 */
export function sha1Mixed(input: string): string {
    const digest = crypto.createHash('sha1').update(input, 'utf8').digest();

    // Convert to hex with alternating case
    let hex = '';
    for (let i = 0; i < digest.length; i++) {
        const byte = digest[i];
        const high = (byte >> 4).toString(16);
        const low = (byte & 0x0f).toString(16);
        // Even position = uppercase, odd position = lowercase
        hex += (i * 2 % 2 === 0) ? high.toUpperCase() : high.toLowerCase();
        hex += ((i * 2 + 1) % 2 === 0) ? low.toUpperCase() : low.toLowerCase();
    }

    // Filter out '0' at even positions
    let result = '';
    for (let i = 0; i < hex.length; i++) {
        if (i % 2 === 0 && hex[i] === '0') {
            continue;
        }
        result += hex[i];
    }

    return result;
}

/**
 * Derive login AES key from password: md5(md5(password))
 */
export function pwdLoginKey(password: string): string {
    return md5Hex(md5Hex(password));
}

/**
 * Compute checkcode from JSON payload
 * MD5 of compact JSON, then reorder: [24:32][8:16][16:24][0:8]
 */
export function computeCheckcode(payload: object): string {
    const json = JSON.stringify(payload);
    const hash = md5Hex(json);

    // Reorder: positions 24-32, 8-16, 16-24, 0-8
    return hash.slice(24, 32) + hash.slice(8, 16) + hash.slice(16, 24) + hash.slice(0, 8);
}

// =============================================================================
// AES ENCRYPTION (Standard AES-128-CBC with zero IV)
// =============================================================================

const ZERO_IV = Buffer.alloc(16, 0);

/**
 * AES-128-CBC encrypt, returns uppercase hex
 */
export function aesEncryptHex(plaintext: string, keyHex: string): string {
    const key = Buffer.from(keyHex, 'hex');
    const cipher = crypto.createCipheriv('aes-128-cbc', key, ZERO_IV);
    cipher.setAutoPadding(true);

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
    ]);

    return encrypted.toString('hex').toUpperCase();
}

/**
 * AES-128-CBC decrypt from hex, returns UTF-8 string
 */
export function aesDecryptUtf8(ciphertextHex: string, keyHex: string): string {
    const key = Buffer.from(keyHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-128-cbc', key, ZERO_IV);
    decipher.setAutoPadding(true);

    const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
    ]);

    return decrypted.toString('utf8');
}

// =============================================================================
// SIGNING
// =============================================================================

/**
 * Build sign string from fields
 * Sort keys alphabetically, join as key=value&, append password
 */
export function buildSignString(fields: Record<string, any>, password: string): string {
    const sortedKeys = Object.keys(fields).sort();
    const pairs = sortedKeys.map(key => {
        const value = fields[key] === null ? 'null' : String(fields[key]);
        return `${key}=${value}`;
    });

    return pairs.join('&') + `&password=${password}`;
}

// =============================================================================
// BANGCLE CODEC (White-box AES)
// =============================================================================

// Pre-computed tables loaded from binary file
let bangcleTables: {
    invRound: Uint8Array;
    invXor: Uint8Array;
    invFirst: Uint8Array;
    round: Uint8Array;
    xor: Uint8Array;
    final: Uint8Array;
    permDecrypt: Uint8Array;
    permEncrypt: Uint8Array;
} | null = null;

/**
 * Load Bangcle tables from binary data
 * Format: BGTB magic, version, count, index, data
 */
export function loadBangcleTables(data: Buffer): void {
    const magic = data.slice(0, 4).toString('ascii');
    if (magic !== 'BGTB') {
        throw new Error('Invalid Bangcle table file');
    }

    // Skip version (bytes 4-5), read count (bytes 6-7)
    const count = data.readUInt16LE(6);

    if (count !== 8) {
        throw new Error(`Expected 8 tables, got ${count}`);
    }

    // Read index (8 entries * 8 bytes each = 64 bytes)
    const index: Array<{ offset: number; length: number }> = [];
    for (let i = 0; i < 8; i++) {
        const offset = data.readUInt32LE(8 + i * 8);
        const length = data.readUInt32LE(8 + i * 8 + 4);
        index.push({ offset, length });
    }

    // Data starts after header (8 bytes) + index (64 bytes)
    const dataStart = 8 + 64;

    const readTable = (i: number): Uint8Array => {
        const { offset, length } = index[i];
        return new Uint8Array(data.slice(dataStart + offset, dataStart + offset + length));
    };

    bangcleTables = {
        invRound: readTable(0),
        invXor: readTable(1),
        invFirst: readTable(2),
        round: readTable(3),
        xor: readTable(4),
        final: readTable(5),
        permDecrypt: readTable(6),
        permEncrypt: readTable(7),
    };
}

/**
 * Check if Bangcle tables are loaded
 */
export function areBangcleTablesLoaded(): boolean {
    return bangcleTables !== null;
}

// Helper: prepare AES matrix (transpose)
function prepareAesMatrix(input: Uint8Array): Uint8Array {
    const state = new Uint8Array(16);
    for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
            state[col * 4 + row] = input[row * 4 + col];
        }
    }
    return state;
}

// Helper: XOR into buffer
function xorInto(target: Uint8Array, source: Uint8Array): void {
    for (let i = 0; i < target.length; i++) {
        target[i] ^= source[i];
    }
}

/**
 * Decrypt a single 16-byte block using white-box AES
 */
function decryptBlockAuth(ciphertext: Uint8Array, roundStart: number = 9): Uint8Array {
    if (!bangcleTables) throw new Error('Bangcle tables not loaded');

    const { invRound, invXor, invFirst, permDecrypt } = bangcleTables;
    let state = prepareAesMatrix(ciphertext);

    for (let round = roundStart; round >= 1; round--) {
        const newState = new Uint8Array(16);

        for (let i = 0; i < 16; i++) {
            const perm = permDecrypt[i];
            const byteVal = state[perm];
            const idx = (round - 1) * 4096 + i * 256 + byteVal;
            newState[i] = invRound[idx];
        }

        // XOR step
        for (let i = 0; i < 4; i++) {
            const xorIdx = (round - 1) * 64 + i * 16;
            for (let j = 0; j < 4; j++) {
                newState[i * 4 + j] ^= invXor[xorIdx + newState[i * 4 + j] % 16];
            }
        }

        state = newState;
    }

    // Final round
    const result = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
        result[i] = invFirst[i * 256 + state[i]];
    }

    return prepareAesMatrix(result);
}

/**
 * Encrypt a single 16-byte block using white-box AES
 */
function encryptBlockAuth(plaintext: Uint8Array): Uint8Array {
    if (!bangcleTables) throw new Error('Bangcle tables not loaded');

    const { round: roundTable, xor: xorTable, final: finalTable, permEncrypt } = bangcleTables;
    let state = prepareAesMatrix(plaintext);

    for (let r = 0; r < 9; r++) {
        const newState = new Uint8Array(16);

        for (let i = 0; i < 16; i++) {
            const perm = permEncrypt[i];
            const byteVal = state[perm];
            const idx = r * 4096 + i * 256 + byteVal;
            newState[i] = roundTable[idx];
        }

        // XOR step
        for (let i = 0; i < 4; i++) {
            const xorIdx = r * 64 + i * 16;
            for (let j = 0; j < 4; j++) {
                newState[i * 4 + j] ^= xorTable[xorIdx + newState[i * 4 + j] % 16];
            }
        }

        state = newState;
    }

    // Final round
    const result = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
        result[i] = finalTable[i * 256 + state[i]];
    }

    return prepareAesMatrix(result);
}

// PKCS7 padding
function addPkcs7(data: Uint8Array): Uint8Array {
    const blockSize = 16;
    const padLen = blockSize - (data.length % blockSize);
    const result = new Uint8Array(data.length + padLen);
    result.set(data);
    result.fill(padLen, data.length);
    return result;
}

function stripPkcs7(data: Uint8Array): Uint8Array {
    const padLen = data[data.length - 1];
    if (padLen > 16 || padLen === 0) {
        throw new Error('Invalid PKCS7 padding');
    }
    return data.slice(0, data.length - padLen);
}

/**
 * Decrypt using Bangcle CBC mode
 */
function decryptCbc(ciphertext: Uint8Array, iv: Uint8Array): Uint8Array {
    if (ciphertext.length % 16 !== 0) {
        throw new Error('Ciphertext must be multiple of 16 bytes');
    }

    const result = new Uint8Array(ciphertext.length);
    let prevBlock = iv;

    for (let i = 0; i < ciphertext.length; i += 16) {
        const block = ciphertext.slice(i, i + 16);
        const decrypted = decryptBlockAuth(block);
        xorInto(decrypted, prevBlock);
        result.set(decrypted, i);
        prevBlock = block;
    }

    return stripPkcs7(result);
}

/**
 * Encrypt using Bangcle CBC mode
 */
function encryptCbc(plaintext: Uint8Array, iv: Uint8Array): Uint8Array {
    const padded = addPkcs7(plaintext);
    const result = new Uint8Array(padded.length);
    let prevBlock = iv;

    for (let i = 0; i < padded.length; i += 16) {
        const block = padded.slice(i, i + 16);
        xorInto(block, prevBlock);
        const encrypted = encryptBlockAuth(block);
        result.set(encrypted, i);
        prevBlock = encrypted;
    }

    return result;
}

/**
 * Encode envelope using Bangcle codec
 * Returns base64 string prefixed with "F"
 */
export function encodeEnvelope(plaintext: string | Buffer): string {
    const data = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;
    const iv = Buffer.alloc(16, 0);
    const encrypted = encryptCbc(new Uint8Array(data), new Uint8Array(iv));
    return 'F' + Buffer.from(encrypted).toString('base64');
}

/**
 * Decode envelope using Bangcle codec
 * Input is base64 string optionally prefixed with "F"
 */
export function decodeEnvelope(envelope: string): string {
    // Strip F prefix
    let b64 = envelope.startsWith('F') ? envelope.slice(1) : envelope;

    // Handle URL-safe base64
    b64 = b64.replace(/-/g, '+').replace(/_/g, '/');

    const ciphertext = Buffer.from(b64, 'base64');
    const iv = Buffer.alloc(16, 0);
    const decrypted = decryptCbc(new Uint8Array(ciphertext), new Uint8Array(iv));

    let result = Buffer.from(decrypted).toString('utf8');

    // Handle stray F prefix in result
    if (result.startsWith('F{') || result.startsWith('F[')) {
        result = result.slice(1);
    }

    return result;
}
