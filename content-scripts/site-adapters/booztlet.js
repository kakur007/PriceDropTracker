// Price Drop Tracker - Booztlet Site Adapter
// Handles Booztlet product detection (outlet/discount fashion site)

import { BaseAdapter } from './base-adapter.js';

/**
 * BooztletAdapter - Extracts product information from Booztlet product pages
 *
 * Booztlet specifics:
 * - Estonian locale and specific URL patterns
 * - Product IDs at end of URL in format /ID1/ID2
 * - Brand and product name are separate elements
 * - Price in discount containers
 */
export class BooztletAdapter extends BaseAdapter {
  detectProduct() {
    return this.url.includes('booztlet.com') && (
      this.url.includes('/ee/et/') || // Estonian locale
      /\/\d+\/\d+$/.test(this.url)    // ID pattern at end of URL
    );
  }

  extractProductId() {
    // URL format: .../product-name_ID1/ID2
    // ID2 is usually the variant/specific product ID
    const matches = this.url.match(/\/(\d+)$/);
    return matches ? matches[1] : null;
  }

  extractTitle() {
    // Look for the brand and name structure
    const brand = this.querySelector('.brand-name');
    const name = this.querySelector('.product-name');

    if (brand && name) {
      return `${brand.textContent.trim()} ${name.textContent.trim()}`;
    }

    // Fallback
    const h1 = this.querySelector('h1');
    return h1 ? h1.textContent.trim() : null;
  }

  extractPrice() {
    // Booztlet has specific price containers
    // Priority: Current price (often red/discounted)
    const selectors = [
      '.price-container .price.current-price', // Specific discount price
      '.price-container .price',               // Standard price
      '[class*="product-price"]',
      '.product-information .price'
    ];

    for (const selector of selectors) {
      const el = this.querySelector(selector);
      if (el) {
        const text = el.textContent.trim();
        const parsed = this.parsePriceWithContext(text);
        if (parsed) return this.validateCurrency(parsed);
      }
    }
    return null;
  }

  extractImage() {
    // Main image is often in a gallery or specific container
    const img = this.querySelector('.primary-image img') ||
                this.querySelector('.product-image img') ||
                this.querySelector('img[itemprop="image"]');

    return img ? img.src : null;
  }
}
