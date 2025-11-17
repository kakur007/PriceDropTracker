// Price Drop Tracker - Best Buy Site Adapter
// Handles Best Buy product detection

import { BaseAdapter } from './base-adapter.js';

/**
 * BestBuyAdapter - Extracts product information from Best Buy product pages
 *
 * Best Buy specifics:
 * - US-only site (bestbuy.com)
 * - USD currency only
 * - Uses data-testid attributes
 * - SKU-based product identification
 * - URLs contain /site/ followed by product name and SKU
 * - Member prices vs regular prices
 */
export class BestBuyAdapter extends BaseAdapter {
  /**
   * Gets the expected currency (always USD for Best Buy)
   * @returns {string} Currency code 'USD'
   */
  getExpectedCurrency() {
    return 'USD';
  }

  /**
   * Detects if this is a Best Buy product page
   * @returns {boolean} True if product page
   */
  detectProduct() {
    // Best Buy product URLs contain /site/
    return this.url.includes('/site/') && this.url.includes('skuId=');
  }

  /**
   * Extracts the Best Buy SKU
   * @returns {string|null} SKU or null
   */
  extractProductId() {
    // Best Buy URLs format: /site/product-name/12345678.p?skuId=12345678
    // Extract SKU from query parameter
    const match = this.url.match(/skuId=(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Extracts the product title
   * Best Buy uses data-testid and itemprop attributes
   * @returns {string|null} Product title or null
   */
  extractTitle() {
    const selectors = [
      '[data-testid="heading"]',                  // Test ID
      '.sku-title',                               // SKU title class
      'h1[itemprop="name"]',                      // Microdata
      'h1.heading-5',                             // Heading class
      '.product-title h1'                         // Product title
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
   * Best Buy may show member prices and regular prices
   * We prioritize customer-facing price
   * @returns {Object|null} Parsed price object or null
   */
  extractPrice() {
    const selectors = [
      '[data-testid="customer-price"]',           // Customer price (test ID)
      '.priceView-customer-price',                // Customer price class
      '[itemprop="price"]',                       // Microdata
      '.priceView-hero-price span',               // Hero price
      '[data-testid="pricing-price"]',            // Pricing price
      '.pricing-price__regular-price'             // Regular price
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
      '.primary-image',                           // Primary image class
      '[data-testid="product-images"] img',       // Test ID
      'img[itemprop="image"]',                    // Microdata
      '.shop-media-gallery img',                  // Media gallery
      '.primary-image-button img'                 // Primary image button
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
