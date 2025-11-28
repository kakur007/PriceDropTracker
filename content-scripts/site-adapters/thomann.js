/**
 * Thomann Site Adapter
 * Handles price detection for Thomann (music gear e-commerce)
 *
 * Thomann operates multiple domains with different currencies.
 * Uses JSON-LD structured data as primary extraction method.
 */

import { BaseAdapter } from './base-adapter.js';
import { debug, debugError } from '../../utils/debug.js';

export class ThomannAdapter extends BaseAdapter {
  /**
   * Gets the expected currency based on domain
   * @returns {string} Currency code
   */
  getExpectedCurrency() {
    // Map domains to currencies
    if (this.domain.includes('thomannmusic.com')) return 'USD'; // US site
    if (this.domain.includes('thomann.de')) return 'EUR';       // German site
    if (this.domain.includes('thomann.co.uk')) return 'GBP';    // UK site

    // Default to EUR (original German site)
    return 'EUR';
  }

  /**
   * Detects if this is a Thomann product page
   * @returns {boolean} True if Thomann product page
   */
  detectProduct() {
    debug('[thomann]', `[Thomann Adapter] Detecting product on domain: ${this.domain}`);

    // Check 1: Domain includes "thomann"
    const isThomannDomain = this.domain.includes('thomann');
    if (!isThomannDomain) {
      return false;
    }

    // Check 2: URL ends in .htm or .html
    const hasHtmlExtension = /\.html?$/.test(this.url);

    // Check 3: Page has product indicators
    const hasProductSchema = this.hasProductSchema();
    const hasArticleId = this.querySelector('input[name="articleId"]') !== null;
    const hasPrice = this.querySelector('.price-wrapper') !== null ||
                     this.querySelector('.fx-product-price') !== null;
    const hasProductImage = this.querySelector('.product-image') !== null;

    debug('[thomann]', `[Thomann Adapter] Detection checks: htmlExt=${hasHtmlExtension}, schema=${hasProductSchema}, articleId=${hasArticleId}, price=${hasPrice}, image=${hasProductImage}`);

    // Be lenient: URL extension OR (schema OR price OR articleId)
    const isProduct = hasHtmlExtension || hasProductSchema || hasArticleId || hasPrice;

    if (!isProduct) {
      debugError('[thomann]', `[Thomann Adapter] ✗ Product NOT detected - No indicators found`);
    } else {
      debug('[thomann]', `[Thomann Adapter] ✓ Product detected`);
    }

    return isProduct;
  }

  /**
   * Helper to check if page has Product schema in JSON-LD
   * @returns {boolean} True if Product schema exists
   */
  hasProductSchema() {
    try {
      const scripts = this.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);
          const jsonString = JSON.stringify(data);

          // Check for @type: "Product"
          if (jsonString.includes('"@type":"Product"') || jsonString.includes('"@type": "Product"')) {
            return true;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    } catch (e) {
      // Ignore errors
    }
    return false;
  }

