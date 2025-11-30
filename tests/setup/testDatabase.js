import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pool = null;
let isInitialized = false;

export async function setupTestDatabase() {
  // If already initialized, just return the pool
  if (pool && isInitialized) {
    return pool;
  }

  pool = new pg.Pool({
    host: process.env.TEST_PG_HOST || 'localhost',
    port: process.env.TEST_PG_PORT || 5432,
    user: process.env.TEST_PG_USER || 'mike228',
    password: process.env.TEST_PG_PASSWORD || '12345678',
    database: process.env.TEST_PG_DATABASE || 'price_tracker_test',
    max: 5
  });

  // Test connection
  try {
    await pool.query('SELECT NOW()');
  } catch (error) {
    console.error('Failed to connect to test database:', error.message);
    throw error;
  }

  // Drop and recreate - use a transaction for clean state
  await pool.query(`
    DROP TABLE IF EXISTS search_results CASCADE;
    DROP TABLE IF EXISTS daily_price_samples CASCADE;
    DROP TABLE IF EXISTS price_history CASCADE;
    DROP TABLE IF EXISTS tracked_products CASCADE;
    DROP TABLE IF EXISTS products CASCADE;
    DROP TYPE IF EXISTS tracking_mode CASCADE;
  `);

  // Run migrations
  const migrationsDir = path.join(__dirname, '../../src/db/migrations');
  const files = fs.readdirSync(migrationsDir).sort();
  
  for (const file of files) {
    if (file.endsWith('.sql')) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      try {
        await pool.query(sql);
      } catch (error) {
        // Ignore "already exists" errors
        if (!error.message.includes('already exists')) {
          console.error(`Migration ${file} failed:`, error.message);
          throw error;
        }
      }
    }
  }

  isInitialized = true;
  return pool;
}

export async function cleanupTestDatabase() {
  if (pool) {
    // Truncate all tables (if they exist)
    try {
      await pool.query(`
        TRUNCATE TABLE search_results, price_history, products, tracked_products RESTART IDENTITY CASCADE;
      `);
    } catch (error) {
      // Tables might not exist yet, ignore
      if (!error.message.includes('does not exist')) {
        throw error;
      }
    }
  }
}

export async function closeTestDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
    isInitialized = false;
  }
}

export function getTestPool() {
  return pool;
}