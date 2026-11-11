/**
 * Product Detector - Core Detection Logic
 *
 * Layers, most trustworthy first:
 *   0. Site adapters (Amazon, eBay, Zalando, …)
 *   1. Structured data shared with the background checker
 *      (JSON-LD, Shopify product JSON, microdata, Open Graph/product meta)
 *   2. Visual heuristics (price-like elements scored by position, size, class)
 *
 * The result carries `priceSelector` whenever a concrete DOM element was used,
 * so the background checker can read the very same element on later refreshes.
 *
 * NOTE: imported dynamically by main.js / injected functions. It must not run
 * anything on import.
 */

import { parsePrice } from '../utils/currency-parser.js';
import { generateProductId } from '../utils/product-hasher.js';
import { getAdapter } from './site-adapters/adapter-factory.js';
import { createOptimizedThumbnail } from '../utils/thumbnail-generator.js';
import {
  extractStructuredProduct,
  buildSelector,
  absoluteUrl,
  cleanText,
  getMetaImage,
  getMetaTitle,
  getSelectedVariant
} from '../utils/page-extractor.js';
import { debug, debugWarn, debugError } from '../utils/debug.js';
import { sanitizeProductUrl } from '../utils/url-sanitizer.js';
import { normalizeAvailability } from '../utils/alert-rules.js';

const LOG = '[product-detector]';

/**
 * Detect the product on the current page.
 *
 * @param {Object} [options]
 * @param {'auto'|'manual'} [options.mode='auto'] - 'manual' means the user
 *   explicitly asked to track this page, so we accept weaker evidence and skip
 *   URL-based "this is not a product page" filters.
 * @returns {Promise<Object|null>}
 */
export async function detectProduct(options = {}) {
  const mode = options.mode === 'manual' ? 'manual' : 'auto';
  const minConfidence = mode === 'manual' ? 0.5 : 0.7;

  debug(LOG, `Scanning page for product data (mode: ${mode})`);

  if (mode === 'auto' && isNonProductPage()) {
    debug(LOG, 'Non-product page detected, skipping');
    return null;
  }

  const ctx = getContext();
  let adapterSaysNotProduct = false;

  let structured = null;
  try {
    structured = extractStructuredProduct(document, ctx);
  } catch (error) {
    debugError(LOG, 'Structured data extraction failed:', error);
  }

  // Layer 0: site adapter
  try {
    const adapter = getAdapter(document, window.location.href);
    // Generic platform adapters only win when the page has no trustworthy
    // structured data; retailer-specific adapters always go first.
    if (adapter?.isPlatformAdapter && structured && structured.confidence >= 0.9) {
      debug(LOG, `Using ${structured.detectionMethod} over platform adapter`);
    } else if (adapter) {
      const isProduct = adapter.detectProduct ? adapter.detectProduct() : true;
      if (!isProduct) {
        // Don't give up: adapters lag behind site redesigns. Continue with
        // the generic layers, just with stricter rules in auto mode.
        adapterSaysNotProduct = true;
        debug(LOG, 'Adapter did not recognise a product page, trying generic detection');
      } else {
        const title = adapter.extractTitle();
        const price = adapter.extractPrice();
        if (title && price && price.numeric > 0) {
          debug(LOG, 'Product detected via site adapter');
          return await enhanceProductData({
            title,
            price,
            imageUrl: adapter.extractImage(),
            sku: adapter.extractProductId(),
            availability: null,
            confidence: 0.9,
            detectionMethod: 'siteAdapter'
          });
        }
        debug(LOG, 'Adapter could not extract title/price, falling back');
      }
    }
  } catch (error) {
    debugError(LOG, 'Adapter error, falling back to generic detection:', error);
  }

  // Layer 1: structured data
  let best = structured;

  if (best && best.confidence >= 0.85) {
    debug(LOG, `Product detected via ${best.detectionMethod}`);
    return await enhanceProductData(best);
  }

  // Layer 2: heuristics
  if (!(mode === 'auto' && adapterSaysNotProduct)) {
    const heuristic = extractFromPage(mode);
    if (heuristic && (!best || heuristic.confidence > best.confidence)) {
      best = heuristic;
    }
  }

  if (!best || best.confidence < minConfidence) {
    debug(LOG, 'No reliable product data found', best ? `(confidence ${best.confidence})` : '');
    return null;
  }

  return await enhanceProductData(best);
}

