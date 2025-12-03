import { describe, it, expect, beforeEach } from '@jest/globals';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * DuckDuckGo Integration Tests
 * Tests parsing of DuckDuckGo HTML search results
 * Uses fixture HTML files to verify result extraction
 */

// Re-implement parsing logic for testing (mirrors search-engine.js)
const ECOMMERCE_DOMAINS = {
  'amazon.com': { name: 'Amazon', priority: 10 },
  'amazon.co.uk': { name: 'Amazon UK', priority: 10 },
  'ebay.com': { name: 'eBay', priority: 8 },
  'walmart.com': { name: 'Walmart', priority: 9 },
  'target.com': { name: 'Target', priority: 9 },
  'bestbuy.com': { name: 'Best Buy', priority: 8 },
  'burton.com': { name: 'Burton', priority: 10 },
  'rei.com': { name: 'REI', priority: 8 },
  'backcountry.com': { name: 'Backcountry', priority: 7 },
};

const EXCLUDED_DOMAINS = [
  'youtube.com',
  'facebook.com',
  'twitter.com',
  'instagram.com',
  'pinterest.com',
  'reddit.com',
  'wikipedia.org',
  'linkedin.com',
  'yelp.com',
  'tripadvisor.com',
];

function extractDomain(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function isExcludedDomain(domain) {
  if (!domain) return true;
  return EXCLUDED_DOMAINS.some(excluded => 
    domain === excluded || domain.endsWith('.' + excluded)
  );
}

function getEcommerceDomainInfo(domain) {
  if (!domain) return null;
  
  const direct = ECOMMERCE_DOMAINS[domain];
  if (direct) return { domain, ...direct };
  
  for (const [ecDomain, info] of Object.entries(ECOMMERCE_DOMAINS)) {
    if (domain.endsWith('.' + ecDomain)) {
      return { domain: ecDomain, ...info };
    }
  }
  
  return null;
}

function extractActualUrl(ddgUrl) {
  // DuckDuckGo wraps URLs in redirects like //duckduckgo.com/l/?uddg=https%3A%2F%2F...
  if (!ddgUrl) return null;
  
  try {
    // Check if it's a DDG redirect URL
    if (ddgUrl.includes('uddg=')) {
      const match = ddgUrl.match(/uddg=([^&]+)/);
      if (match) {
        return decodeURIComponent(match[1]);
      }
    }
    // Return as-is if not a redirect
    return ddgUrl.startsWith('http') ? ddgUrl : `https:${ddgUrl}`;
  } catch {
    return null;
  }
}

function parseDuckDuckGoResults(html, options = {}) {
  const { limit = 10 } = options;
  const results = [];
  
  // DuckDuckGo HTML uses .result class for search results
  // Extract links with result__a class
  const resultPattern = /<a class="result__a"[^>]*href="([^"]+)"[^>]*>\s*([^<]+)/gi;
  
  let match;
  while ((match = resultPattern.exec(html)) !== null && results.length < limit) {
    const rawUrl = match[1];
    const title = match[2].trim();
    
    // Extract actual URL from DDG redirect
    const url = extractActualUrl(rawUrl);
    if (!url) continue;
    
    const domain = extractDomain(url);
    
    if (isExcludedDomain(domain)) {
      continue;
    }
    
    const ecommerceInfo = getEcommerceDomainInfo(domain);
    
    results.push({
      title,
      url,
      domain,
      isEcommerce: !!ecommerceInfo,
      ecommerceInfo,
    });
  }
  
  return results;
}

function sortByEcommercePriority(results) {
  return [...results].sort((a, b) => {
    const prioA = a.ecommerceInfo?.priority || 0;
    const prioB = b.ecommerceInfo?.priority || 0;
    return prioB - prioA; // Higher priority first
  });
}

