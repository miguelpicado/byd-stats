import toast from 'react-hot-toast';
import { TFunction } from 'i18next';

export function createAsyncHandler(t: TFunction) {
    return async function handleAsync<T>(
        operation: () => Promise<T>,
        options?: {
            errorKey?: string;
            fallbackMessage?: string;
            silent?: boolean;
            onError?: (error: Error) => void;
        }
    ): Promise<T | null> {
        try {
            return await operation();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            if (!options?.silent) {
                toast.error(
                    options?.errorKey
                        ? t(options.errorKey, options.fallbackMessage || message)
                        : message
                );
            }
            options?.onError?.(error instanceof Error ? error : new Error(message));
            return null;
        }
    };
}
