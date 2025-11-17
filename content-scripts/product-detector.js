/**
 * Product Detector - Core Detection Logic
 * Multi-layer product page detection with fallback strategies
 * Runs on every supported e-commerce page to detect product information
 */

import { parsePrice } from '../utils/currency-parser.js';
import { generateProductId } from '../utils/product-hasher.js';

/**
 * Main product detection function
 * Uses multiple detection layers in order of reliability
 * @returns {Promise<Object|null>} Product data or null if not a product page
 */
export async function detectProduct() {
  console.log('[Price Drop Tracker] Scanning page for product data...');

  // Quick reject: ignore non-product pages
  if (isNonProductPage()) {
    console.log('[Price Drop Tracker] Non-product page detected, skipping');
    return null;
  }

  // Try detection methods in order of confidence
  let productData = null;

  // Layer 1: Schema.org JSON-LD (most reliable)
  productData = extractFromSchemaOrg();
  if (productData && productData.confidence >= 0.90) {
    console.log('[Price Drop Tracker] Product detected via Schema.org (confidence:', productData.confidence + ')');
    return await enhanceProductData(productData);
  }

  // Layer 2: Open Graph meta tags
  const ogData = extractFromOpenGraph();
  if (ogData && (!productData || ogData.confidence > productData.confidence)) {
    productData = ogData;
    console.log('[Price Drop Tracker] Product detected via Open Graph (confidence:', ogData.confidence + ')');
  }

  // Layer 3: Microdata/RDFa
  const microdataData = extractFromMicrodata();
  if (microdataData && (!productData || microdataData.confidence > productData.confidence)) {
    productData = microdataData;
    console.log('[Price Drop Tracker] Product detected via Microdata (confidence:', microdataData.confidence + ')');
  }

  // Layer 4: CSS Selectors (fallback)
  if (!productData || productData.confidence < 0.70) {
    const cssData = extractFromSelectors();
    if (cssData && (!productData || cssData.confidence > productData.confidence)) {
      productData = cssData;
      console.log('[Price Drop Tracker] Product detected via CSS selectors (confidence:', cssData.confidence + ')');
    }
  }

  // Reject if confidence too low
  if (!productData || productData.confidence < 0.60) {
    console.log('[Price Drop Tracker] No reliable product data found (confidence too low)');
    return null;
  }

  // Enhance and validate the data
  const enhanced = await enhanceProductData(productData);
  console.log('[Price Drop Tracker] Product detected:', enhanced);

  return enhanced;
}

/**
 * Check if current page is definitely NOT a product page
 * @returns {boolean} True if page should be skipped
 */
function isNonProductPage() {
  const url = window.location.href.toLowerCase();
  const nonProductPatterns = [
    '/cart', '/checkout', '/account', '/login', '/register',
    '/search', '/category', '/browse', '/help', '/support',
    '/about', '/contact', '/faq', '/returns', '/shipping'
  ];
  return nonProductPatterns.some(pattern => url.includes(pattern));
}

/**
 * Extract product data from Schema.org JSON-LD
 * Highest confidence (0.95) - SEO-critical data
 * @returns {Object|null} Product data or null
 */