/**
 * Page context passed to price parsing (domain/locale drive currency guesses).
 */
export function getContext() {
  return {
    url: window.location.href,
    domain: window.location.hostname,
    locale: document.documentElement.lang || navigator.language || 'en-US'
  };
}

/**
 * URL-based quick reject for auto mode.
 */
function isNonProductPage() {
  const url = window.location.href.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();

  const productPathPatterns = [
    /\/products?\/[^\/?]+/,
    /\/items?\/[^\/?]+/,
    /\/itm\/[^\/?]+/,
    /\/dp\/[a-z0-9]{6,}/,
    /\/gp\/product\/[a-z0-9]{6,}/,
    /\/p\/[^\/?]+/,
    /\/pd\/[^\/?]+/,
    /\/ip\/[^\/?]+/,
    /\/detail\/[^\/?]+/,
    /\/listing\/\d+/
  ];
  if (productPathPatterns.some(p => p.test(pathname))) return false;

  const nonProductPathPatterns = [
    /^\/(cart|basket|bag|checkout|payment|panier|warenkorb|ostukorv)(\/|$)/,
    /^\/(account|login|register|signin|signup|my-account|profile|dashboard|orders|wishlist)(\/|$)/,
    /^\/(search|results|category|categories|browse|collections|shop|all-products|catalog)(\/)?$/,
    /^\/(help|support|contact|about|faq|returns|shipping|terms|privacy|policy)(\/|$)/,
    /^\/(blog|news|articles|guides)(\/|$)/,
    /^\/(index\.html|index\.php|home)(\/)?$/
  ];
  if (nonProductPathPatterns.some(p => p.test(pathname))) return true;

  if (pathname === '/' || pathname.length <= 2) return true;
  if (/\/collections\/[^\/]+\/?$/.test(pathname)) return true;
  if (/\/(listing|listings)\/?$/.test(pathname)) return true;

  if ((pathname.includes('/search') || pathname.includes('/results')) &&
      /[?&](q|s|query|k)=/.test(url)) {
    return true;
  }

  return false;
}

// ----------------------------------------------------------------- heuristics

const ADD_TO_CART_PATTERNS = [
  'add to cart', 'add to basket', 'add to bag', 'buy now', 'add to trolley',
  'añadir al carrito', 'ajouter au panier', 'in den warenkorb', 'in den einkaufswagen',
  'aggiungi al carrello', 'adicionar ao carrinho', 'カートに入れる', 'toevoegen aan winkelwagen',
  'lisa ostukorvi', 'ostukorvi', 'dodaj do koszyka', 'lägg i varukorgen', 'læg i kurv',
  'legg i handlekurv', 'lisää ostoskoriin', 'do košíku', 'в корзину', 'sepete ekle',
  'addtocart', 'add-to-cart', 'add_to_cart'
];

function findAddToCartButton() {
  const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"], a[role="button"], [data-action*="cart" i], form[action*="cart" i] [type="submit"]');
  for (const button of buttons) {
    const text = (button.textContent || button.value || button.getAttribute('aria-label') || '').toLowerCase();
    const attrs = `${button.id || ''} ${typeof button.className === 'string' ? button.className : ''} ${button.getAttribute('name') || ''} ${button.getAttribute('data-action') || ''}`.toLowerCase();
    if (ADD_TO_CART_PATTERNS.some(p => text.includes(p) || attrs.includes(p))) {
      return button;
    }
  }
  return null;
}

const CURRENCY_HINT = /[$£€¥₹₽¢₩₪₺₫฿₱₴]|\b(USD|EUR|GBP|CAD|AUD|SEK|NOK|DKK|PLN|CHF|CZK|HUF|RON|JPY|INR|BRL|MXN|ZAR|kr|zł|Kč|Ft|lei|R\$)\b/i;

function isVisible(el) {
  if (!el.getClientRects().length) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none' && parseFloat(style.opacity) > 0.05;
}

function isStruckThrough(el) {
  for (let node = el, i = 0; node && i < 3; node = node.parentElement, i++) {
    if (node.tagName === 'DEL' || node.tagName === 'S' || node.tagName === 'STRIKE') return true;
    const deco = window.getComputedStyle(node).textDecorationLine || '';
    if (deco.includes('line-through')) return true;
  }
  return false;
}

