/**
 * BYD API Crypto Module
 * Ported from pyBYD (https://github.com/jkaberg/pyBYD)
 *
 * IMPORTANT: This is a faithful port of the white-box AES implementation.
 * The algorithm uses pre-computed lookup tables extracted from libencrypt.so.
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
 * Compute MD5 hash of a string, returns lowercase hex
 * Used for control PIN which BYD expects in lowercase
 */
export function md5HexLower(input: string): string {
    return crypto.createHash('md5').update(input, 'utf8').digest('hex').toLowerCase();
}

/**
 * Compute SHA1 with special mixed-case formatting
 * Port of pyBYD sha1_mixed:
 * 1. For each byte at index i, format as 2-char hex
 * 2. If i is even: BOTH chars uppercase
 * 3. If i is odd: BOTH chars lowercase
 * 4. Filter: drop any '0' at even position in final string
 */
export function sha1Mixed(input: string): string {
    const digest = crypto.createHash('sha1').update(input, 'utf8').digest();

    // Convert to hex with alternating case BY BYTE (not by char)
    let mixed = '';
    for (let i = 0; i < digest.length; i++) {
        const byte = digest[i];
        // Format as 2-char hex (with leading zero if needed)
        const hexStr = byte.toString(16).padStart(2, '0');
        // Even byte index = uppercase, odd byte index = lowercase
        if (i % 2 === 0) {
            mixed += hexStr.toUpperCase();
        } else {
            mixed += hexStr.toLowerCase();
        }
    }

    // Filter out '0' at even positions in the mixed string
    let result = '';
    for (let j = 0; j < mixed.length; j++) {
        if (mixed[j] === '0' && j % 2 === 0) {
            continue;
        }
        result += mixed[j];
    }

    return result;
}

/**
 * Derive login AES key from password: md5(md5(password))
 */
export function pwdLoginKey(password: string): string {
    const firstHash = md5Hex(password);
    const secondHash = md5Hex(firstHash);
    console.log(`[pwdLoginKey] password length: ${password?.length}, firstHash: ${firstHash} (${firstHash.length}), secondHash: ${secondHash} (${secondHash.length})`);
    return secondHash;
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
    console.log(`[aesEncryptHex] keyHex received: "${keyHex}" (length=${keyHex?.length})`);

    // Validate key is 32 hex chars (16 bytes)
    if (!keyHex || keyHex.length !== 32 || !/^[0-9A-Fa-f]+$/.test(keyHex)) {
        throw new Error(`Invalid AES key: expected 32 hex chars, got "${keyHex}" (length=${keyHex?.length})`);
    }

    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== 16) {
        throw new Error(`Invalid AES key buffer: expected 16 bytes, got ${key.length}`);
    }

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
// Faithful port of pyBYD/_crypto/_bangcle_block.py
// =============================================================================

// Table sizes as per pyBYD
const TABLE_SPECS = [
    { name: 'invRound', size: 0x28000 },   // 163840 bytes
    { name: 'invXor', size: 0x3C000 },     // 245760 bytes
    { name: 'invFirst', size: 0x1000 },    // 4096 bytes
    { name: 'round', size: 0x28000 },      // 163840 bytes
    { name: 'xor', size: 0x3C000 },        // 245760 bytes
    { name: 'final', size: 0x1000 },       // 4096 bytes
    { name: 'permDecrypt', size: 8 },      // 8 bytes
    { name: 'permEncrypt', size: 8 },      // 8 bytes
];

// Pre-computed tables loaded from binary file
let bangcleTables: {
    invRound: Buffer;
    invXor: Buffer;
    invFirst: Buffer;
    round: Buffer;
    xor: Buffer;
    final: Buffer;
    permDecrypt: Buffer;
    permEncrypt: Buffer;
} | null = null;

/**
 * Load Bangcle tables from binary data
 * Format: BGTB magic (4), version (2), count (2), index (64), data
 */