function extractFromSchemaOrg() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');

  console.log(`[Price Drop Tracker] Found ${scripts.length} JSON-LD scripts`);

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent);

      // Collect all potential products from different structures
      let products = [];

      // Case 1: Direct Product object
      if (data['@type'] === 'Product' || data['@type'] === 'https://schema.org/Product') {
        products.push(data);
      }
      // Case 2: Direct array of items
      else if (Array.isArray(data)) {
        products.push(...data.filter(item =>
          item['@type'] === 'Product' || item['@type'] === 'https://schema.org/Product'
        ));
      }
      // Case 3: @graph wrapper (common in Walmart, eBay, etc.)
      else if (data['@graph'] && Array.isArray(data['@graph'])) {
        products.push(...data['@graph'].filter(item =>
          item['@type'] === 'Product' || item['@type'] === 'https://schema.org/Product'
        ));
      }
      // Case 4: Single @graph object
      else if (data['@graph'] && !Array.isArray(data['@graph'])) {
        if (data['@graph']['@type'] === 'Product' || data['@graph']['@type'] === 'https://schema.org/Product') {
          products.push(data['@graph']);
        }
      }

      console.log(`[Price Drop Tracker] Found ${products.length} Product(s) in this script`);

      for (const item of products) {
        console.log('[Price Drop Tracker] Processing Product:', item);

        // Extract offers (could be single object or array)
        const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;

        if (!offers) {
          console.log('[Price Drop Tracker] No offers in Schema.org data');
          continue;
        }

        // Extract price - handle multiple property names and formats
        let priceValue = offers.price || offers.lowPrice || offers.highPrice;
        let currency = offers.priceCurrency || 'USD';

        if (!priceValue) {
          console.log('[Price Drop Tracker] No price in Schema.org offers');
          continue;
        }

        console.log('[Price Drop Tracker] Schema.org price:', priceValue, 'Currency:', currency);

        // Parse price using our currency parser
        // Build a price string that includes currency for better parsing
        const priceString = typeof priceValue === 'number'
          ? `${currency} ${priceValue}`
          : String(priceValue);

        const priceData = parsePrice(priceString, {
          domain: window.location.hostname,
          locale: document.documentElement.lang,
          expectedCurrency: currency
        });

        if (!priceData) {
          console.log('[Price Drop Tracker] Failed to parse Schema.org price:', priceString);
          continue;
        }

        console.log('[Price Drop Tracker] ✓ Successfully parsed price:', priceData.numeric, priceData.currency);

        // Extract image (handle different formats)
        let imageUrl = null;
        if (item.image) {
          if (typeof item.image === 'string') {
            imageUrl = item.image;
          } else if (item.image.url) {
            imageUrl = item.image.url;
          } else if (Array.isArray(item.image) && item.image.length > 0) {
            imageUrl = typeof item.image[0] === 'string' ? item.image[0] : item.image[0].url;
          }
        }

        return {
          title: item.name || 'Unknown Product',
          price: priceData,
          imageUrl: imageUrl,
          url: window.location.href,
          domain: window.location.hostname,
          sku: item.sku || item.gtin || null,
          availability: offers.availability || null,
          confidence: 0.95,
          detectionMethod: 'schemaOrg'
        };
      }
    } catch (error) {
      console.error('[Price Drop Tracker] Error parsing Schema.org:', error);
    }
  }

  return null;
}

/**
 * Extract product data from Open Graph meta tags
 * High confidence (0.85)
 * @returns {Object|null} Product data or null
 */
function extractFromOpenGraph() {
  const ogType = document.querySelector('meta[property="og:type"]')?.content;
  if (!ogType || !ogType.includes('product')) {
    return null;
  }

  const title = document.querySelector('meta[property="og:title"]')?.content;
  const priceAmount = document.querySelector('meta[property="og:price:amount"]')?.content;
  const priceCurrency = document.querySelector('meta[property="og:price:currency"]')?.content;
  const imageUrl = document.querySelector('meta[property="og:image"]')?.content;

  if (!title || !priceAmount) {
    return null;
  }

  // Build price string
  const priceString = priceCurrency ?
    `${priceAmount} ${priceCurrency}` :
    priceAmount;

  const priceData = parsePrice(priceString, {
    domain: window.location.hostname,
    locale: document.documentElement.lang
  });

  if (!priceData) {
    return null;
  }

  return {
    title,
    price: priceData,
    imageUrl,
    url: window.location.href,
    domain: window.location.hostname,
    sku: null,
    availability: null,
    confidence: 0.85,
    detectionMethod: 'openGraph'
  };
}

/**
 * Extract product data from Microdata/RDFa
 * Medium confidence (0.75)
 * @returns {Object|null} Product data or null
 */
