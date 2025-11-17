// Price Drop Tracker - Amazon Site Adapter
// Handles Amazon product detection across all regional domains

import { BaseAdapter } from './base-adapter.js';

/**
 * AmazonAdapter - Extracts product information from Amazon product pages
 *
 * Amazon specifics:
 * - Multiple regional domains with different currencies
 * - Complex DOM structure with many price locations
 * - Prices can be in various locations depending on:
 *   - Prime deals
 *   - Subscribe & Save
 *   - Used/New options
 *   - Lightning deals
 * - Product ID is ASIN (Amazon Standard Identification Number)
 * - URLs contain /dp/ or /gp/product/ followed by ASIN
 */
export class AmazonAdapter extends BaseAdapter {
  /**
   * Maps Amazon domains to their primary currencies
   */
  static CURRENCY_BY_DOMAIN = {
    'amazon.com': 'USD',
    'amazon.co.uk': 'GBP',
    'amazon.de': 'EUR',
    'amazon.fr': 'EUR',
    'amazon.it': 'EUR',
    'amazon.es': 'EUR',
    'amazon.ca': 'CAD',
    'amazon.com.au': 'AUD',
    'amazon.co.jp': 'JPY',
    'amazon.in': 'INR',
    'amazon.com.mx': 'MXN',
    'amazon.com.br': 'BRL',
    'amazon.nl': 'EUR',
    'amazon.se': 'SEK',
    'amazon.pl': 'PLN',
    'amazon.com.tr': 'TRY',
    'amazon.ae': 'AED',
    'amazon.sa': 'SAR',
    'amazon.sg': 'SGD'
  };

  /**
   * Gets the expected currency based on domain
   * @returns {string} Currency code (e.g., 'USD', 'GBP')
   */
  getExpectedCurrency() {
    return AmazonAdapter.CURRENCY_BY_DOMAIN[this.domain] || 'USD';
  }

  /**
   * Detects if this is an Amazon product page
   * @returns {boolean} True if product page
   */
  detectProduct() {
    // Amazon product URLs contain /dp/ or /gp/product/
    return this.url.includes('/dp/') || this.url.includes('/gp/product/');
  }

  /**
   * Extracts the ASIN (Amazon Standard Identification Number)
   * @returns {string|null} ASIN or null
   */
  extractProductId() {
    // ASIN format: 10 characters (letters and numbers)
    // URLs: /dp/B08N5WRWNW or /gp/product/B08N5WRWNW
    const match = this.url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
    return match ? match[1] : null;
  }

  /**
   * Extracts the product title
   * Amazon changes selectors frequently, so we try multiple
   * @returns {string|null} Product title or null
   */
  extractTitle() {
    const selectors = [
      '#productTitle',
      '#title',
      '.product-title',
      'h1[data-feature-name="title"]',
      'h1#title'
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
   * Amazon has many price locations depending on deals, Prime, etc.
   * @returns {Object|null} Parsed price object or null
   */
  extractPrice() {
    // Amazon price selectors (in priority order)
    // Note: Amazon frequently changes these classes
    const selectors = [
      '.a-price[data-a-color="price"] .a-offscreen',  // Main price (hidden for screen readers)
      '#priceblock_ourprice',                         // Our price
      '#priceblock_dealprice',                        // Deal price
      '.a-price-whole',                               // Whole price component
      '[data-a-strike="true"] + .a-offscreen',       // Sale price (after strikethrough)
      '.priceToPay .a-offscreen',                     // Price to pay
      '#corePrice_feature_div .a-offscreen',          // Core price feature
      '.a-price.aok-align-center .a-offscreen'        // Centered price
    ];

    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        // Try text content first
        let text = element.textContent || element.getAttribute('content');

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
      '#landingImage',
      '#imgBlkFront',
      '#main-image',
      '.a-dynamic-image',
      '#ebooksImgBlkFront'
    ];

    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        // Try src first, then data-old-hires for high-res version
        return element.src || element.getAttribute('data-old-hires');
      }
    }

    return null;
  }
}
