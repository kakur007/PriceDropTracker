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
  }

  /**
   * Extract product price
   * This is an improved version that prioritizes sale prices and avoids price ranges.
   *
   * Priority order:
   * 1. The price inside an <ins> tag (this is the current sale price).
   * 2. The price for a selected variation.
   * 3. A single price that is not part of a range.
   *
   * @returns {Object|null} Parsed price data or null
   */
  extractPrice() {
    console.log('[WooCommerce Adapter] Starting improved price extraction...');

    // Scope the search to the main product summary area to avoid grabbing
    // prices from "related products", shipping info, etc.
    const summaryArea = this.querySelector('.summary.entry-summary') || this.document;

    // Define selectors in order of priority
    const priceSelectors = [
      // 1. Sale Price: This is the most reliable indicator of the current price.
      'p.price ins .woocommerce-Price-amount',
      'p.price ins .amount',

      // 2. Variable Product Price: The price shown after a user selects an option.
      '.woocommerce-variation-price .price .woocommerce-Price-amount',

      // 3. Single Product Price: When there's no sale. We must avoid the <del> tag.
      'p.price > .woocommerce-Price-amount:not(del *)',

      // 4. Microdata Price: Fallback using schema.
      '[itemprop="price"]:not(del *)'
    ];

    for (const selector of priceSelectors) {
      const element = summaryArea.querySelector(selector);

      if (element) {
        // Get the raw text from the element
        const priceText = element.textContent?.trim();

        // CRITICAL CHECK: Ignore if it's a price range.
        if (priceText && (priceText.includes('–') || priceText.includes('-'))) {
            console.log(`[WooCommerce Adapter] Skipping selector "${selector}" because it contains a price range: "${priceText}"`);
            continue;
        }

        if (priceText) {
          const parsed = this.parsePriceWithContext(priceText);
          if (parsed && parsed.confidence >= 0.70) {
            console.log(`[WooCommerce Adapter] ✓ Price found with selector "${selector}": ${parsed.numeric} ${parsed.currency}`);
            return parsed; // Return the first valid price we find
          }
        }
      }
    }

    // If no specific selectors worked, do a final generic search but be careful.
    const genericPrice = summaryArea.querySelector('.price, .woocommerce-Price-amount');
    if (genericPrice) {
        const priceText = genericPrice.textContent?.trim();
        if (priceText && !priceText.includes('–') && !priceText.includes('-')) {
             const parsed = this.parsePriceWithContext(priceText);
             if (parsed && parsed.confidence >= 0.70) {
                console.log(`[WooCommerce Adapter] ✓ Price found with generic fallback: ${parsed.numeric} ${parsed.currency}`);
                return parsed;
             }
        }
    }

    console.log('[WooCommerce Adapter] ✗ No valid price found after all checks.');
    return null;
  }

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
