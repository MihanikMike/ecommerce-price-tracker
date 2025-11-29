import fs from "fs";
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import logger from "./logger.js";

/** Cache file for working proxies */
const CACHE_FILE = "proxy_cache.json";

/**
 * Multiple free proxy list sources
 * Each source has a different HTML structure, so we need custom parsers
 */
const PROXY_SOURCES = [
    {
        name: 'SSLProxies',
        url: 'https://www.sslproxies.org/',
        parser: (html) => {
            return [...html.matchAll(/<td>(\d+\.\d+\.\d+\.\d+)<\/td><td>(\d+)<\/td>/g)]
                .map(match => ({ ip: match[1], port: match[2], source: 'sslproxies' }));
        }
    },
    {
        name: 'FreeProxyList',
        url: 'https://free-proxy-list.net/',
        parser: (html) => {
            return [...html.matchAll(/<td>(\d+\.\d+\.\d+\.\d+)<\/td><td>(\d+)<\/td>/g)]
                .map(match => ({ ip: match[1], port: match[2], source: 'freeproxylist' }));
        }
    },
    {
        name: 'ProxyScrape',
        url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=5000&country=all&ssl=yes&anonymity=all',
        parser: (text) => {
            return text.split('\n')
                .filter(line => line.includes(':'))
                .map(line => {
                    const [ip, port] = line.trim().split(':');
                    return { ip, port, source: 'proxyscrape' };
                });
        }
    },
    {
        name: 'GeonodeAPI',
        url: 'https://proxylist.geonode.com/api/proxy-list?limit=100&page=1&sort_by=lastChecked&sort_type=desc&protocols=http%2Chttps',
        parser: (text) => {
            try {
                const json = JSON.parse(text);
                return (json.data || []).map(p => ({
                    ip: p.ip,
                    port: String(p.port),
                    source: 'geonode',
                    speed: p.speed,
                    anonymity: p.anonymityLevel
                }));
            } catch {
                return [];
            }
        }
    }
];

/** Configuration */
const CONFIG = {
    maxConcurrentChecks: 20,      // Check 20 proxies in parallel
    checkTimeout: 3000,            // 3 second timeout per proxy
    minWorkingProxies: 5,          // Minimum proxies to keep in cache
    cacheExpiry: 30 * 60 * 1000,   // Refresh cache every 30 minutes
    testUrl: 'https://httpbin.org/ip',  // Fast, reliable test endpoint
    rotationIndex: 0               // For round-robin rotation
};

/** In-memory working proxies with metadata */
let workingProxies = [];
let lastRefresh = 0;
let rotationIndex = 0;

/**
 * Download proxies from a single source
 */
async function downloadFromSource(source) {
    try {
        const response = await axios.get(source.url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const proxies = source.parser(response.data);
        logger.info({ source: source.name, count: proxies.length }, 'Downloaded proxies from source');
        return proxies;
    } catch (err) {
        logger.warn({ source: source.name, error: err.message }, 'Failed to download from source');
        return [];
    }
}

/**
 * Download proxies from ALL sources in parallel
 */
async function downloadAllProxies() {
    logger.info({ sources: PROXY_SOURCES.length }, 'Downloading proxies from multiple sources...');
    
    const results = await Promise.allSettled(
        PROXY_SOURCES.map(source => downloadFromSource(source))
    );
    
    // Combine all proxies, removing duplicates by IP:port
    const seen = new Set();
    const allProxies = [];
    
    for (const result of results) {
        if (result.status === 'fulfilled') {
            for (const proxy of result.value) {
                const key = `${proxy.ip}:${proxy.port}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    allProxies.push({
                        ...proxy,
                        url: `http://${proxy.ip}:${proxy.port}`
                    });
                }
            }
        }
    }
    
    logger.info({ total: allProxies.length, unique: seen.size }, 'Combined proxies from all sources');
    return allProxies;
}

/**
 * Check a single proxy with timeout
 * Returns proxy with latency info or null if failed
 */
