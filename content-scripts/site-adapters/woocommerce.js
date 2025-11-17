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
   * Extract product price (Version 5 - Score-Based)
   * This version finds all potential prices, scores them based on reliability,
   * and returns the highest-scoring valid price. This is the most robust
   * method for handling complex WooCommerce themes with variations and sales.
   *
   * Scoring Logic:
   *   - Inside <ins> (sale price): +100 (highest priority)
   *   - Variation price: +80
   *   - General price: +50
   *
   * @returns {Object|null} Parsed price data or null
   */
  extractPrice() {
    console.log('[WooCommerce Adapter] Starting score-based price extraction (v5)...');

    const summaryArea = this.querySelector('.summary.entry-summary') || this.document;
    const priceCandidates = [];

    // Find all elements that look like a price
    const potentialElements = summaryArea.querySelectorAll('.woocommerce-Price-amount, .amount');

    console.log(`[WooCommerce Adapter] Found ${potentialElements.length} potential price elements.`);

    for (const element of potentialElements) {
      // *** Run critical checks on each element ***

      // 1. Skip if inside a <del> tag (old price)
      if (element.closest('del')) {
        continue;
      }

      // 2. Skip if in an excluded area (cart, related products, etc.)
      if (element.closest('.related, .upsells, .cart, header, footer, nav')) {
        continue;
      }

      const priceText = element.textContent?.trim();

      // 3. Skip if it's a price range
      if (priceText && (priceText.includes('–') || priceText.includes('-'))) {
        continue;
      }

      if (priceText) {
        const parsed = this.parsePriceWithContext(priceText);
        if (parsed && parsed.confidence >= 0.70) {

          // *** Score the candidate ***
          let score = parsed.confidence * 50; // Base score

          // Highest score for sale price
          if (element.closest('ins')) {
            score += 100;
          }
          // High score for selected variation price
          if (element.closest('.woocommerce-variation-price')) {
            score += 80;
          }
          // Medium score for a standard price paragraph
          if (element.closest('p.price')) {
            score += 50;
          }

          priceCandidates.push({ parsed, score });
        }
      }
    }

    if (priceCandidates.length === 0) {
      console.log('[WooCommerce Adapter] ✗ No valid price candidates found.');
      return null;
    }

    // Sort candidates by score, descending
    priceCandidates.sort((a, b) => b.score - a.score);

    console.log('[WooCommerce Adapter] Price candidates sorted by score:');
    priceCandidates.forEach((c, i) => {
      console.log(`  ${i+1}. ${c.parsed.numeric} ${c.parsed.currency} (Score: ${c.score.toFixed(2)})`);
    });

    // The best candidate is the one with the highest score
    const bestCandidate = priceCandidates[0];

    console.log(`[WooCommerce Adapter] ✓ Best price selected: ${bestCandidate.parsed.numeric} ${bestCandidate.parsed.currency}`);
    return bestCandidate.parsed;
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
