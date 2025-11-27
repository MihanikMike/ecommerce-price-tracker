import { chromium } from 'playwright';
import logger from './logger.js';
import config from '../config/index.js';

class BrowserPool {
    constructor(size = 3) {
        this.size = size;
        this.browsers = [];
        this.available = [];
        this.waiting = [];
    }

    async initialize() {
        logger.info({ size: this.size }, 'Initializing browser pool');
        for (let i = 0; i < this.size; i++) {
            const browser = await chromium.launch({
                headless: config.scraper.headless
            });
            this.browsers.push(browser);
            this.available.push(browser);
        }
        logger.info('Browser pool ready');
    }

    async acquire() {
        if (this.available.length > 0) {
            const browser = this.available.pop();
            logger.debug({ available: this.available.length }, 'Browser acquired');
            return browser;
        }

        // Wait for browser to become available
        return new Promise((resolve) => {
            this.waiting.push(resolve);
        });
    }

    release(browser) {
        if (this.waiting.length > 0) {
            const resolve = this.waiting.shift();
            resolve(browser);
        } else {
            this.available.push(browser);
        }
        logger.debug({ available: this.available.length }, 'Browser released');
    }

    async closeAll() {
        for (const browser of this.browsers) {
            try {
                await browser.close();
            } catch (error) {
                logger.error({ error }, 'Failed to close browser');
            }
        }
        logger.info('All browsers closed');
    }
}

export const browserPool = new BrowserPool(3);