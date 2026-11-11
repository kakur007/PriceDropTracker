/**
 * Page Extractor - shared, DOM-only product/price extraction
 *
 * One implementation used everywhere a page has to be read:
 *   - content scripts (live page)
 *   - Firefox background page (DOMParser)
 *   - Chrome offscreen document (DOMParser)
 *
 * Everything here works on a plain Document and never touches layout APIs
 * (getComputedStyle etc.), so the same code gives the same answer for a live
 * page and for HTML fetched in the background. That keeps the price we show
 * at "track" time consistent with the price we see on later refreshes.
 */

import { parsePrice } from './currency-parser.js';
import { CURRENCIES } from './currency-data.js';
import { normalizeAvailability } from './alert-rules.js';

/**
 * Availability from meta tags / microdata when JSON-LD doesn't say.
 */
function findAvailabilityHint(doc) {
  const el = doc.querySelector(
    'meta[property="product:availability"], meta[property="og:availability"], ' +
    '[itemprop="availability"][href], [itemprop="availability"][content], link[itemprop="availability"]'
  );
  if (!el) return null;
  return normalizeAvailability(el.getAttribute('content') || el.getAttribute('href'));
}

// JSON-LD keys whose Product children are *other* products (recommendations,
// listings, accessories). Descending into them causes false positives.
const SKIP_SCHEMA_KEYS = new Set([
  'isRelatedTo', 'isSimilarTo', 'isAccessoryOrSparePartFor', 'isConsumableFor',
  'itemListElement', 'relatedLink', 'mentions', 'review', 'reviews', 'isVariantOf'
]);

// priceSpecification types that describe a non-payable reference price
const REFERENCE_PRICE_TYPES = /ListPrice|StrikethroughPrice|SRP|MSRP|InvoicePrice/i;

/**
 * Normalise Schema.org @type to an array of short names.
 */
export function getSchemaTypes(node) {
  const raw = node?.['@type'];
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw])
    .filter(t => typeof t === 'string')
    .map(t => t.replace(/^https?:\/\/schema\.org\//i, ''));
}

function hasType(node, ...names) {
  const types = getSchemaTypes(node);
  return names.some(n => types.includes(n));
}

/**
 * Parse JSON-LD text leniently. Real stores ship JSON-LD with HTML comments,
 * CDATA wrappers, raw newlines/tabs inside strings and trailing commas.
 */
export function parseJsonLenient(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    // fall through to cleanup
  }

  let cleaned = text
    .replace(/^\s*<!--/, '')
    .replace(/-->\s*$/, '')
    .replace(/^\s*\/\/\s*<!\[CDATA\[/, '')
    .replace(/\/\/\s*\]\]>\s*$/, '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .trim();

  // Escape control characters that appear inside string literals
  cleaned = cleaned.replace(/"(?:[^"\\]|\\.)*"/gs, str =>
    str.replace(/[\u0000-\u001f]/g, ch => {
      if (ch === '\n') return '\\n';
      if (ch === '\r') return '\\r';
      if (ch === '\t') return '\\t';
      return '';
    })
  );

  // Trailing commas
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    return null;
  }
}

/**
 * All parsed JSON-LD blocks on the page.
 */
export function getJsonLdBlocks(doc) {
  const blocks = [];
  for (const script of doc.querySelectorAll('script[type="application/ld+json" i]')) {
    const data = parseJsonLenient(script.textContent);
    if (data) blocks.push(data);
  }
  return blocks;
}

/**
 * Collect Product / ProductGroup nodes, skipping recommendation sub-trees.
 */
