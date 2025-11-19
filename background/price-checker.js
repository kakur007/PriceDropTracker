import browser from '../utils/browser-polyfill.js';

/**
 * Price Checker - Background price checking orchestration
 *
 * Handles:
 * - Periodic checking of all tracked products
 * - Individual product price checks
 * - Priority-based checking (check older products first)
 * - Batch processing with delays
 * - Price comparison and change detection
 * - Self-contained HTML parsing (no content-script dependencies)
 */

import { fetchHTML } from '../utils/fetch-helper.js';
import { StorageManager } from './storage-manager.js';
import { isUrlSupportedOrPermitted } from '../utils/domain-validator.js';
import { parsePrice } from '../utils/currency-parser.js';

/**
 * Derive expected currency from domain
 * This ensures currency is always correct even if initially detected wrong
 * @param {string} domain - Domain like 'www.amazon.co.uk'
 * @returns {string|null} Expected currency code or null
 */
function getExpectedCurrencyFromDomain(domain) {
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();

  // Amazon domains
  const amazonCurrencies = {
    'amazon.com': 'USD',
    'amazon.co.uk': 'GBP',
    'amazon.de': 'EUR',
    'amazon.fr': 'EUR',
    'amazon.it': 'EUR',
    'amazon.es': 'EUR',
    'amazon.ca': 'CAD',
    'amazon.com.au': 'AUD',
    'amazon.co.jp': 'JPY',
    'amazon.in': 'INR',
    'amazon.com.mx': 'MXN',
    'amazon.com.br': 'BRL',
    'amazon.nl': 'EUR',
    'amazon.se': 'SEK'
  };

  // eBay domains
  const ebayCurrencies = {
    'ebay.com': 'USD',
    'ebay.co.uk': 'GBP',
    'ebay.de': 'EUR',
    'ebay.fr': 'EUR',
    'ebay.it': 'EUR',
    'ebay.es': 'EUR',
    'ebay.ca': 'CAD',
    'ebay.com.au': 'AUD'
  };

  // Check Amazon
  for (const [domain, currency] of Object.entries(amazonCurrencies)) {
    if (cleanDomain.includes(domain)) {
      return currency;
    }
  }

  // Check eBay
  for (const [domain, currency] of Object.entries(ebayCurrencies)) {
    if (cleanDomain.includes(domain)) {
      return currency;
    }
  }

  // Target is always USD
  if (cleanDomain.includes('target.com')) return 'USD';

  // Walmart is always USD
  if (cleanDomain.includes('walmart.com')) return 'USD';

  return null; // Let currency parser auto-detect
}

/**
 * Parse price string with context
 * Uses the robust currency parser to avoid "two brains" problem
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
    console.warn('[PriceChecker] Error parsing price with currency-parser:', error);
    return null;
  }
}

/**
 * Extract price from parsed HTML document (same logic as offscreen.js)
 * @param {Document} doc - Parsed DOM document
 * @param {Object} contextData - Context information (domain, locale, currency)
 * @returns {Object} - { success: boolean, price: number, detectionMethod: string }
 */
function extractPriceFromDocument(doc, contextData = {}) {
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

      // Amazon
      { sel: '.a-price .a-offscreen', attr: 'textContent' },
      { sel: '.a-price-whole', attr: 'textContent' }, // Will be combined with fraction
      { sel: '#priceblock_ourprice', attr: 'textContent' },

      // eBay - IMPORTANT: Use textContent, not content attribute (which has price in cents)
      { sel: '.x-price-primary [itemprop="price"]', attr: 'textContent' },
      { sel: '.x-price-primary span', attr: 'textContent' },
      { sel: '#prcIsum', attr: 'textContent' },
      { sel: '#mm-saleDscPrc', attr: 'textContent' },

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
}

/**
 * Ensures the offscreen document is created and ready (Manifest V3 only)
 * @returns {Promise<void>}
 */
