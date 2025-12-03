import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { retryDatabaseOperation, testDatabaseConnection } from '../../../src/utils/db-retry.js';

/**
 * Tests for database retry logic
 * Tests the actual db-retry module patterns
 */

// Non-retryable error codes (PostgreSQL) - mirrors internal implementation
const NON_RETRYABLE_CODES = [
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

// Local implementation for testing error classification patterns (for reference)
function isNonRetryableError(error) {
  const errorCode = error?.code;
  const errorMessage = error?.message?.toLowerCase() || '';

  if (NON_RETRYABLE_CODES.includes(errorCode)) {
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

// Local implementation for cross-referencing test behavior
async function retryDatabaseOperationImpl(operation, options = {}) {
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
        throw error;
      }
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delayMs = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
        maxDelayMs
      );
      
      if (onRetry) {
        onRetry(error, attempt, delayMs);
      }
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError;
}

describe('db-retry', () => {
  describe('isNonRetryableError', () => {
    describe('PostgreSQL error codes', () => {
      it('should identify authentication errors as non-retryable', () => {
        expect(isNonRetryableError({ code: '28000' })).toBe(true);
        expect(isNonRetryableError({ code: '28P01' })).toBe(true);
      });

      it('should identify schema errors as non-retryable', () => {
        expect(isNonRetryableError({ code: '42P01' })).toBe(true); // undefined_table
        expect(isNonRetryableError({ code: '42703' })).toBe(true); // undefined_column
        expect(isNonRetryableError({ code: '42601' })).toBe(true); // syntax_error
      });

      it('should identify constraint violations as non-retryable', () => {
        expect(isNonRetryableError({ code: '23505' })).toBe(true); // unique_violation
        expect(isNonRetryableError({ code: '23503' })).toBe(true); // foreign_key_violation
        expect(isNonRetryableError({ code: '23502' })).toBe(true); // not_null_violation
      });

      it('should identify data type errors as non-retryable', () => {
        expect(isNonRetryableError({ code: '22P02' })).toBe(true); // invalid_text_representation
        expect(isNonRetryableError({ code: '22003' })).toBe(true); // numeric_value_out_of_range
      });

      it('should identify database not found as non-retryable', () => {
        expect(isNonRetryableError({ code: '3D000' })).toBe(true);
      });
    });

    describe('error messages', () => {
      it('should identify authentication errors by message', () => {
        expect(isNonRetryableError({ message: 'authentication failed for user' })).toBe(true);
        expect(isNonRetryableError({ message: 'invalid password' })).toBe(true);
        expect(isNonRetryableError({ message: 'Permission denied for relation users' })).toBe(true);
      });

      it('should treat connection errors as retryable', () => {
        expect(isNonRetryableError({ message: 'connection refused' })).toBe(false);
        expect(isNonRetryableError({ message: 'connection timeout' })).toBe(false);
        expect(isNonRetryableError({ message: 'ECONNRESET' })).toBe(false);
      });

      it('should treat server errors as retryable', () => {
        expect(isNonRetryableError({ message: 'server closed the connection unexpectedly' })).toBe(false);
        expect(isNonRetryableError({ message: 'too many connections' })).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle null error', () => {
        expect(isNonRetryableError(null)).toBe(false);
      });

      it('should handle undefined error', () => {
        expect(isNonRetryableError(undefined)).toBe(false);
      });

      it('should handle error without code or message', () => {
        expect(isNonRetryableError({})).toBe(false);
      });

      it('should handle error with empty message', () => {
        expect(isNonRetryableError({ message: '' })).toBe(false);
      });
    });
  });

  describe('retryDatabaseOperationImpl', () => {
    describe('successful operations', () => {
      it('should return result on first success', async () => {
        const operation = jest.fn().mockResolvedValue('success');

        const result = await retryDatabaseOperationImpl(operation);

        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledTimes(1);
      });

      it('should succeed after retries', async () => {
        let attempts = 0;
        const operation = jest.fn().mockImplementation(() => {
          attempts++;
          if (attempts < 3) {
            return Promise.reject(new Error('connection failed'));
          }
          return Promise.resolve('success');
        });

        const result = await retryDatabaseOperationImpl(operation, {
          initialDelayMs: 10,
        });

        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledTimes(3);
      });
    });

    describe('failed operations', () => {
      it('should throw after max retries', async () => {
        const operation = jest.fn().mockRejectedValue(new Error('connection failed'));

        await expect(
          retryDatabaseOperationImpl(operation, {
            maxRetries: 3,
            initialDelayMs: 10,
          })
        ).rejects.toThrow('connection failed');

        expect(operation).toHaveBeenCalledTimes(3);
      });

      it('should throw immediately for non-retryable errors', async () => {
        const error = new Error('syntax error');
        error.code = '42601';
        const operation = jest.fn().mockRejectedValue(error);

        await expect(
          retryDatabaseOperationImpl(operation, {
            maxRetries: 5,
            initialDelayMs: 10,
          })
        ).rejects.toThrow('syntax error');

        expect(operation).toHaveBeenCalledTimes(1);
      });

      it('should not retry authentication errors', async () => {
        const error = new Error('invalid password');
        error.code = '28P01';
        const operation = jest.fn().mockRejectedValue(error);

        await expect(
          retryDatabaseOperationImpl(operation, { maxRetries: 5 })
        ).rejects.toThrow('invalid password');

        expect(operation).toHaveBeenCalledTimes(1);
      });
    });

    describe('callbacks', () => {
      it('should call onRetry callback', async () => {
        let attempts = 0;
        const operation = jest.fn().mockImplementation(() => {
          attempts++;
          if (attempts < 3) {
            return Promise.reject(new Error('retry me'));
          }
          return Promise.resolve('done');
        });

        const onRetry = jest.fn();

        await retryDatabaseOperationImpl(operation, {
          maxRetries: 5,
          initialDelayMs: 10,
          onRetry,
        });

        expect(onRetry).toHaveBeenCalledTimes(2);
        expect(onRetry).toHaveBeenCalledWith(
          expect.any(Error),
          1,
          expect.any(Number)
        );
      });
    });

    describe('backoff calculation', () => {
      it('should use exponential backoff', async () => {
        const delays = [];
        let attempts = 0;
        
        const operation = jest.fn().mockImplementation(() => {
          attempts++;
          if (attempts < 4) {
            return Promise.reject(new Error('fail'));
          }
          return Promise.resolve('ok');
        });

        const onRetry = jest.fn((_, __, delayMs) => {
          delays.push(delayMs);
        });

        await retryDatabaseOperationImpl(operation, {
          maxRetries: 5,
          initialDelayMs: 100,
          backoffMultiplier: 2,
          onRetry,
        });

        // Delays should be: 100, 200, 400
        expect(delays[0]).toBe(100);
        expect(delays[1]).toBe(200);
        expect(delays[2]).toBe(400);
      });

      it('should cap delay at maxDelayMs', async () => {
        const delays = [];
        let attempts = 0;
        
        const operation = jest.fn().mockImplementation(() => {
          attempts++;
          if (attempts < 5) {
            return Promise.reject(new Error('fail'));
          }
          return Promise.resolve('ok');
        });

        const onRetry = jest.fn((_, __, delayMs) => {
          delays.push(delayMs);
        });

        await retryDatabaseOperationImpl(operation, {
          maxRetries: 6,
          initialDelayMs: 100,
          backoffMultiplier: 10,
          maxDelayMs: 500,
          onRetry,
        });

        // All delays should be capped at 500
        delays.forEach(delay => {
          expect(delay).toBeLessThanOrEqual(500);
        });
      });
    });

    describe('options', () => {
      it('should use default options', async () => {
        const operation = jest.fn().mockResolvedValue('ok');

        await retryDatabaseOperationImpl(operation);

        expect(operation).toHaveBeenCalledTimes(1);
      });

      it('should respect custom maxRetries', async () => {
        const operation = jest.fn().mockRejectedValue(new Error('fail'));

        await expect(
          retryDatabaseOperationImpl(operation, {
            maxRetries: 2,
            initialDelayMs: 1,
          })
        ).rejects.toThrow();

        expect(operation).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('testDatabaseConnection pattern', () => {
    it('should test connection successfully', async () => {
      const mockPool = {
        connect: jest.fn().mockResolvedValue({
          query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
          release: jest.fn(),
        }),
      };

      const testConnection = async () => {
        const client = await mockPool.connect();
        await client.query('SELECT NOW()');
        client.release();
        return true;
      };

      const result = await testConnection();

      expect(result).toBe(true);
      expect(mockPool.connect).toHaveBeenCalled();
    });

    it('should handle connection failure', async () => {
      const mockPool = {
        connect: jest.fn().mockRejectedValue(new Error('Connection refused')),
      };

      const testConnection = async () => {
        try {
          await retryDatabaseOperationImpl(
            () => mockPool.connect(),
            { maxRetries: 2, initialDelayMs: 10 }
          );
          return true;
        } catch {
          return false;
        }
      };

      const result = await testConnection();

      expect(result).toBe(false);
    });
  });

  // Tests using the actual imported functions for coverage
  describe('retryDatabaseOperation (imported)', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await retryDatabaseOperation(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry and succeed on second attempt', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValueOnce('success');
      
      const result = await retryDatabaseOperation(operation, {
        maxRetries: 3,
        initialDelayMs: 10,
      });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));
      
      await expect(retryDatabaseOperation(operation, {
        maxRetries: 3,
        initialDelayMs: 10,
      })).rejects.toThrow('Persistent failure');
      
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should call onRetry callback', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockResolvedValueOnce('success');
      
      const onRetry = jest.fn();
      
      await retryDatabaseOperation(operation, {
        maxRetries: 5,
        initialDelayMs: 10,
        onRetry,
      });
      
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
    });

    it('should not retry on authentication error', async () => {
      const authError = new Error('authentication failed');
      const operation = jest.fn().mockRejectedValue(authError);
      
      await expect(retryDatabaseOperation(operation, {
        maxRetries: 5,
        initialDelayMs: 10,
      })).rejects.toThrow('authentication failed');
      
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not retry on password error', async () => {
      const passwordError = new Error('invalid password');
      const operation = jest.fn().mockRejectedValue(passwordError);
      
      await expect(retryDatabaseOperation(operation, {
        maxRetries: 5,
        initialDelayMs: 10,
      })).rejects.toThrow('invalid password');
      
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not retry on permission denied', async () => {
      const permissionError = new Error('permission denied for table');
      const operation = jest.fn().mockRejectedValue(permissionError);
      
      await expect(retryDatabaseOperation(operation, {
        maxRetries: 5,
        initialDelayMs: 10,
      })).rejects.toThrow('permission denied');
      
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not retry on PostgreSQL code 28000', async () => {
      const authError = { code: '28000', message: 'auth error' };
      const operation = jest.fn().mockRejectedValue(authError);
      
      await expect(retryDatabaseOperation(operation, {
        maxRetries: 5,
        initialDelayMs: 10,
      })).rejects.toBeDefined();
      
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not retry on PostgreSQL code 42601 (syntax_error)', async () => {
      const syntaxError = { code: '42601', message: 'syntax error' };
      const operation = jest.fn().mockRejectedValue(syntaxError);
      
      await expect(retryDatabaseOperation(operation, {
        maxRetries: 5,
        initialDelayMs: 10,
      })).rejects.toBeDefined();
      
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not retry on PostgreSQL code 23505 (unique_violation)', async () => {
      const uniqueError = { code: '23505', message: 'duplicate key' };
      const operation = jest.fn().mockRejectedValue(uniqueError);
      
      await expect(retryDatabaseOperation(operation, {
        maxRetries: 5,
        initialDelayMs: 10,
      })).rejects.toBeDefined();
      
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('testDatabaseConnection (imported)', () => {
    it('should return true when connection succeeds', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };
      const mockPool = {
        connect: jest.fn().mockResolvedValue(mockClient),
      };
      
      const result = await testDatabaseConnection(mockPool, {
        maxRetries: 1,
        initialDelayMs: 10,
      });
      
      expect(result).toBe(true);
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('SELECT NOW()');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return false when connection fails', async () => {
      const mockPool = {
        connect: jest.fn().mockRejectedValue(new Error('Connection refused')),
      };
      
      const result = await testDatabaseConnection(mockPool, {
        maxRetries: 1,
        initialDelayMs: 10,
      });
      
      expect(result).toBe(false);
    });

    it('should retry and succeed on transient failure', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };
      const mockPool = {
        connect: jest.fn()
          .mockRejectedValueOnce(new Error('Connection timeout'))
          .mockResolvedValueOnce(mockClient),
      };
      
      const result = await testDatabaseConnection(mockPool, {
        maxRetries: 3,
        initialDelayMs: 10,
      });
      
      expect(result).toBe(true);
      expect(mockPool.connect).toHaveBeenCalledTimes(2);
    });
  });
});
