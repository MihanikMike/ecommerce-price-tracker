import { fetchPage } from "../utils/fetch-page.js";

export async function scrapeAmazon(url) {
    const { browser, page } = await fetchPage(url);

    try {
        await page.waitForSelector("#productTitle", { timeout: 15000});

        const title = await page.$eval("#productTitle", el => el.innerText.trim());
        const price = await page.$eval(".a-price > .a-offscreen", el => 
            el.innerText.replace(/[^0-9.]/g, ""));

        return {
            site: "Amazon",
            url,
            title,
            price: parseFloat(price),
            timestamp: new Date()
        };    
    } catch (err) {
        console.error(`Amazon scraping error: ${err.message}`);
        return null;
    } finally {
        await browser.close();
    }
}