function extractFromMicrodata() {
  const productElement = document.querySelector('[itemtype*="schema.org/Product"]');
  if (!productElement) {
    return null;
  }

  const title = productElement.querySelector('[itemprop="name"]')?.textContent?.trim();
  const priceElement = productElement.querySelector('[itemprop="price"]');
  const currency = productElement.querySelector('[itemprop="priceCurrency"]')?.content;
  const imageUrl = productElement.querySelector('[itemprop="image"]')?.src;

  if (!title || !priceElement) {
    return null;
  }

  // Build price string
  const priceString = currency ?
    `${priceElement.content || priceElement.textContent} ${currency}` :
    (priceElement.content || priceElement.textContent);

  const priceData = parsePrice(priceString, {
    domain: window.location.hostname,
    locale: document.documentElement.lang
  });

  if (!priceData) {
    return null;
  }

  return {
    title,
    price: priceData,
    imageUrl,
    url: window.location.href,
    domain: window.location.hostname,
    sku: null,
    availability: null,
    confidence: 0.75,
    detectionMethod: 'microdata'
  };
}

/**
 * Extract product data from CSS selectors
 * Lower confidence (0.65) - fallback method
 * @returns {Object|null} Product data or null
 */
function extractFromSelectors() {
  // URL must match product patterns
  const url = window.location.href.toLowerCase();
  const urlPatterns = ['/product/', '/item/', '/dp/', '/p/', '/itm/', '/goods/', '/pd/'];
  const hasProductUrl = urlPatterns.some(pattern => url.includes(pattern));

  if (!hasProductUrl) {
    return null;
  }

  // Try to find title
  const title =
    document.querySelector('h1[class*="product"]')?.textContent?.trim() ||
    document.querySelector('h1.title')?.textContent?.trim() ||
    document.querySelector('h1[id*="product"]')?.textContent?.trim() ||
    document.querySelector('h1')?.textContent?.trim();

  if (!title || title.length < 3) {
    return null;
  }

  // Site-specific price extraction (more reliable)
  let priceData = null;

  if (window.location.hostname.includes('amazon')) {
    // Try Amazon-specific selectors in order of reliability
    const amazonSelectors = [
      '.a-price .a-offscreen',           // Screen reader price (most reliable - full formatted price)
      '#corePrice_feature_div .a-offscreen',
      '#corePriceDisplay_desktop_feature_div .a-offscreen',
      '.reinventPricePriceToPayMargin .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice'
    ];

    for (const selector of amazonSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const priceText = element.textContent?.trim();
        console.log(`[Price Drop Tracker] Trying Amazon selector "${selector}": "${priceText}"`);

        const parsed = parsePrice(priceText, {
          domain: window.location.hostname,
          locale: document.documentElement.lang
        });

        if (parsed && parsed.confidence >= 0.70) {
          priceData = parsed;
          console.log('[Price Drop Tracker] ✓ Amazon price parsed:', priceData.numeric);
          break;
        }
      }
    }
  }
  else if (window.location.hostname.includes('walmart')) {
    // Try Walmart-specific selectors in order of reliability
    const walmartSelectors = [
      '[itemprop="price"]',                           // Most common Walmart price element
      '[data-testid="price-wrap"] span[itemprop="price"]',
      '[class*="price-characteristic"]',              // New Walmart design
      '[class*="price-group"] [aria-label*="Price"]',
      '.price-characteristic',
      'span.price-group span',
      '[data-automation-id="product-price"]'
    ];

    for (const selector of walmartSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const priceText = element.getAttribute('content') || element.textContent?.trim();
        console.log(`[Price Drop Tracker] Trying Walmart selector "${selector}": "${priceText}"`);

        const parsed = parsePrice(priceText, {
          domain: window.location.hostname,
          locale: document.documentElement.lang
        });

        if (parsed && parsed.confidence >= 0.70) {
          priceData = parsed;
          console.log('[Price Drop Tracker] ✓ Walmart price parsed:', priceData.numeric);
          break;
        }
      }
    }
  }

  // Generic price selectors for other sites or if Amazon-specific failed
  if (!priceData) {
    const genericSelectors = [
      '[data-price]',
      '[itemprop="price"]',
      '.price',
      '.product-price',
      '[data-testid="price"]',
      '.x-price-primary',                // eBay
      '[class*="price"]',
      '[id*="price"]'
    ];

    for (const selector of genericSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const priceText =
          element.getAttribute('data-price') ||
          element.getAttribute('content') ||
          element.textContent;

        const parsed = parsePrice(priceText, {
          domain: window.location.hostname,
          locale: document.documentElement.lang
        });

        if (parsed && parsed.confidence >= 0.70) {
          priceData = parsed;
          break;
        }
      }
      if (priceData) break;
    }
  }

  if (!priceData) {
    return null;
  }

  // Try to find image
  const imageUrl =
    document.querySelector('[data-product-image]')?.src ||
    document.querySelector('.product-image img')?.src ||
    document.querySelector('[class*="product"] img')?.src ||
    document.querySelector('main img')?.src ||
    null;

  return {
    title,
    price: priceData,
    imageUrl,
    url: window.location.href,
    domain: window.location.hostname,
    sku: null,
    availability: null,
    confidence: 0.65,
    detectionMethod: 'cssSelectors'
  };
}