export function loadBangcleTables(data: Buffer): void {
    const HEADER_SIZE = 8;  // 4 magic + 2 version + 2 count
    const INDEX_ENTRY_SIZE = 8;  // 4 offset + 4 length

    if (data.length < HEADER_SIZE + 8 * INDEX_ENTRY_SIZE) {
        throw new Error('Table file too short');
    }

    const magic = data.slice(0, 4).toString('ascii');
    if (magic !== 'BGTB') {
        throw new Error(`Invalid Bangcle table file: bad magic ${magic}`);
    }

    const version = data.readUInt16LE(4);
    if (version !== 1) {
        throw new Error(`Unsupported table version: ${version}`);
    }

    const count = data.readUInt16LE(6);
    if (count !== 8) {
        throw new Error(`Expected 8 tables, got ${count}`);
    }

    // Read tables - offset is ABSOLUTE position in file
    const tables: Buffer[] = [];
    for (let i = 0; i < 8; i++) {
        const idxOffset = HEADER_SIZE + i * INDEX_ENTRY_SIZE;
        const offset = data.readUInt32LE(idxOffset);
        const length = data.readUInt32LE(idxOffset + 4);

        const expected = TABLE_SPECS[i];
        if (length !== expected.size) {
            throw new Error(`Table ${expected.name}: expected ${expected.size} bytes, got ${length}`);
        }
        if (offset + length > data.length) {
            throw new Error(`Table ${expected.name}: data extends beyond file (offset=${offset}, length=${length}, fileSize=${data.length})`);
        }

        tables.push(data.slice(offset, offset + length));
    }

    bangcleTables = {
        invRound: tables[0],
        invXor: tables[1],
        invFirst: tables[2],
        round: tables[3],
        xor: tables[4],
        final: tables[5],
        permDecrypt: tables[6],
        permEncrypt: tables[7],
    };
}

/**
 * Check if Bangcle tables are loaded
 */
export function areBangcleTablesLoaded(): boolean {
    return bangcleTables !== null;
}

/**
 * Transpose 4x4 block into working state layout (col*8+row)
 * Port of _prepare_aes_matrix from pyBYD
 */
function prepareAesMatrix(input: Uint8Array, output: Uint8Array): void {
    for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
            output[col * 8 + row] = input[col + row * 4];
        }
    }
}

/**
 * Decrypt a single 16-byte block using white-box AES tables.
 * Port of decrypt_block_auth from pyBYD/_crypto/_bangcle_block.py
 */
