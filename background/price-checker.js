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
 * @returns {Promise<Object>} - Parsed price data
 */
async function parseHTMLForPrice(html) {
  try {
    // Try offscreen document first (Manifest V3)
    if (browser.offscreen && browser.runtime.getContexts) {
      await setupOffscreenDocument();

      // Send HTML to offscreen document for parsing
      const response = await browser.runtime.sendMessage({
        type: 'PARSE_HTML',
        html
      });

      return response;
    }

    // Fallback for Manifest V2 (Firefox) - Use DOMParser directly
    // Background pages have access to DOM APIs
    console.log('[PriceChecker] Using DOMParser fallback (Manifest V2)');

    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      return {
        success: true,
        document: doc,
        // Make document serializable for the response
        html: html
      };
    }

    // If no parser available, return raw HTML
    console.warn('[PriceChecker] No HTML parser available');
    return {
      success: true,
      html: html
    };

  } catch (error) {
    console.error('[PriceChecker] Error in parseHTMLForPrice:', error);
    return {
      success: false,
      error: error.message
    };
  }
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

    // Process in batches
    const batch = productsToCheck.slice(0, batchSize);
    console.log(`[PriceChecker] Processing batch of ${batch.length} products...`);

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

    for (const product of batch) {
      try {
        const result = await checkSingleProduct(product.productId);

        // Store detailed result
        results.details.push({
          productId: product.productId,
          ...result
        });

        results.checked++;

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

        // Delay between checks to avoid rate limiting
        if (delayBetweenChecks > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenChecks));
        }

      } catch (error) {
        console.error(`[PriceChecker] Error checking product ${product.productId}:`, error);
        results.errors++;
        results.details.push({
          productId: product.productId,
          status: PriceCheckResult.ERROR,
          error: error.message
        });
      }
    }

    console.log(`[PriceChecker] Batch complete: ${results.success} successful, ${results.errors} errors, ${results.priceDrops} drops, ${results.priceIncreases} increases.`);

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

    // Parse the HTML using offscreen document
    console.log(`[PriceChecker] Parsing HTML for price...`);
    const parseResult = await parseHTMLForPrice(html);

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