  /**
   * Helper to extract a specific field from JSON-LD Product schema
   * @param {string} field - Field name to extract
   * @returns {any|null} Field value or null
   */
  extractFromJsonLd(field) {
    try {
      const scripts = this.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);

          // Handle @graph array
          const items = data['@graph'] || (Array.isArray(data) ? data : [data]);

          for (const item of items) {
            if (item['@type'] === 'Product' && item[field]) {
              debug('[thomann]', `[Thomann Adapter] ✓ Extracted ${field} from JSON-LD: ${item[field]}`);
              return item[field];
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    } catch (e) {
      // Ignore errors
    }
    return null;
  }

  /**
   * Extracts the product ID
   * @returns {string|null} Product ID or null
   */
  extractProductId() {
    // Priority 1: JSON-LD sku
    const sku = this.extractFromJsonLd('sku');
    if (sku) {
      debug('[thomann]', `[Thomann Adapter] ✓ Extracted ID from JSON-LD sku: ${sku}`);
      return String(sku);
    }

    // Priority 2: input[name="articleId"]
    const articleIdInput = this.querySelector('input[name="articleId"]');
    if (articleIdInput && articleIdInput.value) {
      debug('[thomann]', `[Thomann Adapter] ✓ Extracted ID from articleId: ${articleIdInput.value}`);
      return articleIdInput.value;
    }

    // Priority 3: .article-number text content
    const articleNumber = this.querySelector('.article-number');
    if (articleNumber) {
      const text = articleNumber.textContent?.trim();
      if (text) {
        debug('[thomann]', `[Thomann Adapter] ✓ Extracted ID from article-number: ${text}`);
        return text;
      }
    }

    // Priority 4: Search for "Item no." in page text
    const bodyText = this.document.body.textContent || '';
    const itemNoMatch = bodyText.match(/Item\s+no[.:]?\s*(\d+)/i);
    if (itemNoMatch) {
      debug('[thomann]', `[Thomann Adapter] ✓ Extracted ID from Item no.: ${itemNoMatch[1]}`);
      return itemNoMatch[1];
    }

    debug('[thomann]', '[Thomann Adapter] ✗ No product ID found');
    return null;
  }

  /**
   * Extracts the product title
   * @returns {string|null} Product title or null
   */
  extractTitle() {
    // Priority 1: JSON-LD name
    const name = this.extractFromJsonLd('name');
    if (name && typeof name === 'string') {
      debug('[thomann]', `[Thomann Adapter] ✓ Extracted title from JSON-LD: ${name}`);
      return name.trim();
    }

    // Priority 2: h1 text content
    const h1 = this.querySelector('h1');
    if (h1) {
      const title = h1.textContent?.trim();
      if (title) {
        debug('[thomann]', `[Thomann Adapter] ✓ Extracted title from h1: ${title}`);
        return title;
      }
    }

    debug('[thomann]', '[Thomann Adapter] ✗ No product title found');
    return null;
  }

  /**
   * Extract product price
   * @returns {Object|null} Parsed price data or null
   */
  extractPrice() {
    debug('[thomann]', '[Thomann Adapter] Starting price extraction...');

    // Priority 1: JSON-LD offers.price
    try {
      const scripts = this.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);
          const items = data['@graph'] || (Array.isArray(data) ? data : [data]);

          for (const item of items) {
            if (item['@type'] === 'Product' && item.offers) {
              const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;

              if (offers.price) {
                // Construct price string
                const priceString = `${offers.price} ${offers.priceCurrency || ''}`.trim();
                const parsed = this.parsePriceWithContext(priceString);

                if (parsed && parsed.confidence >= 0.70) {
                  // Use explicit currency from offers
                  if (offers.priceCurrency) {
                    parsed.currency = offers.priceCurrency;
                  }
                  debug('[thomann]', `[Thomann Adapter] ✓ Extracted price from JSON-LD: ${parsed.numeric} ${parsed.currency}`);
                  return this.validateCurrency(parsed);
                }
              }
            }
          }
        } catch (e) {
          // Ignore parse errors, try next script
        }
      }
    } catch (e) {
      debug('[thomann]', `[Thomann Adapter] JSON-LD extraction error: ${e.message}`);
    }

    // Priority 2: meta[itemprop="price"]
    const priceMeta = this.querySelector('meta[itemprop="price"]');
    if (priceMeta) {
      const priceValue = priceMeta.getAttribute('content');
      if (priceValue) {
        const parsed = this.parsePriceWithContext(priceValue);
        if (parsed && parsed.confidence >= 0.70) {
          debug('[thomann]', `[Thomann Adapter] ✓ Extracted price from meta tag: ${parsed.numeric} ${parsed.currency}`);
          return this.validateCurrency(parsed);
        }
      }
    }

    // Priority 3: DOM selectors
    const priceSelectors = [
      '.price-wrapper .price',
      '.fx-product-price',
      '.product-price',
      '[itemprop="price"]'
    ];

    for (const selector of priceSelectors) {
      const element = this.querySelector(selector);
      if (element) {
        const priceText = element.textContent?.trim();
        if (priceText) {
          const parsed = this.parsePriceWithContext(priceText);
          if (parsed && parsed.confidence >= 0.70) {
            debug('[thomann]', `[Thomann Adapter] ✓ Extracted price from ${selector}: ${parsed.numeric} ${parsed.currency}`);
            return this.validateCurrency(parsed);
          }
        }
      }
    }

    debugError('[thomann]', '[Thomann Adapter] ✗ No valid price found - tried JSON-LD, meta tag, and DOM selectors');
    return null;
  }

  /**
   * Extract product image
   * @returns {string|null} Image URL or null
   */
  extractImage() {
    // Priority 1: JSON-LD image
    const imageFromJsonLd = this.extractFromJsonLd('image');
    if (imageFromJsonLd) {
      // Image can be string, array, or object
      let imageUrl = null;

      if (typeof imageFromJsonLd === 'string') {
        imageUrl = imageFromJsonLd;
      } else if (Array.isArray(imageFromJsonLd) && imageFromJsonLd.length > 0) {
        imageUrl = imageFromJsonLd[0];
      } else if (imageFromJsonLd && typeof imageFromJsonLd === 'object' && imageFromJsonLd.url) {
        imageUrl = imageFromJsonLd.url;
      }

      if (imageUrl && !imageUrl.startsWith('data:')) {
        debug('[thomann]', `[Thomann Adapter] ✓ Extracted image from JSON-LD: ${imageUrl}`);
        return imageUrl;
      }
    }

    // Priority 2: .product-image img
    const imageSelectors = [
      '.product-image img',
      '.product-gallery img',
      '[itemprop="image"]',
      'img.main-image'
    ];

    for (const selector of imageSelectors) {
      const element = this.querySelector(selector);
      if (element) {
        const imageUrl = element.src ||
                        element.getAttribute('data-src') ||
                        element.getAttribute('data-lazy');

        if (imageUrl && !imageUrl.startsWith('data:')) {
          debug('[thomann]', `[Thomann Adapter] ✓ Extracted image from ${selector}: ${imageUrl}`);
          return imageUrl;
        }
      }
    }

    debug('[thomann]', '[Thomann Adapter] ✗ No product image found');
    return null;
  }
}
