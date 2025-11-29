import fs from "fs";
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import logger from "./logger.js";
import config from "../config/index.js";

/** Cache file for working proxies */
const CACHE_FILE = "proxy_cache.json";

/** Free proxy list URL */
const FREE_PROXY_URL = "https://www.sslproxies.org/";

/**
 * Proxy provider types
 */
const PROXY_PROVIDERS = {
    FREE: 'free',
    MANUAL: 'manual',
    SMARTPROXY: 'smartproxy',
    BRIGHTDATA: 'brightdata',
    OXYLABS: 'oxylabs'
};

/**
 * Get proxy configuration from environment
 */
function getProxyConfig() {
    const provider = process.env.PROXY_PROVIDER || PROXY_PROVIDERS.FREE;
    
    const config = {
        provider,
        enabled: process.env.SCRAPER_USE_PROXY === 'true',
    };
    
    // Manual proxy list (comma-separated)
    if (provider === PROXY_PROVIDERS.MANUAL) {
        const proxyList = process.env.PROXY_LIST || '';
        config.proxies = proxyList.split(',').map(p => p.trim()).filter(p => p);
    }
    
    // SmartProxy configuration
    if (provider === PROXY_PROVIDERS.SMARTPROXY) {
        config.username = process.env.SMARTPROXY_USERNAME;
        config.password = process.env.SMARTPROXY_PASSWORD;
        config.server = process.env.SMARTPROXY_SERVER || 'gate.smartproxy.com:7000';
    }
    
    // BrightData (Luminati) configuration
    if (provider === PROXY_PROVIDERS.BRIGHTDATA) {
        config.username = process.env.BRIGHTDATA_USERNAME;
        config.password = process.env.BRIGHTDATA_PASSWORD;
        config.server = process.env.BRIGHTDATA_SERVER || 'brd.superproxy.io:33335';
    }
    
    // Oxylabs configuration
    if (provider === PROXY_PROVIDERS.OXYLABS) {
        config.username = process.env.OXYLABS_USERNAME;
        config.password = process.env.OXYLABS_PASSWORD;
        config.server = process.env.OXYLABS_SERVER || 'pr.oxylabs.io:7777';
    }
    
    return config;
}

/**
 * Build proxy URL from paid provider config
 */
function buildPaidProxyUrl(config) {
    const { provider, username, password, server } = config;
    
    if (!username || !password || !server) {
        logger.warn({ provider }, 'Paid proxy credentials missing');
        return null;
    }
    
    // Format: http://username:password@server
    return `http://${username}:${password}@${server}`;
}

/**
 * Parse HTML and extract proxy list from free source
 */
async function downloadFreeProxyList() {
    try {
        logger.info('Downloading free proxies from SSL Proxies...');
        const response = await axios.get(FREE_PROXY_URL, { timeout: 10000 });
        const html = response.data;

        const proxies = [...html.matchAll(/<td>(\d+\.\d+\.\d+\.\d+)<\/td><td>(\d+)<\/td>/g)]
            .map(match => `http://${match[1]}:${match[2]}`);

        logger.info({ count: proxies.length }, 'Downloaded free proxy list');
        return proxies;
    } catch (err) {
        logger.error({ error: err.message }, 'Error loading free proxy list');
        return [];
    }
}

/**
 * Check if proxy is working
 */
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

/**
 * Refresh free proxy cache with working proxies
 */