async function checkProxy(proxy) {
    const startTime = Date.now();
    
    try {
        const agent = new HttpsProxyAgent(proxy.url);
        const response = await axios.get(CONFIG.testUrl, {
            httpAgent: agent,
            httpsAgent: agent,
            timeout: CONFIG.checkTimeout
        });
        
        const latency = Date.now() - startTime;
        
        // Verify the response contains an IP (basic validation)
        if (response.data && (response.data.origin || response.data.ip)) {
            return {
                ...proxy,
                latency,
                lastChecked: Date.now(),
                working: true
            };
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Check proxies in parallel with limited concurrency
 * Uses a worker pool pattern for efficiency
 */
async function checkProxiesParallel(proxies) {
    const results = [];
    const queue = [...proxies];
    let completed = 0;
    
    // Worker function
    async function worker() {
        while (queue.length > 0) {
            const proxy = queue.shift();
            if (!proxy) break;
            
            const result = await checkProxy(proxy);
            completed++;
            
            if (result) {
                results.push(result);
                logger.info({ 
                    proxy: result.url, 
                    latency: result.latency,
                    progress: `${completed}/${proxies.length}`,
                    working: results.length
                }, 'Working proxy found');
            }
            
            // Log progress every 20 proxies
            if (completed % 20 === 0) {
                logger.debug({ 
                    checked: completed, 
                    total: proxies.length, 
                    working: results.length 
                }, 'Proxy check progress');
            }
        }
    }
    
    // Create worker pool
    const workers = Array(CONFIG.maxConcurrentChecks).fill(null).map(() => worker());
    await Promise.all(workers);
    
    // Sort by latency (fastest first)
    results.sort((a, b) => a.latency - b.latency);
    
    return results;
}

/**
 * Refresh the proxy cache
 * Downloads from all sources and validates in parallel
 */
export async function refreshProxyCache(force = false) {
    const now = Date.now();
    
    // Skip if cache is fresh and we have enough proxies
    if (!force && 
        (now - lastRefresh) < CONFIG.cacheExpiry && 
        workingProxies.length >= CONFIG.minWorkingProxies) {
        logger.debug({ 
            age: Math.round((now - lastRefresh) / 1000),
            count: workingProxies.length 
        }, 'Using cached proxies');
        return workingProxies;
    }
    
    logger.info('Refreshing proxy cache...');
    const startTime = Date.now();
    
    // Download from all sources
    const allProxies = await downloadAllProxies();
    
    if (allProxies.length === 0) {
        logger.error('No proxies downloaded from any source!');
        return workingProxies; // Return existing cache
    }
    
    // Check proxies in parallel
    logger.info({ count: allProxies.length }, 'Validating proxies in parallel...');
    const working = await checkProxiesParallel(allProxies);
    
    // Update cache
    workingProxies = working;
    lastRefresh = now;
    rotationIndex = 0;
    
    // Persist to file
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify({
            updatedAt: new Date().toISOString(),
            proxies: working
        }, null, 2));
    } catch (err) {
        logger.warn({ error: err.message }, 'Failed to save proxy cache file');
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    logger.info({ 
        working: working.length, 
        tested: allProxies.length,
        duration: `${duration}s`,
        successRate: `${Math.round(working.length / allProxies.length * 100)}%`
    }, 'Proxy cache refreshed');
    
    return working;
}

/**
 * Get a random working proxy
 */
export function getRandomProxy() {
    if (workingProxies.length === 0) {
        // Try to load from file cache
        loadCacheFromFile();
    }
    
    if (workingProxies.length === 0) {
        return null;
    }
    
    const index = Math.floor(Math.random() * workingProxies.length);
    return workingProxies[index]?.url || null;
}

/**
 * Get next proxy using round-robin rotation
 * Better distribution than random selection
 */
export function getNextProxy() {
    if (workingProxies.length === 0) {
        loadCacheFromFile();
    }
    
    if (workingProxies.length === 0) {
        return null;
    }
    
    const proxy = workingProxies[rotationIndex % workingProxies.length];
    rotationIndex++;
    
    return proxy?.url || null;
}

/**
 * Get the fastest proxy (lowest latency)
 */
export function getFastestProxy() {
    if (workingProxies.length === 0) {
        loadCacheFromFile();
    }
    
    // Already sorted by latency
    return workingProxies[0]?.url || null;
}

/**
 * Mark a proxy as failed (remove from pool)
 * Call this when a proxy fails during actual use
 */
export function markProxyFailed(proxyUrl) {
    const before = workingProxies.length;
    workingProxies = workingProxies.filter(p => p.url !== proxyUrl);
    
    if (workingProxies.length < before) {
        logger.info({ 
            proxy: proxyUrl, 
            remaining: workingProxies.length 
        }, 'Removed failed proxy from pool');
    }
    
    // Trigger refresh if running low on proxies
    if (workingProxies.length < CONFIG.minWorkingProxies) {
        logger.warn({ remaining: workingProxies.length }, 'Low on proxies, triggering refresh');
        // Don't await - let it run in background
        refreshProxyCache(true).catch(err => 
            logger.error({ error: err.message }, 'Background proxy refresh failed')
        );
    }
}

/**
 * Get proxy pool statistics
 */
export function getProxyStats() {
    return {
        total: workingProxies.length,
        lastRefresh: lastRefresh ? new Date(lastRefresh).toISOString() : null,
        cacheAge: lastRefresh ? Math.round((Date.now() - lastRefresh) / 1000) : null,
        avgLatency: workingProxies.length > 0 
            ? Math.round(workingProxies.reduce((sum, p) => sum + p.latency, 0) / workingProxies.length)
            : null,
        sources: [...new Set(workingProxies.map(p => p.source))],
        rotationIndex
    };
}

/**
 * Load proxies from file cache (on startup)
 */
function loadCacheFromFile() {
    if (!fs.existsSync(CACHE_FILE)) {
        return;
    }
    
    try {
        const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        
        // Handle both old format (array) and new format (object with proxies)
        if (Array.isArray(data)) {
            workingProxies = data.map(url => ({ url, latency: 0 }));
        } else if (data.proxies) {
            workingProxies = data.proxies;
            lastRefresh = new Date(data.updatedAt).getTime();
        }
        
        logger.info({ count: workingProxies.length }, 'Loaded proxies from cache file');
    } catch (err) {
        logger.warn({ error: err.message }, 'Failed to load proxy cache file');
    }
}

/**
 * Smart proxy getter with automatic retry
 * Tries proxies until one works, automatically removing failed ones
 */
export async function getWorkingProxy(maxAttempts = 3) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const proxyUrl = getNextProxy();
        
        if (!proxyUrl) {
            // No proxies available, try to refresh
            await refreshProxyCache(true);
            continue;
        }
        
        // Quick validation
        try {
            const agent = new HttpsProxyAgent(proxyUrl);
            await axios.get(CONFIG.testUrl, {
                httpAgent: agent,
                httpsAgent: agent,
                timeout: CONFIG.checkTimeout
            });
            return proxyUrl;
        } catch {
            markProxyFailed(proxyUrl);
        }
    }
    
    return null; // All attempts failed
}

// Initialize on module load
loadCacheFromFile();