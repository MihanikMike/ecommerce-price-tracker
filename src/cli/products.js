#!/usr/bin/env node
/**
 * CLI for managing tracked products
 * 
 * Usage:
 *   node src/cli/products.js list                    - List all tracked products
 *   node src/cli/products.js add-url <url> [site]    - Add URL-based product
 *   node src/cli/products.js add-search <name>       - Add search-based product
 *   node src/cli/products.js remove <id>             - Remove a product
 *   node src/cli/products.js enable <id>             - Enable a product
 *   node src/cli/products.js disable <id>            - Disable a product
 *   node src/cli/products.js update <id> <field> <value> - Update a field
 */

import { pool, closeDatabaseConnection } from '../db/connect-pg.js';

const COMMANDS = {
    list: listProducts,
    'add-url': addUrlProduct,
    'add-search': addSearchProduct,
    remove: removeProduct,
    enable: enableProduct,
    disable: disableProduct,
    update: updateProduct,
    help: showHelp,
};

async function listProducts() {
    console.log('\n📋 TRACKED PRODUCTS\n');
    
    const result = await pool.query(`
        SELECT 
            id, 
            COALESCE(product_name, 'N/A') as name,
            site,
            CASE WHEN url IS NULL THEN 'search' ELSE 'url' END as type,
            COALESCE(SUBSTRING(url, 1, 40), '-') as url,
            enabled,
            check_interval_minutes as interval_min,
            last_checked_at
        FROM tracked_products
        ORDER BY id
    `);
    
    console.table(result.rows);
    console.log(`\nTotal: ${result.rows.length} products`);
}

async function addUrlProduct(url, site = null) {
    if (!url) {
        console.error('❌ URL is required');
        console.log('Usage: node src/cli/products.js add-url <url> [site]');
        return;
    }

    // Auto-detect site from URL
    if (!site) {
        if (url.includes('amazon.com')) site = 'Amazon';
        else if (url.includes('burton.com')) site = 'Burton';
        else if (url.includes('target.com')) site = 'Target';
        else if (url.includes('bestbuy.com')) site = 'Best Buy';
        else if (url.includes('walmart.com')) site = 'Walmart';
        else if (url.includes('newegg.com')) site = 'Newegg';
        else if (url.includes('bhphotovideo.com')) site = 'B&H Photo';
        else site = 'Other';
    }

    const result = await pool.query(
        `INSERT INTO tracked_products (url, site, enabled, check_interval_minutes)
         VALUES ($1, $2, true, 60)
         ON CONFLICT (url) DO NOTHING
         RETURNING id`,
        [url, site]
    );

    if (result.rows.length > 0) {
        console.log(`✅ Added product #${result.rows[0].id}: ${site} - ${url.substring(0, 50)}...`);
    } else {
        console.log('⚠️ Product already exists');
    }
}

async function addSearchProduct(name, ...keywords) {
    if (!name) {
        console.error('❌ Product name is required');
        console.log('Usage: node src/cli/products.js add-search "Product Name" [keyword1] [keyword2]');
        return;
    }

    const result = await pool.query(
        `INSERT INTO tracked_products (product_name, site, search_keywords, enabled, check_interval_minutes, tracking_mode)
         VALUES ($1, 'any', $2, true, 60, 'search')
         RETURNING id`,
        [name, keywords.length > 0 ? keywords : null]
    );

    console.log(`✅ Added search product #${result.rows[0].id}: "${name}"`);
    if (keywords.length > 0) {
        console.log(`   Keywords: ${keywords.join(', ')}`);
    }
}

async function removeProduct(id) {
    if (!id) {
        console.error('❌ Product ID is required');
        console.log('Usage: node src/cli/products.js remove <id>');
        return;
    }

    const result = await pool.query(
        'DELETE FROM tracked_products WHERE id = $1 RETURNING id, COALESCE(product_name, url) as name',
        [parseInt(id)]
    );

    if (result.rows.length > 0) {
        console.log(`✅ Removed product #${id}: ${result.rows[0].name}`);
    } else {
        console.log(`❌ Product #${id} not found`);
    }
}

async function enableProduct(id) {
    if (!id) {
        console.error('❌ Product ID is required');
        return;
    }

    await pool.query('UPDATE tracked_products SET enabled = true WHERE id = $1', [parseInt(id)]);
    console.log(`✅ Enabled product #${id}`);
}

async function disableProduct(id) {
    if (!id) {
        console.error('❌ Product ID is required');
        return;
    }

    await pool.query('UPDATE tracked_products SET enabled = false WHERE id = $1', [parseInt(id)]);
    console.log(`✅ Disabled product #${id}`);
}

async function updateProduct(id, field, value) {
    if (!id || !field || value === undefined) {
        console.error('❌ ID, field, and value are required');
        console.log('Usage: node src/cli/products.js update <id> <field> <value>');
        console.log('Fields: product_name, site, url, check_interval_minutes');
        return;
    }

    const allowedFields = ['product_name', 'site', 'url', 'check_interval_minutes'];
    if (!allowedFields.includes(field)) {
        console.error(`❌ Invalid field. Allowed: ${allowedFields.join(', ')}`);
        return;
    }

    // Convert interval to number
    if (field === 'check_interval_minutes') {
        value = parseInt(value);
    }

    await pool.query(
        `UPDATE tracked_products SET ${field} = $1 WHERE id = $2`,
        [value, parseInt(id)]
    );
    console.log(`✅ Updated product #${id}: ${field} = ${value}`);
}

function showHelp() {
    console.log(`
📦 Product Management CLI

Usage: node src/cli/products.js <command> [options]

Commands:
  list                          List all tracked products
  add-url <url> [site]          Add a URL-based product
  add-search <name> [keywords]  Add a search-based product
  remove <id>                   Remove a product by ID
  enable <id>                   Enable tracking for a product
  disable <id>                  Disable tracking for a product
  update <id> <field> <value>   Update a product field
  help                          Show this help message

Examples:
  node src/cli/products.js list
  node src/cli/products.js add-url "https://www.amazon.com/dp/B09V3KXJPB"
  node src/cli/products.js add-search "MacBook Pro M3"
  node src/cli/products.js add-search "Sony WH-1000XM5" headphones wireless
  node src/cli/products.js remove 5
  node src/cli/products.js disable 3
  node src/cli/products.js update 4 product_name "AirPods Pro 4"
  node src/cli/products.js update 2 check_interval_minutes 120
`);
}

async function main() {
    const [,, command, ...args] = process.argv;

    if (!command || !COMMANDS[command]) {
        showHelp();
        await closeDatabaseConnection();
        process.exit(command ? 1 : 0);
        return;
    }

    try {
        await COMMANDS[command](...args);
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await closeDatabaseConnection();
    }
}

main();
