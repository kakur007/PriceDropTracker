// Price Drop Tracker - Booztlet Site Adapter
// Handles Booztlet product detection (outlet/discount fashion site)

import { BaseAdapter } from './base-adapter.js';

export class BooztletAdapter extends BaseAdapter {
  detectProduct() {
    return this.url.includes('booztlet.com') && (
      this.url.includes('/ee/et/') ||
      /\/\d+\/\d+$/.test(this.url)
    );
  }

  extractProductId() {
    // URL format: .../product-name_ID1/ID2
    const matches = this.url.match(/\/(\d+)$/);
    return matches ? matches[1] : null;
  }

  extractTitle() {
    // Booztlet often separates Brand and Name
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
    // PRIORITY 1: Try JSON-LD structured data first
    // This works for both initial detection AND background refreshes
    // Boozt.com includes price in JSON-LD even when visual elements are empty
    const jsonLdPrice = this.extractPriceFromJsonLd();
    if (jsonLdPrice && jsonLdPrice.confidence >= 0.70) {
      return this.validateCurrency(jsonLdPrice);
    }

    // PRIORITY 2: Visual elements (works for initial detection only)
    // Define selectors for the wrapper that holds the price
    const selectors = [
      '.price-container',
      '.product-price',
      '.product-information .price'
    ];

    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        // CLONE the element to manipulate it without affecting the page
        const clone = element.cloneNode(true);

        // REMOVE "noise" elements from the clone
        // Remove original/strikethrough prices
        const oldPrices = clone.querySelectorAll('.price-original, .original-price, .prev-price, span[style*="line-through"]');
        oldPrices.forEach(el => el.remove());

        // Remove discount badges (e.g., "-20%")
        const discounts = clone.querySelectorAll('.discount-tag, .percentage, .sale-label');
        discounts.forEach(el => el.remove());

        // Extract text from what's left
        let text = clone.textContent.trim();

        // Regex Cleanup: Booztlet sometimes puts the currency *between* numbers or has weird spacing
        // Look for the first valid price pattern (e.g., "27.99")
        // Matches: digits, dot/comma, digits
        const priceMatch = text.match(/(\d+[.,]\d+)/);
        if (priceMatch) {
          text = priceMatch[0];
        }

        // Parse
        const parsed = this.parsePriceWithContext(text);
        if (parsed && parsed.confidence >= 0.70) {
          return this.validateCurrency(parsed);
        }
      }
    }

    // PRIORITY 3: Fallback - specific "current price" classes
    const directPrice = this.querySelector('.current-price, .price.campaign');
    if (directPrice) {
        return this.parsePriceWithContext(directPrice.textContent.trim());
    }

    return null;
  }

  extractImage() {
    // Try to find the main product image
    const selectors = [
      '.primary-image img',
      '.product-image img',
      '.image-gallery img',
      'img[itemprop="image"]'
    ];

    for (const sel of selectors) {
        const img = this.querySelector(sel);
        if (img && img.src) return img.src;
    }
    return null;
  }
}
