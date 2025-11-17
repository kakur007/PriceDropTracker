/**
 * WooCommerce Site Adapter
 * Handles price detection for WooCommerce-based e-commerce sites
 *
 * WooCommerce is one of the most popular e-commerce platforms for WordPress.
 * It has specific HTML structures and CSS classes that we can target.
 */

import { BaseAdapter } from './base-adapter.js';

export class WooCommerceAdapter extends BaseAdapter {
  /**
   * Detects if this is a WooCommerce product page
   * @returns {boolean} True if WooCommerce product page
   */
  detectProduct() {
    // Check for WooCommerce-specific indicators
    const indicators = [
      // WooCommerce adds these classes to the body
      this.document.body.classList.contains('woocommerce'),
      this.document.body.classList.contains('single-product'),
      this.querySelector('.product_title'),
      this.querySelector('form.cart'),
      this.querySelector('.woocommerce-Price-amount'),

      // URL patterns
      this.url.includes('/product/'),
      this.url.includes('/produkt/'), // German
      this.url.includes('/produit/') // French (removed trailing comma)
    ];

    return indicators.some(indicator => indicator);
  }

  /**
   * Extracts the product ID (SKU or post ID)
   * @returns {string|null} Product ID or null
   */
  extractProductId() {
    // Try to extract SKU first
    const skuElement = this.querySelector('.sku');
    if (skuElement) {
      const sku = skuElement.textContent?.trim();
      if (sku && sku !== 'N/A') {
        return sku;
      }
    }

    // Fallback: extract post ID from page classes
    const postClasses = this.document.body.className.match(/postid-(\d+)/);
    if (postClasses) {
      return postClasses[1];
    }

    return null;
  }

  /**
   * Extracts the product title
   * @returns {string|null} Product title or null
   */
  extractTitle() {
    const titleSelectors = [
      '.product_title',
      'h1.product_title',
      '.product-title',
      '[itemprop="name"]'
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
  },

  /**
   * Extract product price
   * Priority order:
   * 1. Sale price (inside <ins> tag) - current active price
   * 2. Single price (no sale) - regular price
   * 3. Variable product selected variation price
   *
   * IMPORTANT: Only look in the product summary area to avoid picking up:
   * - Shipping costs
   * - Related product prices
   * - Addon/upsell prices
   *
   * @returns {Object|null} Parsed price data or null
   */
  extractPrice() {
    console.log('[WooCommerce Adapter] Starting price extraction...');

    // CRITICAL: Find the main product summary area
    // This contains the actual product price, not related products/shipping
    const summaryArea = this.querySelector('.summary.entry-summary') ||
                       this.querySelector('.product-summary') ||
                       this.querySelector('div.product') ||
                       this.querySelector('.product-details');

    if (!summaryArea) {
      console.log('[WooCommerce Adapter] No product summary area found, using document');
    }

    const searchRoot = summaryArea || this.document;

    // WooCommerce price structure priority:
    // 1. Sale price (inside <ins> tag) - this is the actual current price when on sale
    // 2. Single price (no ins/del) - regular price when not on sale
    // 3. Variable product selected variation price

    const priceSelectors = [
      // Sale price (highest priority - this is the actual current price)
      {
        selector: 'p.price ins .woocommerce-Price-amount',
        desc: 'Sale price (ins tag with woocommerce class)'
      },
      {
        selector: '.price ins .amount',
        desc: 'Sale price (ins tag with amount class)'
      },
      {
        selector: 'ins .woocommerce-Price-amount',
        desc: 'Sale price (any ins tag)'
      },

      // Variable product selected variation price
      {
        selector: '.woocommerce-variation-price .price .woocommerce-Price-amount',
        desc: 'Variable product selected price'
      },
      {
        selector: '.woocommerce-variation-price .woocommerce-Price-amount',
        desc: 'Variable product price (simplified)'
      },

      // Single price (no sale) - but avoid old prices in <del> tags
      {
        selector: 'p.price .woocommerce-Price-amount:not(del *)',
        desc: 'Regular price (not deleted)'
      },
      {
        selector: '.price > .woocommerce-Price-amount:first-child',
        desc: 'First price in price container'
      },

      // Microdata price (within summary)
      {
        selector: '[itemprop="price"]:not(del *)',
        desc: 'Microdata price (not deleted)'
      },

      // Last resort: any non-deleted price in summary
      {
        selector: '.woocommerce-Price-amount:not(del *):not(del .woocommerce-Price-amount)',
        desc: 'Any non-deleted price'
      }
    ];

    for (const { selector, desc } of priceSelectors) {
      console.log(`[WooCommerce Adapter] Trying: ${desc}`);

      const element = searchRoot.querySelector(selector);
      if (!element) {
        console.log(`[WooCommerce Adapter]   ✗ Not found`);
        continue;
      }

      // Double-check: Skip if inside <del> tag (old/crossed-out price)
      if (element.closest('del')) {
        console.log(`[WooCommerce Adapter]   ✗ Inside <del> tag, skipping`);
        continue;
      }

      // Skip if this is in a related products/upsell section
      const container = element.closest('.related, .upsells, .cross-sells, .shipping');
      if (container) {
        console.log(`[WooCommerce Adapter]   ✗ In related/upsell section, skipping`);
        continue;
      }

      const priceText = element.getAttribute('content') ||
                       element.getAttribute('data-price') ||
                       element.textContent?.trim();

      console.log(`[WooCommerce Adapter]   Text: "${priceText}"`);

      if (!priceText) {
        continue;
      }

      const parsed = this.parsePriceWithContext(priceText);

      if (parsed && parsed.confidence >= 0.70) {
        console.log(`[WooCommerce Adapter] ✓ Success: ${parsed.numeric} ${parsed.currency}`);

        // Validation: exclude suspiciously low prices (< 0.50) unless it's 0 (free)
        // This helps avoid picking up shipping costs like "4.95"
        if (parsed.numeric >= 0.50 || parsed.numeric === 0) {
          return parsed;
        } else {
          console.log(`[WooCommerce Adapter]   ✗ Too low (${parsed.numeric}), might be shipping`);
        }
      }
    }

    console.log('[WooCommerce Adapter] ✗ No valid price found');
    return null;
  },

  /**
   * Extract product image
   * @returns {string|null} Image URL or null
   */
  extractImage() {
    const imageSelectors = [
      '.woocommerce-product-gallery__image img',
      '.wp-post-image',
      '.product-image img',
      '[itemprop="image"]',
      '.woocommerce-main-image img',
      '.product-gallery img',
      'figure.woocommerce-product-gallery__wrapper img'
    ];

    for (const selector of imageSelectors) {
      const element = this.querySelector(selector);
      if (element) {
        // WooCommerce often uses data-src for lazy loading
        const imageUrl = element.src ||
                        element.getAttribute('data-src') ||
                        element.getAttribute('data-large_image');
        if (imageUrl && !imageUrl.startsWith('data:')) {
          return imageUrl;
        }
      }
    }

    return null;
  }
}
