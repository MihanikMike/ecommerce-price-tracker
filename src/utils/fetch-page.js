import { chromium } from 'playwright';

export async function fetchPage(url) {
    const browser = await chromium.launch({headless: true });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();
    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 20000 });
    return { browser, page };
}