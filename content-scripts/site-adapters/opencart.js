/**
 * OpenCart Site Adapter
 * Handles price detection for OpenCart-based e-commerce sites
 *
 * OpenCart is a popular open-source e-commerce platform.
 * This adapter detects OpenCart sites by their characteristic URL patterns
 * and HTML structures. Tested with hawaii.ee.
 */

import { BaseAdapter } from './base-adapter.js';
import { debug, debugError } from '../../utils/debug.js';

export class OpenCartAdapter extends BaseAdapter {
  /**
   * Detects if this is an OpenCart product page
   * @returns {boolean} True if OpenCart product page
   */
  detectProduct() {
    // OpenCart URLs can have localized paths
    // Examples: /product/, /toode/ (Estonian), /produkt/ (German), /produit/ (French), /producto/ (Spanish)
    const hasOpenCartUrlPattern =
      /-(\d+)$/.test(this.url) || // Ends with -ID
      this.url.includes('/product/') ||
      this.url.includes('/toode/') ||    // Estonian
      this.url.includes('/produkt/') ||  // German/Swedish
      this.url.includes('/produit/') ||  // French
      this.url.includes('/producto/');   // Spanish

    // Check for OpenCart-specific elements
    const hasProductTitle = this.querySelector('h1.product-title') || this.querySelector('h1');
    const hasPriceElement = this.querySelector('.price-new') || this.querySelector('.price-old') || this.querySelector('.price') || this.querySelector('.special') || this.querySelector('.old-price');
    const hasProductContainer = this.querySelector('#product') || this.querySelector('.product-info');
    const hasOgPrice = this.querySelector('meta[property="og:price:amount"]');

    // Check for OpenCart JavaScript variables (e.g., hawaii.ee uses is_ajax_data)
    const hasProductData = this.document.documentElement.innerHTML.includes('"page":"product"') ||
                          this.document.documentElement.innerHTML.includes('product_id');

    debug('[opencart]', `[OpenCart Adapter] Detection checks: urlPattern=${hasOpenCartUrlPattern}, title=${!!hasProductTitle}, price=${!!hasPriceElement}, container=${!!hasProductContainer}, ogPrice=${!!hasOgPrice}, productData=${hasProductData}`);

    // Be lenient: if we have URL pattern OR (title AND price) OR productData, it's probably a product
    const isProduct = hasOpenCartUrlPattern || (hasProductTitle && hasPriceElement) || hasOgPrice || (hasProductData && hasProductTitle);

    if (!isProduct) {
      debugError('[opencart]', `[OpenCart Adapter] ✗ Product NOT detected - No indicators found`);
    } else {
      debug('[opencart]', `[OpenCart Adapter] ✓ Product detected`);
    }

    return isProduct;
  }

  /**
   * Sanity check for extracted prices
   * Detects likely concatenation errors (e.g., 799999 instead of 799.99)
   * @param {number} price - Numeric price value
   * @returns {boolean} True if price seems reasonable
   */
  isPriceSane(price) {
    // Prices over 50000 are suspicious for most consumer products
    // (unless you're selling cars/luxury items, but OpenCart is rarely used for those)
    if (price > 50000) {
      debugError('[opencart]', `[OpenCart Adapter] Sanity check failed: price ${price} seems too high (likely concatenation error)`);
      return false;
    }
    // Negative prices are obviously wrong
    if (price < 0) {
      debugError('[opencart]', `[OpenCart Adapter] Sanity check failed: negative price ${price}`);
      return false;
    }
    return true;
  }

  /**
   * Gets the expected currency based on domain/locale
   * @returns {string|null} Currency code or null
   */
  getExpectedCurrency() {
    // Check domain TLD for currency hints
    if (this.domain.endsWith('.ee')) return 'EUR'; // Estonia
    if (this.domain.endsWith('.fi')) return 'EUR'; // Finland
    if (this.domain.endsWith('.lv')) return 'EUR'; // Latvia
    if (this.domain.endsWith('.lt')) return 'EUR'; // Lithuania

    // Add more as needed
    return null;
  }

