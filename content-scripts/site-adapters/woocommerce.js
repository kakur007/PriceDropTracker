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
   * Extract product price (Version 7 - Variation Price Priority)
   * This version specifically targets the .woocommerce-variation-price container
   * and extracts the sale price from the <ins> tag, which contains the actual
   * discounted price for variable products.
   *
   * @returns {Object|null} Parsed price data or null
   */
  extractPrice() {
    console.log('[WooCommerce Adapter] Starting variation-focused price extraction (v7)...');

    const summaryArea = this.querySelector('.summary.entry-summary') || this.document;

    // PRIORITY 1: Check for variation price (variable products with selected variation)
    const variationPriceContainer = summaryArea.querySelector('.woocommerce-variation-price');
    if (variationPriceContainer) {
      console.log('[WooCommerce Adapter] Found .woocommerce-variation-price container');

      // Look for sale price in <ins> tag (highest priority)
      const salePrice = variationPriceContainer.querySelector('ins .woocommerce-Price-amount, ins .amount');
      if (salePrice) {
        const salePriceText = salePrice.textContent?.trim();
        if (salePriceText) {
          const parsed = this.parsePriceWithContext(salePriceText);
          if (parsed && parsed.confidence >= 0.70) {
            console.log(`[WooCommerce Adapter] ✓ Found sale price in variation: ${parsed.numeric} ${parsed.currency}`);
            return parsed;
          }
        }
      }

      // If no sale price, look for regular price (not in <del>)
      const regularPrice = variationPriceContainer.querySelector('.woocommerce-Price-amount:not(del .woocommerce-Price-amount), .amount:not(del .amount)');
      if (regularPrice) {
        const regularPriceText = regularPrice.textContent?.trim();
        if (regularPriceText && !regularPriceText.includes('–') && !regularPriceText.includes('-')) {
          const parsed = this.parsePriceWithContext(regularPriceText);
          if (parsed && parsed.confidence >= 0.70) {
            console.log(`[WooCommerce Adapter] ✓ Found regular price in variation: ${parsed.numeric} ${parsed.currency}`);
            return parsed;
          }
        }
      }
    }

    // PRIORITY 2: Check for standard product price with sale
    const standardPriceContainer = summaryArea.querySelector('p.price');
    if (standardPriceContainer) {
      console.log('[WooCommerce Adapter] Found p.price container');

      // Look for sale price in <ins> tag
      const salePrice = standardPriceContainer.querySelector('ins .woocommerce-Price-amount, ins .amount');
      if (salePrice) {
        const salePriceText = salePrice.textContent?.trim();
        if (salePriceText) {
          const parsed = this.parsePriceWithContext(salePriceText);
          if (parsed && parsed.confidence >= 0.70) {
            console.log(`[WooCommerce Adapter] ✓ Found sale price in p.price: ${parsed.numeric} ${parsed.currency}`);
            return parsed;
          }
        }
      }

      // If no sale, look for regular price (not in <del>, not a range)
      const regularPrice = standardPriceContainer.querySelector('.woocommerce-Price-amount:not(del .woocommerce-Price-amount), .amount:not(del .amount)');
      if (regularPrice) {
        const regularPriceText = regularPrice.textContent?.trim();
        if (regularPriceText && !regularPriceText.includes('–') && !regularPriceText.includes('-')) {
          const parsed = this.parsePriceWithContext(regularPriceText);
          if (parsed && parsed.confidence >= 0.70) {
            console.log(`[WooCommerce Adapter] ✓ Found regular price in p.price: ${parsed.numeric} ${parsed.currency}`);
            return parsed;
          }
        }
      }
    }

    // PRIORITY 3: Generic fallback - avoid cart/header/footer
    console.log('[WooCommerce Adapter] Using generic fallback...');
    const allPrices = summaryArea.querySelectorAll('.woocommerce-Price-amount, .amount');
    for (const element of allPrices) {
      if (element.closest('del')) continue;
      if (element.closest('.related, .upsells, .cart, header, footer, nav')) continue;

      const priceText = element.textContent?.trim();
      if (priceText && !priceText.includes('–') && !priceText.includes('-')) {
        const parsed = this.parsePriceWithContext(priceText);
        if (parsed && parsed.confidence >= 0.70) {
          console.log(`[WooCommerce Adapter] ✓ Found fallback price: ${parsed.numeric} ${parsed.currency}`);
          return parsed;
        }
      }
    }

    console.log('[WooCommerce Adapter] ✗ No valid price found.');
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
