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
    },
    {
        name: 'SpysOne',
        url: 'https://spys.one/en/free-proxy-list/',
        parser: (html) => {
            // SpysOne uses JavaScript to decode ports, but we can extract from script
            // Format: document.write("<font class=spy2>:<\/font>"+(x1^x2)+(x3^x4)+...
            // Fallback: extract IP and common ports pattern
            const proxies = [];
            
            // Try to extract IPs and decode ports from the page
            const ipMatches = [...html.matchAll(/(\d+\.\d+\.\d+\.\d+)/g)];
            const portMatches = [...html.matchAll(/document\.write\([^)]*\+\((\w+)\^(\w+)\)/g)];
            
            // Extract variable definitions for port decoding
            const varDefs = {};
            const varMatches = [...html.matchAll(/(\w+)=(\d+)/g)];
            for (const match of varMatches) {
                varDefs[match[1]] = parseInt(match[2]);
            }
            
            // Simple extraction: look for IP:port patterns in plain text
            const simpleMatches = [...html.matchAll(/(\d+\.\d+\.\d+\.\d+)[:\s]+(\d{2,5})/g)];
            for (const match of simpleMatches) {
                const port = parseInt(match[2]);
                if (port > 0 && port < 65536) {
                    proxies.push({ ip: match[1], port: match[2], source: 'spysone' });
                }
            }
            
            // Deduplicate
            const seen = new Set();
            return proxies.filter(p => {
                const key = `${p.ip}:${p.port}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        }
    },
    {
        name: 'OpenProxySpace',
        url: 'https://openproxy.space/list/http',
        parser: (text) => {
            // OpenProxySpace returns a JSON-like format or plain text list
            const proxies = [];
            
            try {
                // Try JSON parse first
                const json = JSON.parse(text);
                if (Array.isArray(json)) {
                    for (const item of json) {
                        if (typeof item === 'string' && item.includes(':')) {
                            const [ip, port] = item.split(':');
                            proxies.push({ ip, port, source: 'openproxyspace' });
                        } else if (item.ip && item.port) {
                            proxies.push({ ip: item.ip, port: String(item.port), source: 'openproxyspace' });
                        }
                    }
                } else if (json.data) {
                    for (const item of json.data) {
                        if (item.items) {
                            for (const proxy of item.items) {
                                const [ip, port] = proxy.split(':');
                                if (ip && port) {
                                    proxies.push({ ip, port, source: 'openproxyspace' });
                                }
                            }
                        }
                    }
                }
            } catch {
                // Plain text format: one proxy per line
                const lines = text.split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.includes(':')) {
                        const [ip, port] = trimmed.split(':');
                        if (ip && port && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
                            proxies.push({ ip, port: port.trim(), source: 'openproxyspace' });
                        }
                    }
                }
            }
            
            return proxies;
        }
    },
    {
        name: 'ProxyListDownload',
        url: 'https://www.proxy-list.download/api/v1/get?type=http',
        parser: (text) => {
            return text.split('\n')
                .filter(line => line.includes(':'))
                .map(line => {
                    const [ip, port] = line.trim().split(':');
                    return { ip, port, source: 'proxylistdownload' };
                })
                .filter(p => p.ip && p.port);
        }
    },
    {
        name: 'FreeProxyWorld',
        url: 'https://www.freeproxy.world/?type=http&anonymity=&country=&speed=&port=&page=1',
        parser: (html) => {
            // Extract from table rows
            const proxies = [];
            const rowMatches = [...html.matchAll(/<td[^>]*>(\d+\.\d+\.\d+\.\d+)<\/td>\s*<td[^>]*><a[^>]*>(\d+)<\/a>/g)];
            for (const match of rowMatches) {
                proxies.push({ ip: match[1], port: match[2], source: 'freeproxyworld' });
            }
            
            // Alternative pattern
            const altMatches = [...html.matchAll(/(\d+\.\d+\.\d+\.\d+).*?<a[^>]*>(\d{2,5})<\/a>/gs)];
            for (const match of altMatches) {
                if (!proxies.find(p => p.ip === match[1])) {
                    proxies.push({ ip: match[1], port: match[2], source: 'freeproxyworld' });
                }
            }
            
            return proxies;
        }
    },
    {
        name: 'HideMy',
        url: 'https://hidemy.life/en/proxy-list/?type=h&anon=234',
        parser: (html) => {
            // HideMy.life table format
            const proxies = [];
            const matches = [...html.matchAll(/<td>(\d+\.\d+\.\d+\.\d+)<\/td>\s*<td>(\d+)<\/td>/g)];
            for (const match of matches) {
                proxies.push({ ip: match[1], port: match[2], source: 'hidemy' });
            }
            return proxies;
        }
    }
];

/** Configuration */
const CONFIG = {
    maxConcurrentChecks: 50,      // Check 50 proxies in parallel (high concurrency)
    checkTimeout: 2000,            // 2 second timeout per proxy (fast)
    minWorkingProxies: 5,          // Minimum proxies to keep in cache
    targetWorkingProxies: 15,      // Stop checking once we have this many
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
 * Stops early once we have enough working proxies
 */
async function checkProxiesParallel(proxies) {
    const results = [];
    const queue = [...proxies];
    let completed = 0;
    let stopEarly = false;
    let resolveEarly;
    
    // Promise that resolves when we have enough proxies
    const earlyStopPromise = new Promise(resolve => {
        resolveEarly = resolve;
    });
    
    // Worker function
    async function worker() {
        while (queue.length > 0 && !stopEarly) {
            const proxy = queue.shift();
            if (!proxy) break;
            
            const result = await checkProxy(proxy);
            if (stopEarly) break; // Check again after async operation
            
            completed++;
            
            if (result) {
                results.push(result);
                logger.info({ 
                    proxy: result.url, 
                    latency: result.latency,
                    progress: `${completed}/${proxies.length}`,
                    working: results.length
                }, 'Working proxy found');
                
                // Stop early if we have enough proxies
                if (results.length >= CONFIG.targetWorkingProxies) {
                    stopEarly = true;
                    queue.length = 0; // Clear queue to stop other workers
                    logger.info({ 
                        working: results.length, 
                        target: CONFIG.targetWorkingProxies 
                    }, 'Reached target proxy count, stopping early');
                    resolveEarly();
                    break;
                }
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
    
    // Race between all workers completing OR early stop
    await Promise.race([
        Promise.all(workers),
        earlyStopPromise
    ]);
    
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
    
    // Shuffle and limit proxies to test (for faster startup)
    // Prioritize proxies from sources that typically have faster/better proxies
    const prioritized = allProxies.sort((a, b) => {
        const priority = { 'sslproxies': 1, 'freeproxylist': 2, 'proxylistdownload': 3 };
        return (priority[a.source] || 5) - (priority[b.source] || 5);
    });
    const toTest = prioritized.slice(0, 200);  // Test first 200 prioritized proxies
    
    // Check proxies in parallel
    logger.info({ count: toTest.length, total: allProxies.length }, 'Validating proxies in parallel...');
    const working = await checkProxiesParallel(toTest);
    
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