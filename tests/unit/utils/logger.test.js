import { describe, it, expect } from '@jest/globals';
import logger from '../../../src/utils/logger.js';

describe('logger', () => {
  describe('logger instance', () => {
    it('should be a valid logger object', () => {
      expect(logger).toBeDefined();
      expect(typeof logger).toBe('object');
    });

    it('should have info method', () => {
      expect(typeof logger.info).toBe('function');
    });

    it('should have debug method', () => {
      expect(typeof logger.debug).toBe('function');
    });

    it('should have warn method', () => {
      expect(typeof logger.warn).toBe('function');
    });

    it('should have error method', () => {
      expect(typeof logger.error).toBe('function');
    });

    it('should have child method for creating child loggers', () => {
      expect(typeof logger.child).toBe('function');
    });

    it('should create child logger with context', () => {
      const childLogger = logger.child({ module: 'test' });
      
      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe('function');
    });
  });

  describe('logging operations', () => {
    it('should not throw when logging info', () => {
      expect(() => {
        logger.info('Test info message');
      }).not.toThrow();
    });

    it('should not throw when logging with object', () => {
      expect(() => {
        logger.info({ key: 'value' }, 'Test with object');
      }).not.toThrow();
    });

    it('should not throw when logging debug', () => {
      expect(() => {
        logger.debug('Test debug message');
      }).not.toThrow();
    });

    it('should not throw when logging warn', () => {
      expect(() => {
        logger.warn('Test warning message');
      }).not.toThrow();
    });

    it('should not throw when logging error', () => {
      expect(() => {
        logger.error('Test error message');
      }).not.toThrow();
    });

    it('should not throw when logging error with Error object', () => {
      expect(() => {
        logger.error({ err: new Error('Test error') }, 'Error occurred');
      }).not.toThrow();
    });
  });
});
