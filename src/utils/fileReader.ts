// BYD Stats - File Reader Utility
// Provides safe, backward-compatible wrappers for reading Files/Blobs.
// Fallback to FileReader is used if file.text() or file.arrayBuffer() are not supported.

/**
 * Safely reads a File or Blob as text, with fallback for older browsers.
 */
export async function readFileAsText(file: Blob): Promise<string> {
    if (typeof file.text === 'function') {
        return file.text();
    }
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error('Failed to read file as text'));
            }
        };
        reader.onerror = () => reject(reader.error || new Error('Error reading file as text'));
        reader.readAsText(file);
    });
}

/**
 * Safely reads a File or Blob as an ArrayBuffer, with fallback for older browsers.
 */
export async function readFileAsArrayBuffer(file: Blob): Promise<ArrayBuffer> {
    if (typeof file.arrayBuffer === 'function') {
        return file.arrayBuffer();
    }
    return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
                resolve(reader.result);
            } else {
                reject(new Error('Failed to read file as ArrayBuffer'));
            }
        };
        reader.onerror = () => reject(reader.error || new Error('Error reading file as ArrayBuffer'));
        reader.readAsArrayBuffer(file);
    });
}