/**
 * Enhance and validate product data
 * @param {Object} data - Raw product data
 * @returns {Promise<Object>} Enhanced product data
 */
async function enhanceProductData(data) {
  // Generate unique product ID
  data.productId = generateProductId(data.url, data.title, data.domain);

  // Add timestamps
  data.detectedAt = Date.now();

  // CRITICAL: Store image URL, NOT base64 data
  // Storing base64 images wastes ~8KB per product (800KB for 100 products!)
  // Instead, store the URL and let the popup load images on-demand
  if (data.imageUrl && data.imageUrl.startsWith('data:')) {
    // If somehow we got base64, remove it
    console.warn('[Price Drop Tracker] Removing base64 image data to save storage');
    data.imageUrl = null;
  }

  // Validate and clean title
  if (data.title && data.title.length > 200) {
    data.title = data.title.slice(0, 197) + '...';
  }

  // Ensure we have all required fields
  if (!data.title) data.title = 'Unknown Product';
  if (!data.url) data.url = window.location.href;
  if (!data.domain) data.domain = window.location.hostname;

  return data;
}

// Auto-detect product when page loads
(async function initialize() {
  // Wait for page to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detectAndSave);
  } else {
    detectAndSave();
  }
})();

async function detectAndSave() {
  try {
    console.log('[Price Drop Tracker] Page loaded, checking for product...');

    // Wait a bit for dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 1000));

    const productData = await detectProduct();

    if (productData) {
      // Check if already tracking
      const response = await chrome.runtime.sendMessage({
        type: 'PRODUCT_DETECTED',
        data: productData
      });

      if (response.success) {
        console.log('[Price Drop Tracker] Product saved:', response.productId);
        showTrackingBadge(productData);
      }
    }
  } catch (error) {
    console.error('[Price Drop Tracker] Detection error:', error);
  }
}

function showTrackingBadge(product) {
  // Create subtle notification badge
  const badge = document.createElement('div');
  badge.id = 'price-tracker-badge';
  badge.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #2563eb;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 999999;
      animation: slideIn 0.3s ease;
    ">
      ✓ Now tracking price: ${product.price.formatted}
    </div>
    <style>
      @keyframes slideIn {
        from { transform: translateY(100px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    </style>
  `;

  document.body.appendChild(badge);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    badge.style.transition = 'opacity 0.3s ease';
    badge.style.opacity = '0';
    setTimeout(() => badge.remove(), 300);
  }, 5000);
}
