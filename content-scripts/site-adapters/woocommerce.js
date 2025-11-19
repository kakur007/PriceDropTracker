/**
 * WooCommerce Site Adapter
 * Handles price detection for WooCommerce-based e-commerce sites
 *
 * WooCommerce is one of the most popular e-commerce platforms for WordPress.
 * It has specific HTML structures and CSS classes that we can target.
 */

import { BaseAdapter } from './base-adapter.js';
import { debug, debugWarn, debugError } from '../../utils/debug.js';

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
   * Extract product price (Version 8 - With Regular Price)
   * This version extracts both the current price and the regular/original price
   * (if available) to provide complete pricing information to the tracker.
   *
   * @returns {Object|null} Parsed price data or null
   */
  extractPrice() {
    debug('[woocommerce]', '[WooCommerce Adapter] Starting price extraction with regular price support (v8)...');

    const summaryArea = this.querySelector('.summary.entry-summary') || this.document;
    let currentPrice = null;
    let regularPrice = null;

    // PRIORITY 1: Check for variation price (variable products with selected variation)
    const variationPriceContainer = summaryArea.querySelector('.woocommerce-variation-price');
    if (variationPriceContainer) {
      debug('[woocommerce]', '[WooCommerce Adapter] Found .woocommerce-variation-price container');

      // Extract regular price from <del> tag (original price before discount)
      const delElement = variationPriceContainer.querySelector('del .woocommerce-Price-amount, del .amount');
      if (delElement) {
        const delPriceText = delElement.textContent?.trim();
        if (delPriceText) {
          const parsedDel = this.parsePriceWithContext(delPriceText);
          if (parsedDel && parsedDel.confidence >= 0.70) {
            regularPrice = parsedDel.numeric;
            debug('[woocommerce]', `[WooCommerce Adapter] ✓ Found regular price in <del>: ${parsedDel.numeric} ${parsedDel.currency}`);
          }
        }
      }

      // Look for current/sale price in <ins> tag
      const insElement = variationPriceContainer.querySelector('ins .woocommerce-Price-amount, ins .amount');
      if (insElement) {
        const insPriceText = insElement.textContent?.trim();
        if (insPriceText) {
          const parsed = this.parsePriceWithContext(insPriceText);
          if (parsed && parsed.confidence >= 0.70) {
            currentPrice = parsed;
            debug('[woocommerce]', `[WooCommerce Adapter] ✓ Found sale price in <ins>: ${parsed.numeric} ${parsed.currency}`);
          }
        }
      }

      // If no sale price found, look for regular price (not in <del>, not a range)
      if (!currentPrice) {
        const priceElement = variationPriceContainer.querySelector('.woocommerce-Price-amount:not(del .woocommerce-Price-amount), .amount:not(del .amount)');
        if (priceElement) {
          const priceText = priceElement.textContent?.trim();
          if (priceText && !priceText.includes('–') && !priceText.includes('-')) {
            const parsed = this.parsePriceWithContext(priceText);
            if (parsed && parsed.confidence >= 0.70) {
              currentPrice = parsed;
              debug('[woocommerce]', `[WooCommerce Adapter] ✓ Found current price in variation: ${parsed.numeric} ${parsed.currency}`);
            }
          }
        }
      }

      // If we found a price in the variation container, return it with metadata
      if (currentPrice) {
        if (regularPrice && regularPrice > currentPrice.numeric) {
          currentPrice.regularPrice = regularPrice;
          currentPrice.isOnSale = true;
          const savings = regularPrice - currentPrice.numeric;
          const savingsPercent = ((savings / regularPrice) * 100).toFixed(0);
          debug('[woocommerce]', `[WooCommerce Adapter] ✓ Product is on sale! Regular: ${regularPrice}, Current: ${currentPrice.numeric}, Savings: ${savings} (${savingsPercent}%)`);
        }
        return currentPrice;
      }
    }

    // PRIORITY 2: Check for standard product price with sale
    const standardPriceContainer = summaryArea.querySelector('p.price');
    if (standardPriceContainer) {
      debug('[woocommerce]', '[WooCommerce Adapter] Found p.price container');

      // Extract regular price from <del> tag
      const delElement = standardPriceContainer.querySelector('del .woocommerce-Price-amount, del .amount');
      if (delElement) {
        const delPriceText = delElement.textContent?.trim();
        if (delPriceText) {
          const parsedDel = this.parsePriceWithContext(delPriceText);
          if (parsedDel && parsedDel.confidence >= 0.70) {
            regularPrice = parsedDel.numeric;
            debug('[woocommerce]', `[WooCommerce Adapter] ✓ Found regular price in <del>: ${parsedDel.numeric} ${parsedDel.currency}`);
          }
        }
      }

      // Look for sale price in <ins> tag
      const insElement = standardPriceContainer.querySelector('ins .woocommerce-Price-amount, ins .amount');
      if (insElement) {
        const insPriceText = insElement.textContent?.trim();
        if (insPriceText) {
          const parsed = this.parsePriceWithContext(insPriceText);
          if (parsed && parsed.confidence >= 0.70) {
            currentPrice = parsed;
            debug('[woocommerce]', `[WooCommerce Adapter] ✓ Found sale price in <ins>: ${parsed.numeric} ${parsed.currency}`);
          }
        }
      }

      // If no sale price, look for regular price
      if (!currentPrice) {
        const priceElement = standardPriceContainer.querySelector('.woocommerce-Price-amount:not(del .woocommerce-Price-amount), .amount:not(del .amount)');
        if (priceElement) {
          const priceText = priceElement.textContent?.trim();
          if (priceText && !priceText.includes('–') && !priceText.includes('-')) {
            const parsed = this.parsePriceWithContext(priceText);
            if (parsed && parsed.confidence >= 0.70) {
              currentPrice = parsed;
              debug('[woocommerce]', `[WooCommerce Adapter] ✓ Found current price in p.price: ${parsed.numeric} ${parsed.currency}`);
            }
          }
        }
      }

      // If we found a price, return it with metadata
      if (currentPrice) {
        if (regularPrice && regularPrice > currentPrice.numeric) {
          currentPrice.regularPrice = regularPrice;
          currentPrice.isOnSale = true;
          const savings = regularPrice - currentPrice.numeric;
          const savingsPercent = ((savings / regularPrice) * 100).toFixed(0);
          debug('[woocommerce]', `[WooCommerce Adapter] ✓ Product is on sale! Regular: ${regularPrice}, Current: ${currentPrice.numeric}, Savings: ${savings} (${savingsPercent}%)`);
        }
        return currentPrice;
      }
    }

    // PRIORITY 3: Generic fallback - avoid cart/header/footer
    debug('[woocommerce]', '[WooCommerce Adapter] Using generic fallback...');
    const allPrices = summaryArea.querySelectorAll('.woocommerce-Price-amount, .amount');
    for (const element of allPrices) {
      if (element.closest('del')) continue;
      if (element.closest('.related, .upsells, .cart, header, footer, nav')) continue;

      const priceText = element.textContent?.trim();
      if (priceText && !priceText.includes('–') && !priceText.includes('-')) {
        const parsed = this.parsePriceWithContext(priceText);
        if (parsed && parsed.confidence >= 0.70) {
          debug('[woocommerce]', `[WooCommerce Adapter] ✓ Found fallback price: ${parsed.numeric} ${parsed.currency}`);
          return parsed;
        }
      }
    }

    debug('[woocommerce]', '[WooCommerce Adapter] ✗ No valid price found.');
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
