// Price Drop Tracker - SportsDirect Site Adapter
// Handles SportsDirect product detection (UK sports retailer)

import { BaseAdapter } from './base-adapter.js';

/**
 * SportsDirectAdapter - Extracts product information from SportsDirect product pages
 *
 * SportsDirect specifics:
 * - Uses ASP.NET control IDs (lblProductName, lblSellingPrice)
 * - Product code in URL colcode parameter
 * - Specific element IDs for product details
 */
export class SportsDirectAdapter extends BaseAdapter {
  detectProduct() {
    return this.url.includes('sportsdirect') && (
      !!this.querySelector('#lblProductName') ||
      this.url.includes('#colcode=')
    );
  }

  extractProductId() {
    // 1. Try URL colcode param (Specific variant)
    const colMatch = this.url.match(/colcode=(\d+)/);
    if (colMatch) return colMatch[1];

    // 2. Try product code element
    const codeEl = this.querySelector('#lblProductCode');
    if (codeEl) return codeEl.textContent.replace(/\D/g, ''); // Strip "Product code:" text

    return null;
  }

  extractTitle() {
    const el = this.querySelector('#lblProductName') || this.querySelector('h1');
    return el ? el.textContent.trim() : null;
  }

  extractPrice() {
    // SportsDirect usually separates selling price (current) from ticket price (RRP)
    const sellingPriceEl = this.querySelector('#lblSellingPrice');

    if (sellingPriceEl) {
      const text = sellingPriceEl.textContent.trim();
      const parsed = this.parsePriceWithContext(text);
      if (parsed) return this.validateCurrency(parsed);
    }

    return null;
  }

  extractImage() {
    // Main image ID
    const img = this.querySelector('#imgProduct') ||
                this.querySelector('.pdpMainImage img');
    return img ? img.src : null;
  }
}