/**
 * Collect visible, short, currency-bearing text nodes that parse as prices.
 */
function findAllPriceCandidates(ctx) {
  const candidates = [];
  const elements = document.querySelectorAll('span, div, p, b, strong, td, li, ins, bdi, dd, data, h2, h3, h4, meta[itemprop="price"]');
  let inspected = 0;

  for (const element of elements) {
    if (++inspected > 4000) break;
    if (element.closest('header, footer, nav, [role="navigation"], [aria-hidden="true"]')) continue;

    const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 40) continue;

    const classAttr = `${typeof element.className === 'string' ? element.className : ''} ${element.id || ''}`.toLowerCase();
    const looksLikePriceClass = classAttr.includes('price') || classAttr.includes('amount');
    if (!CURRENCY_HINT.test(text) && !looksLikePriceClass) continue;
    if (!/\d/.test(text)) continue;

    // Prefer the innermost element carrying the price
    const childWithSameText = Array.from(element.children).some(c => (c.textContent || '').replace(/\s+/g, ' ').trim() === text);
    if (childWithSameText) continue;

    if (!isVisible(element)) continue;

    const parsed = parsePrice(text, { domain: ctx.domain, locale: ctx.locale });
    if (parsed && parsed.numeric > 0 && parsed.confidence >= 0.6) {
      candidates.push({ element, text, parsed, score: 0 });
    }
  }
  return candidates;
}

function scorePriceCandidate(candidate, titleElement, addToCartButton) {
  let score = candidate.parsed.confidence * 100;
  const element = candidate.element;
  const cls = `${typeof element.className === 'string' ? element.className : ''} ${element.id || ''}`.toLowerCase();
  const text = candidate.text.toLowerCase();
  const value = candidate.parsed.numeric;

  if (value < 2) score -= 50;
  else if (value < 10) score -= 15;

  if (cls.includes('price')) score += 20;
  if (/sale|special|current|final|now|offer|actual/.test(cls)) score += 15;
  if (/old|was|regular|compare|strike|before|original|list|rrp|msrp/.test(cls)) score -= 35;
  if (element.closest('[itemprop="offers"], [class*="product-info" i], [class*="product-detail" i], [class*="buy-box" i], [class*="summary" i], main')) score += 10;

  if (isStruckThrough(element)) score -= 60;

  if (titleElement) {
    const d = getDOMDistance(element, titleElement);
    if (d <= 3) score += 15; else if (d <= 5) score += 10; else if (d <= 8) score += 5;
  }
  if (addToCartButton) {
    const d = getDOMDistance(element, addToCartButton);
    if (d <= 3) score += 15; else if (d <= 5) score += 10; else if (d <= 8) score += 5;
  }

  const fontSize = parseFloat(window.getComputedStyle(element).fontSize) || 0;
  if (fontSize >= 24) score += 15; else if (fontSize >= 18) score += 8;

  // Above the fold is where the main price lives
  const rect = element.getBoundingClientRect();
  const top = rect.top + window.scrollY;
  if (top < 1200) score += 10;
  else if (top > 3000) score -= 20;

  const badKeywords = ['shipping', 'delivery', 'tax', 'monthly', 'installment', '/mo', 'per month', 'save ', 'off', 'was', 'msrp', 'list price', 'handling', 'postage', 'from ', 'klarna', 'afterpay'];
  if (badKeywords.some(k => text.includes(k))) score -= 40;

  for (let parent = element.parentElement, i = 0; parent && i < 6; parent = parent.parentElement, i++) {
    const p = `${typeof parent.className === 'string' ? parent.className : ''} ${parent.id || ''}`.toLowerCase();
    if (/related|similar|also-bought|recommend|upsell|cross-sell|carousel|slider|recently|shipping|delivery|cart-drawer|minicart|mini-cart/.test(p)) {
      score -= 60;
      break;
    }
  }

  if (element.hasAttribute('data-price') || element.hasAttribute('data-product-price')) score += 5;

  return score;
}

function getDOMDistance(a, b) {
  if (!a || !b) return Infinity;
  const chainA = getParentChain(a);
  const chainB = getParentChain(b);
  for (let i = 0; i < chainA.length; i++) {
    const j = chainB.indexOf(chainA[i]);
    if (j !== -1) return i + j;
  }
  return Infinity;
}

function getParentChain(el) {
  const chain = [];
  for (let node = el; node && chain.length < 15; node = node.parentElement) chain.push(node);
  return chain;
}

