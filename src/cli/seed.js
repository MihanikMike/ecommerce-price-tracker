import logger from '../utils/logger.js';
import { pool, closeDatabaseConnection } from '../db/connect-pg.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load seed data from JSON file
function loadSeedData() {
    try {
        const seedPath = path.join(__dirname, '../../data/seed-products.json');
        const data = JSON.parse(readFileSync(seedPath, 'utf8'));
        return data.products;
    } catch (error) {
        console.error('❌ Error loading seed data:', error.message);
        console.error('   Make sure data/seed-products.json exists');
        throw error;
    }
}

async function seedDatabase() {
    const products = loadSeedData();
    
    console.log('🌱 Starting database seeding...');
    console.log(`   Found ${products.length} products to seed`);

    let seeded = 0;
    let skipped = 0;
    
    try {
        for (const product of products) {
            const result = await pool.query(
                `INSERT INTO tracked_products (url, site, enabled, check_interval_minutes)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (url) DO NOTHING
                 RETURNING id`,
                [product.url, product.site, product.enabled, product.check_interval_minutes]
            );

            if (result.rows.length > 0) {
                console.log(`   ✓ Seeded: ${product.description || product.url}`);
                seeded++;
            } else {
                console.log(`   - Skipped (exists): ${product.description || product.url}`);
                skipped++;
            }
        }

        console.log('');
        console.log('✅ Database seeding completed successfully');
        console.log(`   Seeded: ${seeded}, Skipped: ${skipped}`);
        
        logger.info({ seeded, skipped }, 'Database seeding completed');
    } catch (error) {
        console.error('');
        console.error('❌ Database seeding failed:', error.message);
        if (error.code) {
            console.error(`   Error code: ${error.code}`);
        }
        if (error.detail) {
            console.error(`   Detail: ${error.detail}`);
        }
        logger.error({ error }, 'Database seeding failed');
        throw error;
    }
}

async function main() {
    try {
        await seedDatabase();
        await closeDatabaseConnection();
        process.exit(0);
    } catch (error) {
        console.error('');
        console.error('💡 Troubleshooting tips:');
        console.error('   1. Check database connection: npm run check-db');
        console.error('   2. Run migrations first: npm run migrate');
        console.error('   3. Check your .env file has correct credentials');
        await closeDatabaseConnection();
        process.exit(1);
    }
}

main();
