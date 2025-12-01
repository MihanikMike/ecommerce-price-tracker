import { firefox } from 'playwright';
import logger from './logger.js';
import config from '../config/index.js';

class BrowserPool {
    constructor(size = 3, browserType = 'firefox') {
        this.size = size;
        this.browserType = browserType; // 'chromium' or 'firefox'
        this.browsers = [];
        this.available = [];
        this.waiting = [];
        this.initialized = false;
        this.stats = {
            totalAcquired: 0,
            totalReleased: 0,
            currentInUse: 0,
            peakInUse: 0
        };
    }

    async initialize() {
        if (this.initialized) {
            logger.warn('Browser pool already initialized');
            return;
        }

        logger.info({ size: this.size, browserType: this.browserType }, 'Initializing browser pool');
        
        try {
            const launchOptions = {
                headless: config.scraper?.headless !== false,
            };
            
            for (let i = 0; i < this.size; i++) {
                const browser = await firefox.launch(launchOptions);
                this.browsers.push(browser);
                this.available.push(browser);
                logger.debug({ browserId: i + 1 }, 'Browser launched');
            }
            
            this.initialized = true;
            logger.info({ size: this.size, browserType: this.browserType }, 'Browser pool ready');
        } catch (error) {
            logger.error({ error }, 'Failed to initialize browser pool');
            throw error;
        }
    }

    async acquire(timeout = 30000) {
        if (!this.initialized) {
            throw new Error('Browser pool not initialized. Call initialize() first.');
        }

        while (this.available.length > 0) {
            const browser = this.available.pop();
            
            // Check if browser is still connected
            if (browser.isConnected()) {
                this.stats.totalAcquired++;
                this.stats.currentInUse++;
                this.stats.peakInUse = Math.max(this.stats.peakInUse, this.stats.currentInUse);
                
                logger.debug({ 
                    available: this.available.length,
                    inUse: this.stats.currentInUse 
                }, 'Browser acquired');
                
                return browser;
            } else {
                // Browser disconnected, create a replacement
                logger.warn('Found disconnected browser, creating replacement');
                try {
                    const newBrowser = await firefox.launch({
                        headless: true,
                    });
                    this.stats.totalAcquired++;
                    this.stats.currentInUse++;
                    this.stats.peakInUse = Math.max(this.stats.peakInUse, this.stats.currentInUse);
                    return newBrowser;
                } catch (error) {
                    logger.error({ error }, 'Failed to create replacement browser');
                    // Continue to try next available or wait
                }
            }
        }

        // Wait for browser to become available with timeout
        logger.debug({ waiting: this.waiting.length + 1 }, 'Waiting for available browser');
        
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                const index = this.waiting.findIndex(w => w.resolve === resolve);
                if (index !== -1) {
                    this.waiting.splice(index, 1);
                }
                reject(new Error(`Browser acquire timeout after ${timeout}ms`));
            }, timeout);

            this.waiting.push({
                resolve: (browser) => {
                    clearTimeout(timer);
                    this.stats.totalAcquired++;
                    this.stats.currentInUse++;
                    this.stats.peakInUse = Math.max(this.stats.peakInUse, this.stats.currentInUse);
                    resolve(browser);
                },
                reject
            });
        });
    }

    release(browser) {
        if (!browser) {
            logger.warn('Attempted to release null browser');
            return;
        }

        this.stats.totalReleased++;
        this.stats.currentInUse--;

        // Check if browser is still connected before reusing
        if (!browser.isConnected()) {
            logger.warn('Released browser is disconnected, not returning to pool');
            // Async create replacement but don't await
            firefox.launch({
                headless: true,
            }).then(newBrowser => {
                this.available.push(newBrowser);
                logger.info('Replacement browser added to pool');
            }).catch(err => {
                logger.error({ error: err.message }, 'Failed to create replacement browser');
            });
            return;
        }

        if (this.waiting.length > 0) {
            const waiter = this.waiting.shift();
            waiter.resolve(browser);
            logger.debug({ 
                waiting: this.waiting.length,
                inUse: this.stats.currentInUse 
            }, 'Browser assigned to waiting request');
        } else {
            this.available.push(browser);
            logger.debug({ 
                available: this.available.length,
                inUse: this.stats.currentInUse 
            }, 'Browser released to pool');
        }
    }

    getStats() {
        return {
            ...this.stats,
            totalBrowsers: this.size,
            available: this.available.length,
            waiting: this.waiting.length
        };
    }

    async closeAll() {
        if (!this.initialized) {
            return;
        }

        logger.info('Closing all browsers in pool');
        
        // Reject all waiting requests
        for (const waiter of this.waiting) {
            waiter.reject(new Error('Browser pool is closing'));
        }
        this.waiting = [];

        // Close all browsers
        const closePromises = this.browsers.map(async (browser, index) => {
            try {
                await browser.close();
                logger.debug({ browserId: index + 1 }, 'Browser closed');
            } catch (error) {
                logger.error({ error, browserId: index + 1 }, 'Failed to close browser');
            }
        });

        await Promise.all(closePromises);
        
        this.browsers = [];
        this.available = [];
        this.initialized = false;
        
        logger.info({ stats: this.stats }, 'All browsers closed');
    }

    async healthCheck() {
        const health = {
            initialized: this.initialized,
            totalBrowsers: this.size,
            available: this.available.length,
            inUse: this.stats.currentInUse,
            waiting: this.waiting.length,
            healthy: true,
            issues: []
        };

        if (!this.initialized) {
            health.healthy = false;
            health.issues.push('Pool not initialized');
        }

        if (this.available.length === 0 && this.stats.currentInUse === 0) {
            health.healthy = false;
            health.issues.push('No browsers available');
        }

        if (this.waiting.length > 5) {
            health.healthy = false;
            health.issues.push(`Too many waiting requests: ${this.waiting.length}`);
        }

        return health;
    }
}

export const browserPool = new BrowserPool(3);