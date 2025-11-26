import { chromium } from 'playwright';
import { randomUA } from './useragents';

// Конфиг для прокси (если есть)
const PROXIES = [
    // "http://username:password@ip:port",
    // "http://username:password@ip:port",
];

export async function fetchPage(url, options = {}) {
    const useProxy = options.proxy || false;

    // Выбираем случайный User-Agent
    const userAgent = randomUA();

    // Выбираем случайный прокси (если включено)
    const proxyConfig = useProxy
        ? { server: PROXIES[Math.floor(Math.random() * PROXIES.length)] }
        : undefined;

    const browser = await chromium.launch({
        headless: false, // headless=false делает скрейпинг менее заметным
        slowMo: 50,      // имитация действий человека
    });

    const context = await browser.newContext({
        userAgent,
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: ['geolocation'],
        proxy: proxyConfig,
    });

    const page = await context.newPage();

    // Случайная задержка перед заходом на страницу
    await page.waitForTimeout(Math.floor(Math.random() * 2000 + 1000));

    // Навигация на страницу
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Имитация скролла и движений мыши
    const scrollSteps = Math.floor(Math.random() * 3 + 2);
    for (let i = 0; i < scrollSteps; i++) {
        await page.mouse.move(Math.random() * 1000, Math.random() * 800, { steps: 5 });
        await page.waitForTimeout(Math.random() * 1000 + 500);
        await page.evaluate(() => window.scrollBy(0, Math.random() * 300));
    }

    // Универсальное ожидание body (лучше использовать конкретные селекторы для сайта)
    await page.waitForSelector('body', { timeout: 15000 });

    // Возвращаем page и browser, чтобы дальше закрывать
    return { page, browser };
}