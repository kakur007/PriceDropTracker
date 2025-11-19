// Price Drop Tracker - Etsy Site Adapter
// Handles product detection and data extraction for Etsy

import { BaseAdapter } from './base-adapter.js';
import { debug, debugWarn, debugError } from '../../utils/debug.js';

/**
 * EtsyAdapter - Adapter for Etsy marketplace
 * Handles listing pages with /listing/ URL pattern
 * Uses JSON-LD structured data for reliable extraction
 */
export class EtsyAdapter extends BaseAdapter {
  constructor(document, url) {
    super(document, url);
    this._cachedStructuredData = null;
  }

  /**
   * Extract and cache JSON-LD structured data
   * @returns {Object|null} Product structured data
   */
  extractStructuredData() {
    // Return cached data if already extracted
    if (this._cachedStructuredData !== null) {
      return this._cachedStructuredData;
    }

    const scripts = this.querySelectorAll('script[type="application/ld+json"]');

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);

        // Look for Product schema
        let product = null;

        // Case 1: Direct Product object
        if (data['@type'] === 'Product') {
          product = data;
        }
        // Case 2: Array of items
        else if (Array.isArray(data)) {
          product = data.find(item => item['@type'] === 'Product');
        }
        // Case 3: @graph wrapper
        else if (data['@graph'] && Array.isArray(data['@graph'])) {
          product = data['@graph'].find(item => item['@type'] === 'Product');
        }

        if (product) {
          this._cachedStructuredData = product;
          return product;
        }
      } catch (error) {
        debugError('[etsy]', '[Etsy Adapter] Error parsing JSON-LD:', error);
      }
    }

    // No structured data found
    this._cachedStructuredData = false;
    return null;
  }

  /**
   * Get expected currency for Etsy
   * Etsy shows prices in multiple currencies, so we let the parser detect it
   * @returns {string|null}
   */
  getExpectedCurrency() {
    // Try to get from structured data first
    const structuredData = this.extractStructuredData();
    if (structuredData?.offers) {
      const offers = Array.isArray(structuredData.offers)
        ? structuredData.offers[0]
        : structuredData.offers;

      if (offers?.priceCurrency) {
        return offers.priceCurrency;
      }
    }

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
    // Check URL pattern first (fast check)
    const hasListingInUrl = this.url.includes('/listing/') || /\/listing\/\d+/i.test(this.url);

    if (!hasListingInUrl) {
      return false;
    }

    // Verify with structured data or DOM elements
    const structuredData = this.extractStructuredData();
    if (structuredData) {
      return true;
    }

    // Fallback: check for listing-specific elements
    return !!this.querySelector('[data-listing-id]') ||
           !!this.querySelector('h1[data-listing-title]');
  }

  /**
   * Extract Etsy listing ID
   * Format: /listing/PRODUCT_ID/...
   * @returns {string|null}
   */
  extractProductId() {
    // Try structured data first
    const structuredData = this.extractStructuredData();
    if (structuredData?.sku) {
      return structuredData.sku;
    }

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
    // Try structured data first (most reliable)
    const structuredData = this.extractStructuredData();
    if (structuredData?.name) {
      return structuredData.name;
    }

    // Fallback to DOM selectors
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
    // Try structured data first (most reliable)
    const structuredData = this.extractStructuredData();
    if (structuredData?.offers) {
      const offers = Array.isArray(structuredData.offers)
        ? structuredData.offers[0]
        : structuredData.offers;

      if (offers) {
        // Handle both regular Offer and AggregateOffer
        const priceValue = offers.price || offers.lowPrice || offers.highPrice;
        const currency = offers.priceCurrency || 'USD';

        if (priceValue) {
          // Create price string with currency
          const currencySymbol = currency === 'USD' ? '$' :
                                currency === 'EUR' ? '€' :
                                currency === 'GBP' ? '£' : '';

          const priceString = currencySymbol
            ? `${currencySymbol}${priceValue}`
            : `${priceValue} ${currency}`;

          const parsed = this.parsePriceWithContext(priceString);
          if (parsed) {
            // Force the currency from structured data (most accurate)
            parsed.currency = currency;
            return parsed;
          }
        }
      }
    }

    // Fallback to DOM extraction
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
    // Try structured data first (most reliable)
    const structuredData = this.extractStructuredData();
    if (structuredData?.image) {
      // Handle different image formats
      if (typeof structuredData.image === 'string') {
        return structuredData.image;
      } else if (structuredData.image.url) {
        return structuredData.image.url;
      } else if (Array.isArray(structuredData.image) && structuredData.image.length > 0) {
        const firstImage = structuredData.image[0];
        return typeof firstImage === 'string' ? firstImage : firstImage.url;
      }
    }

    // Fallback to DOM extraction
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
