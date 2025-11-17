/**
 * Adapter Factory - Creates the appropriate site adapter
 *
 * This factory is separated from base-adapter.js to break circular dependencies.
 * The adapters import BaseAdapter, and this factory imports the adapters.
 */

import { AmazonAdapter } from './amazon.js';
import { EbayAdapter } from './ebay.js';
import { WalmartAdapter } from './walmart.js';
import { TargetAdapter } from './target.js';
import { BestBuyAdapter } from './bestbuy.js';

/**
 * Factory function to get the appropriate adapter for a given domain
 *
 * @param {Document} document - The DOM document
 * @param {string} url - The URL of the page
 * @returns {BaseAdapter|null} Adapter instance or null if no adapter found
 */
export function getAdapter(document, url) {
  const domain = new URL(url).hostname;

  if (domain.includes('amazon')) {
    return new AmazonAdapter(document, url);
  }

  if (domain.includes('ebay')) {
    return new EbayAdapter(document, url);
  }

  if (domain.includes('walmart')) {
    return new WalmartAdapter(document, url);
  }

  if (domain.includes('target')) {
    return new TargetAdapter(document, url);
  }

  if (domain.includes('bestbuy')) {
    return new BestBuyAdapter(document, url);
  }

  // Return null if no adapter found
  // Will fall back to generic detection in product-detector.js
  return null;
}