async function setupOffscreenDocument() {
  // Offscreen API only available in Manifest V3
  if (!browser.runtime.getContexts || !browser.offscreen) {
    console.log('[PriceChecker] Offscreen API not available (using fallback parser)');
    return;
  }

  try {
    // Check if offscreen document already exists
    const existingContexts = await browser.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length > 0) {
      return; // Already exists
    }

    // Create the offscreen document
    await browser.offscreen.createDocument({
      url: 'background/offscreen.html',
      reasons: ['DOM_PARSER'],
      justification: 'Parse HTML to extract product prices in service worker context'
    });

    console.log('[PriceChecker] Offscreen document created');
  } catch (error) {
    console.warn('[PriceChecker] Could not create offscreen document:', error);
  }
}

/**
 * Parse HTML using the offscreen document or fallback parser
 * @param {string} html - The HTML string to parse
 * @param {Object} contextData - Context information (domain, locale, currency)
 * @returns {Promise<Object>} - Parsed price data
 */
async function parseHTMLForPrice(html, contextData = {}) {
  try {
    // Try offscreen document first (Manifest V3 Chrome)
    if (browser.offscreen) {
      try {
        await setupOffscreenDocument();

        // Add small delay to ensure offscreen document is fully initialized
        await new Promise(resolve => setTimeout(resolve, 50));

        // Send HTML to offscreen document for parsing with context
        const response = await browser.runtime.sendMessage({
          type: 'PARSE_HTML',
          html,
          contextData
        });

        // Check if we got a valid response (not undefined and has expected structure)
        if (response && typeof response === 'object' && 'success' in response) {
          if (response.success) {
            console.log('[PriceChecker] Successfully parsed via offscreen document');
            return response;
          } else {
            console.warn('[PriceChecker] Offscreen parsing failed:', response.error);
          }
        } else {
          console.warn('[PriceChecker] Offscreen document did not respond or returned invalid response');
        }
      } catch (offscreenError) {
        console.warn('[PriceChecker] Offscreen document error:', offscreenError.message);
        // Fall through to DOMParser fallback
      }
    }

    // Fallback for Manifest V2 (Firefox) - Use DOMParser directly
    // Background pages have access to DOM APIs
    console.log('[PriceChecker] Using DOMParser fallback (Manifest V2 or offscreen failed)');

    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Extract price from the parsed document with context
      return extractPriceFromDocument(doc, contextData);
    }

    // If no parser available, try to extract from raw HTML using regex as last resort
    console.warn('[PriceChecker] No HTML parser available - using regex extraction');
    return extractPriceFromRawHTML(html, contextData);

  } catch (error) {
    console.error('[PriceChecker] Error in parseHTMLForPrice:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract price from raw HTML using regex (last resort fallback)
 * @param {string} html - Raw HTML
 * @param {Object} contextData - Context data
 * @returns {Object} - Parse result
 */
function extractPriceFromRawHTML(html, contextData) {
  console.log('[PriceChecker] Attempting regex-based price extraction...');

  // Try to find Schema.org JSON-LD in raw HTML
  const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const schema = JSON.parse(match[1]);
      const items = schema['@graph'] || (Array.isArray(schema) ? schema : [schema]);

      for (const item of items) {
        if (item['@type'] === 'Product' && item.offers) {
          const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
          for (const offer of offers) {
            const priceString = offer.price || offer.lowPrice;
            if (priceString) {
              const price = parseNumericPrice(String(priceString), contextData);
              if (price !== null) {
                console.log('[PriceChecker] ✓ Extracted price via regex:schema.org:', price);
                return {
                  success: true,
                  price: price,
                  detectionMethod: 'regex:schema.org'
                };
              }
            }
          }
        }
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  }

  // Try to extract from meta tags
  const metaPatterns = [
    /<meta[^>]*property="og:price:amount"[^>]*content="([^"]+)"[^>]*>/i,
    /<meta[^>]*content="([^"]+)"[^>]*property="og:price:amount"[^>]*>/i,
    /<meta[^>]*property="product:price:amount"[^>]*content="([^"]+)"[^>]*>/i,
    /<meta[^>]*content="([^"]+)"[^>]*property="product:price:amount"[^>]*>/i,
    /<meta[^>]*itemprop="price"[^>]*content="([^"]+)"[^>]*>/i,
    /<meta[^>]*content="([^"]+)"[^>]*itemprop="price"[^>]*>/i
  ];

  for (const pattern of metaPatterns) {
    const metaMatch = html.match(pattern);
    if (metaMatch && metaMatch[1]) {
      const price = parseNumericPrice(metaMatch[1], contextData);
      if (price !== null) {
        console.log('[PriceChecker] ✓ Extracted price via regex:meta tag:', price);
        return {
          success: true,
          price: price,
          detectionMethod: 'regex:meta'
        };
      }
    }
  }

  // Try to extract from common price element patterns (text content only, not attributes)
  const priceElementPatterns = [
    // SportsDirect Specific (looks for ID)
    /<span[^>]*id="lblSellingPrice"[^>]*>([^<]+)<\/span>/i,

    // Booztlet Specific (looks for class structure)
    // Matches: <span class="price current-price">12.34 &euro;</span>
    /<span[^>]*class="[^"]*current-price[^"]*"[^>]*>[\s\S]*?([\d\.,\s]+)/i,

    // Amazon offscreen
    /<span class="a-offscreen">([^<]+)<\/span>/i,

    // eBay - multiple patterns for different layouts
    /<span[^>]*class="[^"]*x-price-primary[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
    /<div[^>]*class="[^"]*x-price-primary[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
    /<span[^>]*id="prcIsum"[^>]*>([^<]+)<\/span>/i,

    // Target
    /<span[^>]*data-test="product-price"[^>]*>([^<]+)<\/span>/i,
    /<div[^>]*data-test="product-price"[^>]*>([^<]+)<\/div>/i,

    // Zalando
    /<[^>]*data-testid="price"[^>]*>([^<]+)<\//i,
    /<[^>]*class="[^"]*priceNow[^"]*"[^>]*>([^<]+)<\//i,

    // WooCommerce (GoGoNano, etc.)
    /<span[^>]*class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>[\s\S]*?<bdi>([^<]+)<\/bdi>/i,
    /<p[^>]*class="[^"]*price[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
    /<ins[^>]*>[\s\S]*?<span[^>]*class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>([^<]+)<\/span>/i,

    // Generic price selectors (broader patterns)
    /<div[^>]*class="[^"]*product[_-]price[^"]*"[^>]*>[\s\S]{0,200}?([€$£¥₹₽][\d\s,\.]+)/i,
    /<span[^>]*class="[^"]*(?:current|sale)[_-]?price[^"]*"[^>]*>([^<]+)<\/span>/i,
    /<[^>]*class="[^"]*price[^"]*"[^>]*>([^<]+)</i
  ];

  for (const pattern of priceElementPatterns) {
    const elementMatch = html.match(pattern);
    if (elementMatch && elementMatch[1]) {
      // Extract just the text content, remove HTML entities and extra whitespace
      const text = elementMatch[1]
        .replace(/&[a-z]+;/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (text && text.length > 0 && text.length < 50) { // Sanity check
        const price = parseNumericPrice(text, contextData);
        if (price !== null && price > 0 && price < 1000000) { // Sanity check
          console.log('[PriceChecker] ✓ Extracted price via regex:element:', price, 'from text:', text.substring(0, 30));
          return {
            success: true,
            price: price,
            detectionMethod: 'regex:element'
          };
        }
      }
    }
  }

  console.warn('[PriceChecker] ❌ Regex extraction failed - no price found');
  return {
    success: false,
    error: 'Could not parse HTML - no parser available and regex extraction failed'
  };
}

