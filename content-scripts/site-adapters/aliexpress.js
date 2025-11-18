// Price Drop Tracker - AliExpress Site Adapter
// Handles product detection and data extraction for AliExpress

import { BaseAdapter } from './base-adapter.js';

/**
 * AliExpressAdapter - Adapter for AliExpress marketplace
 * Handles item pages with /item/ URL pattern and various regional domains
 */
export class AliExpressAdapter extends BaseAdapter {
  /**
   * Get expected currency for AliExpress
   * AliExpress shows prices in many currencies based on user location
   * @returns {string|null}
   */
  getExpectedCurrency() {
    // AliExpress shows prices in multiple currencies based on user location
    // (USD, EUR, GBP, etc.) - let the parser auto-detect from the page
    return null;
  }

  /**
   * Detect if this is an AliExpress product page
   * Product URLs contain /item/ or /i/
   * @returns {boolean}
   */
  detectProduct() {
    // AliExpress product pages have patterns like:
    // https://www.aliexpress.com/item/1005001234567890.html
    // https://www.aliexpress.com/item/1234567890.html
    // https://aliexpress.com/i/1234567890.html
    // https://www.aliexpress.us/item/...
    return this.url.includes('/item/') ||
           this.url.includes('/i/') ||
           /\/item\/\d+/i.test(this.url) ||
           /\/i\/\d+/i.test(this.url);
  }

  /**
   * Extract AliExpress product ID
   * Format: /item/PRODUCT_ID.html or /i/PRODUCT_ID.html
   * @returns {string|null}
   */
  extractProductId() {
    // Extract item ID from URL
    const patterns = [
      /\/item\/(\d+)/,
      /\/i\/(\d+)/,
      /productId=(\d+)/
    ];

    for (const pattern of patterns) {
      const match = this.url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    // Alternative: try to find in data attributes
    const itemElement = this.querySelector('[data-product-id]') ||
                       this.querySelector('[data-spm-anchor-id*="item"]');
    if (itemElement) {
      return itemElement.getAttribute('data-product-id');
    }

    return null;
  }

  /**
   * Extract product title from AliExpress page
   * @returns {string|null}
   */
  extractTitle() {
    const selectors = [
      'h1[data-pl="product-title"]',
      'h1.product-title-text',
      'h1.product-name',
      '[class*="Product_Name"]',
      '[class*="product-title"]',
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
            return content.trim();
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
   * Extract price from AliExpress page
   * AliExpress has complex price structures with sales, ranges, and dynamic pricing
   * @returns {Object|null}
   */
  extractPrice() {
    const selectors = [
      // New AliExpress design
      '[class*="Product_Price"] [class*="price"]',
      '[class*="price-current"]',
      '[class*="price-sale"]',
      '[class*="product-price-value"]',
      'span[class*="price--currentPrice"]',

      // Older designs
      '.product-price-value',
      '.product-price-current',
      '.uniform-banner-box-price',
      '.product-price .price-current',

      // Data attributes
      '[data-spm-anchor-id*="price"]',
      '[itemprop="price"]',

      // Meta tags (fallback)
      'meta[property="product:price:amount"]',
      'meta[property="og:price:amount"]',

      // General price classes
      'span.price',
      'div[class*="Price"]',
      '[class*="productPrice"]'
    ];

    for (const selector of selectors) {
      const elements = this.querySelectorAll(selector);

      for (const element of elements) {
        // Skip if this looks like an original/strikethrough price
        const classes = element.className || '';
        const parent = element.parentElement;
        const parentClasses = parent?.className || '';

        if (classes.match(/original|strike|was|old|before|list-price/i) ||
            parentClasses.match(/original|strike|was|old|before|list-price/i)) {
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
              text = `${currency} ${text}`;
            }
          }
        } else {
          // For regular elements, get text content
          text = element.textContent;

          // Also try data-price attribute if available
          if (element.hasAttribute('data-price')) {
            text = element.getAttribute('data-price');
          }

          // Try content attribute
          if (element.hasAttribute('content')) {
            text = element.getAttribute('content');
          }

          // Try value attribute
          if (element.hasAttribute('value')) {
            text = element.getAttribute('value');
          }
        }

        if (text) {
          // Clean up AliExpress-specific formatting
          // AliExpress sometimes shows ranges like "US $10.99 - $20.99"
          // We want to extract the lower price
          const rangeSplit = text.split('-')[0].trim();

          const parsed = this.parsePriceWithContext(rangeSplit);
          if (parsed && parsed.confidence >= 0.65) {
            // AliExpress often has lower confidence due to complex layouts
            // so we accept slightly lower confidence scores
            return this.validateCurrency(parsed);
          }
        }
      }
    }

    // Last resort: try to find any element with price-like text
    const allElements = this.querySelectorAll('span, div');
    for (const element of allElements) {
      const classes = element.className || '';

      // Look for elements with "price" in the class name
      if (classes.match(/price/i) && !classes.match(/original|strike|was|old/i)) {
        const text = element.textContent.trim();

        // Only try if it looks like it might contain a price
        if (text.match(/[\$€£¥₹]/)) {
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
   * Extract product image from AliExpress page
   * @returns {string|null}
   */
  extractImage() {
    const selectors = [
      'img[class*="magnifier-image"]',
      'img[class*="productImage"]',
      'img[class*="product-image"]',
      '[class*="ImageView"] img',
      'meta[property="og:image"]',
      '[itemprop="image"]',
      '.images-view-item img',
      'img[alt*="product"]',
      'main img'
    ];

    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        // For img elements
        if (element.tagName === 'IMG') {
          // AliExpress uses various attributes for images
          const src = element.src ||
                     element.getAttribute('data-src') ||
                     element.getAttribute('data-lazy-src') ||
                     element.getAttribute('src');

          if (src && !src.includes('placeholder') && !src.includes('loading')) {
            // Remove size parameters to get full-size image
            return src.split('_')[0] + '.jpg';
          }
        }

        // For meta tags
        if (element.tagName === 'META') {
          return element.getAttribute('content');
        }

        // For picture elements
        if (element.tagName === 'PICTURE') {
          const img = element.querySelector('img');
          if (img) {
            return img.src || img.getAttribute('data-src');
          }
        }
      }
    }

    return null;
  }
}