export function findProductNodes(node, out = [], seen = new WeakSet(), depth = 0) {
  if (!node || typeof node !== 'object' || seen.has(node) || depth > 12) return out;
  seen.add(node);

  if (Array.isArray(node)) {
    for (const item of node) findProductNodes(item, out, seen, depth + 1);
    return out;
  }

  if (hasType(node, 'Product', 'ProductGroup', 'IndividualProduct', 'ProductModel', 'Vehicle', 'Car', 'Book')) {
    // Book/Vehicle only count when they carry offers
    if (hasType(node, 'Product', 'ProductGroup', 'IndividualProduct', 'ProductModel') || node.offers) {
      out.push(node);
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (SKIP_SCHEMA_KEYS.has(key)) continue;
    if (value && typeof value === 'object') {
      findProductNodes(value, out, seen, depth + 1);
    }
  }
  return out;
}

function currencySymbol(code) {
  return CURRENCIES[code]?.symbol || code;
}

/**
 * Build a price object from a structured (machine readable) value.
 * Schema.org mandates "." as decimal separator, but some stores emit
 * localised strings ("1.299,00"), so only clean numbers bypass the parser.
 */
export function buildStructuredPrice(rawValue, currencyCode, ctx = {}, method = 'structured') {
  if (rawValue === null || rawValue === undefined || rawValue === '') return null;

  let numeric = null;
  const code = typeof currencyCode === 'string' && /^[A-Za-z]{3}$/.test(currencyCode.trim())
    ? currencyCode.trim().toUpperCase()
    : null;

  if (typeof rawValue === 'number' && isFinite(rawValue)) {
    numeric = rawValue;
  } else if (typeof rawValue === 'string') {
    const s = rawValue.trim();
    if (/^\d+(\.\d{1,2})?$/.test(s) || /^\d+\.\d{4,}$/.test(s)) {
      numeric = parseFloat(s);
    } else {
      const parsed = parsePrice(code ? `${s} ${code}` : s, {
        domain: ctx.domain,
        locale: ctx.locale,
        expectedCurrency: code || ctx.expectedCurrency
      });
      if (parsed) {
        if (code) {
          parsed.currency = code;
          parsed.symbol = currencySymbol(code);
        }
        parsed.method = method;
        return parsed.numeric > 0 ? parsed : null;
      }
    }
  }

  if (numeric === null || !(numeric > 0) || numeric > 99999999) return null;

  let finalCode = code;
  let confidence = 0.95;
  if (!finalCode) {
    // No explicit currency: let the parser infer it from domain/locale
    const guess = parsePrice(String(numeric), {
      domain: ctx.domain,
      locale: ctx.locale,
      expectedCurrency: ctx.expectedCurrency
    });
    finalCode = ctx.expectedCurrency || guess?.currency || 'USD';
    confidence = 0.85;
  }

  const symbol = currencySymbol(finalCode);
  return {
    numeric: Math.round(numeric * 100) / 100,
    currency: finalCode,
    symbol,
    formatted: formatAmount(numeric, finalCode, ctx.locale),
    raw: String(rawValue),
    locale: ctx.locale || 'en-US',
    confidence,
    method
  };
}

function formatAmount(amount, currency, locale) {
  try {
    return new Intl.NumberFormat(locale || 'en-US', { style: 'currency', currency }).format(amount);
  } catch (_) {
    return `${currencySymbol(currency)}${Number(amount).toFixed(2)}`;
  }
}

/**
 * Best payable price from an Offer / AggregateOffer / array of those.
 * Returns { price, regularPrice, availability } or null.
 */
export function priceFromOffers(offers, ctx = {}) {
  const list = (Array.isArray(offers) ? offers : [offers]).filter(o => o && typeof o === 'object');
  const expected = ctx.expectedCurrency;
  let best = null;
  let fallback = null;

  const consider = (price, offer, regular) => {
    if (!price) return;
    const candidate = { price, regularPrice: regular || null, availability: offer.availability || null };
    if (expected && price.currency !== expected) {
      if (!fallback) fallback = candidate;
      return;
    }
    // Prefer in-stock, then lowest price
    const inStock = !/OutOfStock|Discontinued|SoldOut/i.test(String(offer.availability || ''));
    const bestInStock = best && !/OutOfStock|Discontinued|SoldOut/i.test(String(best.availability || ''));
    if (!best || (inStock && !bestInStock) || (inStock === bestInStock && price.numeric < best.price.numeric)) {
      best = candidate;
    }
  };

  for (const offer of list) {
    const text = JSON.stringify(offer).toLowerCase();
    if (text.includes('approximately') || text.includes('approx.')) continue;

    // Nested offers (AggregateOffer.offers)
    if (offer.offers && hasType(offer, 'AggregateOffer')) {
      const nested = priceFromOffers(offer.offers, ctx);
      if (nested) consider(nested.price, { availability: nested.availability }, nested.regularPrice);
    }

    const currency = offer.priceCurrency || offer.priceSpecification?.priceCurrency || ctx.expectedCurrency;
    let regular = null;
    let value = offer.price ?? offer.lowPrice;

    // priceSpecification can hold the real price (and list price)
    const specs = offer.priceSpecification
      ? (Array.isArray(offer.priceSpecification) ? offer.priceSpecification : [offer.priceSpecification])
      : [];
    for (const spec of specs) {
      if (!spec || typeof spec !== 'object') continue;
      const specValue = spec.price ?? spec.minPrice;
      if (specValue === undefined) continue;
      if (REFERENCE_PRICE_TYPES.test(String(spec.priceType || ''))) {
        regular = buildStructuredPrice(specValue, spec.priceCurrency || currency, ctx);
      } else if (value === undefined || value === null || value === '') {
        value = specValue;
      }
    }

    if (value === undefined || value === null || value === '') {
      value = offer.highPrice;
    }

    const price = buildStructuredPrice(value, currency, ctx, 'schemaOrg');
    if (regular && price && regular.numeric <= price.numeric) regular = null;
    consider(price, offer, regular ? regular.numeric : null);
  }

  return best || fallback;
}

function firstImage(image) {
  if (!image) return null;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) return firstImage(image[0]);
  return image.url || image.contentUrl || image['@id'] || null;
}

/**
 * 2 = same path and query, 1 = same path, 0 = different / unknown
 */
function urlMatchScore(candidate, pageUrl) {
  if (!candidate || !pageUrl || typeof candidate !== 'string') return 0;
  try {
    const a = new URL(candidate, pageUrl);
    const b = new URL(pageUrl);
    if (a.hostname.replace(/^www\./, '') !== b.hostname.replace(/^www\./, '')) return 0;
    if (a.pathname.replace(/\/$/, '') !== b.pathname.replace(/\/$/, '')) return 0;
    const qa = new URLSearchParams(a.search); qa.sort();
    const qb = new URLSearchParams(b.search); qb.sort();
    return qa.toString() === qb.toString() ? 2 : 1;
  } catch (_) {
    return 0;
  }
}


