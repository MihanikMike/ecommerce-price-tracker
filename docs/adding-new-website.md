# Adding a New Website Scraper

This guide explains how to add support for a new e-commerce website to the price tracker.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Analyze the Website](#step-1-analyze-the-website)
4. [Step 2: Create the Scraper](#step-2-create-the-scraper)
5. [Step 3: Register the Site](#step-3-register-the-site)
6. [Step 4: Write Tests](#step-4-write-tests)
7. [Step 5: Test Manually](#step-5-test-manually)
8. [Common Challenges](#common-challenges)
9. [Best Practices](#best-practices)

---

## Overview

The price tracker uses **Playwright** for browser automation to scrape product data from e-commerce websites. Each site has:

1. **A scraper function** (`src/scraper/<site>.js`) - Extracts product data
2. **Site registry entry** (`src/search/site-registry.js`) - Configuration and selectors
3. **Tests** (`tests/unit/scraper/<site>.test.js`) - Verify scraper works

---

## Prerequisites

Before starting:

- Understand basic CSS selectors
- Know how to use browser DevTools
- Have the project running locally
- Read existing scrapers (Amazon, Burton) as examples

---

## Step 1: Analyze the Website

### 1.1 Identify Product Pages

Find the URL pattern for product pages:

```
Amazon:   https://amazon.com/dp/B08N5WRWNW
Burton:   https://burton.com/us/en/p/some-product-name
Walmart:  https://walmart.com/ip/Product-Name/123456789
```

### 1.2 Find CSS Selectors

Open a product page in your browser and use DevTools (F12) to find selectors for:

| Data | What to Look For |
|------|------------------|
| **Title** | `<h1>` with product name |
| **Price** | Element containing price (often has `price` in class) |
| **Currency** | Often embedded in price or separate element |
| **Availability** | "In Stock", "Out of Stock" indicators |
| **Image** | Main product image `<img>` |

### Tips for Finding Selectors

```javascript
// Look for these patterns in the HTML:

// Semantic attributes
<h1 itemprop="name">Product Title</h1>
<span itemprop="price">29.99</span>

// Data attributes
<div data-testid="product-title">...</div>
<span data-price="29.99">$29.99</span>

// Unique IDs
<h1 id="productTitle">...</h1>

// Classes with meaningful names
<span class="price-current">$29.99</span>
```

### 1.3 Check for Anti-Bot Protection

Visit the site and look for:

- Cloudflare challenge pages
- CAPTCHA requirements
- Rate limiting warnings
- JavaScript-heavy rendering

---

## Step 2: Create the Scraper

Create a new file: `src/scraper/<sitename>.js`

### Basic Template

```javascript
import { fetchPage, releaseBrowser } from "../utils/fetch-page.js";
import logger from "../utils/logger.js";
import { validateScrapedData, logValidationErrors } from "../utils/validation.js";

/**
 * Try multiple selectors until one works
 * @param {Page} page - Playwright page
 * @param {Array<string>} selectors - Array of CSS selectors to try
 * @param {string} fieldName - Name of field for logging
 * @returns {Promise<string|null>} Element text or null
 */
async function trySelectors(page, selectors, fieldName) {
  for (let i = 0; i < selectors.length; i++) {
    try {
      const selector = selectors[i];
      const element = await page.$(selector);
      if (element) {
        const text = await element.innerText();
        if (text && text.trim()) {
          logger.debug({ selector, fieldName, attempt: i + 1 }, 'Selector succeeded');
          return text.trim();
        }
      }
    } catch (error) {
      logger.debug({ selector: selectors[i], fieldName, error: error.message }, 'Selector failed');
    }
  }
  
  logger.warn({ selectors, fieldName }, 'All selectors failed');
  return null;
}

/**
 * Scrape product data from <SiteName>
 * @param {string} url - Product URL
 * @returns {Promise<Object|null>} Product data or null on failure
 */
export async function scrape<SiteName>(url) {
  const browserContext = await fetchPage(url);
  const { page } = browserContext;

  try {
    // Wait for page to load
    const pageLoadSelectors = ["h1", ".product-title", "[data-testid='title']"];
    await Promise.race([
      ...pageLoadSelectors.map(sel => 
        page.waitForSelector(sel, { timeout: 15000 }).catch(() => null)
      ),
      page.waitForTimeout(15000)
    ]);

    // Title selectors (in order of preference)
    const titleSelectors = [
      "h1.product-title",
      "[data-testid='product-title']",
      "h1[itemprop='name']",
      "h1"
    ];
    
    const title = await trySelectors(page, titleSelectors, 'title');
    if (!title) {
      throw new Error('Could not find product title with any selector');
    }

    // Price selectors (in order of preference)
    const priceSelectors = [
      "[data-testid='price']",
      ".price-current",
      "[itemprop='price']",
      ".product-price"
    ];
    
    const priceText = await trySelectors(page, priceSelectors, 'price');
    if (!priceText) {
      throw new Error('Could not find product price with any selector');
    }
    
    // Extract numeric price
    const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
    
    // Detect currency (customize based on site)
    const currency = priceText.includes('£') ? 'GBP' 
                   : priceText.includes('€') ? 'EUR' 
                   : 'USD';

    const data = {
      site: "<SiteName>",  // e.g., "Walmart", "BestBuy"
      url,
      title,
      price,
      currency,
      timestamp: new Date()
    };
    
    // Validate scraped data
    const validation = validateScrapedData(data);
    if (!validation.valid) {
      logValidationErrors('scrape<SiteName>', validation.errors);
      logger.warn({ url, errors: validation.errors }, 'Scraped data validation failed');
      return null;
    }

    logger.debug({ url, title, price }, '<SiteName> scrape successful');
    return data;

  } catch (err) {
    logger.error({ error: err, url }, '<SiteName> scraping failed');
    return null;
  } finally {
    await releaseBrowser(browserContext);
  }
}
```

---

## Step 3: Register the Site

Edit `src/search/site-registry.js`:

### 3.1 Add Import

```javascript
import { scrapeAmazon } from "../scraper/amazon.js";
import { scrapeBurton } from "../scraper/burton.js";
import { scrape<SiteName> } from "../scraper/<sitename>.js";  // Add this
```

### 3.2 Add Selectors

Add to `SITE_SELECTORS` object:

```javascript
const SITE_SELECTORS = {
  amazon: { ... },
  burton: { ... },
  
  // Add your site
  <sitename>: {
    title: [
      "h1.product-title",
      "[data-testid='product-title']",
      "h1"
    ],
    price: [
      "[data-testid='price']",
      ".price-current",
      ".product-price"
    ],
    availability: [
      ".in-stock",
      ".availability"
    ],
    image: [
      ".product-image img",
      "[data-testid='product-image']"
    ]
  },
};
```

### 3.3 Add Site Configuration

Add to `SITE_CONFIGS` object:

```javascript
const SITE_CONFIGS = {
  amazon: { ... },
  burton: { ... },
  
  // Add your site
  <sitename>: {
    name: '<SiteName>',          // Display name
    domains: [
      '<sitename>.com',
      'www.<sitename>.com'
    ],
    scraper: scrape<SiteName>,   // Your scraper function
    selectors: SITE_SELECTORS.<sitename>,
    rateLimit: {
      requestsPerMinute: 10,
      minDelayMs: 3000
    },
    features: {
      supportsSearch: false,     // Set true if search works
      requiresJS: true,          // Usually true for modern sites
      hasAntiBot: false          // Set true if Cloudflare etc.
    }
  },
};
```

---

## Step 4: Write Tests

Create `tests/unit/scraper/<sitename>.test.js`:

```javascript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { scrape<SiteName> } from '../../../src/scraper/<sitename>.js';

// Mock the fetch-page module
jest.mock('../../../src/utils/fetch-page.js', () => ({
  fetchPage: jest.fn(),
  releaseBrowser: jest.fn(),
}));

import { fetchPage, releaseBrowser } from '../../../src/utils/fetch-page.js';

describe('scrape<SiteName>', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should scrape product data successfully', async () => {
    // Mock page with product data
    const mockPage = {
      $: jest.fn().mockImplementation((selector) => {
        if (selector.includes('title')) {
          return { innerText: () => Promise.resolve('Test Product') };
        }
        if (selector.includes('price')) {
          return { innerText: () => Promise.resolve('$29.99') };
        }
        return null;
      }),
      waitForSelector: jest.fn().mockResolvedValue(true),
      waitForTimeout: jest.fn().mockResolvedValue(true),
    };

    fetchPage.mockResolvedValue({ page: mockPage });

    const result = await scrape<SiteName>('https://<sitename>.com/product/123');

    expect(result).not.toBeNull();
    expect(result.title).toBe('Test Product');
    expect(result.price).toBe(29.99);
    expect(result.site).toBe('<SiteName>');
    expect(releaseBrowser).toHaveBeenCalled();
  });

  it('should return null when title not found', async () => {
    const mockPage = {
      $: jest.fn().mockResolvedValue(null),
      waitForSelector: jest.fn().mockResolvedValue(true),
      waitForTimeout: jest.fn().mockResolvedValue(true),
    };

    fetchPage.mockResolvedValue({ page: mockPage });

    const result = await scrape<SiteName>('https://<sitename>.com/product/123');

    expect(result).toBeNull();
  });

  it('should handle page errors gracefully', async () => {
    fetchPage.mockRejectedValue(new Error('Network error'));

    const result = await scrape<SiteName>('https://<sitename>.com/product/123');

    expect(result).toBeNull();
  });
});
```

### Run Tests

```bash
# Run your new tests
npm test -- tests/unit/scraper/<sitename>.test.js

# Run all scraper tests
npm test -- tests/unit/scraper/
```

---

## Step 5: Test Manually

### 5.1 Create a Test Script

Create `test-<sitename>.js` in the project root:

```javascript
import { scrape<SiteName> } from './src/scraper/<sitename>.js';

const testUrls = [
  'https://<sitename>.com/product/example-1',
  'https://<sitename>.com/product/example-2',
  'https://<sitename>.com/product/example-3',
];

async function test() {
  for (const url of testUrls) {
    console.log(`\nTesting: ${url}`);
    const result = await scrape<SiteName>(url);
    console.log(result ? JSON.stringify(result, null, 2) : 'FAILED');
  }
  process.exit(0);
}

test();
```

### 5.2 Run Manual Test

```bash
node test-<sitename>.js
```

### 5.3 Test via CLI

```bash
# Add to tracked products
node src/cli/products.js add "https://<sitename>.com/product/123"

# Check the database
node src/cli/view-db.js
```

---

## Common Challenges

### Dynamic Content

Some sites load prices via JavaScript after page load:

```javascript
// Wait for specific element to appear
await page.waitForSelector('.price-loaded', { timeout: 10000 });

// Or wait for network to be idle
await page.waitForLoadState('networkidle');
```

### Anti-Bot Protection

For sites with Cloudflare or similar:

```javascript
// Add longer delays
await page.waitForTimeout(5000);

// Use stealth mode (already configured in fetch-page.js)

// Add human-like behavior
await page.mouse.move(100, 100);
await page.mouse.wheel(0, 300);
```

### Multiple Price Formats

Handle different price formats:

```javascript
function parsePrice(priceText) {
  // Remove currency symbols and thousands separators
  let cleaned = priceText
    .replace(/[£$€¥]/g, '')
    .replace(/,/g, '')
    .trim();
  
  // Handle "From $X.XX" format
  const fromMatch = cleaned.match(/from\s*([\d.]+)/i);
  if (fromMatch) {
    cleaned = fromMatch[1];
  }
  
  return parseFloat(cleaned);
}
```

### Regional Variations

Handle different regional sites:

```javascript
const SITE_CONFIGS = {
  amazon: {
    domains: ['amazon.com'],
    // ...
  },
  amazon_uk: {
    domains: ['amazon.co.uk'],
    currency: 'GBP',
    // ...
  },
};
```

---

## Best Practices

### 1. Use Multiple Selectors

Always provide fallback selectors:

```javascript
const titleSelectors = [
  "#specific-id",           // Most specific first
  ".specific-class",        // Then class selectors
  "[data-attribute]",       // Data attributes
  "h1"                      // Generic fallback last
];
```

### 2. Handle Errors Gracefully

```javascript
try {
  const price = await scrapePrice(page);
} catch (error) {
  logger.warn({ error }, 'Price scraping failed');
  return null;  // Don't throw, return null
}
```

### 3. Log Useful Information

```javascript
logger.debug({ url, selector, value }, 'Extracted price');
logger.warn({ url, selectors }, 'All selectors failed');
logger.error({ url, error }, 'Scraping failed');
```

### 4. Validate Data

Always validate before returning:

```javascript
const validation = validateScrapedData(data);
if (!validation.valid) {
  return null;
}
```

### 5. Clean Up Resources

Always release the browser:

```javascript
try {
  // ... scraping logic
} finally {
  await releaseBrowser(browserContext);
}
```

### 6. Respect Rate Limits

Configure appropriate delays:

```javascript
rateLimit: {
  requestsPerMinute: 10,
  minDelayMs: 3000
}
```

---

## Checklist

Before submitting your scraper:

- [ ] Scraper extracts title, price, and currency
- [ ] Multiple selectors provided for each field
- [ ] Site registered in site-registry.js
- [ ] Unit tests written and passing
- [ ] Manual testing with 5+ products
- [ ] Error handling in place
- [ ] Browser resources cleaned up
- [ ] Logging added
- [ ] Documentation updated

---

## Need Help?

- Check existing scrapers for examples
- Ask in GitHub Discussions
- Open a draft PR for early feedback
