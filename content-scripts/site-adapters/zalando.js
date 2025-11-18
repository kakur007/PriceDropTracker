// Price Drop Tracker - Zalando Site Adapter
// Handles product detection and data extraction for Zalando

import { BaseAdapter } from './base-adapter.js';

/**
 * ZalandoAdapter - Adapter for Zalando e-commerce sites
 * Supports all Zalando regional domains (.com, .de, .fr, .it, .es, .nl, .be, .ee, .fi, .se, .dk, .no, .pl, .at, .ch, .co.uk)
 */
export class ZalandoAdapter extends BaseAdapter {
  /**
   * Currency mapping by domain
   */
  static CURRENCY_BY_DOMAIN = {
    'zalando.com': 'EUR',
    'zalando.co.uk': 'GBP',
    'zalando.de': 'EUR',
    'zalando.fr': 'EUR',
    'zalando.it': 'EUR',
    'zalando.es': 'EUR',
    'zalando.nl': 'EUR',
    'zalando.be': 'EUR',
    'zalando.ee': 'EUR',
    'zalando.fi': 'EUR',
    'zalando.se': 'SEK',
    'zalando.dk': 'DKK',
    'zalando.no': 'NOK',
    'zalando.pl': 'PLN',
    'zalando.at': 'EUR',
    'zalando.ch': 'CHF'
  };

  /**
   * Get expected currency for this Zalando domain
   * @returns {string} Currency code
   */
  getExpectedCurrency() {
    const lookupDomain = this.domain.replace(/^www\./, '');
    return ZalandoAdapter.CURRENCY_BY_DOMAIN[lookupDomain] || 'EUR';
  }

  /**
   * Detect if this is a Zalando product page
   * Product URLs contain /product/ or end with .html
   * @returns {boolean}
   */
  detectProduct() {
    // Zalando product pages have patterns like:
    // https://www.zalando.ee/product-name-ABC123.html
    // https://www.zalando.de/product-name-ABC123.html
    return this.url.includes('.html') ||
           this.url.includes('/product/') ||
           /\/[a-z0-9-]+-[A-Z0-9]+\.html/i.test(this.url);
  }

  /**
   * Extract Zalando product ID
   * Format: Usually in URL like product-name-ABC123.html
   * @returns {string|null}
   */
  extractProductId() {
    // Try to extract from URL pattern: product-name-PRODUCTID.html
    const match = this.url.match(/\/([a-z0-9-]+-([A-Z0-9]+))\.html/i);
    if (match && match[2]) {
      return match[2];
    }

    // Alternative: try to find in data attributes
    const productElement = this.querySelector('[data-product-id]') ||
                          this.querySelector('[data-article-id]');
    if (productElement) {
      return productElement.getAttribute('data-product-id') ||
             productElement.getAttribute('data-article-id');
    }

    return null;
  }

  /**
   * Extract product title from Zalando page
   * @returns {string|null}
   */
  extractTitle() {
    const selectors = [
      'h1[class*="title"]',
      'h1[class*="product"]',
      'h1[class*="name"]',
      '[data-testid="pdp-product-brand-name"]',
      '[data-testid="pdp-product-name"]',
      '.product-name',
      '.product-title',
      'h1',
      '[itemprop="name"]'
    ];

    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();
        if (text && text.length > 0) {
          return text;
        }
      }
    }

    // Try combining brand and name if they're separate
    const brand = this.querySelector('[data-testid="pdp-product-brand-name"]');
    const name = this.querySelector('[data-testid="pdp-product-name"]');
    if (brand && name) {
      return `${brand.textContent.trim()} ${name.textContent.trim()}`;
    }

    return null;
  }

  /**
   * Extract price from Zalando page
   * @returns {Object|null}
   */
  extractPrice() {
    const selectors = [
      '[data-testid="price"]',
      '[class*="price"][class*="current"]',
      '[class*="currentPrice"]',
      '.price',
      '[itemprop="price"]',
      '[data-price]',
      'span[class*="Price"]'
    ];

    for (const selector of selectors) {
      const elements = this.querySelectorAll(selector);

      for (const element of elements) {
        // Skip if this looks like an original/strikethrough price
        const classes = element.className || '';
        const parent = element.parentElement;
        const parentClasses = parent?.className || '';

        if (classes.match(/original|strike|was|old/i) ||
            parentClasses.match(/original|strike|was|old/i)) {
          continue;
        }

        // Try to get price from text content
        let text = element.textContent;

        // Also try data-price attribute if available
        if (element.hasAttribute('data-price')) {
          text = element.getAttribute('data-price');
        }

        // Try content attribute for meta tags
        if (element.hasAttribute('content')) {
          text = element.getAttribute('content');
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
   * Extract product image from Zalando page
   * @returns {string|null}
   */
  extractImage() {
    const selectors = [
      '[data-testid="product-image"]',
      'img[class*="product"]',
      'img[class*="ProductImage"]',
      '.product-image img',
      '[itemprop="image"]',
      'meta[property="og:image"]',
      'picture img',
      'main img'
    ];

    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        // For img elements
        if (element.tagName === 'IMG') {
          return element.src || element.getAttribute('data-src') || element.getAttribute('srcset')?.split(' ')[0];
        }
        // For meta tags
        if (element.tagName === 'META') {
          return element.getAttribute('content');
        }
      }
    }

    return null;
  }
}