/**
 * Extract product from Schema.org JSON-LD.
 */
export function extractFromJsonLd(doc, ctx = {}) {
  const candidates = [];

  for (const block of getJsonLdBlocks(doc)) {
    for (const node of findProductNodes(block)) {
      let offerResult = node.offers ? priceFromOffers(node.offers, ctx) : null;

      // ProductGroup: pick the variant matching the URL, else the cheapest
      if (!offerResult && node.hasVariant) {
        const variants = (Array.isArray(node.hasVariant) ? node.hasVariant : [node.hasVariant])
          .filter(v => v && v.offers);
        const scored = variants.map(v => ({ v, score: urlMatchScore(v.url || v.offers?.url, ctx.url) }));
        const top = Math.max(0, ...scored.map(x => x.score));
        const variantFromUrl = top > 0 && scored.filter(x => x.score === top).length === 1
          ? scored.find(x => x.score === top).v
          : null;
        const pool = variantFromUrl ? [variantFromUrl] : variants;
        for (const v of pool) {
          const r = priceFromOffers(v.offers, ctx);
          if (r && (!offerResult || r.price.numeric < offerResult.price.numeric)) offerResult = r;
        }
      }

      if (!offerResult) continue;

      const brand = typeof node.brand === 'string' ? node.brand : node.brand?.name;
      candidates.push({
        title: cleanText(node.name) || null,
        price: offerResult.price,
        regularPrice: offerResult.regularPrice,
        imageUrl: firstImage(node.image),
        sku: node.sku || node.gtin13 || node.gtin || node.mpn || node.productID || null,
        brand: brand || null,
        availability: offerResult.availability,
        isGroup: hasType(node, 'ProductGroup'),
        urlScore: Math.max(urlMatchScore(node.url || node['@id'], ctx.url), urlMatchScore(node.offers?.url, ctx.url))
      });
    }
  }

  if (candidates.length === 0) return null;

  // Prefer the node describing *this* URL (exact query match beats path
  // match), then a ProductGroup (it resolves variants itself), then any
  // node with a title.
  const bestScore = Math.max(...candidates.map(c => c.urlScore));
  const exact = candidates.filter(c => c.urlScore === bestScore && bestScore > 0);
  const chosen =
    (exact.length === 1 ? exact[0] : null) ||
    (bestScore === 2 ? exact.find(c => c.title) : null) ||
    candidates.find(c => c.isGroup) ||
    candidates.find(c => c.title) ||
    candidates[0];

  if (chosen.regularPrice) chosen.price.regularPrice = chosen.regularPrice;

  return {
    title: chosen.title || getMetaTitle(doc),
    price: chosen.price,
    imageUrl: chosen.imageUrl || getMetaImage(doc),
    sku: chosen.sku,
    availability: chosen.availability,
    confidence: 0.95,
    detectionMethod: 'schemaOrg'
  };
}

/**
 * Open Graph / product meta tags (Facebook catalog, Pinterest rich pins…)
 */
export function extractFromMeta(doc, ctx = {}) {
  const meta = sel => {
    const el = doc.querySelector(sel);
    return el ? (el.getAttribute('content') || '').trim() : '';
  };

  const amount =
    meta('meta[property="product:sale_price:amount"]') ||
    meta('meta[property="og:price:amount"]') ||
    meta('meta[property="product:price:amount"]') ||
    meta('meta[name="product:price:amount"]') ||
    meta('meta[property="product:price"]') ||
    meta('meta[name="twitter:data1"][content*="$"], meta[name="twitter:data1"][content*="€"], meta[name="twitter:data1"][content*="£"]') ||
    meta('meta[itemprop="price"]');

  if (!amount) return null;

  const currency =
    meta('meta[property="product:sale_price:currency"]') ||
    meta('meta[property="og:price:currency"]') ||
    meta('meta[property="product:price:currency"]') ||
    meta('meta[name="product:price:currency"]') ||
    meta('meta[itemprop="priceCurrency"]');

  const price = buildStructuredPrice(amount, currency, ctx, 'openGraph');
  if (!price) return null;

  const title = getMetaTitle(doc);
  if (!title) return null;

  const ogType = meta('meta[property="og:type"]').toLowerCase();
  return {
    title,
    price,
    imageUrl: getMetaImage(doc),
    sku: meta('meta[property="product:retailer_item_id"]') || null,
    availability: meta('meta[property="product:availability"], meta[property="og:availability"]') || null,
    confidence: ogType.includes('product') ? 0.88 : 0.82,
    detectionMethod: 'openGraph'
  };
}

/**
 * Schema.org microdata (itemscope/itemprop)
 */
