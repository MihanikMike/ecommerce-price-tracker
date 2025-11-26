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

export default config;