describe('DuckDuckGo HTML Parser', () => {
  let fixtureHtml;

  beforeEach(async () => {
    const fixturePath = join(__dirname, '../../fixtures/html/duckduckgo-search.html');
    fixtureHtml = await readFile(fixturePath, 'utf-8');
  });

  describe('parseDuckDuckGoResults', () => {
    it('should extract results from fixture HTML', () => {
      const results = parseDuckDuckGoResults(fixtureHtml);

      expect(results.length).toBeGreaterThan(0);
    });

    it('should extract title and URL from results', () => {
      const results = parseDuckDuckGoResults(fixtureHtml);

      const amazonResult = results.find(r => r.domain === 'amazon.com');
      expect(amazonResult).toBeDefined();
      expect(amazonResult.title).toBeTruthy();
      expect(amazonResult.url).toContain('amazon.com');
    });

    it('should identify e-commerce domains', () => {
      const results = parseDuckDuckGoResults(fixtureHtml);

      const ecommerceResults = results.filter(r => r.isEcommerce);
      expect(ecommerceResults.length).toBeGreaterThan(0);
    });

    it('should provide e-commerce info for known stores', () => {
      const results = parseDuckDuckGoResults(fixtureHtml);

      const amazonResult = results.find(r => r.domain === 'amazon.com');
      if (amazonResult) {
        expect(amazonResult.ecommerceInfo).toBeDefined();
        expect(amazonResult.ecommerceInfo.name).toBe('Amazon');
        expect(amazonResult.ecommerceInfo.priority).toBe(10);
      }
    });

    it('should respect result limit', () => {
      const results = parseDuckDuckGoResults(fixtureHtml, { limit: 2 });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should exclude non-ecommerce domains', () => {
      const results = parseDuckDuckGoResults(fixtureHtml);

      const excludedDomains = ['youtube.com', 'facebook.com', 'wikipedia.org'];
      for (const domain of excludedDomains) {
        const found = results.find(r => r.domain === domain);
        expect(found).toBeUndefined();
      }
    });
  });

  describe('sortByEcommercePriority', () => {
    it('should sort results by e-commerce priority', () => {
      const results = parseDuckDuckGoResults(fixtureHtml);
      const sorted = sortByEcommercePriority(results);

      // All e-commerce sites should come before non-ecommerce
      let lastEcommerceIdx = -1;
      let firstNonEcommerceIdx = sorted.length;

      sorted.forEach((r, idx) => {
        if (r.isEcommerce) lastEcommerceIdx = idx;
        else if (firstNonEcommerceIdx === sorted.length) firstNonEcommerceIdx = idx;
      });

      if (lastEcommerceIdx >= 0 && firstNonEcommerceIdx < sorted.length) {
        expect(lastEcommerceIdx).toBeLessThan(firstNonEcommerceIdx);
      }
    });

    it('should sort Amazon before lower priority stores', () => {
      const results = [
        { title: 'REI', domain: 'rei.com', isEcommerce: true, ecommerceInfo: { priority: 8 } },
        { title: 'Amazon', domain: 'amazon.com', isEcommerce: true, ecommerceInfo: { priority: 10 } },
        { title: 'Backcountry', domain: 'backcountry.com', isEcommerce: true, ecommerceInfo: { priority: 7 } },
      ];

      const sorted = sortByEcommercePriority(results);

      expect(sorted[0].domain).toBe('amazon.com');
      expect(sorted[1].domain).toBe('rei.com');
      expect(sorted[2].domain).toBe('backcountry.com');
    });

    it('should handle results with no e-commerce info', () => {
      const results = [
        { title: 'Unknown', domain: 'unknown.com', isEcommerce: false },
        { title: 'Amazon', domain: 'amazon.com', isEcommerce: true, ecommerceInfo: { priority: 10 } },
      ];

      const sorted = sortByEcommercePriority(results);

      expect(sorted[0].domain).toBe('amazon.com');
      expect(sorted[1].domain).toBe('unknown.com');
    });
  });

  describe('extractDomain', () => {
    it('should extract domain from full URL', () => {
      const domain = extractDomain('https://www.amazon.com/product/123');
      expect(domain).toBe('amazon.com');
    });

    it('should remove www prefix', () => {
      const domain = extractDomain('https://www.burton.com/us/en/snowboards');
      expect(domain).toBe('burton.com');
    });

    it('should handle http URLs', () => {
      const domain = extractDomain('http://bestbuy.com/tv');
      expect(domain).toBe('bestbuy.com');
    });

    it('should handle URLs without protocol', () => {
      const domain = extractDomain('walmart.com/grocery');
      expect(domain).toBe('walmart.com');
    });

    it('should return null for invalid URLs', () => {
      expect(extractDomain('')).toBeNull();
      expect(extractDomain(null)).toBeNull();
      expect(extractDomain(undefined)).toBeNull();
    });
  });

  describe('isExcludedDomain', () => {
    it('should exclude social media domains', () => {
      expect(isExcludedDomain('youtube.com')).toBe(true);
      expect(isExcludedDomain('facebook.com')).toBe(true);
      expect(isExcludedDomain('instagram.com')).toBe(true);
    });

    it('should exclude subdomains of excluded domains', () => {
      expect(isExcludedDomain('m.youtube.com')).toBe(true);
      expect(isExcludedDomain('en.wikipedia.org')).toBe(true);
    });

    it('should not exclude e-commerce domains', () => {
      expect(isExcludedDomain('amazon.com')).toBe(false);
      expect(isExcludedDomain('burton.com')).toBe(false);
      expect(isExcludedDomain('walmart.com')).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(isExcludedDomain(null)).toBe(true);
      expect(isExcludedDomain(undefined)).toBe(true);
    });
  });

  describe('getEcommerceDomainInfo', () => {
    it('should return info for known e-commerce domains', () => {
      const info = getEcommerceDomainInfo('amazon.com');

      expect(info).toBeDefined();
      expect(info.name).toBe('Amazon');
      expect(info.priority).toBe(10);
    });

    it('should handle subdomain variations', () => {
      const info = getEcommerceDomainInfo('smile.amazon.com');

      expect(info).toBeDefined();
      expect(info.name).toBe('Amazon');
    });

    it('should return null for unknown domains', () => {
      const info = getEcommerceDomainInfo('unknown-store.com');

      expect(info).toBeNull();
    });

    it('should return null for null/undefined', () => {
      expect(getEcommerceDomainInfo(null)).toBeNull();
      expect(getEcommerceDomainInfo(undefined)).toBeNull();
    });

    it('should recognize regional Amazon domains', () => {
      const ukInfo = getEcommerceDomainInfo('amazon.co.uk');

      expect(ukInfo).toBeDefined();
      expect(ukInfo.name).toBe('Amazon UK');
      expect(ukInfo.priority).toBe(10);
    });
  });

  describe('E-commerce Store Priority', () => {
    it('should have highest priority for Amazon and Burton', () => {
      expect(ECOMMERCE_DOMAINS['amazon.com'].priority).toBe(10);
      expect(ECOMMERCE_DOMAINS['burton.com'].priority).toBe(10);
    });

    it('should have high priority for major retailers', () => {
      expect(ECOMMERCE_DOMAINS['walmart.com'].priority).toBe(9);
      expect(ECOMMERCE_DOMAINS['target.com'].priority).toBe(9);
    });

    it('should have medium priority for specialty stores', () => {
      expect(ECOMMERCE_DOMAINS['rei.com'].priority).toBe(8);
      expect(ECOMMERCE_DOMAINS['bestbuy.com'].priority).toBe(8);
    });
  });
});