export function extractFromMicrodata(doc, ctx = {}) {
  const scopes = doc.querySelectorAll('[itemscope][itemtype*="schema.org/Product" i], [itemscope][itemtype*="schema.org/IndividualProduct" i]');

  for (const scope of scopes) {
    // Skip products nested inside another product (related items)
    if (scope.parentElement?.closest('[itemscope][itemtype*="schema.org/Product" i]')) continue;

    const valueOf = el => {
      if (!el) return '';
      return (el.getAttribute('content') || el.getAttribute('value') || el.textContent || '').trim();
    };

    // Only properties that belong to this product, not to nested products
    const own = selector => Array.from(scope.querySelectorAll(selector))
      .find(el => el.closest('[itemscope][itemtype*="schema.org/Product" i], [itemscope][itemtype*="schema.org/IndividualProduct" i]') === scope) || null;

    const priceEl = own('[itemprop="price"]') || own('[itemprop="lowPrice"]');
    if (!priceEl) continue;

    const currency = valueOf(own('[itemprop="priceCurrency"]'));
    const rawPrice = valueOf(priceEl);
    let price = buildStructuredPrice(rawPrice, currency, ctx, 'microdata');

    // `content` sometimes in minor units (eBay) - prefer visible text if they disagree wildly
    const visible = priceEl.textContent?.trim();
    if (price && visible && priceEl.getAttribute('content')) {
      const visiblePrice = parsePrice(visible, { domain: ctx.domain, locale: ctx.locale, expectedCurrency: price.currency });
      if (visiblePrice && visiblePrice.numeric > 0 && Math.abs(visiblePrice.numeric * 100 - price.numeric) < 1) {
        price = { ...price, numeric: visiblePrice.numeric };
      }
    }
    if (!price) continue;

    const nameEl = own('[itemprop="name"]');
    const title = valueOf(nameEl) || getMetaTitle(doc);
    if (!title) continue;

    const imgEl = own('[itemprop="image"]');
    const imageUrl = imgEl
      ? (imgEl.getAttribute('src') || imgEl.getAttribute('content') || imgEl.getAttribute('href') || imgEl.getAttribute('data-src'))
      : getMetaImage(doc);

    const availEl = own('[itemprop="availability"]');
    return {
      title: cleanText(title),
      price,
      imageUrl,
      sku: valueOf(own('[itemprop="sku"]')) || null,
      availability: availEl ? (availEl.getAttribute('href') || availEl.getAttribute('content') || null) : null,
      confidence: 0.85,
      detectionMethod: 'microdata'
    };
  }

  return null;
}

/**
 * Shopify (and similar) embedded product JSON. Shopify product JSON stores
 * integer prices in minor units (cents).
 */
export function extractFromEmbeddedJson(doc, ctx = {}) {
  const currency =
    doc.querySelector('meta[property="og:price:currency"]')?.getAttribute('content') ||
    doc.querySelector('meta[property="product:price:currency"]')?.getAttribute('content') ||
    doc.querySelector('meta[itemprop="priceCurrency"]')?.getAttribute('content') ||
    null;

  const scripts = doc.querySelectorAll(
    'script[type="application/json"][id*="ProductJson" i], script[type="application/json"][id*="product-json" i], ' +
    'script[type="application/json"][data-product-json], script[type="application/json"][id^="product" i]'
  );

  for (const script of scripts) {
    const data = parseJsonLenient(script.textContent);
    const result = normalizeEmbeddedProduct(data, currency || ctx.expectedCurrency, ctx, doc);
    if (result) return result;
  }

  // ShopifyAnalytics.meta = {...,"product":{...}}
  for (const script of doc.querySelectorAll('script:not([src])')) {
    const text = script.textContent || '';
    if (!text.includes('ShopifyAnalytics') || !text.includes('variants')) continue;
    const metaMatch = text.match(/var\s+meta\s*=\s*(\{.*?\});/s);
    const data = metaMatch ? parseJsonLenient(metaMatch[1]) : null;
    const result = normalizeEmbeddedProduct(data?.product, currency || data?.currency || ctx.expectedCurrency, ctx, doc);
    if (result) return result;
  }

  return null;
}

function toMajorUnits(raw) {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) ? raw / 100 : raw;
  }
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    return parseInt(raw, 10) / 100;
  }
  return raw;
}

function normalizeEmbeddedProduct(data, currency, ctx, doc) {
  if (!data || typeof data !== 'object') return null;
  const product = data.product || data;
  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (variants.length === 0 && product.price === undefined) return null;

  // Variant selected in the URL wins (?variant=123)
  let variant = null;
  try {
    const variantId = new URL(ctx.url || '').searchParams.get('variant');
    if (variantId) variant = variants.find(v => String(v.id) === variantId) || null;
  } catch (_) { /* ignore */ }
  variant = variant || variants.find(v => v.available !== false) || variants[0] || null;

  const rawPrice = variant?.price ?? product.price ?? product.price_min;
  if (rawPrice === undefined || rawPrice === null) return null;

  const price = buildStructuredPrice(toMajorUnits(rawPrice), currency, ctx, 'embeddedProductJson');
  if (!price) return null;

  const compare = variant?.compare_at_price ?? product.compare_at_price;
  if (compare) {
    const regular = Number(toMajorUnits(compare));
    if (regular > price.numeric) price.regularPrice = regular;
  }

  const title = cleanText(product.title || product.name) || getMetaTitle(doc);
  if (!title) return null;

  const img = variant?.featured_image?.src || product.featured_image || (Array.isArray(product.images) ? product.images[0] : null);
  return {
    title,
    price,
    imageUrl: typeof img === 'string' ? img : img?.src || getMetaImage(doc),
    sku: variant?.sku || (variant?.id ? String(variant.id) : null) || (product.id ? String(product.id) : null),
    availability: variant?.available === false ? 'OutOfStock' : null,
    confidence: 0.9,
    detectionMethod: 'embeddedProductJson'
  };
}

