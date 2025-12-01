import logger from './logger.js';

/**
 * Retry a database operation with exponential backoff
 * @param {Function} operation - Async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise<any>} Result of the operation
 */
export async function retryDatabaseOperation(operation, options = {}) {
    const {
        maxRetries = 5,
        initialDelayMs = 1000,
        maxDelayMs = 10000,
        backoffMultiplier = 2,
        onRetry = null
    } = options;

    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            // Don't retry on certain errors
            if (isNonRetryableError(error)) {
                logger.error({ error, attempt }, 'Non-retryable database error');
                throw error;
            }
            
            if (attempt === maxRetries) {
                logger.error(
                    { error, attempts: maxRetries }, 
                    'Database operation failed after max retries'
                );
                break;
            }
            
            // Calculate delay with exponential backoff
            const delayMs = Math.min(
                initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
                maxDelayMs
            );
            
            logger.warn(
                { error: error.message, attempt, maxRetries, delayMs },
                'Database operation failed, retrying'
            );
            
            if (onRetry) {
                onRetry(error, attempt);
            }
            
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    
    throw lastError;
}

/**
 * Check if error is non-retryable (e.g., authentication, syntax errors)
 */
function isNonRetryableError(error) {
    const errorCode = error?.code;
    const errorMessage = error?.message?.toLowerCase() || '';
    
    // PostgreSQL error codes that shouldn't be retried
    const nonRetryableCodes = [
        '28000', // invalid_authorization_specification
        '28P01', // invalid_password
        '3D000', // invalid_catalog_name (database doesn't exist)
        '42P01', // undefined_table
        '42703', // undefined_column
        '42601', // syntax_error
        '23505', // unique_violation
        '23503', // foreign_key_violation
        '23502', // not_null_violation
        '22P02', // invalid_text_representation
        '22003', // numeric_value_out_of_range
    ];
    
    if (nonRetryableCodes.includes(errorCode)) {
        return true;
    }
    
    // Check for authentication errors
    if (errorMessage.includes('authentication') || 
        errorMessage.includes('password') ||
        errorMessage.includes('permission denied')) {
        return true;
    }
    
    return false;
}

/**
 * Test database connection with retries
 * @param {Object} pool - PostgreSQL pool
 * @param {Object} options - Retry options
 * @returns {Promise<boolean>} True if connection successful
 */
export async function testDatabaseConnection(pool, options = {}) {
    try {
        await retryDatabaseOperation(async () => {
            const client = await pool.connect();
            await client.query('SELECT NOW()');
            client.release();
        }, options);
        
        logger.info('Database connection successful');
        return true;
    } catch (error) {
        logger.error({ error }, 'Failed to connect to database');
        return false;
    }
}

export default {
    retryDatabaseOperation,
    testDatabaseConnection
};
