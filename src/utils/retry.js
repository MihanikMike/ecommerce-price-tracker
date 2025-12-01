import logger from "./logger.js";

/**
 * Retry a function with exponential backoff
 */
export async function retry(fn, options = {}) {
    const {
        retries = 3,
        minDelay = 1000,
        maxDelay = 5000,
        shouldRetry = () => true,
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt > retries) {
                logger.error({ error, attempt, retries }, 'All retry attempts exhausted');
                throw error;
            }

            if (!shouldRetry(error)) {
                logger.warn({ error, attempt }, 'Error not retryable, throwing');
                throw error;
            }

            // Exponential backoff with jitter
            const exponentialDelay = Math.min(minDelay * Math.pow(2, attempt - 1), maxDelay);
            const jitter = Math.random() * 0.3 * exponentialDelay;
            const delayMs = Math.floor(exponentialDelay + jitter);

            logger.warn({ error: error.message, attempt, retries, delayMs }, 'Retrying after error');

            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    throw lastError;
}