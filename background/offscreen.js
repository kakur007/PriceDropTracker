import browser from '../utils/browser-polyfill.js';
import { parsePrice } from '../utils/currency-parser.js';

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
    console.warn('[Offscreen] Error parsing price with currency-parser:', error);
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

    // 1. Try to find price via Schema.org JSON-LD (most reliable)
    const schemaScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of schemaScripts) {
      try {
        const schema = JSON.parse(script.textContent);
        const items = schema['@graph'] || (Array.isArray(schema) ? schema : [schema]);

        for (const item of items) {
          if (item['@type'] === 'Product' && item.offers) {
            const offers = Array.isArray(item.offers) ? item.offers : [item.offers];

            for (const offer of offers) {
              const priceString = offer.price || offer.lowPrice;
              if (priceString) {
                newPrice = parseNumericPrice(String(priceString), contextData);
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
        { sel: '.a-price .a-offscreen', attr: 'textContent' }, // Amazon (best option)
        { sel: '[data-testid="customer-price"]', attr: 'textContent' }, // Best Buy
        { sel: '.x-price-primary span', attr: 'textContent' }, // eBay
        { sel: '#priceblock_ourprice', attr: 'textContent' }, // Amazon (old)
        { sel: '[itemprop="price"]', attr: 'content' } // Generic microdata
      ];

      for (const { sel, attr } of selectors) {
        const element = doc.querySelector(sel);
        if (element) {
          const priceText = attr === 'content' ? element.getAttribute('content') : element.textContent;
          if (priceText) {
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
    console.error('[Offscreen] Error parsing HTML:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Listen for messages from the service worker
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Offscreen] Received message:', message.type);

  if (message.type === 'PARSE_HTML') {
    const result = parseHTMLForPrice(message.html, message.contextData || {});
    sendResponse(result);
    return true; // Keep the message channel open for async response
  }
});

console.log('[Offscreen] Document initialized and ready to parse HTML');
