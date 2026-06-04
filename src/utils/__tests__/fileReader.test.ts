// BYD Stats - fileReader Utility Tests
import { describe, it, expect } from 'vitest';
import { readFileAsText, readFileAsArrayBuffer } from '../fileReader';

describe('fileReader Utility', () => {
    it('should read file as text using file.text() when available', async () => {
        const file = new File(['hello world'], 'test.txt', { type: 'text/plain' });
        
        // Define file.text explicitly to simulate a modern browser environment in JSDOM
        Object.defineProperty(file, 'text', {
            value: async () => 'hello world',
            configurable: true
        });
        
        const text = await readFileAsText(file);
        expect(text).toBe('hello world');
    });

    it('should read file as text using FileReader fallback when file.text() is not available', async () => {
        const file = new File(['hello fallback'], 'test.txt', { type: 'text/plain' });
        
        // Explicitly delete file.text to simulate legacy browser environment
        Object.defineProperty(file, 'text', {
            value: undefined,
            configurable: true
        });

        const text = await readFileAsText(file);
        expect(text).toBe('hello fallback');
    });

    it('should read file as ArrayBuffer using file.arrayBuffer() when available', async () => {
        const file = new File(['hello binary'], 'test.bin', { type: 'application/octet-stream' });
        
        // Define file.arrayBuffer explicitly to simulate a modern browser environment in JSDOM
        const encoder = new TextEncoder();
        const expectedBuffer = encoder.encode('hello binary').buffer;
        Object.defineProperty(file, 'arrayBuffer', {
            value: async () => expectedBuffer,
            configurable: true
        });

        const buffer = await readFileAsArrayBuffer(file);
        expect(buffer.byteLength).toBe(12);

        const decoder = new TextDecoder();
        expect(decoder.decode(buffer)).toBe('hello binary');
    });

    it('should read file as ArrayBuffer using FileReader fallback when file.arrayBuffer() is not available', async () => {
        const file = new File(['hello binary fallback'], 'test.bin', { type: 'application/octet-stream' });

        // Explicitly delete file.arrayBuffer to simulate legacy browser environment
        Object.defineProperty(file, 'arrayBuffer', {
            value: undefined,
            configurable: true
        });

        const buffer = await readFileAsArrayBuffer(file);
        expect(buffer.byteLength).toBe(21);
        
        const decoder = new TextDecoder();
        expect(decoder.decode(buffer)).toBe('hello binary fallback');
    });
});
