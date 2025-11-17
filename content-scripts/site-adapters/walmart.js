// Price Drop Tracker - Walmart Site Adapter
// Handles Walmart product detection

import { BaseAdapter } from './base-adapter.js';

/**
 * WalmartAdapter - Extracts product information from Walmart product pages
 *
 * Walmart specifics:
 * - US-only site (walmart.com)
 * - USD currency only
 * - Uses data-automation-id attributes extensively
 * - Product ID format varies (WIP numbers)
 * - URLs contain /ip/ followed by product name and ID
 * - Heavily uses React/JavaScript rendering
 */
export class WalmartAdapter extends BaseAdapter {
  /**
   * Gets the expected currency (always USD for Walmart)
   * @returns {string} Currency code 'USD'
   */
  getExpectedCurrency() {
    return 'USD';
  }

  /**
   * Detects if this is a Walmart product page
   * @returns {boolean} True if product page
   */
  detectProduct() {
    // Walmart product URLs contain /ip/
    return this.url.includes('/ip/');
  }

  /**
   * Extracts the Walmart product ID
   * @returns {string|null} Product ID or null
   */
  extractProductId() {
    // Walmart URLs format: /ip/product-name/123456789
    // Extract the numeric ID at the end
    const match = this.url.match(/\/ip\/[^/]+\/(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Extracts the product title
   * Walmart uses data-automation-id and itemprop attributes
   * @returns {string|null} Product title or null
   */
  extractTitle() {
    const selectors = [
      '[itemprop="name"]',                        // Microdata
      'h1.prod-ProductTitle',                     // Product title class
      '[data-automation-id="product-title"]',     // Automation ID
      'h1[itemprop="name"]',                      // Combined
      '.prod-title'                               // Generic class
    ];

    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  /**
   * Extracts the current price
   * Walmart shows different prices for online vs in-store
   * @returns {Object|null} Parsed price object or null
   */
  extractPrice() {
    const selectors = [
      '[itemprop="price"]',                       // Microdata price
      '.price-characteristic',                    // Price characteristic
      '[data-automation-id="product-price"]',     // Automation ID
      'span[itemprop="price"]',                   // Span with itemprop
      '.price-group .price-characteristic',       // Price group
      '[data-testid="product-price"]'             // Test ID
    ];

    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        const text = element.textContent || element.getAttribute('content');

        if (text) {
          const parsed = this.parsePriceWithContext(text);

          if (parsed && parsed.confidence >= 0.70) {
            return this.validateCurrency(parsed);
          }
        }
      }
    }

    return null;
  }

  /**
   * Extracts the product image URL
   * @returns {string|null} Image URL or null
   */
  extractImage() {
    const selectors = [
      '.prod-hero-image img',                     // Hero image
      '[data-testid="hero-image"]',               // Test ID
      'img[itemprop="image"]',                    // Microdata
      '.prod-ProductImage img'                    // Product image class
    ];

    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        return element.src || element.getAttribute('data-src');
      }
    }

    return null;
  }
}