function decryptBlockAuth(block: Uint8Array, roundStart: number = 1): Uint8Array {
    if (!bangcleTables) throw new Error('Bangcle tables not loaded');

    const { invRound, invXor, invFirst, permDecrypt } = bangcleTables;

    const state = new Uint8Array(32);
    const temp64 = new Uint8Array(64);
    const tmp32 = new Uint8Array(32);
    const output = new Uint8Array(16);

    prepareAesMatrix(block, state);
    const param3 = roundStart;

    for (let rnd = 9; rnd >= Math.max(1, param3); rnd--) {
        const l_var20 = rnd;
        const l_var21 = l_var20 * 4;
        let permPtr = 0;

        for (let i = 0; i < 4; i++) {
            const b_var3 = permDecrypt[permPtr];
            const l_var16 = i * 8;
            const base = i * 16;

            for (let j = 0; j < 4; j++) {
                const u_var7 = (b_var3 + j) & 3;
                const byteVal = state[l_var16 + u_var7];
                const idx = byteVal + (i + (l_var21 + u_var7) * 4) * 256;
                // Read 4-byte value from invRound table
                const value = invRound.readUInt32LE(idx * 4);
                // Write 4-byte value to temp64
                temp64[base + j * 4] = value & 0xFF;
                temp64[base + j * 4 + 1] = (value >> 8) & 0xFF;
                temp64[base + j * 4 + 2] = (value >> 16) & 0xFF;
                temp64[base + j * 4 + 3] = (value >> 24) & 0xFF;
            }

            permPtr += 2;
        }

        let i_var15 = 1;
        for (let l_var21_xor = 0; l_var21_xor < 4; l_var21_xor++) {
            let pb_var18_offset = l_var21_xor;

            for (let l_var9_xor = 0; l_var9_xor < 4; l_var9_xor++) {
                const local10 = temp64[pb_var18_offset];
                let u_var6 = local10 & 0xF;
                let u_var26 = local10 & 0xF0;

                const local_f0 = temp64[pb_var18_offset + 0x10];
                const local_f1 = temp64[pb_var18_offset + 0x20];
                const local_f2 = temp64[pb_var18_offset + 0x30];

                const l_var2 = l_var9_xor * 0x18 + l_var20 * 0x60;
                let i_var25 = i_var15;

                for (let l_var16_inner = 0; l_var16_inner < 3; l_var16_inner++) {
                    let b_var3_inner: number;
                    if (l_var16_inner === 0) {
                        b_var3_inner = local_f0;
                    } else if (l_var16_inner === 1) {
                        b_var3_inner = local_f1;
                    } else {
                        b_var3_inner = local_f2;
                    }

                    const u_var1 = (b_var3_inner << 4) & 0xFF;
                    const u_var27 = u_var6 | u_var1;
                    u_var26 = ((u_var26 >> 4) | ((b_var3_inner >> 4) << 4)) & 0xFF;

                    const idx1 = (l_var2 + (i_var25 - 1)) * 0x100 + u_var27;
                    u_var6 = invXor[idx1] & 0xF;

                    const idx2 = (l_var2 + i_var25) * 0x100 + u_var26;
                    const b_var3_new = invXor[idx2];
                    u_var26 = (b_var3_new & 0xF) << 4;
                    i_var25 += 2;
                }

                state[l_var9_xor + l_var21_xor * 8] = (u_var26 | u_var6) & 0xFF;
                pb_var18_offset += 4;
            }

            i_var15 += 6;
        }
    }

    if (param3 === 1) {
        tmp32.set(state);
        let u_var8 = 1;
        let u_var10 = 3;
        let u_var12 = 2;

        for (let row = 0; row < 4; row++) {
            const idx0 = tmp32[row] + row * 0x400;
            state[row] = invFirst[idx0];

            const row1 = u_var10 & 3;
            const idx1 = tmp32[8 + row1] + row1 * 0x400 + 0x100;
            state[8 + row] = invFirst[idx1];

            const row2 = u_var12 & 3;
            const idx2 = tmp32[0x10 + row2] + row2 * 0x400 + 0x200;
            state[0x10 + row] = invFirst[idx2];

            const row3 = u_var8 & 3;
            const idx3 = tmp32[0x18 + row3] + row3 * 0x400 + 0x300;
            state[0x18 + row] = invFirst[idx3];

            u_var8 += 1;
            u_var10 += 1;
            u_var12 += 1;
        }
    }

    // Transpose back
    for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
            output[col + row * 4] = state[col * 8 + row];
        }
    }

    return output;
}

/**
 * Encrypt a single 16-byte block using white-box AES tables.
 * Port of encrypt_block_auth from pyBYD/_crypto/_bangcle_block.py
 */
