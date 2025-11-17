// Price Drop Tracker - Target Site Adapter
// Handles Target product detection

import { BaseAdapter } from './base-adapter.js';

/**
 * TargetAdapter - Extracts product information from Target product pages
 *
 * Target specifics:
 * - US-only site (target.com)
 * - USD currency only
 * - Heavy use of data-test attributes
 * - React-based single page application
 * - Product URLs contain /p/
 * - TCINs (Target.com Item Numbers) as product IDs
 */
export class TargetAdapter extends BaseAdapter {
  /**
   * Gets the expected currency (always USD for Target)
   * @returns {string} Currency code 'USD'
   */
  getExpectedCurrency() {
    return 'USD';
  }

  /**
   * Detects if this is a Target product page
   * @returns {boolean} True if product page
   */
  detectProduct() {
    // Target product URLs contain /p/
    return this.url.includes('/p/');
  }

  /**
   * Extracts the Target product ID (TCIN)
   * @returns {string|null} Product ID or null
   */
  extractProductId() {
    // Target URLs format: /p/product-name/-/A-12345678
    // Extract the TCIN after 'A-'
    const match = this.url.match(/\/A-(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Extracts the product title
   * Target uses data-test attributes extensively
   * @returns {string|null} Product title or null
   */
  extractTitle() {
    const selectors = [
      '[data-test="product-title"]',              // Test attribute
      'h1[data-test="product-detail-title"]',     // Detail title
      'h1[itemprop="name"]',                      // Microdata
      '.ProductTitle h1',                         // Class-based
      'h1.styles__StyledHeading-sc-1n5mqnp-0'    // Styled component
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
   * Target may show different prices for in-store vs online
   * @returns {Object|null} Parsed price object or null
   */
  extractPrice() {
    const selectors = [
      '[data-test="product-price"]',              // Test attribute
      '.PriceRating [data-test="product-price"]', // Price rating section
      'span[data-test="product-price"]',          // Span variant
      '[itemprop="price"]',                       // Microdata
      '.h-text-orangeDark',                       // Orange price text
      '[data-test="product-price-current"]'       // Current price
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
      '[data-test="image-gallery"] img',          // Image gallery
      'picture img',                              // Picture element
      'img[itemprop="image"]',                    // Microdata
      '.ProductImages img',                       // Product images class
      '[data-test="product-image"]'               // Test attribute
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
