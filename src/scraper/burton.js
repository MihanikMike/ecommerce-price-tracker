import { fetchPage } from "../utils/fetch-page.js";
import logger from "../utils/logger.js";

export async function scrapeBurton(url) {
  const { browser, page } = await fetchPage(url);

  try {
    await page.waitForSelector("h1.product-name");
    const title = await page.$eval("h1.product-name", el => el.innerText.trim());
  
    const price = await page.$eval("span.standard-price", el => el.innerText.replace(/[^0-9.]/g, ""));
    
    logger.debug({ url, title, price }, 'Burton scrape successful');
    
    return {
      site: "Burton",
      url,
      title,
      price: parseFloat(price),
      timestamp: new Date(),
    };
  } catch (err) {
    logger.error({ error: err, url }, 'Burton scraping failed');
    return null;
  } finally {
    await browser.close();
  }
}