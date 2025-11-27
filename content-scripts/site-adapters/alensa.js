/**
 * Alensa Site Adapter
 * Handles price detection for Alensa.ee (contact lenses e-commerce)
 *
 * This adapter uses JSON-LD structured data extraction strategy.
 * It leverages BaseAdapter's extractPriceFromJsonLd() method for price extraction.
 */

import { BaseAdapter } from './base-adapter.js';
import { debug, debugWarn } from '../../utils/debug.js';

export class AlensaAdapter extends BaseAdapter {
  /**
   * Helper method to extract Product schema from JSON-LD
   * @returns {Object|null} Product schema object or null
   */
  getSchema() {
    try {
      const scripts = this.querySelectorAll('script[type="application/ld+json"]');

      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);

          // Handle different JSON-LD formats
          const items = data['@graph'] || (Array.isArray(data) ? data : [data]);

          for (const item of items) {
            if (item['@type'] === 'Product') {
              debug('[alensa]', '[Alensa Adapter] ✓ Found Product schema in JSON-LD');
              return item;
            }
          }
        } catch (e) {
          debugWarn('[alensa]', '[Alensa Adapter] Failed to parse JSON-LD script:', e.message);
        }
      }
    } catch (e) {
      debugWarn('[alensa]', '[Alensa Adapter] Error extracting schema:', e);
    }

    return null;
  }

  /**
   * Gets the expected currency for Alensa
   * @returns {string} Currency code
   */
  getExpectedCurrency() {
    // Alensa.ee operates in Estonia (Eurozone)
    return 'EUR';
  }

  /**
   * Detects if this is an Alensa product page
   * @returns {boolean} True if Alensa product page
   */
  detectProduct() {
    // Check domain
    const isAlensaSite = this.domain.includes('alensa.ee');
    if (!isAlensaSite) {
      return false;
    }

    // Verify we have valid Product schema
    const schema = this.getSchema();
    return schema !== null;
  }

  /**
   * Extracts the product ID (SKU) from schema
   * @returns {string|null} Product SKU or null
   */
  extractProductId() {
    const schema = this.getSchema();
    if (!schema) {
      debug('[alensa]', '[Alensa Adapter] ✗ No schema available for product ID extraction');
      return null;
    }

    const sku = schema.sku;
    if (sku) {
      debug('[alensa]', `[Alensa Adapter] ✓ Extracted SKU: ${sku}`);
      return String(sku);
    }

    // Fallback: try mpn or gtin
    const id = schema.mpn || schema.gtin || schema.gtin13 || schema.gtin12;
    if (id) {
      debug('[alensa]', `[Alensa Adapter] ✓ Extracted ID from fallback: ${id}`);
      return String(id);
    }

    debug('[alensa]', '[Alensa Adapter] ✗ No product ID found in schema');
    return null;
  }

  /**
   * Extracts the product title from schema
   * @returns {string|null} Product name or null
   */
  extractTitle() {
    const schema = this.getSchema();
    if (!schema) {
      debug('[alensa]', '[Alensa Adapter] ✗ No schema available for title extraction');
      return null;
    }

    const name = schema.name;
    if (name && typeof name === 'string') {
      debug('[alensa]', `[Alensa Adapter] ✓ Extracted title: ${name}`);
      return name.trim();
    }

    debug('[alensa]', '[Alensa Adapter] ✗ No product name found in schema');
    return null;
  }

  /**
   * Extract product price using BaseAdapter's JSON-LD extraction
   * @returns {Object|null} Parsed price data or null
   */
  extractPrice() {
    debug('[alensa]', '[Alensa Adapter] Using base adapter JSON-LD extraction...');

    // Use the base adapter's built-in JSON-LD extraction method
    const jsonLdPrice = this.extractPriceFromJsonLd();

    if (jsonLdPrice && jsonLdPrice.confidence >= 0.70) {
      debug('[alensa]', `[Alensa Adapter] ✓ Extracted price: ${jsonLdPrice.numeric} ${jsonLdPrice.currency}`);
      return this.validateCurrency(jsonLdPrice);
    }

    debug('[alensa]', '[Alensa Adapter] ✗ No valid price found');
    return null;
  }

  /**
   * Extract product image from schema
   * @returns {string|null} Image URL or null
   */
  extractImage() {
    const schema = this.getSchema();
    if (!schema) {
      debug('[alensa]', '[Alensa Adapter] ✗ No schema available for image extraction');
      return null;
    }

    // Schema.org image can be a string, array of strings, or object
    let imageUrl = null;

    if (typeof schema.image === 'string') {
      imageUrl = schema.image;
    } else if (Array.isArray(schema.image) && schema.image.length > 0) {
      imageUrl = schema.image[0];
    } else if (schema.image && typeof schema.image === 'object' && schema.image.url) {
      imageUrl = schema.image.url;
    }

    if (imageUrl && !imageUrl.startsWith('data:')) {
      debug('[alensa]', `[Alensa Adapter] ✓ Extracted image: ${imageUrl}`);
      return imageUrl;
    }

    debug('[alensa]', '[Alensa Adapter] ✗ No valid image found in schema');
    return null;
  }
}
