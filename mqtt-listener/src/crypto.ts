/**
 * BYD Crypto utilities for MQTT listener
 * Simplified version for Raspberry Pi
 */

import * as crypto from 'crypto';

const ZERO_IV = Buffer.alloc(16, 0);

/**
 * Compute MD5 hash, returns uppercase hex
 */
export function md5Hex(input: string): string {
    return crypto.createHash('md5').update(input, 'utf8').digest('hex').toUpperCase();
}

/**
 * AES-128-CBC decrypt, returns UTF-8 string
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

/**
 * Build MQTT password
 * pyBYD: MD5(timestamp + signToken + clientId + userId)
 */
export function buildMqttPassword(
    timestamp: string,
    signToken: string,
    clientId: string,
    userId: string
): string {
    const combined = timestamp + signToken + clientId + userId;
    return md5Hex(combined);
}
