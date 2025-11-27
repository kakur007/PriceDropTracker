/**
 * Alensa Site Adapter
 * Handles price detection for Alensa.ee (contact lenses e-commerce)
 *
 * This adapter uses DOM extraction based on site structure analysis.
 */

import { BaseAdapter } from './base-adapter.js';
import { debug, debugError } from '../../utils/debug.js';

export class AlensaAdapter extends BaseAdapter {
  /**
   * Gets the expected currency for Alensa
   * @returns {string} Currency code
   */
  getExpectedCurrency() {
    // Alensa.ee operates in Estonia (Eurozone)
    return 'EUR';
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

          // Check for @type: "Product" anywhere in the structure
          if (jsonString.includes('"@type":"Product"') || jsonString.includes('"@type": "Product"')) {
            debug('[alensa]', '[Alensa Adapter] ✓ Found Product schema in JSON-LD');
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
   * Detects if this is an Alensa product page
   * Uses multiple detection methods - very lenient to catch all product pages
   * @returns {boolean} True if Alensa product page
   */
  detectProduct() {
    debug('[alensa]', `[Alensa Adapter] Detecting product on domain: ${this.domain}`);

    // Check 1: Basic page structure (most lenient)
    const hasH1 = this.querySelector('h1') !== null;
    const hasPrice = this.querySelector('.price') !== null || this.querySelector('[class*="price"]') !== null;

    // Check 2: Product Schema
    const hasProductSchema = this.hasProductSchema();

    // Check 3: Specific Alensa elements
    const hasPriceBox = this.querySelector('#price_box') !== null ||
                        this.querySelector('.product-price-group') !== null ||
                        this.querySelector('#price-value') !== null;
    const hasAddToCart = this.querySelector('#add_to_cart') !== null ||
                        this.querySelector('button[name="add_to_cart"]') !== null ||
                        this.querySelector('.add-to-cart') !== null;

    // Check 4: Form elements
    const hasProductInput = this.querySelector('input[name="id_product"]') !== null ||
                           this.querySelector('input[name="product"]') !== null;

    // Check 5: Body class
    const hasProductClass = this.document.body.classList.contains('product-page') ||
                           this.document.body.classList.contains('product');

    debug('[alensa]', `[Alensa Adapter] Detection checks: h1=${hasH1}, price=${hasPrice}, schema=${hasProductSchema}, priceBox=${hasPriceBox}, addToCart=${hasAddToCart}, productInput=${hasProductInput}, productClass=${hasProductClass}`);

    // Be very lenient: if we have schema OR (h1 AND price) OR addToCart, it's a product
    const isProduct = hasProductSchema || (hasH1 && hasPrice) || hasAddToCart || hasPriceBox || hasProductInput || hasProductClass;

    if (!isProduct) {
      debugError('[alensa]', `[Alensa Adapter] ✗ Product NOT detected - No indicators found`);
    } else {
      debug('[alensa]', `[Alensa Adapter] ✓ Product detected`);
    }

    return isProduct;
  }

  /**
   * Extracts the product ID from hidden inputs
   * @returns {string|null} Product ID or null
   */
  extractProductId() {
    // Priority 1: input[name="id_product"]
    const idProductInput = this.querySelector('input[name="id_product"]');
    if (idProductInput && idProductInput.value) {
      debug('[alensa]', `[Alensa Adapter] ✓ Extracted ID from id_product: ${idProductInput.value}`);
      return idProductInput.value;
    }

    // Priority 2: input[name="product"]
    const productInput = this.querySelector('input[name="product"]');
    if (productInput && productInput.value) {
      debug('[alensa]', `[Alensa Adapter] ✓ Extracted ID from product: ${productInput.value}`);
      return productInput.value;
    }

    // Priority 3: data-product-id attribute
    const dataElement = this.querySelector('[data-product-id]');
    if (dataElement) {
      const productId = dataElement.getAttribute('data-product-id');
      if (productId) {
        debug('[alensa]', `[Alensa Adapter] ✓ Extracted ID from data-product-id: ${productId}`);
        return productId;
      }
    }

    debug('[alensa]', '[Alensa Adapter] ✗ No product ID found');
    return null;
  }

  /**
   * Extracts the product title
   * @returns {string|null} Product name or null
   */
  extractTitle() {
    const titleSelectors = [
      '#product-name',
      'h1',
      '[itemprop="name"]'
    ];

    for (const selector of titleSelectors) {
      const element = this.querySelector(selector);
      if (element) {
        const title = element.textContent?.trim();
        if (title && title.length > 0) {
          debug('[alensa]', `[Alensa Adapter] ✓ Extracted title: ${title}`);
          return title;
        }
      }
    }

    debug('[alensa]', '[Alensa Adapter] ✗ No product title found');
    return null;
  }

  /**
   * Extract product price - tries JSON-LD first, then DOM fallback
   * @returns {Object|null} Parsed price data or null
   */
  extractPrice() {
    debug('[alensa]', '[Alensa Adapter] Starting price extraction...');

    // PRIORITY 1: Try JSON-LD with WebPage/Offer schema
    const jsonLdPrice = this.extractPriceFromJsonLdWebPage();
    if (jsonLdPrice && jsonLdPrice.confidence >= 0.70) {
      debug('[alensa]', `[Alensa Adapter] ✓ Extracted price from JSON-LD: ${jsonLdPrice.numeric} ${jsonLdPrice.currency}`);
      return this.validateCurrency(jsonLdPrice);
    }

    // PRIORITY 2: Try standard Product schema JSON-LD
    const productJsonLd = this.extractPriceFromJsonLd();
    if (productJsonLd && productJsonLd.confidence >= 0.70) {
      debug('[alensa]', `[Alensa Adapter] ✓ Extracted price from Product JSON-LD: ${productJsonLd.numeric} ${productJsonLd.currency}`);
      return this.validateCurrency(productJsonLd);
    }

    // PRIORITY 3: DOM-based extraction
    const priceSelectors = [
      '#price-value',
      '.price-final',
      '.price'
    ];

    for (const selector of priceSelectors) {
      const element = this.querySelector(selector);
      if (element) {
        const priceText = element.textContent?.trim();
        if (priceText) {
          const parsed = this.parsePriceWithContext(priceText);
          if (parsed && parsed.confidence >= 0.70) {
            debug('[alensa]', `[Alensa Adapter] ✓ Extracted price from ${selector}: ${parsed.numeric} ${parsed.currency}`);
            return this.validateCurrency(parsed);
          }
        }
      }
    }

    // CRITICAL: Always log price extraction failures
    debugError('[alensa]', '[Alensa Adapter] ✗ No valid price found - tried JSON-LD WebPage, JSON-LD Product, and DOM selectors');
    return null;
  }

  /**
   * Extract price from JSON-LD WebPage schema with mainEntity
   * Alensa uses @graph with WebPage that contains mainEntity.Product
   * @returns {Object|null} Parsed price object or null
   */
  extractPriceFromJsonLdWebPage() {
    try {
      const scripts = this.querySelectorAll('script[type="application/ld+json"]');
      debug('[alensa]', `[Alensa Adapter] Found ${scripts.length} JSON-LD script tags`);

      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);

          // Handle different JSON-LD formats
          const items = data['@graph'] || (Array.isArray(data) ? data : [data]);
          debug('[alensa]', `[Alensa Adapter] Processing ${items.length} items from JSON-LD`);

          for (const item of items) {
            debug('[alensa]', `[Alensa Adapter] Checking item type: ${item['@type']}`);

            // Look for WebPage with mainEntity.Product (Alensa structure)
            if (item['@type'] === 'WebPage' && item.mainEntity) {
              debug('[alensa]', '[Alensa Adapter] Found WebPage with mainEntity');
              const mainEntity = item.mainEntity;

              // Check if mainEntity is a Product with offers
              if (mainEntity['@type'] === 'Product' && mainEntity.offers) {
                debug('[alensa]', '[Alensa Adapter] mainEntity is a Product with offers');
                const offers = Array.isArray(mainEntity.offers) ? mainEntity.offers : [mainEntity.offers];

                for (const offer of offers) {
                  const priceValue = offer.price || offer.lowPrice;
                  debug('[alensa]', `[Alensa Adapter] Offer price value: ${priceValue}, currency: ${offer.priceCurrency}`);
                  if (priceValue) {
                    const parsed = this.parsePriceWithContext(String(priceValue));
                    if (parsed) {
                      // Use explicit priceCurrency from offer if available
                      if (offer.priceCurrency) {
                        parsed.currency = offer.priceCurrency;
                      }
                      debug('[alensa]', `[Alensa Adapter] ✓ Found price in WebPage.mainEntity offer: ${parsed.numeric} ${parsed.currency}`);
                      return parsed;
                    }
                  }
                }
              }
            }

            // Look for WebPage with offers directly (fallback)
            if (item['@type'] === 'WebPage' && item.offers) {
              const offers = Array.isArray(item.offers) ? item.offers : [item.offers];

              for (const offer of offers) {
                const priceValue = offer.price || offer.lowPrice;
                if (priceValue) {
                  const parsed = this.parsePriceWithContext(String(priceValue));
                  if (parsed) {
                    // Use explicit priceCurrency from offer if available
                    if (offer.priceCurrency) {
                      parsed.currency = offer.priceCurrency;
                    }
                    debug('[alensa]', `[Alensa Adapter] Found price in WebPage offer: ${parsed.numeric} ${parsed.currency}`);
                    return parsed;
                  }
                }
              }
            }

            // Also check for standalone Offer type
            if (item['@type'] === 'Offer') {
              const priceValue = item.price || item.lowPrice;
              if (priceValue) {
                const parsed = this.parsePriceWithContext(String(priceValue));
                if (parsed) {
                  if (item.priceCurrency) {
                    parsed.currency = item.priceCurrency;
                  }
                  debug('[alensa]', `[Alensa Adapter] Found price in Offer: ${parsed.numeric} ${parsed.currency}`);
                  return parsed;
                }
              }
            }
          }
        } catch (e) {
          debug('[alensa]', `[Alensa Adapter] Failed to parse JSON-LD: ${e.message}`);
        }
      }
    } catch (e) {
      debug('[alensa]', `[Alensa Adapter] Error extracting WebPage JSON-LD: ${e.message}`);
    }

    return null;
  }

  /**
   * Extract product image
   * @returns {string|null} Image URL or null
   */
  extractImage() {
    const imageSelectors = [
      '#main-image',
      '#main-image-container img',
      '[itemprop="image"]',
      '.product-image img'
    ];

    for (const selector of imageSelectors) {
      const element = this.querySelector(selector);
      if (element) {
        const imageUrl = element.src ||
                        element.getAttribute('data-src') ||
                        element.getAttribute('href');
        if (imageUrl && !imageUrl.startsWith('data:')) {
          debug('[alensa]', `[Alensa Adapter] ✓ Extracted image: ${imageUrl}`);
          return imageUrl;
        }
      }
    }

    debug('[alensa]', '[Alensa Adapter] ✗ No valid image found');
    return null;
  }
}
