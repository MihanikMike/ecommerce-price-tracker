import fs from "fs";
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import logger from "./logger.js";

/** Cache file for working proxies */
const CACHE_FILE = "proxy_cache.json";

/** Free proxy list URL */
const FREE_PROXY_URL = "https://www.sslproxies.org/";

/** Parse HTML and extract proxy list */
async function downloadProxyList() {
    try {
        const response = await axios.get(FREE_PROXY_URL);
        const html = response.data;

        const proxies = [...html.matchAll(/<td>(\d+\.\d+\.\d+\.\d+)<\/td><td>(\d+)<\/td>/g)]
            .map(match => `http://${match[1]}:${match[2]}`);

        logger.info({ count: proxies.length }, 'Downloaded proxy list');
        return proxies;
    } catch (err) {
        logger.error({ error: err }, 'Error loading proxy list');
        return [];
    }
}

/** Check if proxy is working */
async function checkProxy(proxyUrl) {
    try {
        const agent = new HttpsProxyAgent(proxyUrl);
        await axios.get("https://www.google.com", {
            httpAgent: agent,
            httpsAgent: agent,
            timeout: 5000
        });
        return true;
    } catch (error) {
        logger.debug({ proxy: proxyUrl, error: error.message }, 'Proxy check failed');
        return false;
    }
}

/** Refresh proxy cache with working proxies */
export async function refreshProxyCache() {
    logger.info('Downloading free proxies...');
    const proxies = await downloadProxyList();

    logger.info({ count: proxies.length }, 'Checking which proxies are alive...');
    const alive = [];

    for (const proxy of proxies) {
        const ok = await checkProxy(proxy);
        if (ok) {
            alive.push(proxy);
            logger.info({ proxy }, 'Working proxy found');
        }
    }

    fs.writeFileSync(CACHE_FILE, JSON.stringify(alive, null, 2));
    logger.info({ count: alive.length, file: CACHE_FILE }, 'Saved working proxies');

    return alive;
}

/** Get random working proxy from cache */
export function getRandomProxy() {
    if (!fs.existsSync(CACHE_FILE)) return null;

    try {
        const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        if (data.length === 0) return null;
        return data[Math.floor(Math.random() * data.length)];
    } catch (error) {
        logger.error({ error }, 'Failed to read proxy cache');
        return null;
    }
}