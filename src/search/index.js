/**
 * Search Module Index
 * 
 * Exports all search-related functionality for easy imports
 */

// Search engine
export { 
    searchDuckDuckGo,
    searchProduct,
    searchProductWithFallback,
    getKnownEcommerceDomains,
    addEcommerceDomain,
} from './search-engine.js';

// Site registry
export {
    detectSite,
    getScraperForUrl,
    getSelectorsForUrl,
    getRateLimitForUrl,
    isSupportedSite,
    getSiteName,
    getAllSites,
    registerSite,
} from './site-registry.js';

// Universal scraper
export {
    scrapeProduct,
    scrapeMultipleProducts,
    parsePrice,
    detectCurrency,
} from './universal-scraper.js';

// Product matcher
export {
    calculateMatchScore,
    findBestMatch,
    comparePrices,
    levenshteinDistance,
    normalizeText,
    tokenize,
} from './product-matcher.js';

// Search orchestrator
export {
    searchAndScrape,
    findProduct,
    searchProductOnSites,
    batchSearch,
    getOrchestratorStats,
} from './search-orchestrator.js';

// Default export with all functions grouped
export default {
    // Main orchestration
    searchAndScrape,
    findProduct,
    searchProductOnSites,
    batchSearch,
    
    // Search
    searchDuckDuckGo,
    searchProduct,
    
    // Scraping
    scrapeProduct,
    scrapeMultipleProducts,
    
    // Matching
    findBestMatch,
    comparePrices,
    calculateMatchScore,
    
    // Site detection
    detectSite,
    getSiteName,
    isSupportedSite,
};
