import { chromium } from "playwright";
import { getRandomProxy, refreshProxyCache } from "./proxy-manager.js";
import { randomUA } from "./useragents.js";
import logger from "./logger.js";
import config from "../config/index.js";

export async function fetchPage(url, options = {}) {
    // Get proxy from manager if enabled
    let proxy = null;
    if (options.useProxy !== false) {
        proxy = getRandomProxy();
        if (!proxy) {
            await refreshProxyCache();
            proxy = getRandomProxy();
        }
        if (proxy) {
            logger.debug({ proxy }, 'Using proxy for request');
        }
    }
    
    const userAgent = randomUA();

    const browser = await chromium.launch({
        headless: config.scraper?.headless !== false,
        proxy: proxy ? { server: proxy } : undefined,
    });

    const context = await browser.newContext({
        userAgent,
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
    });

    const page = await context.newPage();

    // Minimal delay before navigation
    if (options.antiBot !== false) {
        await page.waitForTimeout(Math.floor(Math.random() * 500 + 500));
    }

    // Navigate to page
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for body to be ready
    await page.waitForSelector('body', { timeout: 15000 });

    return { page, browser };
}