import { fetchPage } from "../utils/fetch-page.js";

export async function scrapeBurton(url) {
  const { browser, page } = await fetchPage(url);

  try {
    await page.waitForSelector("h1.product-name"); // селектор заголовка
    const title = await page.$eval("h1.product-name", el => el.innerText.trim());
  
    // селектор цены 
    const price = await page.$eval("span.standard-price", el => el.innerText.replace(/[^0-9.]/g, ""));
    
    return {
      site: "Burton",
      url,
      title,
      price: parseFloat(price),
      timestamp: new Date(),
    };
  } catch (err) {
    console.error("Burton scraper error:", err);
    return null;
  } finally {
    await browser.close();
  }
}