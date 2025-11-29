import { fetchPage, releaseBrowser } from "../utils/fetch-page.js";
import logger from "../utils/logger.js";
import { validateScrapedData, logValidationErrors } from "../utils/validation.js";

/**
 * Try multiple selectors until one works
 * @param {Page} page - Playwright page
 * @param {Array<string>} selectors - Array of CSS selectors to try
 * @param {string} fieldName - Name of field for logging
 * @returns {Promise<string|null>} Element text or null
 */
async function trySelectors(page, selectors, fieldName) {
    for (let i = 0; i < selectors.length; i++) {
        try {
            const selector = selectors[i];
            const element = await page.$(selector);
            if (element) {
                const text = await element.innerText();
                if (text && text.trim()) {
                    logger.debug({ selector, fieldName, attempt: i + 1 }, 'Selector succeeded');
                    return text.trim();
                }
            }
        } catch (error) {
            logger.debug({ selector: selectors[i], fieldName, error: error.message }, 'Selector failed');
        }
    }
    
    logger.warn({ selectors, fieldName }, 'All selectors failed');
    return null;
}

export async function scrapeAmazon(url) {
    const browserContext = await fetchPage(url);
    const { page } = browserContext;

    try {
        // Wait for page to load - try multiple selectors
        const pageLoadSelectors = ["#productTitle", "#title", ".product-title", "h1"];
        await Promise.race([
            ...pageLoadSelectors.map(sel => page.waitForSelector(sel, { timeout: 15000 }).catch(() => null)),
            page.waitForTimeout(15000)
        ]);

        // Title selectors (in order of preference)
        const titleSelectors = [
            "#productTitle",
            "#title",
            ".product-title-word-break",
            "h1.a-size-large",
            "h1 span#productTitle",
            "[data-feature-name='title'] h1",
            "h1"
        ];
        
        const title = await trySelectors(page, titleSelectors, 'title');
        if (!title) {
            throw new Error('Could not find product title with any selector');
        }

        // Price selectors (in order of preference)
        const priceSelectors = [
            ".a-price > .a-offscreen",           // Standard price
            "#priceblock_ourprice",               // Old layout
            "#priceblock_dealprice",              // Deal price
            ".a-price .a-offscreen:first-child",  // Alternative
            "span.a-price-whole",                 // Whole price part
            ".a-color-price",                     // Generic price
            "#price_inside_buybox",               // Buy box price
            ".a-section .a-price",                // Section price
            "[data-a-color='price']",             // Data attribute
            ".apexPriceToPay .a-offscreen"        // Apex price
        ];
        
        const priceText = await trySelectors(page, priceSelectors, 'price');
        if (!priceText) {
            throw new Error('Could not find product price with any selector');
        }
        
        // Extract numeric price
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));

        const data = {
            site: "Amazon",
            url,
            title,
            price,
            currency: "USD",
            timestamp: new Date()
        };
        
        // Validate scraped data
        const validation = validateScrapedData(data);
        if (!validation.valid) {
            logValidationErrors('scrapeAmazon', validation.errors);
            logger.warn({ url, errors: validation.errors }, 'Scraped data validation failed');
            return null;
        }

        logger.debug({ url, title, price }, 'Amazon scrape successful');
        return data;    
    } catch (err) {
        logger.error({ error: err, url }, 'Amazon scraping failed');
        return null;
    } finally {
        await releaseBrowser(browserContext);
    }
}