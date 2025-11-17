/**
 * Product ID Hasher Module
 * Generates unique, deterministic product IDs from URL, title, and domain
 * Handles URL variations and normalizes titles for consistent hashing
 */

/**
 * Generate a unique product ID
 * @param {string} url - Product URL
 * @param {string} title - Product title
 * @param {string} domain - Domain name
 * @returns {string} Unique product ID hash (8-12 characters hex)
 */
export function generateProductId(url, title, domain) {
  try {
    const productId = extractProductIdentifier(url, domain);
    const normalizedTitle = normalizeTitle(title);
    const combined = `${domain}|${productId}|${normalizedTitle}`;
    return simpleHash(combined);
  } catch (error) {
    console.error('[Product Hasher] Error generating product ID:', error);
    // Fallback to simple hash of URL
    return simpleHash(url || Date.now().toString());
  }
}

/**
 * Extract product identifier from URL based on domain
 * @param {string} url - Product URL
 * @param {string} domain - Domain name
 * @returns {string} Extracted product identifier
 */
function extractProductIdentifier(url, domain) {
  if (!url) return 'unknown';

  // Amazon: Extract ASIN (Amazon Standard Identification Number)
  // Patterns: /dp/XXXXX, /gp/product/XXXXX
  if (domain.includes('amazon')) {
    const asinMatch = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    if (asinMatch) {
      return asinMatch[1];
    }
  }

  // eBay: Extract item ID
  // Pattern: /itm/123456789
  if (domain.includes('ebay')) {
    const itemMatch = url.match(/\/itm\/(\d+)/);
    if (itemMatch) {
      return itemMatch[1];
    }
  }

  // Walmart: Extract product ID
  // Pattern: /ip/Product-Name/12345678
  if (domain.includes('walmart')) {
    const walmartMatch = url.match(/\/ip\/[^\/]+\/(\d+)/);
    if (walmartMatch) {
      return walmartMatch[1];
    }
  }

  // Target: Extract TCIN (Target.com Item Number)
  // Pattern: /p/Product-Name/-/A-12345678
  if (domain.includes('target')) {
    const targetMatch = url.match(/\/p\/[^\/]+\/-\/A-(\d+)/);
    if (targetMatch) {
      return targetMatch[1];
    }
  }

  // Best Buy: Extract SKU
  // Pattern: /site/product-name/12345678.p
  if (domain.includes('bestbuy')) {
    const bestbuyMatch = url.match(/\/site\/[^\/]+\/(\d+)\.p/);
    if (bestbuyMatch) {
      return bestbuyMatch[1];
    }
  }

  // Generic fallback: use pathname without query
  return getPathHash(url);
}

/**
 * Get hash of URL pathname (fallback for unknown sites)
 * @param {string} url - Full URL
 * @returns {string} Pathname-based identifier
 */
function getPathHash(url) {
  try {
    const urlObj = new URL(url);
    // Remove leading/trailing slashes and replace internal slashes with underscores
    return urlObj.pathname
      .replace(/^\/|\/$/g, '')
      .replace(/\//g, '_')
      .slice(0, 100); // Limit length
  } catch (error) {
    // Invalid URL, use first 100 chars
    return url.slice(0, 100);
  }
}

/**
 * Normalize product title for consistent hashing
 * @param {string} title - Raw product title
 * @returns {string} Normalized title (max 50 chars)
 */
function normalizeTitle(title) {
  if (!title || typeof title !== 'string') {
    return 'untitled';
  }

  return title
    .toLowerCase()                        // Convert to lowercase
    .trim()                                // Remove leading/trailing whitespace
    .replace(/\s+/g, ' ')                 // Replace multiple spaces with single space
    .replace(/[^a-z0-9\s-]/g, '')         // Remove special characters except spaces and dashes
    .slice(0, 50);                        // Truncate to 50 characters
}

/**
 * Simple hash function using djb2 algorithm
 * Fast, deterministic, and good distribution for our use case
 * @param {string} str - String to hash
 * @returns {string} Hexadecimal hash string (8-12 characters)
 */
function simpleHash(str) {
  if (!str) return '0';

  let hash = 5381;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    // hash * 33 + char
    hash = ((hash << 5) + hash) + char;
    // Convert to 32-bit integer
    hash = hash & hash;
  }

  // Convert to hexadecimal and take first 12 characters
  return Math.abs(hash).toString(16).slice(0, 12);
}

/**
 * Validate a product ID
 * @param {string} productId - Product ID to validate
 * @returns {boolean} True if valid
 */
export function isValidProductId(productId) {
  return productId &&
         typeof productId === 'string' &&
         productId.length >= 1 &&
         productId.length <= 12 &&
         /^[a-f0-9]+$/.test(productId);
}
