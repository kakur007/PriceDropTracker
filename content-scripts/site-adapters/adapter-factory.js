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
import { OpenCartAdapter } from './opencart.js';
import { ZalandoAdapter } from './zalando.js';
import { EtsyAdapter } from './etsy.js';
import { AliExpressAdapter } from './aliexpress.js';
import { AlensaAdapter } from './alensa.js';
import { BooztletAdapter } from './booztlet.js';
import { SportsDirectAdapter } from './sportsdirect.js';
import { ThomannAdapter } from './thomann.js';
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

  if (domain.includes('alensa')) {
    return new AlensaAdapter(document, url);
  }

  if (domain.includes('thomann')) {
    return new ThomannAdapter(document, url);
  }

  // Platform adapters (WooCommerce, OpenCart) are only used when the page
  // carries a real platform fingerprint. Their own detectProduct() checks are
  // intentionally lenient ("has an h1 and a .price") and used to hijack
  // unrelated stores, overriding correct structured data.
  if (isWooCommerce(document)) {
    const wooAdapter = new WooCommerceAdapter(document, url);
    if (wooAdapter.detectProduct()) {
      debug('[adapter-factory]', '[Adapter Factory] Detected WooCommerce site');
      wooAdapter.isPlatformAdapter = true;
      return wooAdapter;
    }
  }

  if (isOpenCart(document)) {
    const openCartAdapter = new OpenCartAdapter(document, url);
    if (openCartAdapter.detectProduct()) {
      debug('[adapter-factory]', '[Adapter Factory] Detected OpenCart site');
      openCartAdapter.isPlatformAdapter = true;
      return openCartAdapter;
    }
  }

  // Return null if no adapter found
  // Will fall back to generic detection in product-detector.js
  return null;
}

function isWooCommerce(doc) {
  const body = doc.body;
  return !!(
    body?.classList.contains('woocommerce') ||
    body?.classList.contains('woocommerce-page') ||
    doc.querySelector('.woocommerce-Price-amount, form.cart[action*="add-to-cart"], [class*="woocommerce-product"]') ||
    doc.querySelector('link[href*="/plugins/woocommerce/"], script[src*="/plugins/woocommerce/"]')
  );
}

function isOpenCart(doc) {
  if (doc.querySelector('link[href*="catalog/view/"], script[src*="catalog/view/"], a[href*="route=product/"], a[href*="route=checkout/"], #product input[name="product_id"]')) {
    return true;
  }
  const html = doc.documentElement.innerHTML;
  // hawaii.ee and similar themes expose these JS variables
  return html.includes('is_ajax_data') || html.includes('"page":"product"') || html.includes('index.php?route=');
}