function encryptBlockAuth(block: Uint8Array, roundEnd: number = 10): Uint8Array {
    if (!bangcleTables) throw new Error('Bangcle tables not loaded');

    const { round: roundTable, xor: xorTable, final: finalTable, permEncrypt } = bangcleTables;

    const state = new Uint8Array(32);
    const temp64 = new Uint8Array(64);
    const tmp32 = new Uint8Array(32);
    const output = new Uint8Array(16);

    prepareAesMatrix(block, state);
    const param3 = roundEnd;

    const rounds = Math.min(9, Math.max(0, param3));
    for (let rnd = 0; rnd < rounds; rnd++) {
        const l_var21 = rnd * 4;
        let permPtr = 0;

        for (let i = 0; i < 4; i++) {
            const b_var4 = permEncrypt[permPtr];
            const l_var16 = i * 8;
            const base = i * 16;

            for (let j = 0; j < 4; j++) {
                const u_var8 = (b_var4 + j) & 3;
                const byteVal = state[l_var16 + u_var8];
                const idx = byteVal + (i + (l_var21 + u_var8) * 4) * 256;
                // Read 4-byte value from round table
                const value = roundTable.readUInt32LE(idx * 4);
                // Write 4-byte value to temp64
                temp64[base + j * 4] = value & 0xFF;
                temp64[base + j * 4 + 1] = (value >> 8) & 0xFF;
                temp64[base + j * 4 + 2] = (value >> 16) & 0xFF;
                temp64[base + j * 4 + 3] = (value >> 24) & 0xFF;
            }

            permPtr += 2;
        }

        let i_var16 = 1;
        for (let l_var22 = 0; l_var22 < 4; l_var22++) {
            let pb_var19_offset = l_var22;

            for (let l_var10 = 0; l_var10 < 4; l_var10++) {
                const local10 = temp64[pb_var19_offset];
                let u_var7 = local10 & 0xF;
                let u_var26 = local10 & 0xF0;

                const local_f0 = temp64[pb_var19_offset + 0x10];
                const local_f1 = temp64[pb_var19_offset + 0x20];
                const local_f2 = temp64[pb_var19_offset + 0x30];

                const l_var2 = l_var10 * 0x18 + rnd * 0x60;
                let i_var25 = i_var16;

                for (let l_var17 = 0; l_var17 < 3; l_var17++) {
                    let b_var4_inner: number;
                    if (l_var17 === 0) {
                        b_var4_inner = local_f0;
                    } else if (l_var17 === 1) {
                        b_var4_inner = local_f1;
                    } else {
                        b_var4_inner = local_f2;
                    }

                    const u_var1 = (b_var4_inner << 4) & 0xFF;
                    const u_var27 = u_var7 | u_var1;
                    u_var26 = ((u_var26 >> 4) | ((b_var4_inner >> 4) << 4)) & 0xFF;

                    const idx1 = (l_var2 + (i_var25 - 1)) * 0x100 + u_var27;
                    u_var7 = xorTable[idx1] & 0xF;

                    const idx2 = (l_var2 + i_var25) * 0x100 + u_var26;
                    const b_var4_new = xorTable[idx2];
                    u_var26 = (b_var4_new & 0xF) << 4;
                    i_var25 += 2;
                }

                state[l_var10 + l_var22 * 8] = (u_var26 | u_var7) & 0xFF;
                pb_var19_offset += 4;
            }

            i_var16 += 6;
        }
    }

    if (param3 === 10) {
        tmp32.set(state);
        let u_var13 = 3;
        let u_var9 = 2;
        let u_var11 = 1;
        const u_var8_enc = 0;

        for (let row = 0; row < 4; row++) {
            const row0 = (u_var8_enc + row) & 3;
            state[row] = finalTable[tmp32[row0] + row0 * 0x400];

            const row1 = (u_var11 + row) & 3;
            state[8 + row] = finalTable[tmp32[8 + row1] + row1 * 0x400 + 0x100];

            const row2 = (u_var9 + row) & 3;
            state[0x10 + row] = finalTable[tmp32[0x10 + row2] + row2 * 0x400 + 0x200];

            const row3 = (u_var13 + row) & 3;
            state[0x18 + row] = finalTable[tmp32[0x18 + row3] + row3 * 0x400 + 0x300];
        }
    }

    // Transpose back
    for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
            output[col + row * 4] = state[col * 8 + row];
        }
    }

    return output;
}

// =============================================================================
// PKCS7 PADDING
// =============================================================================

function addPkcs7(data: Uint8Array): Uint8Array {
    const blockSize = 16;
    const padLen = blockSize - (data.length % blockSize);
    const result = new Uint8Array(data.length + padLen);
    result.set(data);
    result.fill(padLen, data.length);
    return result;
}

function stripPkcs7(data: Uint8Array): Uint8Array {
    if (data.length === 0) {
        throw new Error('Cannot strip PKCS7 from empty data');
    }

    const padLen = data[data.length - 1];
    if (padLen > 16 || padLen === 0) {
        const preview = Buffer.from(data.slice(0, Math.min(50, data.length))).toString('utf8');
        throw new Error(`Invalid PKCS7 padding (padLen=${padLen}). Data preview: ${preview}`);
    }

    // Validate all padding bytes
    for (let i = data.length - padLen; i < data.length; i++) {
        if (data[i] !== padLen) {
            const preview = Buffer.from(data.slice(0, Math.min(50, data.length))).toString('utf8');
            throw new Error(`Invalid PKCS7 padding at position ${i}. Data preview: ${preview}`);
        }
    }

    return data.slice(0, data.length - padLen);
}

// =============================================================================
// CBC MODE
// =============================================================================

