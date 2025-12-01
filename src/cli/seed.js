import logger from '../utils/logger.js';
import { pool, closeDatabaseConnection } from '../db/connect-pg.js';

const SEED_PRODUCTS = [
    {
        url: 'https://www.amazon.com/dp/B0DHS3B7S1',
        site: 'Amazon',
        enabled: true,
        check_interval_minutes: 60
    },
    {
        url: 'https://www.amazon.com/dp/B0DHS5F4PZ',
        site: 'Amazon',
        enabled: true,
        check_interval_minutes: 60
    },
    {
        url: 'https://www.burton.com/us/en/p/mens-burton-cartel-x-snowboard-bindings/W25JP-109861.html',
        site: 'Burton',
        enabled: true,
        check_interval_minutes: 120
    }
];

async function seedDatabase() {
    try {
        logger.info('Starting database seeding...');

        // Insert tracked products
        for (const product of SEED_PRODUCTS) {
            const result = await pool.query(
                `INSERT INTO tracked_products (url, site, enabled, check_interval_minutes)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (url) DO NOTHING
                 RETURNING id`,
                [product.url, product.site, product.enabled, product.check_interval_minutes]
            );

            if (result.rows.length > 0) {
                logger.info({ id: result.rows[0].id, url: product.url }, 'Seeded product');
            } else {
                logger.info({ url: product.url }, 'Product already exists');
            }
        }

        logger.info('✅ Database seeding completed successfully');
    } catch (error) {
        logger.error({ error }, '❌ Database seeding failed');
        throw error;
    }
}

async function main() {
    try {
        await seedDatabase();
        await closeDatabaseConnection();
        process.exit(0);
    } catch (error) {
        await closeDatabaseConnection();
        process.exit(1);
    }
}

main();
