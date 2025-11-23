// Price Drop Tracker - Base Site Adapter
// Abstract base class for site-specific adapters

import { parsePrice } from '../../utils/currency-parser.js';
import { debug, debugWarn, debugError } from '../../utils/debug.js';

/**
 * BaseAdapter - Abstract base class for site-specific adapters
 *
 * This class provides a common interface and shared functionality for
 * extracting product information from e-commerce sites. Each site should
 * have its own adapter that extends this class and implements the
 * required abstract methods.
 *
 * The adapter pattern allows us to handle site-specific DOM structures
 * and extraction logic while maintaining a consistent interface.
 */
export class BaseAdapter {
  /**
   * @param {Document} document - The DOM document to extract from
   * @param {string} url - The URL of the page
   */
  constructor(document, url) {
    this.document = document;
    this.url = url;
    this.domain = new URL(url).hostname;
    this.locale = document.documentElement.lang || 'en-US';
  }

  // ========== Abstract Methods (must be implemented by subclasses) ==========

  /**
   * Detects if the current page is a product page
   * @returns {boolean} True if this is a product page
   */
  detectProduct() {
    throw new Error('detectProduct() must be implemented');
  }

  /**
   * Extracts the price from the page
   * @returns {Object|null} Parsed price object or null
   */
  extractPrice() {
    throw new Error('extractPrice() must be implemented');
  }

  /**
   * Extracts the product title
   * @returns {string|null} Product title or null
   */
  extractTitle() {
    throw new Error('extractTitle() must be implemented');
  }

  /**
   * Extracts the product image URL
   * @returns {string|null} Image URL or null
   */
  extractImage() {
    throw new Error('extractImage() must be implemented');
  }

  /**
   * Extracts the site-specific product ID
   * @returns {string|null} Product ID or null
   */
  extractProductId() {
    throw new Error('extractProductId() must be implemented');
  }

  // ========== Shared Helper Methods ==========

  /**
   * Gets the expected currency for this domain
   * Override in subclass if the site has a known currency
   * @returns {string|null} Currency code or null
   */
  getExpectedCurrency() {
    return null;
  }

  /**
   * Helper to query a single element
   * @param {string} selector - CSS selector
   * @returns {Element|null} Element or null
   */
  querySelector(selector) {
    return this.document.querySelector(selector);
  }

  /**
   * Helper to query multiple elements
   * @param {string} selector - CSS selector
   * @returns {NodeList} NodeList of elements
   */
  querySelectorAll(selector) {
    return this.document.querySelectorAll(selector);
  }

  /**
   * Parses a price string with domain and locale context
   * @param {string} priceString - Price text to parse
   * @returns {Object|null} Parsed price object or null
   */
  parsePriceWithContext(priceString) {
    return parsePrice(priceString, {
      domain: this.domain,
      locale: this.locale,
      expectedCurrency: this.getExpectedCurrency()
    });
  }

  /**
   * Validates that the parsed price matches the expected currency
   * Reduces confidence if there's a mismatch
   * @param {Object} parsedPrice - Parsed price object
   * @returns {Object} Price object (possibly with adjusted confidence)
   */
  validateCurrency(parsedPrice) {
    const expected = this.getExpectedCurrency();
    if (!expected) return parsedPrice;

    if (parsedPrice.currency !== expected) {
      debugWarn('[base-adapter]', `[Adapter] Currency mismatch: expected ${expected}, got ${parsedPrice.currency}`);
      parsedPrice.confidence *= 0.8;
    }

    return parsedPrice;
  }