/**
 * Run every structured extractor and return the most trustworthy result.
 */
export function extractStructuredProduct(doc, ctx = {}) {
  const extractors = [extractFromJsonLd, extractFromEmbeddedJson, extractFromMicrodata, extractFromMeta];
  let best = null;
  for (const fn of extractors) {
    try {
      const result = fn(doc, ctx);
      if (result && (!best || result.confidence > best.confidence)) best = result;
      if (best && best.confidence >= 0.95) break;
    } catch (_) {
      // one broken extractor must never break the others
    }
  }
  if (best?.imageUrl) best.imageUrl = absoluteUrl(best.imageUrl, ctx.url);
  return best;
}

/**
 * Read the price from a remembered CSS selector (manual pick or heuristic).
 */
export function extractPriceBySelector(doc, selector, ctx = {}) {
  if (!selector) return null;
  let el = null;
  try {
    el = doc.querySelector(selector);
  } catch (_) {
    return null;
  }
  if (!el) return null;
  const text = el.getAttribute('content') || el.getAttribute('data-price') || el.textContent || '';
  const parsed = parsePrice(text.trim().slice(0, 80), {
    domain: ctx.domain,
    locale: ctx.locale,
    expectedCurrency: ctx.expectedCurrency
  });
  if (!parsed || !(parsed.numeric > 0)) return null;
  parsed.method = 'savedSelector';
  return parsed;
}

// Known site selectors used as a background-refresh fallback. Generic
// selectors come last and are flagged as weak by the caller.
const SITE_SELECTORS = [
  '#corePrice_feature_div .a-offscreen',
  '#corePriceDisplay_desktop_feature_div .a-offscreen',
  '.reinventPricePriceToPayMargin .a-offscreen',
  '#priceblock_dealprice',
  '#priceblock_ourprice',
  '.x-price-primary .ux-textspans',
  '#prcIsum',
  '[data-test="product-price"]',
  '[data-testid="customer-price"] span',
  '[itemprop="price"][data-seo-id="hero-price"]',
  '#lblSellingPrice',
  '.product-info-main .price-final_price .price',   // Magento 2
  '.summary .price ins .amount',                     // WooCommerce sale
  '.summary .price .amount',                         // WooCommerce
  '.product-single__price',                          // Shopify themes
  '.price__current, .price-item--sale, .price-item--regular',
  '#our_price_display, .current-price-value',        // PrestaShop
  '.product-price .price-new, #product .price-new',  // OpenCart
  '.productView-price .price--withTax'               // BigCommerce
];

const GENERIC_SELECTORS = ['[itemprop="price"]', '[data-price]', '.price'];

/**
 * Background refresh: find the current price in a fetched document.
 * hints: { priceSelector, detectionMethod }
 * @returns {{success:boolean, price:number|null, currency:string|null, detectionMethod:string, weak:boolean}}
 */
export function extractPriceForRefresh(doc, ctx = {}, hints = {}) {
  const structured = extractStructuredProduct(doc, ctx);
  const availability = normalizeAvailability(structured?.availability) || findAvailabilityHint(doc);

  const ok = (parsed, method, weak = false) => ({
    success: true,
    price: parsed.numeric,
    currency: parsed.currency,
    detectionMethod: method,
    availability,
    weak
  });

  // A specific variant was tracked: only that variant's price counts. Falling
  // back to the page's default price would record another variant's price
  // (e.g. single item instead of a 60-pack) as a fake price change.
  if (hints.variant) {
    const v = priceForVariant(doc, hints.variant, ctx);
    if (v) {
      return { ...ok(v.price, 'variant'), availability: normalizeAvailability(v.availability) || availability };
    }
    return {
      success: false, price: null, currency: null, detectionMethod: 'none', availability, weak: false,
      error: 'The selected variant could not be found on the page'
    };
  }

  // A user-picked element is the most explicit signal we have
  if (hints.priceSelector && hints.detectionMethod === 'manual') {
    const p = extractPriceBySelector(doc, hints.priceSelector, ctx);
    if (p) return ok(p, 'savedSelector');
  }

  if (structured?.price) return ok(structured.price, structured.detectionMethod);

  if (hints.priceSelector) {
    const p = extractPriceBySelector(doc, hints.priceSelector, ctx);
    if (p) return ok(p, 'savedSelector');
  }

  for (const sel of SITE_SELECTORS) {
    const p = extractPriceBySelector(doc, sel, ctx);
    if (p) return ok(p, `selector: ${sel}`);
  }

  // Amazon split price
  const whole = doc.querySelector('.a-price-whole');
  if (whole) {
    const fraction = doc.querySelector('.a-price-fraction');
    const text = whole.textContent.replace(/[^\d]/g, '') + (fraction ? '.' + fraction.textContent.replace(/[^\d]/g, '') : '');
    const p = parsePrice(text, ctx);
    if (p && p.numeric > 0) return ok(p, 'selector: .a-price-whole');
  }

  for (const sel of GENERIC_SELECTORS) {
    const p = extractPriceBySelector(doc, sel, ctx);
    if (p) return ok(p, `selector: ${sel}`, true);
  }

  return { success: false, price: null, currency: null, detectionMethod: 'none', availability, weak: false, error: 'Could not find a price on the page' };
}

