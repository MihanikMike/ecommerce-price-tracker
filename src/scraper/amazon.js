import { fetchPage } from "../utils/fetch-page.js";
import logger from "../utils/logger.js";

export async function scrapeAmazon(url) {
    const { browser, page } = await fetchPage(url);

    try {
        await page.waitForSelector("#productTitle", { timeout: 15000});

        const title = await page.$eval("#productTitle", el => el.innerText.trim());
        const price = await page.$eval(".a-price > .a-offscreen", el => 
            el.innerText.replace(/[^0-9.]/g, ""));

        logger.debug({ url, title, price }, 'Amazon scrape successful');

        return {
            site: "Amazon",
            url,
            title,
            price: parseFloat(price),
            timestamp: new Date()
        };    
    } catch (err) {
        logger.error({ error: err, url }, 'Amazon scraping failed');
        return null;
    } finally {
        await browser.close();
    }
}