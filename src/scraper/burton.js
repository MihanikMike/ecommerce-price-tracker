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

export async function scrapeBurton(url) {
  const browserContext = await fetchPage(url);
  const { page } = browserContext;

  try {
    // Wait for page to load - try multiple selectors
    const pageLoadSelectors = ["h1.product-name", ".product-name", "h1", ".product-title"];
    await Promise.race([
      ...pageLoadSelectors.map(sel => page.waitForSelector(sel, { timeout: 15000 }).catch(() => null)),
      page.waitForTimeout(15000)
    ]);

    // Title selectors (in order of preference)
    const titleSelectors = [
      "h1.product-name",
      ".product-name",
      "h1.pdp-title",
      ".product-title",
      "[data-product-title]",
      "h1"
    ];
    
    const title = await trySelectors(page, titleSelectors, 'title');
    if (!title) {
      throw new Error('Could not find product title with any selector');
    }

    // Price selectors (in order of preference)
    const priceSelectors = [
      "span.standard-price",
      ".price-value",
      ".product-price",
      "[data-product-price]",
      ".price",
      "span[itemprop='price']",
      ".pdp-price"
    ];
    
    const priceText = await trySelectors(page, priceSelectors, 'price');
    if (!priceText) {
      throw new Error('Could not find product price with any selector');
    }
    
    const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
    
    const data = {
      site: "Burton",
      url,
      title,
      price,
      currency: "USD",
      timestamp: new Date(),
    };
    
    // Validate scraped data
    const validation = validateScrapedData(data);
    if (!validation.valid) {
      logValidationErrors('scrapeBurton', validation.errors);
      logger.warn({ url, errors: validation.errors }, 'Scraped data validation failed');
      return null;
    }
    
    logger.debug({ url, title, price }, 'Burton scrape successful');
    return data;
  } catch (err) {
    logger.error({ error: err, url }, 'Burton scraping failed');
    return null;
  } finally {
    await releaseBrowser(browserContext);
  }
}