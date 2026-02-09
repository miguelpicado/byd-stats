import { useState, useCallback, useRef, useEffect } from 'react';

interface AsyncState<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
}

interface UseAsyncStateOptions<T> {
    initialData?: T | null;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
}

export function useAsyncState<T>(
    asyncFn: ((...args: any[]) => Promise<T>) | null,
    options: UseAsyncStateOptions<T> = {}
) {
    const [state, setState] = useState<AsyncState<T>>({
        data: options.initialData || null,
        loading: false,
        error: null,
    });

    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    const execute = useCallback(async (...args: any[]) => {
        if (!asyncFn) return;

        setState(prev => ({ ...prev, loading: true, error: null }));

        try {
            const result = await asyncFn(...args);
            if (isMounted.current) {
                setState({ data: result, loading: false, error: null });
                options.onSuccess?.(result);
            }
            return result;
        } catch (err) {
            if (isMounted.current) {
                const error = err instanceof Error ? err : new Error(String(err));
                setState(prev => ({ ...prev, loading: false, error }));
                options.onError?.(error);
            }
            throw err;
        }
    }, [asyncFn, options.onSuccess, options.onError]);

    // Reset state helper
    const reset = useCallback(() => {
        if (isMounted.current) {
            setState({
                data: options.initialData || null,
                loading: false,
                error: null,
            });
        }
    }, [options.initialData]);

    return {
        ...state,
        execute,
        reset,
        setData: (data: T) => setState(prev => ({ ...prev, data })),
    };
}
