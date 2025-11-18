// Price Drop Tracker - Etsy Site Adapter
// Handles product detection and data extraction for Etsy

import { BaseAdapter } from './base-adapter.js';

/**
 * EtsyAdapter - Adapter for Etsy marketplace
 * Handles listing pages with /listing/ URL pattern
 */
export class EtsyAdapter extends BaseAdapter {
  /**
   * Get expected currency for Etsy
   * Etsy shows prices in multiple currencies, so we let the parser detect it
   * @returns {string|null}
   */
  getExpectedCurrency() {
    // Etsy supports multiple currencies based on user location
    // Let the currency parser detect from the page
    return null;
  }

  /**
   * Detect if this is an Etsy listing (product) page
   * Etsy listing URLs contain /listing/PRODUCT_ID
   * @returns {boolean}
   */
  detectProduct() {
    // Etsy product pages have pattern: https://www.etsy.com/listing/123456789/product-name
    return this.url.includes('/listing/') || /\/listing\/\d+/i.test(this.url);
  }

  /**
   * Extract Etsy listing ID
   * Format: /listing/PRODUCT_ID/...
   * @returns {string|null}
   */
  extractProductId() {
    // Extract listing ID from URL
    const match = this.url.match(/\/listing\/(\d+)/);
    if (match && match[1]) {
      return match[1];
    }

    // Alternative: try to find in data attributes
    const listingElement = this.querySelector('[data-listing-id]');
    if (listingElement) {
      return listingElement.getAttribute('data-listing-id');
    }

    return null;
  }

  /**
   * Extract product title from Etsy listing
   * @returns {string|null}
   */
  extractTitle() {
    const selectors = [
      'h1[data-listing-title]',
      'h1[data-buy-box-listing-title]',
      'h1[class*="title"]',
      '[data-listing-title]',
      'meta[property="og:title"]',
      '[itemprop="name"]',
      'h1'
    ];

    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        // For meta tags
        if (element.tagName === 'META') {
          const content = element.getAttribute('content');
          if (content) {
            // Etsy og:title often includes " - Etsy" or " | Etsy" at the end
            return content.replace(/\s+[-|]\s+Etsy.*$/i, '').trim();
          }
        }

        // For regular elements
        const text = element.textContent.trim();
        if (text && text.length > 0) {
          return text;
        }
      }
    }

    return null;
  }

  /**
   * Extract price from Etsy listing
   * @returns {Object|null}
   */
  extractPrice() {
    const selectors = [
      '[data-buy-box-region="price"] p[class*="price"]',
      'p[class*="price"][class*="prominent"]',
      '[data-price]',
      'meta[property="product:price:amount"]',
      'meta[property="og:price:amount"]',
      '[class*="wt-text-title-03"][class*="price"]',
      'p.wt-text-title-03',
      '[itemprop="price"]',
      'span[class*="currency-value"]'
    ];

    for (const selector of selectors) {
      const elements = this.querySelectorAll(selector);

      for (const element of elements) {
        // Skip if this looks like an original/strikethrough price
        const classes = element.className || '';
        const parent = element.parentElement;
        const parentClasses = parent?.className || '';

        if (classes.match(/original|strike|was|discount-price/i) ||
            parentClasses.match(/original|strike|was|discount-price/i)) {
          continue;
        }

        let text = null;

        // For meta tags
        if (element.tagName === 'META') {
          text = element.getAttribute('content');

          // Also try to get currency from separate meta tag
          if (text) {
            const currencyMeta = this.querySelector('meta[property="product:price:currency"]') ||
                                this.querySelector('meta[property="og:price:currency"]');
            if (currencyMeta) {
              const currency = currencyMeta.getAttribute('content');
              text = `${text} ${currency}`;
            }
          }
        } else {
          // For regular elements
          text = element.textContent;

          // Also try data-price attribute if available
          if (element.hasAttribute('data-price')) {
            text = element.getAttribute('data-price');
          }

          // Try content attribute
          if (element.hasAttribute('content')) {
            text = element.getAttribute('content');
          }
        }

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
   * Extract product image from Etsy listing
   * @returns {string|null}
   */
  extractImage() {
    const selectors = [
      'img[data-listing-id]',
      '[data-component="listing-page-image-carousel"] img',
      'meta[property="og:image"]',
      '[itemprop="image"]',
      'img[class*="listing-image"]',
      '.wt-position-absolute img',
      'img[alt*="listing"]',
      'main img'
    ];

    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        // For img elements
        if (element.tagName === 'IMG') {
          // Etsy often uses data-src for lazy loading
          const src = element.src ||
                     element.getAttribute('data-src') ||
                     element.getAttribute('data-lazy-src');

          if (src && !src.includes('placeholder')) {
            return src;
          }
        }

        // For meta tags
        if (element.tagName === 'META') {
          return element.getAttribute('content');
        }

        // For elements with data-src
        const dataSrc = element.getAttribute('data-src');
        if (dataSrc) {
          return dataSrc;
        }
      }
    }

    return null;
  }
}
