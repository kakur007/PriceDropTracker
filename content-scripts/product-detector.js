/**
 * Product Detector - Core Detection Logic
 * Multi-layer product page detection with fallback strategies
 * Runs on every supported e-commerce page to detect product information
 */

import { parsePrice } from '../utils/currency-parser.js';
import { generateProductId } from '../utils/product-hasher.js';
import { getAdapter } from './site-adapters/adapter-factory.js';

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

  // Try site-specific adapter first (Layer 0: Site-specific adapters)
  try {
    const adapter = getAdapter(document, window.location.href);
    if (adapter) {
      console.log('[Price Drop Tracker] Using site-specific adapter');
      const title = adapter.extractTitle();
      const price = adapter.extractPrice();
      const imageUrl = adapter.extractImage();
      const productId = adapter.extractProductId();

      if (title && price) {
        const productData = {
          title,
          price,
          imageUrl,
          url: window.location.href,
          domain: window.location.hostname,
          sku: productId,
          availability: null,
          confidence: 0.90,
          detectionMethod: 'siteAdapter'
        };
        console.log('[Price Drop Tracker] Product detected via adapter (confidence: 0.90)');
        return await enhanceProductData(productData);
      }
    }
  } catch (error) {
    console.error('[Price Drop Tracker] Error using adapter:', error);
    // Fall through to generic detection
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
 * Enhanced to reduce false negatives on generic e-commerce sites
 * @returns {boolean} True if page should be skipped
 */
function isNonProductPage() {
  const url = window.location.href.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();

  // Expanded patterns for various e-commerce platforms
  const nonProductPatterns = [
    // Shopping cart and checkout
    '/cart', '/basket', '/bag', '/checkout', '/payment', '/panier',

    // Account pages
    '/account', '/login', '/register', '/signin', '/signup', '/my-account',
    '/profile', '/dashboard', '/orders', '/wishlist',

    // Search and browsing
    '/search', '/results', '/category', '/categories', '/browse', '/collections',
    '/shop', '/all-products', '/catalog', '/listing',

    // Support and info pages
    '/help', '/support', '/contact', '/about', '/faq', '/returns', '/shipping',
    '/terms', '/privacy', '/policy',

    // Blog and content
    '/blog', '/news', '/articles', '/guides',

    // Homepage indicators
    '/index.html', '/index.php', '/home'
  ];

  // Check URL patterns
  if (nonProductPatterns.some(pattern => url.includes(pattern))) {
    return true;
  }

  // Skip if pathname is just "/" or very short (likely homepage or category)
  if (pathname === '/' || pathname.length <= 2) {
    return true;
  }

  // Skip collection/category pages (common in Shopify)
  if (/\/collections\/[^\/]+\/?$/.test(pathname)) {
    return true;
  }

  // Skip search results pages
  if (url.includes('?q=') || url.includes('?s=') || url.includes('&q=') || url.includes('&s=')) {
    return true;
  }

  return false;
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

        // Extract offers - handle multiple structures
        let offersList = [];

        if (item.offers) {
          if (Array.isArray(item.offers)) {
            offersList = item.offers;
          } else {
            offersList = [item.offers];
          }
        }

        if (offersList.length === 0) {
          console.log('[Price Drop Tracker] No offers in Schema.org data');
          continue;
        }

        // Try each offer until we find a valid one
        let priceData = null;
        let currency = null;

        for (const offers of offersList) {
          // Handle AggregateOffer (variable products)
          if (offers['@type'] === 'AggregateOffer' || offers['@type'] === 'https://schema.org/AggregateOffer') {
            console.log('[Price Drop Tracker] Found AggregateOffer (variable product)');

            // Use lowPrice for variable products
            const priceValue = offers.lowPrice || offers.price || offers.highPrice;
            currency = offers.priceCurrency || 'EUR';

            if (priceValue) {
              console.log('[Price Drop Tracker] Variable product price:', priceValue, 'Currency:', currency);

              // Include currency symbol in the price string for better detection
              const currencySymbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '';
              const priceString = currencySymbol
                ? `${currencySymbol}${priceValue}`
                : `${priceValue} ${currency}`;

              priceData = parsePrice(priceString, {
                domain: window.location.hostname,
                locale: document.documentElement.lang,
                expectedCurrency: currency
              });

              if (priceData) {
                // Force the currency to match the detected one
                priceData.currency = currency;
                break;
              }
            }
          }
          // Handle regular Offer
          else {
            const priceValue = offers.price || offers.lowPrice || offers.highPrice;
            currency = offers.priceCurrency || 'EUR';

            if (priceValue) {
              console.log('[Price Drop Tracker] Schema.org price:', priceValue, 'Currency:', currency);

              // Include currency symbol in the price string
              const currencySymbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '';
              const priceString = currencySymbol
                ? `${currencySymbol}${priceValue}`
                : `${priceValue} ${currency}`;

              priceData = parsePrice(priceString, {
                domain: window.location.hostname,
                locale: document.documentElement.lang,
                expectedCurrency: currency
              });

              if (priceData) {
                // Force the currency to match the detected one
                priceData.currency = currency;
                break;
              }
            }
          }
        }

        if (!priceData) {
          console.log('[Price Drop Tracker] Failed to parse any offers');
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
 * Find "Add to Cart" button on the page
 * Strong indicator this is a product page
 * @returns {Element|null} Add to cart button element or null
 */
function findAddToCartButton() {
  // Common button text patterns across languages and platforms
  const patterns = [
    'add to cart', 'add to basket', 'add to bag', 'buy now',
    'añadir al carrito', 'ajouter au panier', 'in den warenkorb',
    'aggiungi al carrello', 'adicionar ao carrinho', 'カートに入れる',
    'add item', 'purchase', 'buy', 'comprar', 'acheter', 'kaufen',
    'submit.add-to-cart', 'addtocart', 'add_to_cart'
  ];

  // Search in buttons
  const buttons = document.querySelectorAll('button, input[type="submit"], a[role="button"]');
  for (const button of buttons) {
    const text = (button.textContent || button.value || button.getAttribute('aria-label') || '').toLowerCase();
    const id = (button.id || '').toLowerCase();
    const className = (button.className || '').toLowerCase();

    if (patterns.some(pattern => text.includes(pattern) || id.includes(pattern) || className.includes(pattern))) {
      return button;
    }
  }

  return null;
}

/**
 * Find all potential price candidates on the page
 * @returns {Array} Array of {element, text, score} objects
 */
function findAllPriceCandidates() {
  const candidates = [];
  const allElements = document.querySelectorAll('span, div, p, b, strong, td, li');

  for (const element of allElements) {
    // Skip if element is hidden
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      continue;
    }

    const text = element.textContent?.trim();
    if (!text || text.length > 50) continue; // Prices are usually short

    // Quick check if it might be a price (contains currency symbol or number)
    if (!/[\$£€¥₹₽¢]|\d/.test(text)) continue;

    // Try to parse it as a price
    const parsed = parsePrice(text, {
      domain: window.location.hostname,
      locale: document.documentElement.lang
    });

    if (parsed && parsed.confidence >= 0.60) {
      candidates.push({
        element,
        text,
        parsed,
        score: 0 // Will be calculated later
      });
    }
  }

  return candidates;
}

/**
 * Score a price candidate based on context and position
 * @param {Object} candidate - Candidate object {element, text, parsed}
 * @param {Element} titleElement - Main H1 title element
 * @param {Element} addToCartButton - Add to cart button element
 * @returns {number} Score (higher is better)
 */
function scorePriceCandidate(candidate, titleElement, addToCartButton) {
  let score = 0;
  const element = candidate.element;
  const elementClass = (element.className || '').toLowerCase();
  const elementId = (element.id || '').toLowerCase();
  const text = candidate.text.toLowerCase();

  // Base score from parser confidence
  score += candidate.parsed.confidence * 100;

  // CRITICAL: Penalize very low prices that are likely shipping costs
  // Common shipping costs: 3.99, 4.95, 4.99, 5.99, 6.99, etc.
  const priceValue = candidate.parsed.numeric;
  if (priceValue > 0 && priceValue < 10) {
    // Prices under 10 are often shipping/handling fees, not products
    score -= 30;
    console.log(`[Price Candidate] Low price penalty for ${priceValue}: -30 points`);
  }
  if (priceValue > 0 && priceValue < 2) {
    // Extremely low prices (under 2) are almost never product prices
    score -= 50;
    console.log(`[Price Candidate] Very low price penalty for ${priceValue}: -50 points`);
  }

  // +20 points: Element has price-related class or ID
  if (elementClass.includes('price') || elementId.includes('price')) {
    score += 20;
  }
  if (elementClass.includes('sale') || elementClass.includes('offer')) {
    score += 15;
  }
  if (elementClass.includes('product') && (elementClass.includes('price') || elementId.includes('price'))) {
    score += 10;
  }

  // +15 points: Close to title in DOM
  if (titleElement) {
    const distance = getDOMDistance(element, titleElement);
    if (distance <= 3) score += 15;
    else if (distance <= 5) score += 10;
    else if (distance <= 8) score += 5;
  }

  // +15 points: Close to Add to Cart button
  if (addToCartButton) {
    const distance = getDOMDistance(element, addToCartButton);
    if (distance <= 3) score += 15;
    else if (distance <= 5) score += 10;
  }

  // +10 points: Larger font size (main prices are usually bigger)
  const fontSize = parseInt(window.getComputedStyle(element).fontSize);
  if (fontSize >= 24) score += 10;
  else if (fontSize >= 18) score += 5;

  // -40 points: Contains unwanted keywords (increased penalty)
  const badKeywords = ['shipping', 'ship', 'delivery', 'tax', 'monthly', 'installment', '/mo', 'per month',
                        'save', 'off', 'was', 'msrp', 'list price', 'handling', 'freight', 'postage'];
  if (badKeywords.some(keyword => text.includes(keyword))) {
    score -= 40;
    console.log(`[Price Candidate] Bad keyword penalty: -40 points`);
  }

  // -60 points: In a "related items", "upsells", or shipping section (increased penalty)
  let parent = element.parentElement;
  for (let i = 0; i < 5 && parent; i++) {
    const parentClass = (parent.className || '').toLowerCase();
    const parentId = (parent.id || '').toLowerCase();

    if (parentClass.includes('related') || parentClass.includes('similar') ||
        parentClass.includes('also-bought') || parentClass.includes('recommendations') ||
        parentClass.includes('upsell') || parentClass.includes('cross-sell') ||
        parentClass.includes('shipping') || parentClass.includes('delivery') ||
        parentId.includes('related') || parentId.includes('similar') ||
        parentId.includes('shipping') || parentId.includes('delivery')) {
      score -= 60;
      console.log(`[Price Candidate] Related/shipping section penalty: -60 points`);
      break;
    }
    parent = parent.parentElement;
  }

  // +5 points: Has data-price attribute
  if (element.hasAttribute('data-price') || element.hasAttribute('data-product-price')) {
    score += 5;
  }

  return score;
}

/**
 * Calculate DOM distance between two elements
 * @param {Element} elem1
 * @param {Element} elem2
 * @returns {number} Number of steps in DOM tree
 */
function getDOMDistance(elem1, elem2) {
  if (!elem1 || !elem2) return Infinity;

  const parents1 = getParentChain(elem1);
  const parents2 = getParentChain(elem2);

  // Find common ancestor
  for (let i = 0; i < parents1.length; i++) {
    for (let j = 0; j < parents2.length; j++) {
      if (parents1[i] === parents2[j]) {
        return i + j;
      }
    }
  }

  return Infinity;
}

/**
 * Get chain of parent elements
 * @param {Element} element
 * @returns {Array} Array of parent elements
 */
function getParentChain(element) {
  const parents = [];
  let current = element;
  while (current && parents.length < 15) {
    parents.push(current);
    current = current.parentElement;
  }
  return parents;
}

/**
 * Extract product data from CSS selectors
 * Enhanced with heuristic price detection for generic e-commerce sites
 * @returns {Object|null} Product data or null
 */
function extractFromSelectors() {
  // Expanded URL patterns for generic e-commerce (Shopify, WooCommerce, Magento, etc.)
  const url = window.location.href.toLowerCase();
  const urlPatterns = [
    '/product/', '/products/', '/item/', '/items/', '/dp/', '/p/', '/itm/',
    '/goods/', '/pd/', '/buy/', '/shop/', '/store/', '-p-', '/detail/',
    '/produkter/', '/produit/', '/produto/', '/produkt/'  // Multi-language support
  ];
  const hasProductUrl = urlPatterns.some(pattern => url.includes(pattern));

  // Also check for numeric product IDs in URL
  const hasProductId = /\/\d{6,}/.test(url) || /[?&](product|item|sku|id)=\d+/.test(url);

  if (!hasProductUrl && !hasProductId) {
    console.log('[Price Drop Tracker] URL does not match product patterns');
    return null;
  }

  // Try to find title (main H1 on the page)
  const titleElement =
    document.querySelector('h1[class*="product"]') ||
    document.querySelector('h1[id*="product"]') ||
    document.querySelector('h1.title') ||
    document.querySelector('h1');

  const title = titleElement?.textContent?.trim();

  if (!title || title.length < 3) {
    console.log('[Price Drop Tracker] No valid title found');
    return null;
  }

  console.log('[Price Drop Tracker] Found title:', title.slice(0, 60));

  // Find "Add to Cart" button - strong signal of product page
  const addToCartButton = findAddToCartButton();
  if (addToCartButton) {
    console.log('[Price Drop Tracker] ✓ Add to Cart button found');
  }

  // Use heuristic price detection for maximum compatibility
  let priceData = null;
  let detectedPriceElement = null;

  // Site-specific selectors first (most reliable)
  if (window.location.hostname.includes('amazon')) {
    const amazonSelectors = [
      '.a-price .a-offscreen',
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
        const parsed = parsePrice(priceText, {
          domain: window.location.hostname,
          locale: document.documentElement.lang
        });

        if (parsed && parsed.confidence >= 0.70) {
          priceData = parsed;
          detectedPriceElement = element;
          console.log('[Price Drop Tracker] ✓ Amazon price found:', priceData.numeric);
          break;
        }
      }
    }
  }
  else if (window.location.hostname.includes('walmart')) {
    const walmartSelectors = [
      '[itemprop="price"]',
      '[data-testid="price-wrap"] span[itemprop="price"]',
      '[class*="price-characteristic"]',
      '.price-characteristic',
      '[data-automation-id="product-price"]'
    ];

    for (const selector of walmartSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const priceText = element.getAttribute('content') || element.textContent?.trim();
        const parsed = parsePrice(priceText, {
          domain: window.location.hostname,
          locale: document.documentElement.lang
        });

        if (parsed && parsed.confidence >= 0.70) {
          priceData = parsed;
          detectedPriceElement = element;
          console.log('[Price Drop Tracker] ✓ Walmart price found:', priceData.numeric);
          break;
        }
      }
    }
  }

  // Fallback: Use heuristic price candidate scoring for generic sites
  if (!priceData) {
    console.log('[Price Drop Tracker] Using heuristic price detection...');

    // First try common generic selectors (fast path)
    const quickSelectors = [
      '[itemprop="price"]',
      '[data-price]',
      '.price',
      '.product-price',
      '.product_price',
      '[class*="price-now"]',
      '[class*="current-price"]',
      '[id*="product-price"]'
    ];

    for (const selector of quickSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const priceText =
          element.getAttribute('data-price') ||
          element.getAttribute('content') ||
          element.textContent?.trim();

        const parsed = parsePrice(priceText, {
          domain: window.location.hostname,
          locale: document.documentElement.lang
        });

        if (parsed && parsed.confidence >= 0.70) {
          priceData = parsed;
          detectedPriceElement = element;
          console.log('[Price Drop Tracker] ✓ Quick selector price found:', priceData.numeric);
          break;
        }
      }
      if (priceData) break;
    }

    // If still no price, use the full candidate scoring system
    if (!priceData) {
      console.log('[Price Drop Tracker] Running full price candidate scoring...');

      const candidates = findAllPriceCandidates();
      console.log(`[Price Drop Tracker] Found ${candidates.length} price candidates`);

      if (candidates.length > 0) {
        // Score each candidate
        for (const candidate of candidates) {
          candidate.score = scorePriceCandidate(candidate, titleElement, addToCartButton);
        }

        // Sort by score (highest first)
        candidates.sort((a, b) => b.score - a.score);

        // Log top candidates for debugging
        console.log('[Price Drop Tracker] Top 3 candidates:');
        for (let i = 0; i < Math.min(3, candidates.length); i++) {
          console.log(`  ${i + 1}. ${candidates[i].text} (score: ${candidates[i].score})`);
        }

        // Select the best candidate if score is high enough
        const bestCandidate = candidates[0];
        if (bestCandidate.score >= 60) {
          priceData = bestCandidate.parsed;
          detectedPriceElement = bestCandidate.element;
          console.log('[Price Drop Tracker] ✓ Best candidate selected:', priceData.numeric, 'score:', bestCandidate.score);
        } else {
          console.log('[Price Drop Tracker] Best candidate score too low:', bestCandidate.score);
        }
      }
    }
  }

  if (!priceData) {
    console.log('[Price Drop Tracker] No reliable price found');
    return null;
  }

  // Try to find image
  const imageUrl =
    document.querySelector('[data-product-image]')?.src ||
    document.querySelector('[itemprop="image"]')?.src ||
    document.querySelector('.product-image img')?.src ||
    document.querySelector('[class*="product"] img[src]')?.src ||
    document.querySelector('main img[src]')?.src ||
    document.querySelector('img[alt*="' + title.slice(0, 20) + '"]')?.src ||
    null;

  // Calculate confidence score based on signals
  let confidence = 0.30; // Base confidence for selector-based detection

  // Boost confidence based on evidence
  if (hasProductUrl) confidence += 0.10;
  if (titleElement) confidence += 0.10;
  if (addToCartButton) confidence += 0.20;
  if (detectedPriceElement) confidence += 0.20;
  if (imageUrl) confidence += 0.05;

  console.log('[Price Drop Tracker] ✓ Product detected with confidence:', confidence);

  return {
    title,
    price: priceData,
    imageUrl,
    url: window.location.href,
    domain: window.location.hostname,
    sku: null,
    availability: null,
    confidence: Math.min(confidence, 0.95), // Cap at 0.95
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
