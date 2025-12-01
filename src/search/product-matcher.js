/**
 * Product Matcher
 * 
 * Fuzzy matching utility to find the best product match from search results.
 * Uses multiple scoring factors:
 * - Title similarity (Levenshtein distance, word matching)
 * - Keyword presence
 * - Brand matching
 * - Price reasonableness
 */

import logger from "../utils/logger.js";

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(a, b) {
    const matrix = [];
    
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[b.length][a.length];
}

/**
 * Normalize text for comparison
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
function normalizeText(text) {
    if (!text) return '';
    
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')  // Remove special chars
        .replace(/\s+/g, ' ')       // Normalize whitespace
        .trim();
}

/**
 * Tokenize text into words
 * @param {string} text - Text to tokenize
 * @returns {Array<string>} Array of words
 */
function tokenize(text) {
    return normalizeText(text)
        .split(' ')
        .filter(word => word.length > 1);  // Skip single chars
}

/**
 * Calculate word overlap score
 * @param {Array<string>} queryWords - Query words
 * @param {Array<string>} titleWords - Title words
 * @returns {number} Score 0-1
 */
function wordOverlapScore(queryWords, titleWords) {
    if (queryWords.length === 0 || titleWords.length === 0) return 0;
    
    const querySet = new Set(queryWords);
    const titleSet = new Set(titleWords);
    
    let matches = 0;
    for (const word of querySet) {
        if (titleSet.has(word)) {
            matches++;
        }
    }
    
    // Jaccard-like similarity
    const unionSize = querySet.size + titleSet.size - matches;
    return matches / unionSize;
}

/**
 * Calculate sequential word match score
 * Rewards words appearing in the same order
 * @param {Array<string>} queryWords - Query words
 * @param {Array<string>} titleWords - Title words
 * @returns {number} Score 0-1
 */
function sequentialMatchScore(queryWords, titleWords) {
    if (queryWords.length === 0 || titleWords.length === 0) return 0;
    
    let maxSequence = 0;
    let currentSequence = 0;
    let titleIndex = 0;
    
    for (const queryWord of queryWords) {
        let found = false;
        for (let i = titleIndex; i < titleWords.length; i++) {
            if (titleWords[i] === queryWord || titleWords[i].includes(queryWord)) {
                currentSequence++;
                titleIndex = i + 1;
                found = true;
                break;
            }
        }
        if (!found) {
            maxSequence = Math.max(maxSequence, currentSequence);
            currentSequence = 0;
        }
    }
    
    maxSequence = Math.max(maxSequence, currentSequence);
    return maxSequence / queryWords.length;
}

/**
 * Check if brand matches
 * @param {string} query - Search query
 * @param {string} title - Product title
 * @param {string} brand - Product brand (if available)
 * @returns {number} Score 0-1
 */
function brandMatchScore(query, title, brand) {
    const queryWords = tokenize(query);
    const titleLower = normalizeText(title);
    const brandLower = normalizeText(brand || '');
    
    // Common brand names to look for
    const commonBrands = [
        'nike', 'adidas', 'burton', 'apple', 'samsung', 'sony', 'lg',
        'microsoft', 'dell', 'hp', 'lenovo', 'asus', 'acer',
        'north face', 'patagonia', 'columbia', 'arc\'teryx',
        'levi', 'gap', 'zara', 'h&m', 'uniqlo'
    ];
    
    for (const queryWord of queryWords) {
        // Check if query word is a brand
        if (commonBrands.some(b => b.includes(queryWord) || queryWord.includes(b))) {
            // Check if brand appears in title or brand field
            if (titleLower.includes(queryWord) || brandLower.includes(queryWord)) {
                return 1.0;
            }
        }
    }
    
    return 0;
}

/**
 * Calculate price reasonableness score
 * @param {number} price - Product price
 * @param {number} expectedPrice - Expected price (if known)
 * @param {Array<number>} allPrices - All prices from search results
 * @returns {number} Score 0-1
 */
function priceScore(price, expectedPrice, allPrices = []) {
    if (!price || price <= 0) return 0;
    
    // If expected price is provided
    if (expectedPrice && expectedPrice > 0) {
        const ratio = price / expectedPrice;
        
        // Within 50% of expected is good
        if (ratio >= 0.5 && ratio <= 1.5) {
            return 1 - Math.abs(1 - ratio) / 2;
        }
        return 0.2;  // Very different from expected
    }
    
    // If we have other prices, check if this is reasonable
    if (allPrices.length > 1) {
        const validPrices = allPrices.filter(p => p > 0);
        const median = validPrices.sort((a, b) => a - b)[Math.floor(validPrices.length / 2)];
        
        const ratio = price / median;
        if (ratio >= 0.5 && ratio <= 2) {
            return 0.8;  // Close to median
        }
        return 0.4;  // Outlier
    }
    
    return 0.5;  // No comparison available
}

/**
 * Calculate overall match score for a product
 * @param {Object} params - Matching parameters
 * @returns {Object} Score details
 */