// ---------------------------------------------------------------- helpers

export function getMetaTitle(doc) {
  const t =
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
    doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ||
    doc.querySelector('h1')?.textContent ||
    doc.title;
  return cleanText(t);
}

export function getMetaImage(doc) {
  return (
    doc.querySelector('meta[property="og:image:secure_url"]')?.getAttribute('content') ||
    doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
    doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ||
    null
  );
}

export function cleanText(text) {
  if (!text || typeof text !== 'string') return '';
  const div = text.replace(/\s+/g, ' ').trim();
  // Decode the handful of entities that commonly leak through JSON-LD
  return div
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function absoluteUrl(url, base) {
  if (!url) return null;
  try {
    return new URL(url, base || undefined).href;
  } catch (_) {
    return url;
  }
}

/**
 * Build a reasonably stable CSS selector for an element so we can find the
 * same price again in a freshly fetched copy of the page.
 */
export function buildSelector(el) {
  if (!el || el.nodeType !== 1) return null;
  const doc = el.ownerDocument;
  const esc = s => (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(s) : s.replace(/([^\w-])/g, '\\$1');
  const looksGenerated = s => /\d{4,}|[a-f0-9]{8,}|^(ember|react|ng|vue|svelte)|__|--[a-z0-9]{5,}$/i.test(s);
  const unique = sel => {
    try { return doc.querySelectorAll(sel).length === 1; } catch (_) { return false; }
  };

  if (el.id && !looksGenerated(el.id) && unique(`#${esc(el.id)}`)) return `#${esc(el.id)}`;

  for (const attr of ['itemprop', 'data-testid', 'data-test', 'data-qa', 'data-price-type']) {
    const v = el.getAttribute(attr);
    if (v) {
      const sel = `${el.tagName.toLowerCase()}[${attr}="${v.replace(/"/g, '\\"')}"]`;
      if (unique(sel)) return sel;
    }
  }

  const parts = [];
  let node = el;
  while (node && node.nodeType === 1 && node !== doc.body && parts.length < 6) {
    let part = node.tagName.toLowerCase();
    if (node.id && !looksGenerated(node.id)) {
      parts.unshift(`#${esc(node.id)}`);
      const sel = parts.join(' > ');
      if (unique(sel)) return sel;
      break;
    }
    const classes = Array.from(node.classList || []).filter(c => !looksGenerated(c)).slice(0, 2);
    if (classes.length) part += classes.map(c => `.${esc(c)}`).join('');
    const parent = node.parentElement;
    if (parent) {
      const same = Array.from(parent.children).filter(c => c.tagName === node.tagName);
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    const sel = parts.join(' > ');
    if (unique(sel)) return sel;
    node = parent;
  }
  const sel = parts.join(' > ');
  return sel && unique(sel) ? sel : null;
}

// ------------------------------------------------------------- variants
//
// Many products come in variants (size, pack, colour) with different prices.
// The variant chosen on the page is applied by the store's JavaScript, which
// does not run when the background fetches the page - a fetched page shows
// the *default* variant. So we remember the chosen variant and, on refresh,
// read that variant's price from the variant data embedded in the HTML.

/**
 * Stable key used to compare variants.
 */
export function variantKey(variant) {
  if (!variant) return null;
  if (variant.id) return `id:${variant.id}`;
  if (variant.sku) return `sku:${variant.sku}`;
  if (variant.attributes && Object.keys(variant.attributes).length) {
    return 'attr:' + Object.entries(variant.attributes).sort().map(([k, v]) => `${k}=${v}`).join('&');
  }
  return null;
}

function wooVariations(doc) {
  const form = doc.querySelector('form.variations_form[data-product_variations]');
  if (!form) return null;
  const raw = form.getAttribute('data-product_variations');
  if (!raw || raw === 'false') return null; // large products load variations via AJAX
  const data = parseJsonLenient(raw);
  return Array.isArray(data) ? data : null;
}

function wooCurrency(doc, ctx) {
  const symbol = doc.querySelector('.woocommerce-Price-currencySymbol')?.textContent?.trim();
  if (symbol) {
    const parsed = parsePrice(`${symbol}1`, { domain: ctx.domain, locale: ctx.locale });
    if (parsed?.currency) return parsed.currency;
  }
  return ctx.expectedCurrency || null;
}

function wooMatches(variation, attributes) {
  const attrs = variation?.attributes || {};
  return Object.entries(attributes || {}).every(([k, v]) => !attrs[k] || String(attrs[k]) === String(v));
}

function shopifyVariants(doc, ctx) {
  const scripts = doc.querySelectorAll(
    'script[type="application/json"][id*="ProductJson" i], script[type="application/json"][id*="product-json" i], script[type="application/json"][data-product-json]'
  );
  for (const script of scripts) {
    const data = parseJsonLenient(script.textContent);
    const product = data?.product || data;
    if (Array.isArray(product?.variants) && product.variants.length > 1) return product.variants;
  }
  return null;
}

function jsonLdVariantOffers(doc) {
  const out = [];
  for (const block of getJsonLdBlocks(doc)) {
    for (const node of findProductNodes(block)) {
      const variants = node.hasVariant ? (Array.isArray(node.hasVariant) ? node.hasVariant : [node.hasVariant]) : [node];
      for (const v of variants) {
        const offers = v?.offers ? (Array.isArray(v.offers) ? v.offers : [v.offers]) : [];
        for (const offer of offers) {
          const sku = v.sku || offer.sku || null;
          if (sku) out.push({ sku: String(sku), offer });
        }
      }
    }
  }
  return out;
}

/**
 * The variant currently selected on a LIVE page (reads form state).
 * @returns {{platform, id, sku, attributes, label, price?:Object}|null}
 */
export function getSelectedVariant(doc, ctx = {}) {
  // WooCommerce
  const variations = wooVariations(doc);
  const form = doc.querySelector('form.variations_form');
  if (form) {
    const attributes = {};
    const labels = [];
    for (const select of form.querySelectorAll('select[name^="attribute_"]')) {
      if (!select.value) continue;
      attributes[select.name] = select.value;
      labels.push(select.selectedOptions?.[0]?.textContent?.trim() || select.value);
    }
    for (const input of form.querySelectorAll('input[name^="attribute_"]:checked')) {
      attributes[input.name] = input.value;
      labels.push(input.value);
    }
    const idValue = form.querySelector('input[name="variation_id"]')?.value;
    const id = idValue && idValue !== '0' ? String(idValue) : null;
    if (id || Object.keys(attributes).length) {
      const match = variations?.find(v => String(v.variation_id) === id) ||
        (Object.keys(attributes).length ? variations?.find(v => wooMatches(v, attributes)) : null);
      const variant = {
        platform: 'woocommerce',
        id: id || (match ? String(match.variation_id) : null),
        sku: match?.sku || null,
        attributes,
        label: labels.join(' / ') || null
      };
      if (match) variant.price = wooVariantPrice(match, doc, ctx);
      return variant.id || Object.keys(attributes).length ? variant : null;
    }
    return null;
  }

  // Shopify: ?variant= in the URL, or the product form's id field
  const variants = shopifyVariants(doc, ctx);
  if (variants) {
    let id = null;
    try { id = new URL(ctx.url || '').searchParams.get('variant'); } catch (_) { /* ignore */ }
    id = id || doc.querySelector('form[action*="/cart/add"] [name="id"]')?.value || null;
    const match = id ? variants.find(v => String(v.id) === String(id)) : null;
    if (match) {
      const currency = doc.querySelector('meta[property="og:price:currency"]')?.getAttribute('content') || ctx.expectedCurrency;
      return {
        platform: 'shopify',
        id: String(match.id),
        sku: match.sku || null,
        attributes: {},
        label: match.title && match.title !== 'Default Title' ? match.title : null,
        price: buildStructuredPrice(Number.isInteger(match.price) ? match.price / 100 : match.price, currency, ctx, 'variant')
      };
    }
  }
  return null;
}

function wooVariantPrice(variation, doc, ctx) {
  const price = buildStructuredPrice(variation.display_price, wooCurrency(doc, ctx), ctx, 'variant');
  if (price && Number(variation.display_regular_price) > price.numeric) {
    price.regularPrice = Number(variation.display_regular_price);
  }
  return price;
}

/**
 * Price of a remembered variant in a (fetched) document.
 * @returns {{price:Object, availability:string|null}|null}
 */
export function priceForVariant(doc, variant, ctx = {}) {
  if (!variant) return null;

  const variations = wooVariations(doc);
  if (variations) {
    const match = (variant.id && variations.find(v => String(v.variation_id) === String(variant.id))) ||
      (variant.sku && variations.find(v => v.sku && String(v.sku) === String(variant.sku))) ||
      (variant.attributes && Object.keys(variant.attributes).length && variations.find(v => wooMatches(v, variant.attributes)));
    if (match) {
      const price = wooVariantPrice(match, doc, ctx);
      if (price) return { price, availability: match.is_in_stock === false ? 'OutOfStock' : 'InStock' };
    }
  }

  const shopify = shopifyVariants(doc, ctx);
  if (shopify && variant.id) {
    const match = shopify.find(v => String(v.id) === String(variant.id));
    if (match) {
      const currency = doc.querySelector('meta[property="og:price:currency"]')?.getAttribute('content') || ctx.expectedCurrency;
      const price = buildStructuredPrice(Number.isInteger(match.price) ? match.price / 100 : match.price, currency, ctx, 'variant');
      if (price) return { price, availability: match.available === false ? 'OutOfStock' : 'InStock' };
    }
  }

  if (variant.sku) {
    const hit = jsonLdVariantOffers(doc).find(o => o.sku === String(variant.sku));
    if (hit) {
      const r = priceFromOffers(hit.offer, ctx);
      if (r) return { price: r.price, availability: r.availability || null };
    }
  }

  return null;
}

// ------------------------------------------------------------ deal check
//
// Signals for "is this discount real?" (see utils/deal-check.js).

// "lowest price" in the languages of EU stores (Omnibus directive notices)
const LOWEST_WORDS = /lowest|cheapest|niedrigst|tiefst|günstigst|madalaim|odavaim|le plus bas|más bajo|mas bajo|più basso|piu basso|laagste|najniższ|najnizsz|lägsta|lagsta|alin |alhaisin|halvin|zemākā|zemaka|mažiausia|maziausia|nejnižší|nejnizsi|najnižš|laveste|mais baixo|legalacsonyabb|cel mai mic|χαμηλότερη|най-ниска|najniž/i;
const THIRTY_DAYS = /\b30\b/;
const NOT_PRODUCT_AREA = 'header, footer, nav, [role="navigation"], [class*="related" i], [class*="recommend" i], [class*="carousel" i], [class*="upsell" i], [class*="cross-sell" i], [class*="similar" i]';

function priceTokens(text) {
  // number with optional currency on either side; "30" alone is excluded below
  const re = /(?:[$£€¥₹]|EUR|USD|GBP|PLN|SEK|NOK|DKK|CZK|HUF|RON|CHF)?\s*\d[\d\s.,'’]*(?:\d)(?:\s*(?:[$£€¥₹]|EUR|USD|GBP|zł|kr|Kč|Ft|lei|PLN|SEK|NOK|DKK|CZK|HUF|RON|CHF))?|(?:[$£€]\s*)\d/g;
  return text.match(re) || [];
}

/**
 * The store's "lowest price in the last 30 days" figure, if shown.
 * @returns {number|null}
 */
export function findLowest30Price(doc, ctx = {}) {
  const els = doc.querySelectorAll('p, span, div, small, li, dd, dt, td, strong, em, b');
  let best = null;
  for (const el of els) {
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 220 || !THIRTY_DAYS.test(text) || !LOWEST_WORDS.test(text)) continue;
    if (el.closest(NOT_PRODUCT_AREA)) continue;
    // innermost element carrying the sentence
    if (Array.from(el.children).some(c => THIRTY_DAYS.test(c.textContent || '') && LOWEST_WORDS.test(c.textContent || ''))) continue;

    let source = text;
    // price may live in the next element ("Lowest price 30 days: | €19.99")
    const hasPrice = priceTokens(text).some(t => !/^\s*30\s*$/.test(t));
    if (!hasPrice && el.nextElementSibling) source += ' ' + el.nextElementSibling.textContent;

    const after = source.slice(Math.max(0, source.search(LOWEST_WORDS)));
    for (const token of priceTokens(after)) {
      if (/^\s*30\s*$/.test(token)) continue;
      const parsed = parsePrice(token.trim(), { domain: ctx.domain, locale: ctx.locale, expectedCurrency: ctx.expectedCurrency });
      if (parsed && parsed.numeric > 0 && parsed.numeric !== 30) {
        best = best === null ? parsed.numeric : Math.min(best, parsed.numeric);
        break;
      }
    }
    if (best !== null) break;
  }
  return best;
}

function domDistance(a, b) {
  if (!a || !b) return 99;
  const chain = [];
  for (let n = a; n && chain.length < 20; n = n.parentElement) chain.push(n);
  let steps = 0;
  for (let n = b; n && steps < 20; n = n.parentElement, steps++) {
    const i = chain.indexOf(n);
    if (i !== -1) return i + steps;
  }
  return 99;
}

/**
 * The struck-through "was" price shown next to the current price.
 * @returns {number|null}
 */
export function findClaimedRegularPrice(doc, current, ctx = {}) {
  if (!(current > 0)) return null;
  const title = doc.querySelector('h1');
  const candidates = doc.querySelectorAll(
    'del, s, strike, [class*="old-price" i], [class*="oldprice" i], [class*="price-old" i], [class*="was-price" i], ' +
    '[class*="price-was" i], [class*="regular-price" i], [class*="price--compare" i], [class*="compare-at" i], ' +
    '[class*="strike" i], [class*="price-before" i], [class*="original-price" i], [class*="list-price" i], ' +
    '[class*="crossed" i], [data-price-type="oldPrice"], [data-test*="old-price" i], [data-testid*="original-price" i]'
  );
  let best = null;
  for (const el of candidates) {
    if (el.closest(NOT_PRODUCT_AREA)) continue;
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 40 || !/\d/.test(text)) continue;
    if (/save|spar|säästa|économ|ahorr|rispar|bespaar|oszczęd|\/\s*(kg|l|m|st|tk|pc)/i.test(text)) continue;
    const parsed = parsePrice(text, { domain: ctx.domain, locale: ctx.locale, expectedCurrency: ctx.expectedCurrency });
    if (!parsed || !(parsed.numeric > current * 1.01) || parsed.numeric > current * 20) continue;
    const distance = title ? domDistance(el, title) : 0;
    if (!best || distance < best.distance) best = { value: parsed.numeric, distance };
  }
  return best && best.distance <= 12 ? best.value : null;
}

/**
 * Both deal signals for a product page.
 */
export function getDealSignals(doc, product, ctx = {}) {
  const current = product?.price?.numeric;
  const structuredRegular = Number(product?.price?.regularPrice) > current ? Number(product.price.regularPrice) : null;
  const c = { ...ctx, expectedCurrency: product?.price?.currency || ctx.expectedCurrency };
  return {
    claimedRegular: structuredRegular || findClaimedRegularPrice(doc, current, c),
    lowest30: findLowest30Price(doc, c)
  };
}
