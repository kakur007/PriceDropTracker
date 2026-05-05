import browser from '../utils/browser-polyfill.js';
import { parsePrice } from '../utils/currency-parser.js';
import { debug, debugWarn, debugError } from '../utils/debug.js';

/**
 * Offscreen Document - DOM Parsing for Service Worker
 *
 * This document runs in a hidden HTML context where DOMParser is available.
 * It receives HTML strings from the service worker, parses them, and extracts prices.
 */

/**
 * Parse price string with context using robust currency parser
 * @param {string} priceString - The raw text to parse
 * @param {Object} contextData - Context information (domain, locale, currency)
 * @returns {number|null} The numeric price or null
 */
function parseNumericPrice(priceString, contextData = {}) {
  if (!priceString || typeof priceString !== 'string') return null;

  try {
    const parsed = parsePrice(priceString, contextData);
    return parsed ? parsed.numeric : null;
  } catch (error) {
    debugWarn('[offscreen]', '[Offscreen] Error parsing price with currency-parser:', error);
    return null;
  }
}

/**
 * Normalize Schema.org @type values to an array of strings.
 * @param {Object} item - Schema node
 * @returns {string[]} Schema type names
 */
function getSchemaTypes(item) {
  const rawType = item?.['@type'];
  if (!rawType) return [];

  return (Array.isArray(rawType) ? rawType : [rawType])
    .filter(type => typeof type === 'string')
    .map(type => type.replace(/^https?:\/\/schema\.org\//i, ''));
}

/**
 * Check if a Schema.org node has a specific type.
 * @param {Object} item - Schema node
 * @param {string} typeName - Type name, e.g. Product
 * @returns {boolean}
 */
function isSchemaType(item, typeName) {
  return getSchemaTypes(item).includes(typeName);
}

/**
 * Recursively collect Product and ProductGroup entities from JSON-LD.
 * @param {Object|Array} node - Parsed JSON-LD node
 * @param {Array} matches - Accumulator
 * @param {WeakSet<object>} seen - Cycle guard
 * @returns {Array}
 */
function findProductSchemaNodes(node, matches = [], seen = new WeakSet()) {
  if (!node || typeof node !== 'object' || seen.has(node)) {
    return matches;
  }

  seen.add(node);

  if (isSchemaType(node, 'Product') || isSchemaType(node, 'ProductGroup')) {
    matches.push(node);
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      findProductSchemaNodes(item, matches, seen);
    }
    return matches;
  }

  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') {
      findProductSchemaNodes(value, matches, seen);
    }
  }

  return matches;
}

/**
 * Normalize platform prices. Shopify stores integer minor units in product JSON.
 * @param {string|number} rawPrice - Raw price value
 * @returns {string|number}
 */
function normalizePlatformPrice(rawPrice) {
  if (typeof rawPrice !== 'number') {
    return rawPrice;
  }

  if (Number.isInteger(rawPrice) && rawPrice >= 1000) {
    return (rawPrice / 100).toFixed(2);
  }

  return rawPrice;
}

/**
 * Extract a price from embedded platform product JSON scripts.
 * @param {Document} doc - Parsed DOM document
 * @param {Object} contextData - Context information
 * @returns {number|null}
 */
function extractPriceFromEmbeddedProductJson(doc, contextData = {}) {
  const scripts = doc.querySelectorAll(
    'script[type="application/json"][id*="ProductJson" i], script[type="application/json"][id*="product" i], script[type="application/json"][data-product-json]'
  );

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent);
      const product = data.product || data;
      const variants = Array.isArray(product.variants) ? product.variants : [];
      const selectedVariant = variants.find(variant => variant.available !== false) || variants[0] || null;
      const rawPrice = selectedVariant?.price ?? product.price ?? product.price_min;

      if (!rawPrice) {
        continue;
      }

      const normalizedPrice = normalizePlatformPrice(rawPrice);
      const parsed = parseNumericPrice(String(normalizedPrice), contextData);
      if (parsed !== null) {
        return parsed;
      }
    } catch (error) {
      debugWarn('[offscreen]', '[Offscreen] Failed to parse embedded product JSON:', error.message);
    }
  }

  return null;
}

/**
 * Parse HTML and extract price information
 * @param {string} html - The HTML string to parse
 * @param {Object} contextData - Context information (domain, locale, currency)
 * @returns {Object} - Extracted price data
 */
