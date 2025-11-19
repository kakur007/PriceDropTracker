/**
 * Price Extractor - Helper Functions
 * Utility functions for extracting and validating prices from DOM elements
 * Used by product-detector.js and future price checking logic
 */

import { parsePrice } from '../utils/currency-parser.js';
import { debug, debugWarn, debugError } from '../utils/debug.js';

/**
 * Extract price from a DOM element
 * Tries multiple methods: data attributes, text content, child elements
 * @param {HTMLElement} element - DOM element that might contain a price
 * @param {Object} context - Context data for price parsing (domain, locale, etc.)
 * @returns {Object|null} Parsed price data or null
 */
export function extractPriceFromElement(element, context = {}) {
  if (!element) {
    return null;
  }

  // Method 1: Try data attributes first (most reliable)
  const dataPrice =
    element.getAttribute('data-price') ||
    element.getAttribute('data-product-price') ||
    element.getAttribute('data-price-amount') ||
    element.getAttribute('content') ||
    element.getAttribute('value');

  if (dataPrice) {
    const parsed = parsePrice(dataPrice, context);
    if (parsed && parsed.confidence >= 0.70) {
      return parsed;
    }
  }

  // Method 2: Try text content
  const text = element.textContent?.trim();
  if (text && text.length > 0 && text.length < 100) {
    const parsed = parsePrice(text, context);
    if (parsed && parsed.confidence >= 0.70) {
      return parsed;
    }
  }

  // Method 3: Try child elements with price-related classes/attributes
  const priceChild = element.querySelector(
    '[class*="price"], [data-price], [itemprop="price"], .a-offscreen'
  );
  if (priceChild && priceChild !== element) {
    // Recursive call, but prevent infinite loop
    return extractPriceFromElement(priceChild, context);
  }

  return null;
}

/**
 * Find all potential price elements in a container
 * @param {HTMLElement} rootElement - Root element to search within (default: document)
 * @returns {HTMLElement[]} Array of candidate price elements
 */
export function findPriceElements(rootElement = document) {
  const selectors = [
    // Data attributes (highest priority)
    '[data-price]',
    '[data-product-price]',
    '[data-price-amount]',

    // Semantic/Microdata
    '[itemprop="price"]',
    '[itemprop="lowPrice"]',
    '[itemprop="highPrice"]',

    // Common class names
    '.price',
    '.product-price',
    '.sale-price',
    '.regular-price',
    '[class*="price"]',
    '[class*="Price"]',

    // IDs
    '[id*="price"]',
    '[id*="Price"]',

    // Site-specific selectors
    '#priceblock_ourprice',           // Amazon
    '#priceblock_dealprice',          // Amazon deal price
    '#priceblock_saleprice',          // Amazon sale price
    '.a-price',                        // Amazon price container
    '.a-price .a-offscreen',          // Amazon hidden price (screen reader)
    '.x-price-primary',                // eBay
    '[data-testid="price"]',           // Modern React apps
    '[data-automation="product-price"]', // Target
    '.price-current',                  // Newegg

    // Generic product containers that might have price
    '[data-component="price"]',
    '[data-qa="price"]'
  ];

  const elements = [];
  const seen = new Set();

  for (const selector of selectors) {
    try {
      const found = rootElement.querySelectorAll(selector);
      for (const el of found) {
        // Avoid duplicates
        if (!seen.has(el)) {
          seen.add(el);
          elements.push(el);
        }
      }
    } catch (error) {
      debugWarn('[price-extractor]', '[Price Extractor] Invalid selector:', selector, error);
    }
  }

  return elements;
}

/**
 * Validate that price data is reasonable and usable
 * @param {Object} priceData - Parsed price object
 * @returns {boolean} True if price is valid
 */
export function validatePrice(priceData) {
  // Must exist and be an object
  if (!priceData || typeof priceData !== 'object') {
    return false;
  }

  // Must have numeric value
  if (typeof priceData.numeric !== 'number' || isNaN(priceData.numeric)) {
    return false;
  }

  // Must be positive (0 is valid for FREE items)
  if (priceData.numeric < 0) {
    return false;
  }

  // Reasonable range (0.01 to 9,999,999)
  // Allow 0 for free items, but not negative
  if (priceData.numeric > 0 && priceData.numeric < 0.01) {
    return false; // Too small, likely parsing error
  }

  if (priceData.numeric > 9999999) {
    return false; // Too large, likely parsing error
  }

  // Must have currency code
  if (!priceData.currency || typeof priceData.currency !== 'string') {
    return false;
  }

  // Currency must be 3-letter code
  if (priceData.currency.length !== 3) {
    return false;
  }

  // Confidence must be reasonable (0-1 range)
  if (typeof priceData.confidence !== 'number' ||
      priceData.confidence < 0 ||
      priceData.confidence > 1) {
    return false;
  }

  // Confidence must be at least 0.50 to be useful
  if (priceData.confidence < 0.50) {
    return false;
  }

  return true;
}