/**
 * Price check result types
 */
const PriceCheckResult = {
  SUCCESS: 'success',
  NO_CHANGE: 'no_change',
  PRICE_DROP: 'price_drop',
  PRICE_INCREASE: 'price_increase',
  CURRENCY_CHANGE: 'currency_change',
  OUT_OF_STOCK: 'out_of_stock',
  ERROR: 'error',
  NOT_FOUND: 'not_found'
};

/**
 * Check all tracked products
 * Processes products in priority order (oldest first)
 *
 * @param {Object} options - Check options
 * @param {number} options.batchSize - Number of products to check in one batch (default: 10)
 * @param {number} options.delayBetweenChecks - Delay between individual checks in ms (default: 2000)
 * @param {number} options.maxAge - Only check products older than this (in ms, default: 1 hour)
 * @returns {Promise<Object>} - Check summary
 */
async function checkAllProducts(options = {}) {
  const {
    batchSize = 10,
    delayBetweenChecks = 2000,
    maxAge = 60 * 60 * 1000 // 1 hour default
  } = options;

  console.log('[PriceChecker] Starting check for all tracked products...');

  try {
    // Get all tracked products
    const allProductsObj = await StorageManager.getAllProducts();
    const allProducts = Object.values(allProductsObj);

    if (allProducts.length === 0) {
      console.log('[PriceChecker] No products to check.');
      return {
        total: 0,
        checked: 0,
        skipped: 0,
        success: 0,
        errors: 0,
        priceDrops: 0,
        priceIncreases: 0,
        details: []
      };
    }

    console.log(`[PriceChecker] Found ${allProducts.length} tracked products.`);

    // Filter products that need checking (based on lastChecked timestamp)
    const now = Date.now();
    const productsToCheck = allProducts.filter(product => {
      const timeSinceLastCheck = now - (product.tracking?.lastChecked || 0);
      return timeSinceLastCheck >= maxAge;
    });

    console.log(`[PriceChecker] ${productsToCheck.length} products need checking (older than ${maxAge / 1000}s).`);

    if (productsToCheck.length === 0) {
      return {
        total: allProducts.length,
        checked: 0,
        skipped: allProducts.length,
        success: 0,
        errors: 0,
        priceDrops: 0,
        priceIncreases: 0,
        details: []
      };
    }

    // Sort by priority (oldest lastChecked first)
    productsToCheck.sort((a, b) => {
      const aLastChecked = a.tracking?.lastChecked || 0;
      const bLastChecked = b.tracking?.lastChecked || 0;
      return aLastChecked - bLastChecked;
    });

    const results = {
      total: allProducts.length,
      checked: 0,
      skipped: allProducts.length - productsToCheck.length,
      success: 0,
      errors: 0,
      priceDrops: 0,
      priceIncreases: 0,
      details: [] // Store detailed results for each check
    };

    // Loop through all products in chunks
    for (let i = 0; i < productsToCheck.length; i += batchSize) {
      const batch = productsToCheck.slice(i, i + batchSize);
      console.log(`[PriceChecker] Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(productsToCheck.length/batchSize)} (${batch.length} products)...`);

      // CRITICAL: Sequential checking with random delays to avoid bot detection
      // Firing 10 simultaneous requests from same IP = instant bot flag by Amazon/Cloudflare
      // This is slower but prevents IP bans and 503 errors
      for (const product of batch) {
        try {
          const result = await checkSingleProduct(product.productId);

          results.checked++;

          // Store detailed result
          results.details.push({
            productId: product.productId,
            ...result
          });

          if (result.status === PriceCheckResult.SUCCESS || result.status === PriceCheckResult.NO_CHANGE) {
            results.success++;
          } else if (result.status === PriceCheckResult.ERROR) {
            results.errors++;
          }

          if (result.status === PriceCheckResult.PRICE_DROP) {
            results.priceDrops++;
          } else if (result.status === PriceCheckResult.PRICE_INCREASE) {
            results.priceIncreases++;
          }

        } catch (error) {
          console.error(`[PriceChecker] Error checking product ${product.productId}:`, error);
          results.checked++;
          results.errors++;
          results.details.push({
            productId: product.productId,
            status: PriceCheckResult.ERROR,
            error: error.message
          });
        }

        // Random delay between 2-5 seconds to appear human
        // Avoids rate limiting and bot detection
        if (delayBetweenChecks > 0) {
          const randomDelay = Math.floor(Math.random() * 3000) + delayBetweenChecks;
          console.log(`[PriceChecker] Waiting ${(randomDelay / 1000).toFixed(1)}s before next check...`);
          await new Promise(resolve => setTimeout(resolve, randomDelay));
        }
      }

      // Larger delay between batches to be safer
      if (i + batchSize < productsToCheck.length) {
        console.log('[PriceChecker] Batch complete, waiting 5s before next batch...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log(`[PriceChecker] All batches complete: ${results.success} successful, ${results.errors} errors, ${results.priceDrops} drops, ${results.priceIncreases} increases.`);

    return results;

  } catch (error) {
    console.error('[PriceChecker] Error in checkAllProducts:', error);
    throw error;
  }
}

/**
 * Check a single product's current price
 *
 * @param {string} productId - Product ID to check
 * @returns {Promise<Object>} - Check result
 */
async function checkSingleProduct(productId) {
  console.log(`[PriceChecker] Checking product: ${productId}`);

  try {
    // Get product from storage
    const product = await StorageManager.getProduct(productId);

    if (!product) {
      console.warn(`[PriceChecker] Product not found: ${productId}`);
      return {
        status: PriceCheckResult.NOT_FOUND,
        error: 'Product not found in storage'
      };
    }

    // Check if domain is supported or has permission
    const hasPermission = await isUrlSupportedOrPermitted(product.url);
    if (!hasPermission) {
      console.warn(`[PriceChecker] No permission for domain, skipping: ${product.url}`);

      // Mark product as stale (no permission)
      product.tracking = product.tracking || {};
      product.tracking.failedChecks = (product.tracking.failedChecks || 0) + 1;
      product.tracking.lastChecked = Date.now();
      product.tracking.status = 'no_permission';

      await StorageManager.saveProduct(product);

      return {
        status: PriceCheckResult.ERROR,
        error: 'No permission for this domain (grant permission in extension settings)'
      };
    }

    // Fetch the product page
    console.log(`[PriceChecker] Fetching: ${product.url}`);
    const html = await fetchHTML(product.url, {
      maxRetries: 2,
      timeout: 15000
    });

    // Prepare context data for robust price parsing
    // Use domain-derived currency to fix initial detection errors
    const derivedCurrency = getExpectedCurrencyFromDomain(product.domain);
    const contextData = {
      domain: product.domain,
      locale: product.price?.locale,
      expectedCurrency: derivedCurrency || product.price?.currency
    };

    // Log if currency was corrected
    if (derivedCurrency && product.price?.currency && derivedCurrency !== product.price.currency) {
      console.warn(`[PriceChecker] Currency corrected from ${product.price.currency} to ${derivedCurrency} based on domain ${product.domain}`);
    }

    // Parse the HTML using offscreen document with context
    console.log(`[PriceChecker] Parsing HTML for price with context:`, contextData);
    const parseResult = await parseHTMLForPrice(html, contextData);

    // Check if parsing was successful
    if (!parseResult.success || parseResult.price === null) {
      console.warn(`[PriceChecker] Could not extract price for ${productId}`);

      // Update failed checks counter
      product.tracking = product.tracking || {};
      product.tracking.failedChecks = (product.tracking.failedChecks || 0) + 1;
      product.tracking.lastChecked = Date.now();

      if (product.tracking.failedChecks >= 3) {
        product.tracking.status = 'stale';
      }

      await StorageManager.saveProduct(product);

      return {
        status: PriceCheckResult.ERROR,
        error: parseResult.error || 'Could not extract price from page'
      };
    }

    const newPrice = parseResult.price;
    const detectionMethod = parseResult.detectionMethod;

    console.log(`[PriceChecker] New price detected: ${newPrice} (via ${detectionMethod})`);

    // Compare with current price
    const oldPrice = product.price.numeric;

    // Check for no significant change (less than 1 cent)
    if (Math.abs(oldPrice - newPrice) < 0.01) {
      console.log(`[PriceChecker] Price unchanged for ${productId}`);

      // Update timestamp and reset failed checks
      product.tracking = product.tracking || {};
      product.tracking.lastChecked = Date.now();
      product.tracking.failedChecks = 0;
      product.tracking.status = 'active';

      await StorageManager.saveProduct(product);

      return {
        status: PriceCheckResult.NO_CHANGE,
        price: newPrice
      };
    }

    // Reset failed checks counter on successful price extraction
    product.tracking = product.tracking || {};
    product.tracking.failedChecks = 0;
    product.tracking.status = 'active';
    product.tracking.lastChecked = Date.now();

    // Calculate price change
    const priceDiff = newPrice - oldPrice;
    const priceChangePercent = (priceDiff / oldPrice) * 100;

    console.log(`[PriceChecker] Price change: ${priceDiff.toFixed(2)} (${priceChangePercent.toFixed(2)}%)`);

    // Update product price using storage manager
    await StorageManager.updateProductPrice(productId, {
      ...product.price,
      numeric: newPrice
    });

    // Determine result status
    let status = PriceCheckResult.SUCCESS;
    if (priceDiff < 0) {
      status = PriceCheckResult.PRICE_DROP;
    } else if (priceDiff > 0) {
      status = PriceCheckResult.PRICE_INCREASE;
    }

    return {
      status,
      oldPrice,
      newPrice,
      change: priceDiff,
      changePercent: priceChangePercent,
      detectionMethod
    };

  } catch (error) {
    console.error(`[PriceChecker] Error checking product ${productId}:`, error);

    // Try to update failed checks even on error
    try {
      const product = await StorageManager.getProduct(productId);
      if (product) {
        product.tracking = product.tracking || {};
        product.tracking.failedChecks = (product.tracking.failedChecks || 0) + 1;
        product.tracking.lastChecked = Date.now();

        if (product.tracking.failedChecks >= 3) {
          product.tracking.status = 'stale';
        }

        await StorageManager.saveProduct(product);
      }
    } catch (updateError) {
      console.error(`[PriceChecker] Failed to update error status:`, updateError);
    }

    return {
      status: PriceCheckResult.ERROR,
      error: error.message
    };
  }
}

/**
 * Get products that need checking based on age
 * @param {number} maxAge - Maximum age since last check (ms)
 * @returns {Promise<Array>} - Products that need checking
 */
async function getProductsNeedingCheck(maxAge = 60 * 60 * 1000) {
  const allProductsObj = await StorageManager.getAllProducts();
  const allProducts = Object.values(allProductsObj);
  const now = Date.now();

  return allProducts.filter(product => {
    const timeSinceLastCheck = now - (product.tracking?.lastChecked || 0);
    return timeSinceLastCheck >= maxAge;
  });
}

/**
 * Force check a product immediately (bypasses age check)
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} - Check result
 */
async function forceCheckProduct(productId) {
  console.log(`[PriceChecker] Force checking product: ${productId}`);
  return checkSingleProduct(productId);
}

// Export functions
export {
  checkAllProducts,
  checkSingleProduct,
  getProductsNeedingCheck,
  forceCheckProduct,
  PriceCheckResult
};