export function calculateMatchScore({
    query,
    keywords = [],
    productTitle,
    productPrice,
    productBrand,
    expectedPrice,
    allPrices = [],
}) {
    const queryWords = tokenize(query);
    const keywordWords = keywords.flatMap(k => tokenize(k));
    const allQueryWords = [...new Set([...queryWords, ...keywordWords])];
    const titleWords = tokenize(productTitle);
    
    // Calculate component scores
    const scores = {
        wordOverlap: wordOverlapScore(queryWords, titleWords),
        sequentialMatch: sequentialMatchScore(queryWords, titleWords),
        keywordMatch: keywordWords.length > 0 
            ? wordOverlapScore(keywordWords, titleWords) 
            : 0.5,
        brandMatch: brandMatchScore(query, productTitle, productBrand),
        priceReasonable: priceScore(productPrice, expectedPrice, allPrices),
    };
    
    // Weight factors
    const weights = {
        wordOverlap: 0.25,
        sequentialMatch: 0.30,
        keywordMatch: 0.15,
        brandMatch: 0.15,
        priceReasonable: 0.15,
    };
    
    // Calculate weighted score
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const [key, score] of Object.entries(scores)) {
        totalScore += score * weights[key];
        totalWeight += weights[key];
    }
    
    const finalScore = (totalScore / totalWeight) * 100;
    
    return {
        score: Math.round(finalScore * 100) / 100,
        components: scores,
        weights,
        confidence: getConfidenceLevel(finalScore),
    };
}

/**
 * Get confidence level from score
 * @param {number} score - Match score 0-100
 * @returns {string} Confidence level
 */
function getConfidenceLevel(score) {
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    if (score >= 40) return 'low';
    return 'very_low';
}

/**
 * Find best matching product from search results
 * @param {string} query - Original search query
 * @param {Array<string>} keywords - Additional keywords
 * @param {Array<Object>} products - Scraped product data
 * @param {Object} options - Matching options
 * @returns {Object} Best match and all scored results
 */
export function findBestMatch(query, keywords, products, options = {}) {
    const {
        expectedPrice = null,
        minScore = 30,
        requireAvailable = false,
    } = options;
    
    if (!products || products.length === 0) {
        return { bestMatch: null, scoredResults: [] };
    }
    
    // Get all prices for comparison
    const allPrices = products
        .map(p => p.price)
        .filter(p => p && p > 0);
    
    // Score all products
    const scoredResults = products.map(product => {
        const matchResult = calculateMatchScore({
            query,
            keywords,
            productTitle: product.title,
            productPrice: product.price,
            productBrand: product.brand,
            expectedPrice,
            allPrices,
        });
        
        return {
            ...product,
            matchScore: matchResult.score,
            matchDetails: matchResult,
        };
    });
    
    // Sort by score descending
    scoredResults.sort((a, b) => b.matchScore - a.matchScore);
    
    // Filter by minimum score and availability
    let candidates = scoredResults.filter(p => p.matchScore >= minScore);
    
    if (requireAvailable) {
        candidates = candidates.filter(p => p.available !== false);
    }
    
    const bestMatch = candidates[0] || null;
    
    logger.info({
        query,
        totalProducts: products.length,
        scoredAboveMin: candidates.length,
        bestMatchScore: bestMatch?.matchScore,
        bestMatchTitle: bestMatch?.title?.substring(0, 50),
    }, 'Product matching completed');
    
    return {
        bestMatch,
        scoredResults,
        candidates,
    };
}

/**
 * Compare prices across multiple sources
 * @param {Array<Object>} products - Array of product data
 * @returns {Object} Price comparison analysis
 */
export function comparePrices(products) {
    if (!products || products.length === 0) {
        return {
            lowestPrice: null,
            highestPrice: null,
            averagePrice: null,
            priceRange: null,
            savings: null,
            recommendations: [],
        };
    }
    
    const validProducts = products.filter(p => p.price && p.price > 0);
    
    if (validProducts.length === 0) {
        return {
            lowestPrice: null,
            highestPrice: null,
            averagePrice: null,
            priceRange: null,
            savings: null,
            recommendations: [],
        };
    }
    
    // Sort by price
    const sortedByPrice = [...validProducts].sort((a, b) => a.price - b.price);
    
    const lowestPrice = sortedByPrice[0];
    const highestPrice = sortedByPrice[sortedByPrice.length - 1];
    const averagePrice = validProducts.reduce((sum, p) => sum + p.price, 0) / validProducts.length;
    const priceRange = highestPrice.price - lowestPrice.price;
    const savings = priceRange;
    const savingsPercent = (savings / highestPrice.price) * 100;
    
    // Generate recommendations
    const recommendations = [];
    
    if (lowestPrice) {
        recommendations.push({
            type: 'best_price',
            product: lowestPrice,
            message: `Best price at ${lowestPrice.site}: $${lowestPrice.price.toFixed(2)}`,
        });
    }
    
    if (savingsPercent > 10) {
        recommendations.push({
            type: 'savings_opportunity',
            savings: savings.toFixed(2),
            savingsPercent: savingsPercent.toFixed(1),
            message: `Save $${savings.toFixed(2)} (${savingsPercent.toFixed(1)}%) by buying from ${lowestPrice.site}`,
        });
    }
    
    // Check for available products
    const availableProducts = validProducts.filter(p => p.available !== false);
    if (availableProducts.length < validProducts.length) {
        const bestAvailable = [...availableProducts].sort((a, b) => a.price - b.price)[0];
        if (bestAvailable && bestAvailable.price !== lowestPrice?.price) {
            recommendations.push({
                type: 'best_available',
                product: bestAvailable,
                message: `Best available price at ${bestAvailable.site}: $${bestAvailable.price.toFixed(2)}`,
            });
        }
    }
    
    return {
        lowestPrice,
        highestPrice,
        averagePrice: Math.round(averagePrice * 100) / 100,
        priceRange: Math.round(priceRange * 100) / 100,
        savings: Math.round(savings * 100) / 100,
        savingsPercent: Math.round(savingsPercent * 10) / 10,
        recommendations,
        allPrices: sortedByPrice.map(p => ({
            site: p.site,
            price: p.price,
            url: p.url,
            available: p.available,
        })),
    };
}

export default {
    calculateMatchScore,
    findBestMatch,
    comparePrices,
    levenshteinDistance,
    normalizeText,
    tokenize,
};
