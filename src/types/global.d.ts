/**
 * Global type augmentations for third-party globals injected at runtime.
 */

declare global {
    interface Window {
        Capacitor?: {
            isNativePlatform: () => boolean;
        };
    }
}

export {};
