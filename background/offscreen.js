import browser from '../utils/browser-polyfill.js';

/**
 * Offscreen Document - DOM Parsing for Service Worker
 *
 * This document runs in a hidden HTML context where DOMParser is available.
 * It receives HTML strings from the service worker, parses them, and extracts prices.
 */

/**
 * Simple price parser
 * @param {string} priceString - The raw text to parse
 * @returns {number|null} The numeric price or null
 */
function simpleParsePrice(priceString) {
  if (!priceString || typeof priceString !== 'string') return null;

  // Remove currency symbols, letters, and whitespace, except for . and ,
  const numericString = priceString.replace(/[^0-9.,]/g, '').trim();

  if (!numericString) return null;

  // Handle European format (e.g., "1.299,99")
  if (numericString.includes(',') && numericString.includes('.')) {
    if (numericString.lastIndexOf(',') > numericString.lastIndexOf('.')) {
      // Comma is the decimal separator
      return parseFloat(numericString.replace(/\./g, '').replace(',', '.'));
    }
  }

  // Handle comma as decimal separator (e.g., "1299,99")
  if (numericString.includes(',')) {
    const parts = numericString.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      return parseFloat(numericString.replace(',', '.'));
    }
  }

  // Default to parseFloat for US-style or simple numbers
  const price = parseFloat(numericString.replace(/,/g, ''));
  return isNaN(price) ? null : price;
}

/**
 * Parse HTML and extract price information
 * @param {string} html - The HTML string to parse
 * @returns {Object} - Extracted price data
 */
function parseHTMLForPrice(html) {
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
                newPrice = simpleParsePrice(String(priceString));
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
        { sel: '.a-price .a-offscreen', attr: 'textContent' }, // Amazon
        { sel: '.a-price-whole', attr: 'textContent' }, // Amazon
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
            newPrice = simpleParsePrice(priceText);
            if (newPrice !== null) {
              detectionMethod = `selector: ${sel}`;
              break;
            }
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
    const result = parseHTMLForPrice(message.html);
    sendResponse(result);
    return true; // Keep the message channel open for async response
  }
});

console.log('[Offscreen] Document initialized and ready to parse HTML');
