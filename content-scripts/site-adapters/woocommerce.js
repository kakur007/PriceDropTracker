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
   * Extract product price (Version 4)
   * This version correctly prioritizes sale prices, explicitly ignores
   * prices that are inside a <del> (deleted/strikethrough) tag, and
   * excludes prices from cart, header, and navigation areas.
   *
   * @returns {Object|null} Parsed price data or null
   */
  extractPrice() {
    console.log('[WooCommerce Adapter] Starting refined price extraction (v4)...');

    // CRITICAL: Only search within the product summary area, not the entire page
    // Try multiple selectors to find the product info section
    const summaryArea = this.querySelector('.summary.entry-summary') ||
                       this.querySelector('.product-summary') ||
                       this.querySelector('div.product') ||
                       this.querySelector('.product-details');

    if (!summaryArea) {
      console.log('[WooCommerce Adapter] ✗ No product summary area found - cannot extract price safely');
      return null;
    }

    console.log('[WooCommerce Adapter] Found summary area, searching for prices...');

    // Selectors are ordered by priority, with sale prices first
    const priceSelectors = [
      // 1. HIGHEST PRIORITY: The sale price inside an <ins> tag within p.price
      'p.price ins .woocommerce-Price-amount',
      'p.price ins .amount',

      // 2. Variable Product Price: The price for the selected variation
      '.woocommerce-variation-price .price .woocommerce-Price-amount',

      // 3. Single Price: The regular price when not on sale
      'p.price > .woocommerce-Price-amount',
      'p.price .woocommerce-Price-amount',

      // 4. Generic Fallback: Any price amount in the summary
      '.woocommerce-Price-amount',
    ];

    for (const selector of priceSelectors) {
      // Find all elements that match, not just the first one
      const elements = summaryArea.querySelectorAll(selector);

      for (const element of elements) {
        // *** CRITICAL CHECKS ***

        // 1. Skip if inside a <del> tag (old/crossed-out price)
        if (element.closest('del')) {
          console.log(`[WooCommerce Adapter] Skipping "${selector}" - inside <del> tag`);
          continue;
        }

        // 2. Skip if in cart, header, navigation, or related products areas
        const excludedContainers = element.closest(
          'header, nav, .cart, .mini-cart, .cart-contents, .widget_shopping_cart, ' +
          '.related, .upsells, .cross-sells, .shipping, footer'
        );
        if (excludedContainers) {
          console.log(`[WooCommerce Adapter] Skipping "${selector}" - in excluded area (cart/header/nav)`);
          continue;
        }

        const priceText = element.textContent?.trim();

        // 3. Skip price ranges
        if (priceText && (priceText.includes('–') || priceText.includes('-'))) {
          console.log(`[WooCommerce Adapter] Skipping "${selector}" - contains price range: "${priceText}"`);
          continue;
        }

        if (priceText) {
          const parsed = this.parsePriceWithContext(priceText);
          if (parsed && parsed.confidence >= 0.70) {
            console.log(`[WooCommerce Adapter] ✓ Price found with selector "${selector}": ${parsed.numeric} ${parsed.currency}`);
            return parsed; // Return the first valid, non-deleted price we find
          }
        }
      }
    }

    console.log('[WooCommerce Adapter] ✗ No valid, non-deleted price found.');
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