function xorInto(target: Uint8Array, source: Uint8Array): void {
    for (let i = 0; i < target.length; i++) {
        target[i] ^= source[i];
    }
}

/**
 * Decrypt data using white-box AES in CBC mode.
 */
function decryptCbc(data: Uint8Array, iv: Uint8Array): Uint8Array {
    if (data.length % 16 !== 0) {
        throw new Error(`Ciphertext length ${data.length} is not a multiple of 16`);
    }
    if (iv.length !== 16) {
        throw new Error(`IV must be 16 bytes, got ${iv.length}`);
    }

    const result = new Uint8Array(data.length);
    const prev = new Uint8Array(iv);

    for (let offset = 0; offset < data.length; offset += 16) {
        const block = data.slice(offset, offset + 16);
        const decrypted = decryptBlockAuth(block, 1);
        xorInto(decrypted, prev);
        result.set(decrypted, offset);
        prev.set(block);
    }

    return result;
}

/**
 * Encrypt data using white-box AES in CBC mode.
 */
function encryptCbc(data: Uint8Array, iv: Uint8Array): Uint8Array {
    if (data.length % 16 !== 0) {
        throw new Error(`Plaintext length ${data.length} is not a multiple of 16`);
    }
    if (iv.length !== 16) {
        throw new Error(`IV must be 16 bytes, got ${iv.length}`);
    }

    const result = new Uint8Array(data.length);
    const prev = new Uint8Array(iv);

    for (let offset = 0; offset < data.length; offset += 16) {
        const block = new Uint8Array(data.slice(offset, offset + 16));
        xorInto(block, prev);
        const encrypted = encryptBlockAuth(block, 10);
        result.set(encrypted, offset);
        prev.set(encrypted);
    }

    return result;
}

// =============================================================================
// ENVELOPE ENCODING/DECODING
// =============================================================================

/**
 * Encode envelope using Bangcle codec
 * Returns base64 string prefixed with "F"
 */
export function encodeEnvelope(plaintext: string | Buffer): string {
    if (!bangcleTables) {
        throw new Error('Bangcle tables not loaded. Call loadBangcleTables() first.');
    }

    const data = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;
    const iv = Buffer.alloc(16, 0);
    const padded = addPkcs7(new Uint8Array(data));
    const encrypted = encryptCbc(padded, new Uint8Array(iv));
    return 'F' + Buffer.from(encrypted).toString('base64');
}

/**
 * Decode envelope using Bangcle codec
 * Input is base64 string prefixed with "F"
 */
export function decodeEnvelope(envelope: string): string {
    if (!bangcleTables) {
        throw new Error('Bangcle tables not loaded. Call loadBangcleTables() first.');
    }

    // Check if already plain JSON (server error response)
    if (envelope.startsWith('{') || envelope.startsWith('[')) {
        return envelope;
    }

    // Normalize envelope
    let cleaned = envelope.replace(/\s/g, '').trim();

    // URL-safe base64 normalization
    cleaned = cleaned.replace(/-/g, '+').replace(/_/g, '/');

    if (!cleaned) {
        throw new Error('Bangcle input is empty');
    }
    if (!cleaned.startsWith('F')) {
        throw new Error('Bangcle envelope must start with "F"');
    }

    // Strip F prefix
    let b64 = cleaned.slice(1);

    // Add padding if needed
    const remainder = b64.length % 4;
    if (remainder !== 0) {
        b64 += '='.repeat(4 - remainder);
    }

    const ciphertext = Buffer.from(b64, 'base64');

    if (ciphertext.length === 0) {
        throw new Error('Bangcle ciphertext is empty');
    }
    if (ciphertext.length % 16 !== 0) {
        throw new Error(`Bangcle ciphertext length ${ciphertext.length} is not a multiple of 16`);
    }

    const iv = Buffer.alloc(16, 0);

    try {
        const decrypted = decryptCbc(new Uint8Array(ciphertext), new Uint8Array(iv));
        const plaintext = stripPkcs7(decrypted);
        return Buffer.from(plaintext).toString('utf8');
    } catch (error: any) {
        throw new Error(`Bangcle decryption failed: ${error.message}. Raw envelope (first 200 chars): ${envelope.substring(0, 200)}`);
    }
}
