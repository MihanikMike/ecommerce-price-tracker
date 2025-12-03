#!/usr/bin/env node

/**
 * Cache Management CLI Tool
 * 
 * Commands:
 *   node src/cli/cache.js status       - Show cache status and stats
 *   node src/cli/cache.js clear        - Clear all cache
 *   node src/cli/cache.js clear <id>   - Clear cache for specific product
 *   node src/cli/cache.js test         - Test cache connectivity
 */

import * as cacheService from '../services/cacheService.js';
import logger from '../utils/logger.js';

const command = process.argv[2] || 'status';
const arg = process.argv[3];

async function main() {
    console.log('\n🗄️  Cache Management Tool\n');
    console.log('═'.repeat(50));
    
    try {
        switch (command) {
            case 'status':
                await showStatus();
                break;
            case 'stats':
                await showStatus();
                break;
            case 'clear':
                await clearCache(arg);
                break;
            case 'flush':
                await clearCache();
                break;
            case 'test':
                await testCache();
                break;
            case 'help':
                showHelp();
                break;
            default:
                console.log(`Unknown command: ${command}`);
                showHelp();
                process.exit(1);
        }
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        logger.error({ error }, 'Cache CLI error');
        process.exit(1);
    }
    
    // Close connection
    await cacheService.closeCache();
    process.exit(0);
}

async function showStatus() {
    console.log('\n📊 Cache Status:\n');
    
    const stats = await cacheService.getStats();
    
    console.log(`  Enabled:     ${stats.enabled ? '✅ Yes' : '❌ No'}`);
    console.log(`  Connected:   ${stats.connected ? '✅ Yes' : '❌ No'}`);
    
    if (stats.enabled && stats.connected) {
        console.log(`\n📈 Statistics:\n`);
        console.log(`  Total Keys:  ${stats.keyCount || 'N/A'}`);
        console.log(`  Memory Used: ${stats.memoryUsed || 'N/A'}`);
        console.log(`  Hits:        ${stats.hits || 0}`);
        console.log(`  Misses:      ${stats.misses || 0}`);
        
        if (stats.hits || stats.misses) {
            const hitRate = stats.hits / (stats.hits + stats.misses) * 100;
            console.log(`  Hit Rate:    ${hitRate.toFixed(2)}%`);
        }
        
        if (stats.uptime) {
            const hours = Math.floor(stats.uptime / 3600);
            const minutes = Math.floor((stats.uptime % 3600) / 60);
            console.log(`  Uptime:      ${hours}h ${minutes}m`);
        }
        
        console.log(`\n🔑 Key Patterns:\n`);
        console.log(`  ${cacheService.CACHE_KEYS.PRODUCT}:*     - Single product data`);
        console.log(`  ${cacheService.CACHE_KEYS.PRODUCT_LIST}  - Product list`);
        console.log(`  ${cacheService.CACHE_KEYS.PRODUCT_HISTORY}:*   - Price history`);
        console.log(`  ${cacheService.CACHE_KEYS.CHART_DATA}:*       - Chart data`);
        console.log(`  ${cacheService.CACHE_KEYS.SEARCH_RESULTS}:*    - Search results`);
        console.log(`  ${cacheService.CACHE_KEYS.STATS}          - Database stats`);
    } else if (!stats.enabled) {
        console.log('\n⚠️  Cache is disabled. Set CACHE_ENABLED=true to enable.');
        console.log('   Configure REDIS_HOST and REDIS_PORT for Redis connection.');
    } else {
        console.log('\n⚠️  Cache is enabled but not connected to Redis.');
        console.log('   Check if Redis is running and accessible.');
    }
    
    console.log(`\n⚙️  Configuration:\n`);
    console.log(`  CACHE_ENABLED:   ${process.env.CACHE_ENABLED || 'false'}`);
    console.log(`  REDIS_HOST:      ${process.env.REDIS_HOST || 'localhost'}`);
    console.log(`  REDIS_PORT:      ${process.env.REDIS_PORT || '6379'}`);
    console.log(`  CACHE_TTL:       ${process.env.CACHE_TTL || '3600'}s (default)`);
    console.log(`  CACHE_PREFIX:    ${process.env.CACHE_PREFIX || 'pt'}`);
}

