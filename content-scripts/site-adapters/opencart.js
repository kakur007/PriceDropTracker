/**
 * OpenCart Site Adapter
 * Handles price detection for OpenCart-based e-commerce sites
 *
 * OpenCart is a popular open-source e-commerce platform.
 * This adapter detects OpenCart sites by their characteristic URL patterns
 * and HTML structures. Tested with hawaii.ee.
 */

import { BaseAdapter } from './base-adapter.js';
import { debug } from '../../utils/debug.js';

export class OpenCartAdapter extends BaseAdapter {
  /**
   * Detects if this is an OpenCart product page
   * @returns {boolean} True if OpenCart product page
   */
  detectProduct() {
    // OpenCart URLs typically end with -ID or have /product/ in the path
    const hasOpenCartUrlPattern = /-(\d+)$/.test(this.url) || this.url.includes('/product/');

    // Check for OpenCart-specific indicators
    const indicators = [
      // Common OpenCart elements
      this.querySelector('h1.product-title'),
      this.querySelector('.price-new'),
      this.querySelector('.price-old'),
      this.querySelector('#product'),
      this.querySelector('.product-info'),

      // URL pattern
      hasOpenCartUrlPattern
    ];

    return indicators.some(indicator => indicator);
  }

  /**
   * Gets the expected currency based on domain/locale
   * @returns {string|null} Currency code or null
   */
  getExpectedCurrency() {
    // Check domain TLD for currency hints
    if (this.domain.endsWith('.ee')) return 'EUR'; // Estonia
    if (this.domain.endsWith('.fi')) return 'EUR'; // Finland
    if (this.domain.endsWith('.lv')) return 'EUR'; // Latvia
    if (this.domain.endsWith('.lt')) return 'EUR'; // Lithuania

    // Add more as needed
    return null;
  }

  /**
   * Extracts the product ID from URL
   * OpenCart typically uses -ID at the end of product URLs
   * @returns {string|null} Product ID or null
   */
  extractProductId() {
    // Extract ID from URL pattern like /product-name-290694
    const matches = this.url.match(/-(\d+)$/);
    if (matches) {
      return matches[1];
    }

    // Fallback: check for product_id in URL params
    const urlParams = new URLSearchParams(new URL(this.url).search);
    const productId = urlParams.get('product_id');
    if (productId) {
      return productId;
    }

    return null;
  }

  /**
   * Extracts the product title
   * @returns {string|null} Product title or null
   */
  extractTitle() {
    const titleSelectors = [
      'h1.product-title',
      'h1',
      '.product-title',
      '[itemprop="name"]',
      '#content h1'
    ];

    for (const selector of titleSelectors) {
      const element = this.querySelector(selector);
      if (element) {
        const title = element.textContent?.trim();
        if (title && title.length > 0) {
          return title;
        }
      }
    }

    return null;
  }

  /**
   * Extract product price
   * OpenCart typically uses .price-new for sale prices and .price for regular prices
   * @returns {Object|null} Parsed price data or null
   */
  extractPrice() {
    debug('[opencart]', '[OpenCart Adapter] Starting price extraction...');

    // PRIORITY 1: Try sale price first (.price-new)
    const newPriceElement = this.querySelector('.price-new');
    if (newPriceElement) {
      const priceText = newPriceElement.textContent?.trim();
      if (priceText) {
        const parsed = this.parsePriceWithContext(priceText);
        if (parsed && parsed.confidence >= 0.70) {
          debug('[opencart]', `[OpenCart Adapter] ✓ Found sale price: ${parsed.numeric} ${parsed.currency}`);

          // Check if there's an old price to track discount
          const oldPriceElement = this.querySelector('.price-old');
          if (oldPriceElement) {
            const oldPriceText = oldPriceElement.textContent?.trim();
            const parsedOld = this.parsePriceWithContext(oldPriceText);
            if (parsedOld && parsedOld.numeric > parsed.numeric) {
              parsed.regularPrice = parsedOld.numeric;
              parsed.isOnSale = true;
            }
          }

          return this.validateCurrency(parsed);
        }
      }
    }

    // PRIORITY 2: Standard price (.price)
    const priceElement = this.querySelector('.price');
    if (priceElement) {
      const priceText = priceElement.textContent?.trim();
      if (priceText) {
        const parsed = this.parsePriceWithContext(priceText);
        if (parsed && parsed.confidence >= 0.70) {
          debug('[opencart]', `[OpenCart Adapter] ✓ Found standard price: ${parsed.numeric} ${parsed.currency}`);
          return this.validateCurrency(parsed);
        }
      }
    }

    // PRIORITY 3: Try JSON-LD structured data
    const jsonLdPrice = this.extractPriceFromJsonLd();
    if (jsonLdPrice && jsonLdPrice.confidence >= 0.70) {
      debug('[opencart]', `[OpenCart Adapter] ✓ Found price in JSON-LD: ${jsonLdPrice.numeric} ${jsonLdPrice.currency}`);
      return this.validateCurrency(jsonLdPrice);
    }

    debug('[opencart]', '[OpenCart Adapter] ✗ No valid price found.');
    return null;
  }

  /**
   * Extract product image
   * @returns {string|null} Image URL or null
   */
  extractImage() {
    const imageSelectors = [
      '.thumbnails .thumbnail img',
      '#image',
      '.product-image img',
      '.image img',
      '[itemprop="image"]',
      '.product-info img',
      '#content .image img'
    ];

    for (const selector of imageSelectors) {
      const element = this.querySelector(selector);
      if (element) {
        // Get src or data-src for lazy loading
        const imageUrl = element.src ||
                        element.getAttribute('data-src') ||
                        element.getAttribute('data-image');
        if (imageUrl && !imageUrl.startsWith('data:')) {
          return imageUrl;
        }
      }
    }

    return null;
  }
}