/**
 * Visual heuristic detection. Works on any store layout.
 */
function extractFromPage(mode) {
  const ctx = getContext();
  const pathname = window.location.pathname.toLowerCase();
  const urlPatterns = ['/product', '/item', '/dp/', '/p/', '/itm/', '/goods/', '/pd/', '/buy/', '/detail',
    '-p-', '/produkt', '/produit', '/produto', '/producto', '/toode', '/tuote', '/artikel', '.html'];
  const hasProductUrl = urlPatterns.some(p => pathname.includes(p));
  const hasProductId = /\/\d{5,}/.test(pathname) || /[?&](product|item|sku|id|pid)=\w+/i.test(window.location.search);

  const addToCartButton = findAddToCartButton();

  // In auto mode we need at least one structural product signal; otherwise
  // we would start tracking random pages that merely contain a price.
  if (mode === 'auto' && !addToCartButton && !hasProductUrl && !hasProductId) {
    debug(LOG, 'No product page signals for heuristic detection');
    return null;
  }

  const titleElement =
    document.querySelector('h1[itemprop="name"]') ||
    document.querySelector('h1[class*="product" i]') ||
    document.querySelector('h1[id*="product" i]') ||
    document.querySelector('main h1') ||
    document.querySelector('h1');

  const title = cleanText(titleElement?.textContent) || getMetaTitle(document);
  if (!title || title.length < 3) {
    debug(LOG, 'No product title found');
    return null;
  }

  // Score all candidates; there is no fixed selector list for unknown stores
  const candidates = findAllPriceCandidates(ctx);
  for (const c of candidates) c.score = scorePriceCandidate(c, titleElement, addToCartButton);
  candidates.sort((a, b) => b.score - a.score);

  debug(LOG, 'Top price candidates:', candidates.slice(0, 3).map(c => `${c.text} (${Math.round(c.score)})`));

  const winner = candidates[0];
  if (!winner || winner.score < 60) {
    debug(LOG, 'No convincing price candidate');
    return null;
  }

  const imageUrl =
    getMetaImage(document) ||
    document.querySelector('[itemprop="image"]')?.getAttribute('src') ||
    document.querySelector('[class*="product" i] img[src], main img[src]')?.getAttribute('src') ||
    null;

  let confidence = 0.35;
  if (hasProductUrl || hasProductId) confidence += 0.1;
  if (titleElement) confidence += 0.1;
  if (addToCartButton) confidence += 0.2;
  if (winner.score >= 100) confidence += 0.15;
  else if (winner.score >= 80) confidence += 0.1;
  if (imageUrl) confidence += 0.05;

  return {
    title,
    price: winner.parsed,
    imageUrl: absoluteUrl(imageUrl, window.location.href),
    sku: document.querySelector('[itemprop="sku"]')?.textContent?.trim() || null,
    availability: null,
    priceSelector: buildSelector(winner.element),
    confidence: Math.min(confidence, 0.84),
    detectionMethod: 'heuristic'
  };
}

/**
 * Build a product from an element the user picked on the page.
 * @param {Element} element
 * @returns {Promise<Object|null>}
 */
export async function buildProductFromElement(element) {
  const ctx = getContext();
  const text = (element.getAttribute('content') || element.textContent || '').replace(/\s+/g, ' ').trim();
  const parsed = parsePrice(text.slice(0, 80), { domain: ctx.domain, locale: ctx.locale });
  if (!parsed || !(parsed.numeric > 0)) return null;

  const structured = (() => {
    try { return extractStructuredProduct(document, ctx); } catch (_) { return null; }
  })();

  // Keep the currency from structured data when the picked text has no symbol
  if (structured?.price?.currency && !CURRENCY_HINT.test(text)) {
    parsed.currency = structured.price.currency;
    parsed.symbol = structured.price.symbol;
  }

  const title =
    structured?.title ||
    cleanText(document.querySelector('h1')?.textContent) ||
    getMetaTitle(document);

  return await enhanceProductData({
    title: title || document.title,
    price: parsed,
    imageUrl: structured?.imageUrl || getMetaImage(document),
    sku: structured?.sku || null,
    availability: null,
    priceSelector: buildSelector(element),
    confidence: 1,
    detectionMethod: 'manual'
  });
}

/**
 * Add ids, thumbnail, and normalise fields.
 */