  /**
   * Waits for a price element to appear in the DOM
   * Useful for sites with JavaScript-rendered prices
   *
   * NOTE: This is primarily useful for content scripts running on the page.
   * Background price checks won't have access to dynamic content.
   *
   * @param {string[]} selectors - Array of CSS selectors to try
   * @param {number} timeout - Timeout in milliseconds (default 10000)
   * @returns {Promise<Element>} Resolves with element when found
   */
  async waitForPriceElement(selectors, timeout = 10000) {
    return new Promise((resolve, reject) => {
      // Check if already present
      for (const selector of selectors) {
        const element = this.querySelector(selector);
        if (element?.textContent?.trim()) {
          resolve(element);
          return;
        }
      }

      // Wait for it to appear
      const observer = new MutationObserver(() => {
        for (const selector of selectors) {
          const element = this.querySelector(selector);
          if (element?.textContent?.trim()) {
            observer.disconnect();
            resolve(element);
            return;
          }
        }
      });

      observer.observe(this.document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error('Price element not found within timeout'));
      }, timeout);
    });
  }

  /**
   * Extracts price from Schema.org JSON-LD structured data
   * This is the most reliable method for dynamic sites (boozt.com, etc.)
   * Works in both content scripts AND background fetches
   *
   * @returns {Object|null} Parsed price object or null
   */
  extractPriceFromJsonLd() {
    try {
      const scripts = this.querySelectorAll('script[type="application/ld+json"]');

      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);

          // Handle @graph array format
          const items = data['@graph'] || (Array.isArray(data) ? data : [data]);

          for (const item of items) {
            // Helper function to extract price from offers array
            const extractFromOffers = (offers) => {
              const expectedCurrency = this.getExpectedCurrency();
              let matchingCurrencyOffer = null;
              let fallbackOffer = null;

              for (const offer of offers) {
                // Skip approximate/conversion prices (eBay fix)
                const offerText = JSON.stringify(offer).toLowerCase();
                if (offerText.includes('approximately') || offerText.includes('approx.') || offerText.includes('approx ')) {
                  debug('[base-adapter]', '[Adapter] Skipping approximate offer in JSON-LD');
                  continue;
                }

                // Extract price
                const priceValue = offer.price || offer.lowPrice;
                if (priceValue) {
                  const parsed = this.parsePriceWithContext(String(priceValue));
                  if (parsed) {
                    // CRITICAL: Use explicit priceCurrency from JSON-LD offer
                    // The parser might guess wrong currency based on domain (.com = USD)
                    // but JSON-LD explicitly specifies the correct currency
                    if (offer.priceCurrency) {
                      parsed.currency = offer.priceCurrency;
                      debug('[base-adapter]', `[Adapter] Using explicit currency from JSON-LD: ${offer.priceCurrency}`);
                    }

                    const offerCurrency = parsed.currency;

                    if (expectedCurrency && offerCurrency !== expectedCurrency) {
                      debug('[base-adapter]', `[Adapter] Skipping offer with mismatched currency: ${offerCurrency} (expected ${expectedCurrency})`);
                      if (!fallbackOffer) {
                        fallbackOffer = parsed;
                      }
                      continue;
                    }

                    if (!matchingCurrencyOffer) {
                      matchingCurrencyOffer = parsed;
                      debug('[base-adapter]', '[Adapter] ✓ Found matching currency offer:', parsed.numeric, parsed.currency);
                    }
                  }
                }
              }

              return matchingCurrencyOffer || fallbackOffer;
            };

            // Check if this is a Product with offers
            if (item['@type'] === 'Product' && item.offers) {
              const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
              const bestOffer = extractFromOffers(offers);
              if (bestOffer) {
                debug('[base-adapter]', '[Adapter] ✓ Extracted price from JSON-LD Product:', bestOffer.numeric, bestOffer.currency);
                return bestOffer;
              }
            }

            // BOOZT FIX: Handle ProductGroup with hasVariant array
            // Boozt uses ProductGroup with multiple Product variants
            if (item['@type'] === 'ProductGroup' && item.hasVariant) {
              debug('[base-adapter]', '[Adapter] Found ProductGroup, checking variants...');
              const variants = Array.isArray(item.hasVariant) ? item.hasVariant : [item.hasVariant];

              // Try to extract price from first variant with offers
              for (const variant of variants) {
                if (variant['@type'] === 'Product' && variant.offers) {
                  const offers = Array.isArray(variant.offers) ? variant.offers : [variant.offers];
                  const bestOffer = extractFromOffers(offers);
                  if (bestOffer) {
                    debug('[base-adapter]', '[Adapter] ✓ Extracted price from JSON-LD ProductGroup variant:', bestOffer.numeric, bestOffer.currency);
                    return bestOffer;
                  }
                }
              }
            }
          }
        } catch (e) {
          // Ignore JSON parse errors for individual scripts
          debugWarn('[base-adapter]', '[Adapter] Failed to parse JSON-LD script:', e.message);
        }
      }
    } catch (e) {
      debugError('[base-adapter]', '[Adapter] Error extracting JSON-LD:', e);
    }

    return null;
  }
}
