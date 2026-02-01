import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock Web Worker
class MockWorker {
    url: string;
    constructor(url: string) {
        this.url = url;
    }
    terminate() { }
    postMessage() { }
    addEventListener() { }
    removeEventListener() { }
}

global.Worker = MockWorker as any;

// Global mocks for Worker/Crypto only

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});


// Mock Crypto (for UUIDs)
if (!global.crypto.randomUUID) {
    global.crypto.randomUUID = (() => 'test-uuid-' + Math.random().toString(36).substring(2)) as any;
}

// Mock window.URL.createObjectURL (common in frontend tests)
if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = vi.fn();
}

// Cleanup after each test
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
    cleanup();
});
