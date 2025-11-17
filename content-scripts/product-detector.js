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

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent);

      // Handle both single object and array
      const products = Array.isArray(data) ? data : [data];

      for (const item of products) {
        // Check if it's a Product type
        const itemType = item['@type'];
        if (itemType !== 'Product' && itemType !== 'https://schema.org/Product') {
          continue;
        }

        // Extract offers (could be single object or array)
        const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;

        if (!offers || !offers.price) {
          continue;
        }

        // Parse price using our currency parser
        const priceString = String(offers.price);
        const priceData = parsePrice(priceString, {
          domain: window.location.hostname,
          locale: document.documentElement.lang,
          expectedCurrency: offers.priceCurrency
        });

        if (!priceData) {
          continue;
        }

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

  // Try to find price with common selectors
  const priceSelectors = [
    '[data-price]',
    '.price',
    '.product-price',
    '[class*="price"]',
    '[id*="price"]',
    '#priceblock_ourprice',           // Amazon
    '#priceblock_dealprice',           // Amazon deal price
    '.a-price .a-offscreen',           // Amazon hidden price
    '[data-testid="price"]',           // Modern React apps
    '.x-price-primary',                // eBay
    '[itemprop="price"]'               // Microdata fallback
  ];

  let priceData = null;

  for (const selector of priceSelectors) {
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
