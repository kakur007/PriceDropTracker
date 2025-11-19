// Price Drop Tracker - eBay Site Adapter
// Handles eBay product detection across all regional domains

import { BaseAdapter } from './base-adapter.js';

/**
 * EbayAdapter - Extracts product information from eBay product pages
 *
 * eBay specifics:
 * - Multiple regional domains with different currencies
 * - Both auction and "Buy It Now" listings
 * - Price may include shipping costs
 * - Product ID is item number (numeric)
 * - URLs contain /itm/ followed by item number
 * - Recent redesign uses data-testid attributes
 */
export class EbayAdapter extends BaseAdapter {
  /**
   * Maps eBay domains to their primary currencies
   */
  static CURRENCY_BY_DOMAIN = {
    'ebay.com': 'USD',
    'ebay.co.uk': 'GBP',
    'ebay.de': 'EUR',
    'ebay.fr': 'EUR',
    'ebay.it': 'EUR',
    'ebay.es': 'EUR',
    'ebay.ca': 'CAD',
    'ebay.com.au': 'AUD',
    'ebay.ie': 'EUR',
    'ebay.nl': 'EUR',
    'ebay.be': 'EUR',
    'ebay.at': 'EUR',
    'ebay.ch': 'CHF',
    'ebay.in': 'INR',
    'ebay.com.sg': 'SGD',
    'ebay.com.my': 'MYR',
    'ebay.ph': 'PHP',
    'ebay.com.hk': 'HKD'
  };

  /**
   * Gets the expected currency based on domain
   * @returns {string} Currency code
   */
  getExpectedCurrency() {
    // Strip 'www.' prefix if present for lookup
    const lookupDomain = this.domain.replace(/^www\./, '');
    return EbayAdapter.CURRENCY_BY_DOMAIN[lookupDomain] || 'USD';
  }

  /**
   * Detects if this is an eBay product/item page
   * @returns {boolean} True if product page
   */
  detectProduct() {
    // eBay product URLs contain /itm/
    return this.url.includes('/itm/');
  }

  /**
   * Extracts the eBay item ID
   * @returns {string|null} Item ID or null
   */
  extractProductId() {
    // eBay item IDs are numeric
    // URL format: /itm/123456789012
    const match = this.url.match(/\/itm\/(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Extracts the item title
   * eBay has updated their DOM structure recently
   * @returns {string|null} Item title or null
   */
  extractTitle() {
    const selectors = [
      'h1.x-item-title__mainTitle',           // New design
      '.it-ttl',                               // Older design
      '#itemTitle',                            // Classic design
      'h1[itemprop="name"]',                   // Microdata
      '[data-testid="x-item-title"]'           // Test ID variant
    ];

    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  /**
   * Extracts the current price
   * eBay shows different prices for auctions vs Buy It Now
   * Also shows conversion rates (e.g., "Approximately US $X" on AU site)
   * We need to find the PRIMARY price, not the conversion
   * @returns {Object|null} Parsed price object or null
   */
  extractPrice() {
    const selectors = [
      '.x-price-primary [itemprop="price"]',   // Primary price with microdata
      '.x-price-primary span',                 // Primary price span
      '#prcIsum',                              // Classic price summary
      '#mm-saleDscPrc',                        // Sale price
      '[data-testid="x-price-primary"]',       // Test ID variant
      '.display-price'                         // Display price class
    ];

    const expectedCurrency = this.getExpectedCurrency();

    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        // CRITICAL FIX: NEVER use content attribute for eBay
        // eBay's content attribute contains price in cents (e.g., "3000" for $30.00)
        // This causes $30 to become $3000 in Firefox when textContent is empty
        // ONLY use textContent or value attribute
        let text = element.textContent || element.getAttribute('value');

        // Skip this element if no text content (don't fall back to content attribute!)
        if (!text || text.trim() === '') {
          continue;
        }

        // Clean up whitespace (eBay sometimes has weird spacing)
        text = text.replace(/\s+/g, ' ').trim();

        // Filter out conversion/approximate prices (eBay shows these on regional sites)
        // For example: "AU $25.00 Approximately US $16.50"
        // We want the first price (AU $25.00), not the conversion (US $16.50)
        if (text.toLowerCase().includes('approximately')) {
          // Split on "approximately" and take the first part
          const parts = text.split(/approximately/i);
          if (parts.length > 1) {
            text = parts[0].trim();
          }
        }

        const parsed = this.parsePriceWithContext(text);

        if (parsed && parsed.confidence >= 0.70) {
          // Validate that it matches expected currency for this domain
          const validated = this.validateCurrency(parsed);

          // Only accept if currency matches expected (or close enough)
          // This prevents picking up conversion rates
          if (!expectedCurrency || parsed.currency === expectedCurrency || validated.confidence >= 0.70) {
            return validated;
          }
        }
      }
    }

    return null;
  }

  /**
   * Extracts the item image URL
   * @returns {string|null} Image URL or null
   */
  extractImage() {
    const selectors = [
      '.ux-image-carousel-item img',           // Image carousel
      '#icImg',                                // Classic image
      'img[itemprop="image"]',                 // Microdata image
      '.img-container img'                     // Generic container
    ];

    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        return element.src;
      }
    }

    return null;
  }
}
