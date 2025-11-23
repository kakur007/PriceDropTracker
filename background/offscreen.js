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

        const priceString = offer.price || offer.lowPrice;
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
        const items = schema['@graph'] || (Array.isArray(schema) ? schema : [schema]);

        for (const item of items) {
          // Handle Product with offers
          if (item['@type'] === 'Product' && item.offers) {
            const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
            newPrice = extractPriceFromOffers(offers, contextData);
            if (newPrice !== null) {
              detectionMethod = 'schema.org';
              break;
            }
          }

          // BOOZT FIX: Handle ProductGroup with hasVariant
          if (item['@type'] === 'ProductGroup' && item.hasVariant) {
            debug('[offscreen]', 'Found ProductGroup, checking variants...');
            const variants = Array.isArray(item.hasVariant) ? item.hasVariant : [item.hasVariant];

            for (const variant of variants) {
              if (variant['@type'] === 'Product' && variant.offers) {
                const offers = Array.isArray(variant.offers) ? variant.offers : [variant.offers];
                newPrice = extractPriceFromOffers(offers, contextData);
                if (newPrice !== null) {
                  detectionMethod = 'schema.org';
                  break;
                }
              }
            }
          }

          if (newPrice !== null) break;
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
      if (newPrice !== null) break;
    }

    // 2. If Schema.org fails, try common meta tags and selectors
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