async function clearCache(productId) {
    if (productId) {
        const id = parseInt(productId, 10);
        if (isNaN(id)) {
            console.log('❌ Invalid product ID');
            return;
        }
        
        console.log(`\n🗑️  Clearing cache for product ${id}...`);
        await cacheService.invalidateProduct(id);
        console.log(`✅ Cache cleared for product ${id}`);
    } else {
        console.log('\n🗑️  Clearing all cache...');
        await cacheService.flushAll();
        console.log('✅ All cache cleared');
    }
}

async function testCache() {
    console.log('\n🧪 Testing Cache Operations:\n');
    
    // Test connection
    const stats = await cacheService.getStats();
    console.log(`  1. Connection: ${stats.connected ? '✅ OK' : '❌ Failed'}`);
    
    if (!stats.enabled) {
        console.log('\n⚠️  Cache is disabled. Enable with CACHE_ENABLED=true');
        return;
    }
    
    if (!stats.connected) {
        console.log('\n❌ Cannot connect to Redis. Check configuration.');
        return;
    }
    
    // Test set/get
    const testKey = 'pt:test:cli';
    const testValue = { timestamp: Date.now(), test: true };
    
    await cacheService.set(testKey, testValue, 60);
    const retrieved = await cacheService.get(testKey);
    const setGetOk = retrieved && retrieved.test === true;
    console.log(`  2. Set/Get:    ${setGetOk ? '✅ OK' : '❌ Failed'}`);
    
    // Test delete
    await cacheService.del(testKey);
    const afterDelete = await cacheService.get(testKey);
    const deleteOk = afterDelete === null;
    console.log(`  3. Delete:     ${deleteOk ? '✅ OK' : '❌ Failed'}`);
    
    // Test getOrSet
    let computeCount = 0;
    const compute = async () => {
        computeCount++;
        return { computed: true, count: computeCount };
    };
    
    await cacheService.getOrSet(testKey, compute, 60);
    await cacheService.getOrSet(testKey, compute, 60);
    const getOrSetOk = computeCount === 1; // Should only compute once
    console.log(`  4. GetOrSet:   ${getOrSetOk ? '✅ OK' : '❌ Failed'}`);
    
    // Cleanup
    await cacheService.del(testKey);
    
    const allPassed = setGetOk && deleteOk && getOrSetOk;
    console.log(`\n${allPassed ? '✅ All tests passed!' : '❌ Some tests failed'}`);
}

function showHelp() {
    console.log(`
Usage: node src/cli/cache.js <command> [options]

Commands:
  status           Show cache status and statistics
  stats            Alias for status
  clear            Clear all cache entries
  clear <id>       Clear cache for specific product ID
  flush            Alias for clear (clears all)
  test             Test cache connectivity and operations
  help             Show this help message

Environment Variables:
  CACHE_ENABLED    Enable/disable caching (true/false)
  REDIS_HOST       Redis server host (default: localhost)
  REDIS_PORT       Redis server port (default: 6379)
  REDIS_PASSWORD   Redis password (optional)
  CACHE_TTL        Default TTL in seconds (default: 3600)
  CACHE_PREFIX     Key prefix (default: pt)

Examples:
  node src/cli/cache.js status
  node src/cli/cache.js clear
  node src/cli/cache.js clear 123
  CACHE_ENABLED=true node src/cli/cache.js test

API Endpoints:
  GET /api/cache/stats           - Get cache statistics
  DELETE /api/cache              - Clear all cache
  DELETE /api/cache/product/:id  - Clear product cache
`);
}

main();