describe('DuckDuckGo URL Building', () => {
  function buildDuckDuckGoUrl(query) {
    const baseUrl = 'https://html.duckduckgo.com/html/';
    const params = new URLSearchParams({ q: query, t: 'h_', ia: 'web' });
    return `${baseUrl}?${params.toString()}`;
  }

  it('should build correct search URL', () => {
    const url = buildDuckDuckGoUrl('sony headphones price');

    expect(url).toContain('html.duckduckgo.com/html/');
    expect(url).toContain('q=');
    expect(url).toContain('sony');
    expect(url).toContain('headphones');
  });

  it('should encode special characters', () => {
    const url = buildDuckDuckGoUrl('product & category');

    expect(url).toContain('%26'); // encoded &
  });

  it('should use HTML version of DuckDuckGo', () => {
    const url = buildDuckDuckGoUrl('test');

    expect(url.startsWith('https://html.duckduckgo.com')).toBe(true);
  });

  it('should include required parameters', () => {
    const url = buildDuckDuckGoUrl('test');

    expect(url).toContain('t=h_');
    expect(url).toContain('ia=web');
  });
});

describe('Search Result Filtering', () => {
  function filterEcommerceResults(results) {
    return results.filter(r => r.isEcommerce);
  }

  function filterByPriority(results, minPriority) {
    return results.filter(r => 
      r.ecommerceInfo && r.ecommerceInfo.priority >= minPriority
    );
  }

  function getTopEcommerceResult(results) {
    const ecommerce = filterEcommerceResults(results);
    if (ecommerce.length === 0) return null;
    
    return ecommerce.reduce((best, curr) => {
      const bestPriority = best.ecommerceInfo?.priority || 0;
      const currPriority = curr.ecommerceInfo?.priority || 0;
      return currPriority > bestPriority ? curr : best;
    });
  }

  it('should filter to e-commerce results only', () => {
    const results = [
      { domain: 'amazon.com', isEcommerce: true, ecommerceInfo: { priority: 10 } },
      { domain: 'blog.example.com', isEcommerce: false },
      { domain: 'burton.com', isEcommerce: true, ecommerceInfo: { priority: 10 } },
    ];

    const filtered = filterEcommerceResults(results);

    expect(filtered).toHaveLength(2);
    expect(filtered.every(r => r.isEcommerce)).toBe(true);
  });

  it('should filter by minimum priority', () => {
    const results = [
      { domain: 'amazon.com', isEcommerce: true, ecommerceInfo: { priority: 10 } },
      { domain: 'rei.com', isEcommerce: true, ecommerceInfo: { priority: 8 } },
      { domain: 'backcountry.com', isEcommerce: true, ecommerceInfo: { priority: 7 } },
    ];

    const filtered = filterByPriority(results, 9);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].domain).toBe('amazon.com');
  });

  it('should get top e-commerce result by priority', () => {
    const results = [
      { domain: 'rei.com', isEcommerce: true, ecommerceInfo: { priority: 8 } },
      { domain: 'amazon.com', isEcommerce: true, ecommerceInfo: { priority: 10 } },
      { domain: 'blog.example.com', isEcommerce: false },
    ];

    const top = getTopEcommerceResult(results);

    expect(top.domain).toBe('amazon.com');
  });

  it('should return null when no e-commerce results', () => {
    const results = [
      { domain: 'blog.example.com', isEcommerce: false },
      { domain: 'news.example.com', isEcommerce: false },
    ];

    const top = getTopEcommerceResult(results);

    expect(top).toBeNull();
  });
});
