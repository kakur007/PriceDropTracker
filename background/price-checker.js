/**
 * Price Checker - Background price checking orchestration
 *
 * Handles:
 * - Periodic checking of all tracked products
 * - Individual product price checks
 * - Priority-based checking (check older products first)
 * - Batch processing with delays
 * - Price comparison and change detection
 * - Integration with site adapters
 */

import { fetchHTML } from '../utils/fetch-helper.js';
import { StorageManager } from './storage-manager.js';
import { getAdapter } from '../content-scripts/site-adapters/base-adapter.js';
import { ProductDetector } from '../content-scripts/product-detector.js';
import { parseCurrency } from '../utils/currency-parser.js';

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
    const allProducts = await StorageManager.getAllProducts();

    if (allProducts.length === 0) {
      console.log('[PriceChecker] No products to check.');
      return {
        total: 0,
        checked: 0,
        skipped: 0,
        success: 0,
        errors: 0,
        priceDrops: 0,
        priceIncreases: 0
      };
    }

    console.log(`[PriceChecker] Found ${allProducts.length} tracked products.`);

    // Filter products that need checking (based on lastChecked timestamp)
    const now = Date.now();
    const productsToCheck = allProducts.filter(product => {
      const timeSinceLastCheck = now - (product.lastChecked || 0);
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
        priceIncreases: 0
      };
    }

    // Sort by priority (oldest lastChecked first)
    productsToCheck.sort((a, b) => {
      const aLastChecked = a.lastChecked || 0;
      const bLastChecked = b.lastChecked || 0;
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
      results: []
    };

    // Check each product in the batch
    for (const product of batch) {
      try {
        const result = await checkSingleProduct(product.id);
        results.checked++;

        if (result.status === PriceCheckResult.SUCCESS ||
            result.status === PriceCheckResult.NO_CHANGE ||
            result.status === PriceCheckResult.PRICE_DROP ||
            result.status === PriceCheckResult.PRICE_INCREASE) {
          results.success++;
        }

        if (result.status === PriceCheckResult.PRICE_DROP) {
          results.priceDrops++;
        }

        if (result.status === PriceCheckResult.PRICE_INCREASE) {
          results.priceIncreases++;
        }

        if (result.status === PriceCheckResult.ERROR ||
            result.status === PriceCheckResult.NOT_FOUND) {
          results.errors++;
        }

        results.results.push({
          productId: product.id,
          title: product.title,
          ...result
        });

      } catch (error) {
        console.error(`[PriceChecker] Error checking product ${product.id}:`, error);
        results.checked++;
        results.errors++;
        results.results.push({
          productId: product.id,
          title: product.title,
          status: PriceCheckResult.ERROR,
          error: error.message
        });
      }

      // Delay between checks to be respectful
      if (delayBetweenChecks > 0 && batch.indexOf(product) < batch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenChecks));
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

    // Fetch the product page
    console.log(`[PriceChecker] Fetching: ${product.url}`);
    const html = await fetchHTML(product.url, {
      maxRetries: 2,
      timeout: 15000
    });

    // Parse the HTML into a document
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Try to detect product info using site adapter
    let detectedProduct = null;
    const hostname = new URL(product.url).hostname;

    try {
      const adapter = getAdapter(doc, product.url);
      if (adapter) {
        console.log(`[PriceChecker] Using ${adapter.constructor.name} for ${hostname}`);
        detectedProduct = adapter.detectProduct(doc, product.url);
      }
    } catch (adapterError) {
      console.warn(`[PriceChecker] Adapter failed, falling back to generic detection:`, adapterError.message);
    }

    // Fallback to generic detection if adapter failed
    if (!detectedProduct) {
      console.log(`[PriceChecker] Using generic ProductDetector`);
      const detector = new ProductDetector();
      detectedProduct = detector.detectProduct(doc, product.url);
    }

    // Check if we found product info
    if (!detectedProduct || !detectedProduct.price) {
      console.warn(`[PriceChecker] Could not detect price for ${productId}`);

      // Update lastChecked timestamp even if we couldn't get price
      product.lastChecked = Date.now();
      await StorageManager.saveProduct(product);

      return {
        status: PriceCheckResult.ERROR,
        error: 'Could not detect price on page'
      };
    }

    // Parse the new price
    const newPriceData = parseCurrency(detectedProduct.price, {
      url: product.url,
      locale: detectedProduct.locale
    });

    if (!newPriceData || newPriceData.amount === null) {
      console.warn(`[PriceChecker] Could not parse price: ${detectedProduct.price}`);

      product.lastChecked = Date.now();
      await StorageManager.saveProduct(product);

      return {
        status: PriceCheckResult.ERROR,
        error: 'Could not parse price'
      };
    }

    console.log(`[PriceChecker] New price detected: ${newPriceData.amount} ${newPriceData.currency}`);

    // Compare with current price
    const oldPrice = product.currentPrice;
    const newPrice = newPriceData.amount;

    // Check if currency changed (problematic!)
    if (newPriceData.currency !== product.currency) {
      console.warn(`[PriceChecker] Currency changed from ${product.currency} to ${newPriceData.currency}`);

      // Update product but don't add to history
      product.currentPrice = newPrice;
      product.currency = newPriceData.currency;
      product.lastChecked = Date.now();
      await StorageManager.saveProduct(product);

      return {
        status: PriceCheckResult.CURRENCY_CHANGE,
        oldCurrency: product.currency,
        newCurrency: newPriceData.currency,
        newPrice: newPrice
      };
    }

    // Check for out of stock
    if (detectedProduct.availability === 'OutOfStock' || detectedProduct.availability === 'Discontinued') {
      console.log(`[PriceChecker] Product is out of stock: ${productId}`);

      product.lastChecked = Date.now();
      product.availability = detectedProduct.availability;
      await StorageManager.saveProduct(product);

      return {
        status: PriceCheckResult.OUT_OF_STOCK,
        availability: detectedProduct.availability
      };
    }

    // Calculate price change
    const priceDiff = newPrice - oldPrice;
    const priceChangePercent = (priceDiff / oldPrice) * 100;

    console.log(`[PriceChecker] Price change: ${priceDiff.toFixed(2)} (${priceChangePercent.toFixed(2)}%)`);

    // Update product data
    product.currentPrice = newPrice;
    product.lastChecked = Date.now();
    product.availability = detectedProduct.availability || 'InStock';

    // Add to price history if price changed significantly (>0.5%)
    if (Math.abs(priceChangePercent) >= 0.5) {
      if (!product.priceHistory) {
        product.priceHistory = [];
      }

      product.priceHistory.push({
        price: newPrice,
        timestamp: Date.now()
      });

      // Keep only last 30 entries
      if (product.priceHistory.length > 30) {
        product.priceHistory = product.priceHistory.slice(-30);
      }

      console.log(`[PriceChecker] Added to price history. Total entries: ${product.priceHistory.length}`);
    }

    // Update title and image if available
    if (detectedProduct.title) {
      product.title = detectedProduct.title;
    }
    if (detectedProduct.image) {
      product.image = detectedProduct.image;
    }

    // Save updated product
    await StorageManager.saveProduct(product);

    // Determine result status
    let status = PriceCheckResult.NO_CHANGE;
    if (Math.abs(priceChangePercent) >= 0.5) {
      if (priceDiff < 0) {
        status = PriceCheckResult.PRICE_DROP;
      } else {
        status = PriceCheckResult.PRICE_INCREASE;
      }
    }

    return {
      status,
      oldPrice,
      newPrice,
      priceDiff,
      priceChangePercent: parseFloat(priceChangePercent.toFixed(2)),
      currency: product.currency,
      title: product.title
    };

  } catch (error) {
    console.error(`[PriceChecker] Error checking product ${productId}:`, error);

    // Try to update lastChecked even on error
    try {
      const product = await StorageManager.getProduct(productId);
      if (product) {
        product.lastChecked = Date.now();
        await StorageManager.saveProduct(product);
      }
    } catch (updateError) {
      console.error(`[PriceChecker] Could not update lastChecked:`, updateError);
    }

    return {
      status: PriceCheckResult.ERROR,
      error: error.message
    };
  }
}

/**
 * Get products that need checking
 * Returns products sorted by priority (oldest lastChecked first)
 *
 * @param {number} maxAge - Only return products older than this (in ms, default: 6 hours)
 * @param {number} limit - Maximum number of products to return
 * @returns {Promise<Array>} - Array of products needing check
 */
async function getProductsNeedingCheck(maxAge = 6 * 60 * 60 * 1000, limit = null) {
  const allProducts = await StorageManager.getAllProducts();
  const now = Date.now();

  const productsNeedingCheck = allProducts
    .filter(product => {
      const timeSinceLastCheck = now - (product.lastChecked || 0);
      return timeSinceLastCheck >= maxAge;
    })
    .sort((a, b) => {
      const aLastChecked = a.lastChecked || 0;
      const bLastChecked = b.lastChecked || 0;
      return aLastChecked - bLastChecked;
    });

  if (limit) {
    return productsNeedingCheck.slice(0, limit);
  }

  return productsNeedingCheck;
}

/**
 * Force check a product immediately (ignoring age)
 *
 * @param {string} productId - Product ID to check
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
