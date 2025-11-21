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
import { WooCommerceAdapter } from './woocommerce.js';
import { ZalandoAdapter } from './zalando.js';
import { EtsyAdapter } from './etsy.js';
import { AliExpressAdapter } from './aliexpress.js';
import { BooztletAdapter } from './booztlet.js';
import { SportsDirectAdapter } from './sportsdirect.js';
import { debug, debugWarn, debugError } from '../../utils/debug.js';

/**
 * Factory function to get the appropriate adapter for a given domain
 *
 * @param {Document} document - The DOM document
 * @param {string} url - The URL of the page
 * @returns {BaseAdapter|null} Adapter instance or null if no adapter found
 */
export function getAdapter(document, url) {
  const domain = new URL(url).hostname;

  // Check for specific retailer domains first
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

  if (domain.includes('zalando')) {
    return new ZalandoAdapter(document, url);
  }

  if (domain.includes('etsy')) {
    return new EtsyAdapter(document, url);
  }

  if (domain.includes('aliexpress')) {
    return new AliExpressAdapter(document, url);
  }

  // Match both boozt.com and booztlet.com
  if (domain.includes('boozt')) {
    return new BooztletAdapter(document, url);
  }

  if (domain.includes('sportsdirect')) {
    return new SportsDirectAdapter(document, url);
  }

  // Check for platform-based sites (WooCommerce, Shopify, etc.)
  // These need to be detected by page structure, not domain
  const wooAdapter = new WooCommerceAdapter(document, url);
  if (wooAdapter.detectProduct()) {
    debug('[adapter-factory]', '[Adapter Factory] Detected WooCommerce site');
    return wooAdapter;
  }

  // Return null if no adapter found
  // Will fall back to generic detection in product-detector.js
  return null;
}
