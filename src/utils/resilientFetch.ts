interface FetchOptions extends RequestInit {
    timeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
    retryOn?: (response: Response) => boolean;
}

const DEFAULT_TIMEOUT = 30_000;  // 30s
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1_000; // 1s base (exponential)

export async function resilientFetch(url: string, options: FetchOptions = {}): Promise<Response> {
    const {
        timeoutMs = DEFAULT_TIMEOUT,
        maxRetries = DEFAULT_MAX_RETRIES,
        retryDelayMs = DEFAULT_RETRY_DELAY,
        retryOn = (r) => r.status >= 500 || r.status === 429,
        ...fetchOptions
    } = options;

    let retries = 0;

    while (true) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal
            });

            clearTimeout(id);

            if (!response.ok && retryOn(response) && retries < maxRetries) {
                throw new Error(`Retryable status: ${response.status}`);
            }

            return response;
        } catch (error) {
            clearTimeout(id);

            const isAbort = error instanceof DOMException && error.name === 'AbortError';

            if (retries >= maxRetries) {
                throw isAbort ? new Error(`Request timeout after ${timeoutMs}ms`) : error;
            }

            retries++;
            // Exponential backoff: 1s, 2s, 4s...
            const delay = retryDelayMs * Math.pow(2, retries - 1);
            console.warn(`[resilientFetch] Attempt ${retries} failed, retrying in ${delay}ms...`, error);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}