async function enhanceProductData(data) {
  // Prefer the canonical product URL; strip cart/action/tracking params so a
  // later background check can never repeat an action like add-to-cart.
  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  let canonicalUrl = null;
  try {
    if (canonical && new URL(canonical).hostname === window.location.hostname &&
        new URL(canonical).pathname.length > 1) {
      canonicalUrl = sanitizeProductUrl(canonical);
    }
  } catch (_) { /* ignore bad canonical */ }
  data.url = canonicalUrl || sanitizeProductUrl(data.url || window.location.href);
  if (!data.url) {
    debug(LOG, 'Page URL is a cart/checkout action, not tracking');
    return null;
  }
  data.domain = data.domain || window.location.hostname;
  data.title = cleanText(data.title) || 'Unknown Product';
  if (data.title.length > 200) data.title = data.title.slice(0, 197) + '...';

  // Variant chosen on the page (size, pack, colour…). Remember it so
  // background checks read this variant's price, not the default one.
  try {
    const variant = getSelectedVariant(document, getContext());
    if (variant) {
      if (variant.price && data.detectionMethod !== 'manual') {
        data.price = { ...variant.price };
      }
      if (variant.price?.availability) data.availability = variant.price.availability;
      data.variant = {
        platform: variant.platform,
        id: variant.id || null,
        sku: variant.sku || null,
        attributes: variant.attributes || {},
        label: variant.label || null
      };
      if (variant.label && !data.title.toLowerCase().includes(variant.label.toLowerCase())) {
        data.title = `${data.title} – ${variant.label}`;
      }
    }
  } catch (error) {
    debugWarn(LOG, 'Variant detection failed:', error);
  }

  data.availability = normalizeAvailability(data.availability);
  data.productId = generateProductId(data.url, data.title, data.domain);
  data.detectedAt = Date.now();

  if (data.imageUrl) data.imageUrl = absoluteUrl(data.imageUrl, data.url);

  if (data.imageUrl && !data.imageUrl.startsWith('data:')) {
    try {
      const thumbnail = await createOptimizedThumbnail(data.imageUrl, 80, 80);
      if (thumbnail && thumbnail.startsWith('data:')) {
        data.imageThumbnail = thumbnail;
        data.hasImage = true;
      } else {
        data.hasImage = false;
        // Background can retry with host permissions (no CORS taint there).
        // It discards the URL afterwards.
        data.imageSourceUrl = data.imageUrl;
      }
    } catch (error) {
      debugWarn(LOG, 'Thumbnail creation failed:', error);
      data.hasImage = false;
      data.imageSourceUrl = data.imageUrl;
    }
    delete data.imageUrl;
  } else {
    data.hasImage = false;
    delete data.imageUrl;
  }

  return data;
}

/**
 * Small on-page confirmation toast. Shared by auto & manual tracking.
 */
export function showTrackingBadge(product, message) {
  const existing = document.getElementById('price-genius-badge');
  if (existing) existing.remove();

  const host = document.createElement('div');
  host.id = 'price-genius-badge';
  host.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;';
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    .toast{display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:12px;
      background:#0f172a;color:#f8fafc;font:500 14px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
      box-shadow:0 10px 30px rgba(15,23,42,.35);max-width:340px;
      animation:in .35s cubic-bezier(.34,1.56,.64,1)}
    .dot{flex:none;width:22px;height:22px;border-radius:50%;background:#14b8a6;display:grid;place-items:center}
    .t{overflow:hidden}.t b{display:block;font-weight:600}
    .t span{display:block;color:#94a3b8;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    @keyframes in{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}`;

  const toast = document.createElement('div');
  toast.className = 'toast';
  const dot = document.createElement('div');
  dot.className = 'dot';
  dot.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2L5 8.5L9.5 3.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const t = document.createElement('div');
  t.className = 't';
  const b = document.createElement('b');
  b.textContent = message || `Price Genius is tracking ${product?.price?.formatted || ''}`.trim();
  const s = document.createElement('span');
  s.textContent = product?.title || '';
  t.append(b, s);
  toast.append(dot, t);
  shadow.append(style, toast);
  (document.body || document.documentElement).appendChild(host);

  setTimeout(() => {
    toast.style.transition = 'opacity .3s, transform .3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    setTimeout(() => host.remove(), 320);
  }, 4500);
}
