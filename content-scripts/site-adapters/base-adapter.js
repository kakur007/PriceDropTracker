// Price Drop Tracker - Base Site Adapter
// Abstract base class for site-specific adapters

import { parsePrice } from '../../utils/currency-parser.js';

/**
 * BaseAdapter - Abstract base class for site-specific adapters
 *
 * This class provides a common interface and shared functionality for
 * extracting product information from e-commerce sites. Each site should
 * have its own adapter that extends this class and implements the
 * required abstract methods.
 *
 * The adapter pattern allows us to handle site-specific DOM structures
 * and extraction logic while maintaining a consistent interface.
 */
export class BaseAdapter {
  /**
   * @param {Document} document - The DOM document to extract from
   * @param {string} url - The URL of the page
   */
  constructor(document, url) {
    this.document = document;
    this.url = url;
    this.domain = new URL(url).hostname;
    this.locale = document.documentElement.lang || 'en-US';
  }

  // ========== Abstract Methods (must be implemented by subclasses) ==========

  /**
   * Detects if the current page is a product page
   * @returns {boolean} True if this is a product page
   */
  detectProduct() {
    throw new Error('detectProduct() must be implemented');
  }

  /**
   * Extracts the price from the page
   * @returns {Object|null} Parsed price object or null
   */
  extractPrice() {
    throw new Error('extractPrice() must be implemented');
  }

  /**
   * Extracts the product title
   * @returns {string|null} Product title or null
   */
  extractTitle() {
    throw new Error('extractTitle() must be implemented');
  }

  /**
   * Extracts the product image URL
   * @returns {string|null} Image URL or null
   */
  extractImage() {
    throw new Error('extractImage() must be implemented');
  }

  /**
   * Extracts the site-specific product ID
   * @returns {string|null} Product ID or null
   */
  extractProductId() {
    throw new Error('extractProductId() must be implemented');
  }

  // ========== Shared Helper Methods ==========

  /**
   * Gets the expected currency for this domain
   * Override in subclass if the site has a known currency
   * @returns {string|null} Currency code or null
   */
  getExpectedCurrency() {
    return null;
  }

  /**
   * Helper to query a single element
   * @param {string} selector - CSS selector
   * @returns {Element|null} Element or null
   */
  querySelector(selector) {
    return this.document.querySelector(selector);
  }

  /**
   * Helper to query multiple elements
   * @param {string} selector - CSS selector
   * @returns {NodeList} NodeList of elements
   */
  querySelectorAll(selector) {
    return this.document.querySelectorAll(selector);
  }

  /**
   * Parses a price string with domain and locale context
   * @param {string} priceString - Price text to parse
   * @returns {Object|null} Parsed price object or null
   */
  parsePriceWithContext(priceString) {
    return parsePrice(priceString, {
      domain: this.domain,
      locale: this.locale,
      expectedCurrency: this.getExpectedCurrency()
    });
  }

  /**
   * Validates that the parsed price matches the expected currency
   * Reduces confidence if there's a mismatch
   * @param {Object} parsedPrice - Parsed price object
   * @returns {Object} Price object (possibly with adjusted confidence)
   */
  validateCurrency(parsedPrice) {
    const expected = this.getExpectedCurrency();
    if (!expected) return parsedPrice;

    if (parsedPrice.currency !== expected) {
      console.warn(`[Adapter] Currency mismatch: expected ${expected}, got ${parsedPrice.currency}`);
      parsedPrice.confidence *= 0.8;
    }

    return parsedPrice;
  }

  /**
   * Waits for a price element to appear in the DOM
   * Useful for sites with JavaScript-rendered prices
   *
   * NOTE: This is primarily useful for content scripts running on the page.
   * Background price checks won't have access to dynamic content.
   *
   * @param {string[]} selectors - Array of CSS selectors to try
   * @param {number} timeout - Timeout in milliseconds (default 10000)
   * @returns {Promise<Element>} Resolves with element when found
   */
  async waitForPriceElement(selectors, timeout = 10000) {
    return new Promise((resolve, reject) => {
      // Check if already present
      for (const selector of selectors) {
        const element = this.querySelector(selector);
        if (element?.textContent?.trim()) {
          resolve(element);
          return;
        }
      }

      // Wait for it to appear
      const observer = new MutationObserver(() => {
        for (const selector of selectors) {
          const element = this.querySelector(selector);
          if (element?.textContent?.trim()) {
            observer.disconnect();
            resolve(element);
            return;
          }
        }
      });

      observer.observe(this.document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error('Price element not found within timeout'));
      }, timeout);
    });
  }
}

// ========== Adapter Factory ==========

import { AmazonAdapter } from './amazon.js';
import { EbayAdapter } from './ebay.js';
import { WalmartAdapter } from './walmart.js';
import { TargetAdapter } from './target.js';
import { BestBuyAdapter } from './bestbuy.js';

/**
 * Factory function to get the appropriate adapter for a given domain
 *
 * @param {Document} document - The DOM document
 * @param {string} url - The URL of the page
 * @returns {BaseAdapter|null} Adapter instance or null if no adapter found
 */
export function getAdapter(document, url) {
  const domain = new URL(url).hostname;

  if (domain.includes('amazon')) {
    return new AmazonAdapter(document, url);
  }

  if (domain.includes('ebay')) {
    return new EbayAdapter(document, url);
  }

  if (domain.includes('walmart')) {
    return new WalmartAdapter(document, url);
  }

  if (domain.includes('target')) {
    return new TargetAdapter(document, url);
  }

  if (domain.includes('bestbuy')) {
    return new BestBuyAdapter(document, url);
  }

  // Return null if no adapter found
  // Will fall back to generic detection in product-detector.js
  return null;
}