  /**
   * Extracts the product ID from URL or JavaScript variables
   * OpenCart typically uses -ID at the end of product URLs
   * Some installations (e.g., hawaii.ee) use JavaScript variables
   * @returns {string|null} Product ID or null
   */
  extractProductId() {
    // Priority 1: Extract ID from URL pattern like /product-name-290694
    const matches = this.url.match(/-(\d+)$/);
    if (matches) {
      debug('[opencart]', `[OpenCart Adapter] ✓ Extracted ID from URL: ${matches[1]}`);
      return matches[1];
    }

    // Priority 2: JavaScript variables (e.g., hawaii.ee uses is_ajax_data.products[0].product_id)
    try {
      const htmlContent = this.document.documentElement.innerHTML;
      const productIdMatch = htmlContent.match(/"product_id"[:\s]+(\d+)/);
      if (productIdMatch) {
        debug('[opencart]', `[OpenCart Adapter] ✓ Extracted ID from JavaScript: ${productIdMatch[1]}`);
        return productIdMatch[1];
      }

      // Also check for $product_id variable
      const varMatch = htmlContent.match(/\$product_id\s*=\s*['"](\d+)['"]/);
      if (varMatch) {
        debug('[opencart]', `[OpenCart Adapter] ✓ Extracted ID from $product_id variable: ${varMatch[1]}`);
        return varMatch[1];
      }
    } catch (e) {
      // Ignore errors
    }

    // Priority 3: Hidden input field
    const productInput = this.querySelector('input[name="product_id"]');
    if (productInput && productInput.value) {
      debug('[opencart]', `[OpenCart Adapter] ✓ Extracted ID from input: ${productInput.value}`);
      return productInput.value;
    }

    // Priority 4: URL params
    const urlParams = new URLSearchParams(new URL(this.url).search);
    const productId = urlParams.get('product_id');
    if (productId) {
      debug('[opencart]', `[OpenCart Adapter] ✓ Extracted ID from URL param: ${productId}`);
      return productId;
    }

    debug('[opencart]', '[OpenCart Adapter] ✗ No product ID found');
    return null;
  }

  /**
   * Extracts the product title
   * @returns {string|null} Product title or null
   */
  extractTitle() {
    const titleSelectors = [
      'h1.product-title',
      'h1',
      '.product-title',
      '[itemprop="name"]',
      '#content h1'
    ];

    for (const selector of titleSelectors) {
      const element = this.querySelector(selector);
      if (element) {
        const title = element.textContent?.trim();
        if (title && title.length > 0) {
          return title;
        }
      }
    }

    return null;
  }

  /**
   * Extract product price
   * OpenCart typically uses .price-new for sale prices and .price for regular prices
   * Some installations use .special and .old-price (e.g., hawaii.ee)
   * Meta tag extraction is prioritized as it's most reliable (same as background checks)
   * @returns {Object|null} Parsed price data or null
   */
  extractPrice() {
    debug('[opencart]', '[OpenCart Adapter] Starting price extraction...');

    // PRIORITY 1: Extract from Open Graph meta tag (same method as background refresh)
    const ogPriceMeta = this.querySelector('meta[property="og:price:amount"]');
    if (ogPriceMeta) {
      const priceValue = ogPriceMeta.getAttribute('content');
      if (priceValue) {
        const parsed = this.parsePriceWithContext(priceValue);
        if (parsed && parsed.confidence >= 0.70 && this.isPriceSane(parsed.numeric)) {
          debug('[opencart]', `[OpenCart Adapter] ✓ Found price in meta tag: ${parsed.numeric} ${parsed.currency}`);
          return this.validateCurrency(parsed);
        } else if (parsed && !this.isPriceSane(parsed.numeric)) {
          debugError('[opencart]', `[OpenCart Adapter] Meta tag price failed sanity check: ${parsed.numeric}`);
        }
      }
    }

    // PRIORITY 2: Try sale/special price (.special, .price-new)
    // Look for price elements, but exclude those in product listings/grids
    const specialPriceElements = this.querySelectorAll('.special, .price-new');
    console.log(`[opencart] Found ${specialPriceElements.length} .special/.price-new elements`);

    for (const element of specialPriceElements) {
      // Skip prices that are inside product listings/grids (these are other products)
      const isInListing = element.closest('.product-grid, .product-list, .product-thumb, .product-item, .products-list');
      if (isInListing) {
        debug('[opencart]', '[OpenCart Adapter] Skipping price in product listing');
        continue;
      }

      const priceText = element.textContent?.trim();

      // Always log what we're checking (use debugError so it's visible without debug mode)
      if (priceText && priceText.length > 0 && priceText.length < 100) {
        console.log(`[opencart] Checking .special/.price-new element with text: "${priceText}"`);
      }

      if (priceText) {
        // CRITICAL FIX: If the element contains child elements with line-through (old prices),
        // extract only prices that are NOT crossed out
        const childElements = element.querySelectorAll('*');
        const activePrices = [];
        const crossedOutPrices = [];

        // Check all child elements for prices
        for (const child of childElements) {
          const computedStyle = window.getComputedStyle(child);
          const childText = child.textContent?.trim();

          if (childText && (childText.includes('€') || /\d+[.,]\d+/.test(childText))) {
            if (computedStyle.textDecoration.includes('line-through')) {
              crossedOutPrices.push(childText);
              console.log(`[opencart] Skipping crossed-out price: "${childText}"`);
            } else {
              activePrices.push(childText);
            }
          }
        }

        // If no child elements, check the parent element itself
        if (childElements.length === 0 || activePrices.length === 0) {
          const computedStyle = window.getComputedStyle(element);
          if (!computedStyle.textDecoration.includes('line-through')) {
            activePrices.push(priceText);
          } else {
            console.log(`[opencart] Skipping crossed-out element: "${priceText}"`);
            continue;
          }
        }

        // Parse the first active (non-crossed-out) price
        if (activePrices.length > 0) {
          const activePrice = activePrices[0];
          console.log(`[opencart] Using active price: "${activePrice}"`);
          const parsed = this.parsePriceWithContext(activePrice);

          if (parsed && parsed.confidence >= 0.70 && this.isPriceSane(parsed.numeric)) {
            debug('[opencart]', `[OpenCart Adapter] ✓ Found sale price: ${parsed.numeric} ${parsed.currency}`);

            // Try to extract old price from crossed-out prices
            if (crossedOutPrices.length > 0) {
              const parsedOld = this.parsePriceWithContext(crossedOutPrices[0]);
              if (parsedOld && parsedOld.numeric > parsed.numeric && this.isPriceSane(parsedOld.numeric)) {
                parsed.regularPrice = parsedOld.numeric;
                parsed.isOnSale = true;
                console.log(`[opencart] Found old price: ${parsedOld.numeric} ${parsedOld.currency}`);
              }
            }

            return this.validateCurrency(parsed);
          } else if (parsed && !this.isPriceSane(parsed.numeric)) {
            debugError('[opencart]', `[OpenCart Adapter] Active price failed sanity check: ${parsed.numeric} (text was: "${activePrice}")`);
          }
        }
      }
    }

    // PRIORITY 3: Standard price (.price)
    // Extract only direct text nodes to avoid concatenation issues
    const priceElement = this.querySelector('.price');
    if (priceElement) {
      // Method 1: Try to get only direct text nodes (cleanest)
      const textNodes = Array.from(priceElement.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent.trim())
        .filter(text => text.length > 0)
        .join(' ');

      if (textNodes) {
        const parsed = this.parsePriceWithContext(textNodes);
        if (parsed && parsed.confidence >= 0.70 && this.isPriceSane(parsed.numeric)) {
          debug('[opencart]', `[OpenCart Adapter] ✓ Found standard price (text nodes): ${parsed.numeric} ${parsed.currency}`);
          return this.validateCurrency(parsed);
        }
      }

      // Method 2: Clone and clean approach (fallback)
      const clone = priceElement.cloneNode(true);
      const oldPrices = clone.querySelectorAll('.price-new, .price-old, .price-tax, del, .text-danger, span[style*="text-decoration"]');
      oldPrices.forEach(el => el.remove());

      const priceText = clone.textContent?.trim();
      if (priceText) {
        const parsed = this.parsePriceWithContext(priceText);
        if (parsed && parsed.confidence >= 0.70 && this.isPriceSane(parsed.numeric)) {
          debug('[opencart]', `[OpenCart Adapter] ✓ Found standard price (cleaned): ${parsed.numeric} ${parsed.currency}`);
          return this.validateCurrency(parsed);
        }
      }
    }

    // PRIORITY 4: Try JSON-LD structured data (fallback)
    const jsonLdPrice = this.extractPriceFromJsonLd();
    if (jsonLdPrice && jsonLdPrice.confidence >= 0.70) {
      debug('[opencart]', `[OpenCart Adapter] ✓ Found price in JSON-LD: ${jsonLdPrice.numeric} ${jsonLdPrice.currency}`);
      return this.validateCurrency(jsonLdPrice);
    }

    // PRIORITY 5: Last resort - look for price patterns near the h1 title
    // Some OpenCart themes don't use standard classes
    const h1Element = this.querySelector('h1');
    if (h1Element) {
      // Look for siblings or nearby elements containing currency symbols
      const container = h1Element.parentElement;
      if (container) {
        const containerText = container.textContent || '';
        debug('[opencart]', `[OpenCart Adapter] Searching in h1 container for price patterns...`);

        // Look for strong tags with prices (hawaii.ee structure)
        const strongElements = container.querySelectorAll('strong');
        console.log(`[opencart] Searching ${strongElements.length} <strong> tags near h1 for prices`);

        for (const strong of strongElements) {
          const strongText = strong.textContent?.trim();
          if (strongText && (strongText.includes('€') || strongText.includes('EUR') || /\d+[.,]\d+/.test(strongText))) {
            console.log(`[opencart] Found <strong> with price-like content: "${strongText}"`);
            const parsed = this.parsePriceWithContext(strongText);
            if (parsed && parsed.confidence >= 0.70 && this.isPriceSane(parsed.numeric)) {
              debug('[opencart]', `[OpenCart Adapter] ✓ Found price in <strong> near h1: ${parsed.numeric} ${parsed.currency}`);
              return this.validateCurrency(parsed);
            }
          }
        }
      }
    }

    // CRITICAL: Always log price extraction failures
    debugError('[opencart]', '[OpenCart Adapter] ✗ No valid price found - tried meta tag, .price-new/.special, .price, JSON-LD, and h1 container');
    return null;
  }

  /**
   * Extract product image
   * @returns {string|null} Image URL or null
   */
  extractImage() {
    const imageSelectors = [
      '.thumbnails .thumbnail img',
      '#image',
      '.product-image img',
      '.image img',
      '[itemprop="image"]',
      '.product-info img',
      '#content .image img'
    ];

    for (const selector of imageSelectors) {
      const element = this.querySelector(selector);
      if (element) {
        // Get src or data-src for lazy loading
        const imageUrl = element.src ||
                        element.getAttribute('data-src') ||
                        element.getAttribute('data-image');
        if (imageUrl && !imageUrl.startsWith('data:')) {
          return imageUrl;
        }
      }
    }

    return null;
  }
}
