import { browserPool } from '../utils/BrowserPool.js';
import logger from '../utils/logger.js';

async function main() {
    try {
        await browserPool.initialize();
        
        const health = await browserPool.healthCheck();
        const stats = browserPool.getStats();
        
        logger.info({ health, stats }, 'Browser pool status');
        
        console.log('\n📊 Browser Pool Status:\n');
        console.log(`Initialized: ${health.initialized ? '✅' : '❌'}`);
        console.log(`Healthy: ${health.healthy ? '✅' : '❌'}`);
        console.log(`Total Browsers: ${health.totalBrowsers}`);
        console.log(`Available: ${health.available}`);
        console.log(`In Use: ${health.inUse}`);
        console.log(`Waiting: ${health.waiting}`);
        console.log(`\nStatistics:`);
        console.log(`  Total Acquired: ${stats.totalAcquired}`);
        console.log(`  Total Released: ${stats.totalReleased}`);
        console.log(`  Peak In Use: ${stats.peakInUse}`);
        
        if (health.issues.length > 0) {
            console.log(`\n⚠️  Issues: ${health.issues.join(', ')}`);
        }
        
        await browserPool.closeAll();
        process.exit(0);
    } catch (error) {
        logger.error({ error }, 'Failed to check browser pool');
        process.exit(1);
    }
}

main();