function parseHTMLForPrice(html, contextData = {}) {
  try {
    // Parse the HTML into a document
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let newPrice = null;
    let detectionMethod = 'none';

    // Helper function to extract price from offers array
    const extractPriceFromOffers = (offers, contextData) => {
      const expectedCurrency = contextData.expectedCurrency;
      let matchingCurrencyPrice = null;
      let fallbackPrice = null;

      for (const offer of offers) {
        const offerText = JSON.stringify(offer).toLowerCase();
        if (offerText.includes('approximately') || offerText.includes('approx.') || offerText.includes('approx ')) {
          console.log('[Offscreen]', 'Skipping approximate offer in JSON-LD');
          continue;
        }

        const priceString = offer.price || offer.lowPrice || offer.highPrice;
        if (priceString) {
          const parsed = parsePrice(String(priceString), contextData);
          if (parsed && parsed.numeric !== null) {
            // CRITICAL: Use explicit priceCurrency from JSON-LD offer
            // The parser might guess wrong currency based on domain (.com = USD)
            // but JSON-LD explicitly specifies the correct currency
            if (offer.priceCurrency) {
              parsed.currency = offer.priceCurrency;
              debug('[offscreen]', `Using explicit currency from JSON-LD: ${offer.priceCurrency}`);
            }

            const offerCurrency = parsed.currency;

            if (expectedCurrency && offerCurrency !== expectedCurrency) {
              debug('[offscreen]', `Skipping offer with mismatched currency: ${offerCurrency} (expected ${expectedCurrency})`);
              if (fallbackPrice === null) {
                fallbackPrice = parsed.numeric;
              }
              continue;
            }

            if (matchingCurrencyPrice === null) {
              matchingCurrencyPrice = parsed.numeric;
              debug('[offscreen]', `Found matching currency offer: ${parsed.numeric} ${parsed.currency}`);
            }
          }
        }
      }

      return matchingCurrencyPrice !== null ? matchingCurrencyPrice : fallbackPrice;
    };

    // 1. Try to find price via Schema.org JSON-LD (most reliable)
    const schemaScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of schemaScripts) {
      try {
        const schema = JSON.parse(script.textContent);
        const items = findProductSchemaNodes(schema);

        for (const item of items) {
          // Handle Product/ProductGroup with offers. Product variants nested
          // under hasVariant are already included by findProductSchemaNodes().
          if ((isSchemaType(item, 'Product') || isSchemaType(item, 'ProductGroup')) && item.offers) {
            const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
            newPrice = extractPriceFromOffers(offers, contextData);
            if (newPrice !== null) {
              detectionMethod = 'schema.org';
              break;
            }
          }
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
      if (newPrice !== null) break;
    }

    // 2. Try embedded platform product JSON (Shopify themes, etc.)
    if (newPrice === null) {
      newPrice = extractPriceFromEmbeddedProductJson(doc, contextData);
      if (newPrice !== null) {
        detectionMethod = 'embeddedProductJson';
      }
    }

    // 3. If structured extraction fails, try common meta tags and selectors
    if (newPrice === null) {
      const selectors = [
        { sel: 'meta[property="og:price:amount"]', attr: 'content' },
        { sel: 'meta[property="product:price:amount"]', attr: 'content' },
        { sel: 'meta[itemprop="price"]', attr: 'content' },

        // Amazon
        { sel: '.a-price .a-offscreen', attr: 'textContent' },
        { sel: '.a-price-whole', attr: 'textContent' }, // Will be combined with fraction
        { sel: '#priceblock_ourprice', attr: 'textContent' },

        // eBay - IMPORTANT: Use textContent, not content attribute (which has price in cents)
        // Be specific to avoid "Approximately" prices
        { sel: '.x-price-primary [itemprop="price"]', attr: 'textContent' },
        { sel: '.x-price-primary .ux-textspans--BOLD', attr: 'textContent' },
        { sel: '#prcIsum', attr: 'textContent' },
        { sel: '#mm-saleDscPrc', attr: 'textContent' },
        { sel: '.x-price-primary span[class*="price"]', attr: 'textContent' },

        // Target
        { sel: '[data-test="product-price"]', attr: 'textContent' },
        { sel: '[data-test="product-price-current"]', attr: 'textContent' },
        { sel: '.h-text-orangeDark', attr: 'textContent' },

        // Zalando
        { sel: '[data-testid="price"]', attr: 'textContent' },
        { sel: '[class*="price"][class*="current"]', attr: 'textContent' },
        { sel: '[class*="currentPrice"]', attr: 'textContent' },

        // Best Buy
        { sel: '[data-testid="customer-price"]', attr: 'textContent' },

        // Generic fallbacks
        { sel: '[itemprop="price"]', attr: 'content' },
        { sel: '.price', attr: 'textContent' }
      ];

      for (const { sel, attr } of selectors) {
        const element = doc.querySelector(sel);
        if (element) {
          // Get price text based on specified attribute
          let priceText;
          if (attr === 'content') {
            // For microdata content attributes, try textContent first
            // because some sites (eBay) put prices in cents in content attribute
            priceText = element.textContent || element.getAttribute('content');
          } else {
            priceText = element.textContent;
          }

          if (priceText) {
            // EBAY FIX: Skip "Approximately" prices (shipping estimates, not actual prices)
            const lowerText = priceText.toLowerCase();
            if (lowerText.includes('approximately') || lowerText.includes('approx.') || lowerText.includes('approx ')) {
              debug('[offscreen]', `Skipping approximate price: ${priceText.substring(0, 50)}`);
              continue; // Skip this selector and try next one
            }

            newPrice = parseNumericPrice(priceText, contextData);
            if (newPrice !== null) {
              detectionMethod = `selector: ${sel}`;
              break;
            }
          }
        }
      }

      // Special handling for Amazon when a-offscreen is not available
      // Combine a-price-whole and a-price-fraction for complete price
      if (newPrice === null) {
        const priceWhole = doc.querySelector('.a-price-whole');
        const priceFraction = doc.querySelector('.a-price-fraction');
        if (priceWhole) {
          let combinedPrice = priceWhole.textContent.trim();
          if (priceFraction) {
            // Combine whole and fraction (e.g., "19" + "99" = "19.99")
            combinedPrice = combinedPrice + '.' + priceFraction.textContent.trim();
          }
          newPrice = parseNumericPrice(combinedPrice, contextData);
          if (newPrice !== null) {
            detectionMethod = 'selector: .a-price-whole + .a-price-fraction';
          }
        }
      }
    }

    return {
      success: newPrice !== null,
      price: newPrice,
      detectionMethod
    };

  } catch (error) {
    debugError('[offscreen]', '[Offscreen] Error parsing HTML:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Listen for messages from the service worker
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  debug('[offscreen]', '[Offscreen] Received message:', message.type);

  if (message.type === 'PARSE_HTML') {
    const result = parseHTMLForPrice(message.html, message.contextData || {});
    sendResponse(result);
    return true; // Keep the message channel open for async response
  }
});

debug('[offscreen]', '[Offscreen] Document initialized and ready to parse HTML');