/**
 * Compare two prices and calculate the difference
 * Handles currency mismatches and edge cases
 * @param {Object} oldPrice - Previous price object
 * @param {Object} newPrice - New price object
 * @returns {Object} Comparison result with dropped, amount, percentage, etc.
 */
export function comparePrices(oldPrice, newPrice) {
  // Validate both prices exist
  if (!oldPrice || !newPrice) {
    return {
      comparable: false,
      reason: 'missing_data',
      oldPrice: oldPrice?.numeric || null,
      newPrice: newPrice?.numeric || null
    };
  }

  // Validate numeric values
  if (typeof oldPrice.numeric !== 'number' || typeof newPrice.numeric !== 'number') {
    return {
      comparable: false,
      reason: 'invalid_numeric',
      oldPrice: oldPrice.numeric,
      newPrice: newPrice.numeric
    };
  }

  // Check for currency mismatch
  if (oldPrice.currency !== newPrice.currency) {
    return {
      comparable: false,
      reason: 'currency_mismatch',
      oldCurrency: oldPrice.currency,
      newCurrency: newPrice.currency,
      oldPrice: oldPrice.numeric,
      newPrice: newPrice.numeric
    };
  }

  // Calculate difference
  const difference = oldPrice.numeric - newPrice.numeric;
  const percentageChange = oldPrice.numeric > 0 ?
    (difference / oldPrice.numeric) * 100 :
    0;

  // Determine if prices are essentially the same (within 1 cent)
  const unchanged = Math.abs(difference) < 0.01;

  return {
    comparable: true,
    dropped: difference > 0.01,           // Price went down
    increased: difference < -0.01,        // Price went up
    unchanged: unchanged,                  // Price stayed the same
    amount: Math.abs(difference),         // Absolute difference
    percentage: Math.abs(percentageChange), // Absolute percentage change
    oldPrice: oldPrice.numeric,
    newPrice: newPrice.numeric,
    currency: oldPrice.currency,
    symbol: oldPrice.symbol || '$',

    // Additional useful info
    savedAmount: difference > 0 ? difference : 0,  // Only if dropped
    savedPercentage: difference > 0 ? percentageChange : 0
  };
}

/**
 * Format price for display
 * @param {Object} priceData - Parsed price object
 * @returns {string} Formatted price string (e.g., "$99.99", "€1.299,99")
 */
export function formatPrice(priceData) {
  if (!priceData || !validatePrice(priceData)) {
    return 'N/A';
  }

  const { numeric, symbol, currency } = priceData;

  // Handle free items
  if (numeric === 0) {
    return 'FREE';
  }

  // Format the number based on currency
  const decimals = getDecimalsForCurrency(currency);
  const formatted = numeric.toFixed(decimals);

  // Return with symbol
  return `${symbol}${formatted}`;
}

/**
 * Get number of decimal places for a currency
 * @param {string} currencyCode - ISO currency code (e.g., "USD", "JPY")
 * @returns {number} Number of decimal places (usually 2, but 0 for JPY/KRW)
 */
function getDecimalsForCurrency(currencyCode) {
  // Currencies with no decimal places
  const noDecimalCurrencies = ['JPY', 'KRW', 'VND', 'IDR', 'HUF'];

  if (noDecimalCurrencies.includes(currencyCode)) {
    return 0;
  }

  // Most currencies use 2 decimals
  return 2;
}

/**
 * Extract multiple prices from a page (for price ranges, etc.)
 * @param {Object} context - Context data for parsing
 * @returns {Object[]} Array of parsed price objects
 */
export function extractAllPrices(context = {}) {
  const priceElements = findPriceElements();
  const prices = [];

  for (const element of priceElements) {
    const price = extractPriceFromElement(element, context);
    if (price && validatePrice(price)) {
      prices.push(price);
    }
  }

  // Remove duplicates (same numeric value and currency)
  const unique = [];
  const seen = new Set();

  for (const price of prices) {
    const key = `${price.numeric}_${price.currency}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(price);
    }
  }

  return unique;
}
