import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const config = {
  // Application
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  
  // PostgreSQL
  pg: {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT, 10) || 5432,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    max: parseInt(process.env.PG_POOL_MAX, 10) || 20,
    idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT, 10) || 30000,
    connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT, 10) || 10000,
  },
  
  // Scraper
  scraper: {
    retries: parseInt(process.env.SCRAPER_RETRIES, 10) || 3,
    minDelay: parseInt(process.env.SCRAPER_MIN_DELAY, 10) || 1200,
    maxDelay: parseInt(process.env.SCRAPER_MAX_DELAY, 10) || 2500,
    timeout: parseInt(process.env.SCRAPER_TIMEOUT, 10) || 30000,
    headless: process.env.SCRAPER_HEADLESS !== 'false',
    useProxy: process.env.SCRAPER_USE_PROXY === 'true',
  },
  
  // Logging
  log: {
    level: process.env.LOG_LEVEL || 'info',
    prettyPrint: process.env.NODE_ENV === 'development',
  },
  
  // Paths
  paths: {
    userAgents: process.env.USER_AGENTS_FILE || path.join(__dirname, '../../data/useragents.txt'),
    exports: process.env.EXPORTS_DIR || path.join(__dirname, '../../exports'),
  },
};

/**
 * Validate required environment variables
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateConfig() {
  const errors = [];
  const warnings = [];

  // Required for database connection
  if (!config.pg.user) {
    errors.push('PG_USER is required');
  }
  if (!config.pg.password) {
    errors.push('PG_PASSWORD is required');
  }
  if (!config.pg.database) {
    errors.push('PG_DATABASE is required');
  }

  // Warnings for recommended settings
  if (config.nodeEnv === 'production') {
    if (config.log.level === 'debug') {
      warnings.push('LOG_LEVEL=debug in production may impact performance');
    }
    if (!config.scraper.useProxy) {
      warnings.push('SCRAPER_USE_PROXY=false in production - consider using proxies to avoid blocks');
    }
  }

  // Validate numeric ranges
  if (config.pg.port < 1 || config.pg.port > 65535) {
    errors.push(`PG_PORT must be between 1 and 65535, got: ${config.pg.port}`);
  }
  if (config.scraper.timeout < 1000) {
    warnings.push(`SCRAPER_TIMEOUT=${config.scraper.timeout}ms is very low, may cause failures`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate config and exit if invalid (for use at startup)
 */
export function validateConfigOrExit() {
  const { valid, errors, warnings } = validateConfig();

  // Log warnings
  for (const warning of warnings) {
    console.warn(`⚠️  Config warning: ${warning}`);
  }

  // Exit on errors
  if (!valid) {
    console.error('❌ Configuration errors:');
    for (const error of errors) {
      console.error(`   - ${error}`);
    }
    console.error('\nPlease check your .env file or environment variables.');
    process.exit(1);
  }

  if (warnings.length === 0 && errors.length === 0) {
    console.log('✅ Configuration validated successfully');
  }
}

export default config;