async function refreshFreeProxyCache() {
    logger.info('Refreshing free proxy cache...');
    const proxies = await downloadFreeProxyList();
    
    if (proxies.length === 0) {
        logger.warn('No free proxies found');
        return [];
    }

    logger.info({ count: proxies.length }, 'Checking which free proxies are alive...');
    const alive = [];

    // Check up to 20 proxies (free proxies are unreliable, don't waste time)
    const toCheck = proxies.slice(0, 20);
    
    for (const proxy of toCheck) {
        const ok = await checkProxy(proxy);
        if (ok) {
            alive.push(proxy);
            logger.info({ proxy }, 'Working free proxy found');
            
            // Stop after finding 3 working proxies
            if (alive.length >= 3) {
                break;
            }
        }
    }

    if (alive.length > 0) {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(alive, null, 2));
        logger.info({ count: alive.length, file: CACHE_FILE }, 'Saved working free proxies');
    } else {
        logger.warn('No working free proxies found');
    }

    return alive;
}

/**
 * Get random proxy from free proxy cache
 */
function getRandomFreeProxy() {
    if (!fs.existsSync(CACHE_FILE)) return null;

    try {
        const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        if (data.length === 0) return null;
        return data[Math.floor(Math.random() * data.length)];
    } catch (error) {
        logger.error({ error: error.message }, 'Failed to read free proxy cache');
        return null;
    }
}

/**
 * Get random proxy from manual list
 */
function getRandomManualProxy(proxies) {
    if (!proxies || proxies.length === 0) return null;
    return proxies[Math.floor(Math.random() * proxies.length)];
}

/**
 * Get proxy URL based on configuration
 * @returns {Promise<string|null>} Proxy URL or null
 */
export async function getProxy() {
    const proxyConfig = getProxyConfig();
    
    if (!proxyConfig.enabled) {
        logger.debug('Proxy disabled in configuration');
        return null;
    }
    
    logger.debug({ provider: proxyConfig.provider }, 'Getting proxy');
    
    switch (proxyConfig.provider) {
        case PROXY_PROVIDERS.FREE:
            // Try cache first
            let proxy = getRandomFreeProxy();
            if (!proxy) {
                logger.info('No cached free proxies, refreshing...');
                const alive = await refreshFreeProxyCache();
                proxy = alive.length > 0 ? alive[0] : null;
            }
            
            if (!proxy) {
                logger.warn('⚠️ FREE PROXIES UNRELIABLE: No working proxies found. Consider using paid proxies.');
                logger.info('💡 Set PROXY_PROVIDER=manual and PROXY_LIST=http://proxy1:port,http://proxy2:port');
                logger.info('💡 Or use paid providers: smartproxy, brightdata, oxylabs');
            }
            
            return proxy;
            
        case PROXY_PROVIDERS.MANUAL:
            const manualProxy = getRandomManualProxy(proxyConfig.proxies);
            if (!manualProxy) {
                logger.warn('No manual proxies configured. Set PROXY_LIST environment variable.');
            }
            return manualProxy;
            
        case PROXY_PROVIDERS.SMARTPROXY:
        case PROXY_PROVIDERS.BRIGHTDATA:
        case PROXY_PROVIDERS.OXYLABS:
            const paidProxy = buildPaidProxyUrl(proxyConfig);
            if (!paidProxy) {
                logger.error({ provider: proxyConfig.provider }, 'Paid proxy credentials not configured');
            }
            return paidProxy;
            
        default:
            logger.warn({ provider: proxyConfig.provider }, 'Unknown proxy provider');
            return null;
    }
}

/**
 * Refresh proxy cache (for backward compatibility and scheduled jobs)
 */
export async function refreshProxyCache() {
    const proxyConfig = getProxyConfig();
    
    if (proxyConfig.provider === PROXY_PROVIDERS.FREE) {
        return await refreshFreeProxyCache();
    }
    
    logger.info({ provider: proxyConfig.provider }, 'Refresh not needed for this proxy provider');
    return [];
}

/**
 * Get random proxy (deprecated - use getProxy instead)
 * @deprecated Use getProxy() instead for better provider support
 */
export function getRandomProxy() {
    logger.warn('getRandomProxy() is deprecated, use getProxy() instead');
    return getRandomFreeProxy();
}

export default {
    getProxy,
    refreshProxyCache,
    PROXY_PROVIDERS
};
