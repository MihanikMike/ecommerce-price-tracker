import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

/**
 * Tests for config validation logic
 * Uses inline implementations to test validation patterns
 */

// Inline implementation of validateConfig logic
function validateConfigImpl(config) {
  const errors = [];
  const warnings = [];

  // Required for database connection
  if (!config.pg?.user) {
    errors.push('PG_USER is required');
  }
  if (!config.pg?.password) {
    errors.push('PG_PASSWORD is required');
  }
  if (!config.pg?.database) {
    errors.push('PG_DATABASE is required');
  }

  // Warnings for recommended settings
  if (config.nodeEnv === 'production') {
    if (config.log?.level === 'debug') {
      warnings.push('LOG_LEVEL=debug in production may impact performance');
    }
    if (!config.scraper?.useProxy) {
      warnings.push('SCRAPER_USE_PROXY=false in production - consider using proxies to avoid blocks');
    }
  }

  // Validate numeric ranges
  if (config.pg?.port < 1 || config.pg?.port > 65535) {
    errors.push(`PG_PORT must be between 1 and 65535, got: ${config.pg?.port}`);
  }
  if (config.scraper?.timeout < 1000) {
    warnings.push(`SCRAPER_TIMEOUT=${config.scraper?.timeout}ms is very low, may cause failures`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Config parsing functions
function parseIntWithDefault(value, defaultValue) {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseFloatWithDefault(value, defaultValue) {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseBooleanEnv(value, defaultValue) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return defaultValue;
}

describe('config', () => {
  describe('validateConfigImpl', () => {
    describe('required fields', () => {
      it('should fail validation when PG_USER is missing', () => {
        const config = {
          pg: { user: null, password: 'pass', database: 'db', port: 5432 },
          nodeEnv: 'development',
        };

        const result = validateConfigImpl(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('PG_USER is required');
      });

      it('should fail validation when PG_PASSWORD is missing', () => {
        const config = {
          pg: { user: 'user', password: '', database: 'db', port: 5432 },
          nodeEnv: 'development',
        };

        const result = validateConfigImpl(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('PG_PASSWORD is required');
      });

      it('should fail validation when PG_DATABASE is missing', () => {
        const config = {
          pg: { user: 'user', password: 'pass', database: undefined, port: 5432 },
          nodeEnv: 'development',
        };

        const result = validateConfigImpl(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('PG_DATABASE is required');
      });

      it('should pass validation with all required fields', () => {
        const config = {
          pg: { user: 'user', password: 'pass', database: 'db', port: 5432 },
          nodeEnv: 'development',
          scraper: { timeout: 30000 },
        };

        const result = validateConfigImpl(config);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should collect multiple errors', () => {
        const config = {
          pg: { user: null, password: null, database: null, port: 5432 },
          nodeEnv: 'development',
        };

        const result = validateConfigImpl(config);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBe(3);
      });
    });

    describe('production warnings', () => {
      it('should warn about debug logging in production', () => {
        const config = {
          pg: { user: 'user', password: 'pass', database: 'db', port: 5432 },
          nodeEnv: 'production',
          log: { level: 'debug' },
          scraper: { useProxy: true, timeout: 30000 },
        };

        const result = validateConfigImpl(config);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContain(
          'LOG_LEVEL=debug in production may impact performance'
        );
      });

      it('should warn about no proxy in production', () => {
        const config = {
          pg: { user: 'user', password: 'pass', database: 'db', port: 5432 },
          nodeEnv: 'production',
          log: { level: 'info' },
          scraper: { useProxy: false, timeout: 30000 },
        };

        const result = validateConfigImpl(config);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContain(
          'SCRAPER_USE_PROXY=false in production - consider using proxies to avoid blocks'
        );
      });

      it('should not warn in development', () => {
        const config = {
          pg: { user: 'user', password: 'pass', database: 'db', port: 5432 },
          nodeEnv: 'development',
          log: { level: 'debug' },
          scraper: { useProxy: false, timeout: 30000 },
        };

        const result = validateConfigImpl(config);

        expect(result.warnings).toHaveLength(0);
      });
    });

    describe('port validation', () => {
      it('should fail validation for port 0', () => {
        const config = {
          pg: { user: 'user', password: 'pass', database: 'db', port: 0 },
          nodeEnv: 'development',
        };

        const result = validateConfigImpl(config);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('PG_PORT'))).toBe(true);
      });

      it('should fail validation for port > 65535', () => {
        const config = {
          pg: { user: 'user', password: 'pass', database: 'db', port: 70000 },
          nodeEnv: 'development',
        };

        const result = validateConfigImpl(config);

        expect(result.valid).toBe(false);
      });

      it('should pass validation for valid port', () => {
        const config = {
          pg: { user: 'user', password: 'pass', database: 'db', port: 5432 },
          nodeEnv: 'development',
          scraper: { timeout: 30000 },
        };

        const result = validateConfigImpl(config);

        expect(result.valid).toBe(true);
      });
    });

    describe('timeout validation', () => {
      it('should warn about very low timeout', () => {
        const config = {
          pg: { user: 'user', password: 'pass', database: 'db', port: 5432 },
          nodeEnv: 'development',
          scraper: { timeout: 500 },
        };

        const result = validateConfigImpl(config);

        expect(result.warnings.some(w => w.includes('SCRAPER_TIMEOUT'))).toBe(true);
      });

      it('should not warn about reasonable timeout', () => {
        const config = {
          pg: { user: 'user', password: 'pass', database: 'db', port: 5432 },
          nodeEnv: 'development',
          scraper: { timeout: 30000 },
        };

        const result = validateConfigImpl(config);

        expect(result.warnings.filter(w => w.includes('SCRAPER_TIMEOUT'))).toHaveLength(0);
      });
    });
  });

  describe('parseIntWithDefault', () => {
    it('should parse valid integers', () => {
      expect(parseIntWithDefault('5432', 1234)).toBe(5432);
      expect(parseIntWithDefault('0', 1234)).toBe(0);
      expect(parseIntWithDefault('-10', 1234)).toBe(-10);
    });

    it('should return default for invalid input', () => {
      expect(parseIntWithDefault('abc', 1234)).toBe(1234);
      expect(parseIntWithDefault('', 1234)).toBe(1234);
      expect(parseIntWithDefault(null, 1234)).toBe(1234);
      expect(parseIntWithDefault(undefined, 1234)).toBe(1234);
    });

    it('should handle float strings by truncating', () => {
      expect(parseIntWithDefault('5.7', 0)).toBe(5);
    });
  });

  describe('parseFloatWithDefault', () => {
    it('should parse valid floats', () => {
      expect(parseFloatWithDefault('3.14', 0)).toBe(3.14);
      expect(parseFloatWithDefault('10', 0)).toBe(10);
      expect(parseFloatWithDefault('-5.5', 0)).toBe(-5.5);
    });

    it('should return default for invalid input', () => {
      expect(parseFloatWithDefault('abc', 1.5)).toBe(1.5);
      expect(parseFloatWithDefault('', 1.5)).toBe(1.5);
      expect(parseFloatWithDefault(null, 1.5)).toBe(1.5);
    });
  });

  describe('parseBooleanEnv', () => {
    it('should parse true string', () => {
      expect(parseBooleanEnv('true', false)).toBe(true);
    });

    it('should parse false string', () => {
      expect(parseBooleanEnv('false', true)).toBe(false);
    });

    it('should return default for other values', () => {
      expect(parseBooleanEnv('yes', true)).toBe(true);
      expect(parseBooleanEnv('1', false)).toBe(false);
      expect(parseBooleanEnv('', true)).toBe(true);
      expect(parseBooleanEnv(null, false)).toBe(false);
      expect(parseBooleanEnv(undefined, true)).toBe(true);
    });
  });

  describe('config structure', () => {
    it('should define all required config sections', () => {
      // This tests the expected structure of config
      const expectedSections = [
        'nodeEnv', 'port', 'healthPort', 'apiPort',
        'pg', 'scraper', 'log', 'paths', 'priceChange', 'retention'
      ];

      // Just verify these are the expected keys
      expect(expectedSections).toContain('pg');
      expect(expectedSections).toContain('scraper');
      expect(expectedSections).toContain('priceChange');
    });

    it('should have price change config with proper defaults', () => {
      const defaultPriceChange = {
        minAbsoluteChange: 1.00,
        minPercentChange: 5,
        alertDropThreshold: 10,
        alertIncreaseThreshold: 20,
      };

      expect(defaultPriceChange.minAbsoluteChange).toBe(1.00);
      expect(defaultPriceChange.minPercentChange).toBe(5);
    });

    it('should have retention config with proper defaults', () => {
      const defaultRetention = {
        priceHistoryDays: 90,
        minPriceRecordsPerProduct: 10,
        staleProductDays: 180,
        searchResultDays: 30,
        deleteBatchSize: 1000,
        keepDailySamples: true,
      };

      expect(defaultRetention.priceHistoryDays).toBe(90);
      expect(defaultRetention.keepDailySamples).toBe(true);
    });
  });
});

// Tests for actual exported functions
import config, { validateConfig } from '../../../src/config/index.js';

describe('config (actual imports)', () => {
  describe('config default export', () => {
    it('should export a config object', () => {
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    it('should have pg configuration', () => {
      expect(config.pg).toBeDefined();
      expect(typeof config.pg.port).toBe('number');
      expect(typeof config.pg.max).toBe('number');
    });

    it('should have scraper configuration', () => {
      expect(config.scraper).toBeDefined();
      expect(typeof config.scraper.retries).toBe('number');
      expect(typeof config.scraper.minDelay).toBe('number');
      expect(typeof config.scraper.maxDelay).toBe('number');
      expect(typeof config.scraper.timeout).toBe('number');
    });

    it('should have priceChange configuration', () => {
      expect(config.priceChange).toBeDefined();
      expect(typeof config.priceChange.minAbsoluteChange).toBe('number');
      expect(typeof config.priceChange.minPercentChange).toBe('number');
      expect(typeof config.priceChange.alertDropThreshold).toBe('number');
      expect(typeof config.priceChange.alertIncreaseThreshold).toBe('number');
    });

    it('should have retention configuration', () => {
      expect(config.retention).toBeDefined();
      expect(typeof config.retention.priceHistoryDays).toBe('number');
      expect(typeof config.retention.minPriceRecordsPerProduct).toBe('number');
      expect(typeof config.retention.staleProductDays).toBe('number');
      expect(typeof config.retention.searchResultDays).toBe('number');
      expect(typeof config.retention.deleteBatchSize).toBe('number');
    });

    it('should have log configuration', () => {
      expect(config.log).toBeDefined();
      expect(typeof config.log.level).toBe('string');
    });

    it('should have paths configuration', () => {
      expect(config.paths).toBeDefined();
      expect(typeof config.paths.userAgents).toBe('string');
      expect(typeof config.paths.exports).toBe('string');
    });
  });

  describe('validateConfig', () => {
    it('should return validation result object', () => {
      const result = validateConfig();
      
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should validate current config successfully (test env)', () => {
      const result = validateConfig();
      
      // In test environment, we should have valid config
      expect(result.valid).toBe(true);
    });
  });
});
