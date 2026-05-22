/// <reference types="vite/client" />

declare module 'virtual:pwa-register/react' {
  import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
  export function useRegisterSW(options?: RegisterSWOptions): {
    offlineReady: [boolean, (val: boolean) => void];
    needRefresh: [boolean, (val: boolean) => void];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
}

interface Navigator {
  standalone?: boolean;
}

interface Window {
  deferredPrompt?: any;
}
