/**
 * Price Genius - Popup
 *
 * Top: what's on the current tab (track it / already tracking / pick price)
 * Below: searchable, sortable list of tracked products
 */

import browser, { executeScript } from '../utils/browser-polyfill.js';
import { debug, debugError } from '../utils/debug.js';
import { isUrlSupported, getStoreName } from '../utils/domain-validator.js';
import { hasPermissionForUrl, requestPermissionForUrl } from '../utils/permission-manager.js';
import { sanitizeProductUrl } from '../utils/url-sanitizer.js';
import { getAlert, describeAlert, globalMinDrop } from '../utils/alert-rules.js';

const state = {
  products: {},
  filter: 'all',
  sort: 'recent',
  query: '',
  tab: null,
  page: { kind: 'loading' },
  detected: null,
  hasSiteAccess: false,
  accessibleDomains: new Set(),
  settings: null,
  editingId: null,   // product whose alert editor is open
  alertDraft: null   // unsaved editor values (survive re-renders)
};

const $ = id => document.getElementById(id);

// ------------------------------------------------------------------ helpers

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function icon(pathD, { stroke = true } = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', pathD);
  if (stroke) {
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.7');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
  } else {
    path.setAttribute('fill', 'currentColor');
  }
  svg.append(path);
  return svg;
}

const ICONS = {
  plus: 'M10 4.5v11M4.5 10h11',
  target: 'M10 3v3M10 14v3M3 10h3M14 10h3M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  refresh: 'M16.5 10a6.5 6.5 0 1 1-1.9-4.6M16.5 3.5v3.8h-3.8',
  open: 'M11 3.5h5.5V9M16.5 3.5 9 11M14 12.5V16a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 4 16V7a.5.5 0 0 1 .5-.5H8',
  trash: 'M4 6h12M8 6V4.5h4V6M6 6l.7 9.5a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L14 6',
  check: 'M4.5 10.5 8 14l7.5-8',
  bell: 'M10 3.5a4.5 4.5 0 0 0-4.5 4.5v2.6L4 13.5h12l-1.5-2.9V8A4.5 4.5 0 0 0 10 3.5ZM8.3 15.5a1.8 1.8 0 0 0 3.4 0'
};

function formatPrice(amount, currency = 'USD', locale) {
  if (typeof amount !== 'number' || !isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat(locale || undefined, { style: 'currency', currency }).format(amount);
  } catch (_) {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function timeAgo(ts) {
  if (!ts) return 'never';
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function storeName(domain) {
  const shopify = (domain || '').match(/^([^.]+)\.myshopify\.com$/i);
  if (shopify) return shopify[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const name = getStoreName(domain || '');
  // getStoreName capitalises the first label for unknown stores; keep the
  // full domain there since "Shop" or "Www" says nothing.
  return name && !/^(Www|Shop|Store)$/i.test(name) ? name : (domain || '').replace(/^www\./, '');
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(url || '');
}

function send(type, data = {}) {
  return browser.runtime.sendMessage({ type, data });
}

let toastTimer = null;
function toast(message, { type = 'info', action = null, duration = 3200 } = {}) {
  const el = $('toast');
  el.className = `toast ${type === 'error' ? 'error' : ''}`;
  el.textContent = '';
  el.append(h('span', { text: message }));
  if (action) {
    el.append(h('button', {
      text: action.label,
      onclick: () => { el.hidden = true; action.run(); }
    }));
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, duration);
}

// ----------------------------------------------------------- price analysis

function baselinePrice(product) {
  const history = product.priceHistory || [];
  return history.length ? history[0].price : product.price?.numeric;
}

function lowestPrice(product) {
  const prices = (product.priceHistory || []).map(e => e.price).filter(p => p > 0);
  return prices.length ? Math.min(...prices) : product.price?.numeric;
}

function changePercent(product) {
  const base = baselinePrice(product);
  const now = product.price?.numeric;
  if (!(base > 0) || !(now > 0)) return 0;
  return ((now - base) / base) * 100;
}

function needsAttention(product) {
  let status = product.tracking?.status;
  if (status === 'no_permission' && state.accessibleDomains.has(product.domain)) status = 'active';
  return status === 'stale' || status === 'no_permission' || status === 'captcha_detected' || status === 'unsafe_url' ||
    (product.tracking?.failedChecks || 0) >= 3;
}

function sparkline(product) {
  const points = (product.priceHistory || []).map(e => e.price).filter(p => p > 0);
  if (points.length < 2) return null;
  const w = 56, hgt = 18, pad = 2;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const step = (w - pad * 2) / (points.length - 1);
  const d = points.map((p, i) =>
    `${i ? 'L' : 'M'}${(pad + i * step).toFixed(1)},${(hgt - pad - ((p - min) / span) * (hgt - pad * 2)).toFixed(1)}`
  ).join(' ');

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${hgt}`);
  const change = points[points.length - 1] - points[0];
  svg.setAttribute('class', `spark ${change < 0 ? 'down' : change > 0 ? 'up' : ''}`);
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.5');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('stroke-linecap', 'round');
  svg.append(path);
  return svg;
}

// ------------------------------------------------------------------- theme

async function initTheme() {
  let pref = 'system';
  try {
    pref = (await browser.storage.local.get('theme')).theme || 'system';
  } catch (_) { /* default */ }
  applyTheme(pref);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(document.body.dataset.pref));
}

function applyTheme(pref) {
  const dark = pref === 'dark' || (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.body.dataset.pref = pref;
  document.body.dataset.theme = dark ? 'dark' : 'light';
  $('themeToggleBtn').title = `Theme: ${pref}`;
}

async function cycleTheme() {
  const order = ['system', 'light', 'dark'];
  const next = order[(order.indexOf(document.body.dataset.pref || 'system') + 1) % order.length];
  applyTheme(next);
  toast(`Theme: ${next}`, { duration: 1200 });
  try { await browser.storage.local.set({ theme: next }); } catch (_) { /* ignore */ }
}

// ------------------------------------------------------------ current page

/** Runs inside the page (activeTab), returns detected product or error. */
async function detectInPage() {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  try {
    window.__PRICE_TRACKER_MANUAL_MODE__ = true;
    const { detectProduct } = await import(api.runtime.getURL('content-scripts/product-detector.js'));
    let product = await detectProduct({ mode: 'manual' });
    if (!product) {
      // JS-heavy stores may still be rendering
      await new Promise(r => setTimeout(r, 1200));
      product = await detectProduct({ mode: 'manual' });
    }
    return { ok: true, product };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

/** Runs inside the page: start the price picker. */
async function startPickerInPage() {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  const { startPicker } = await import(api.runtime.getURL('content-scripts/price-picker.js'));
  startPicker();
  return true;
}

async function inspectCurrentPage() {
  const tab = state.tab;
  if (!tab || !isHttpUrl(tab.url)) {
    state.page = { kind: 'unsupported' };
    renderPageCard();
    return;
  }

  state.hasSiteAccess = isUrlSupported(tab.url) || await hasPermissionForUrl(tab.url);

  const tracked = await send('FIND_PRODUCT_BY_URL', { url: tab.url }).then(r => r?.data).catch(() => null);
  if (tracked) {
    state.page = { kind: 'tracked', product: tracked };
    renderPageCard();
    return;
  }

  state.page = { kind: 'loading' };
  renderPageCard();

  try {
    const results = await executeScript({ target: { tabId: tab.id }, func: detectInPage });
    const result = results?.[0]?.result;
    if (!result?.ok) {
      debug('[Popup]', 'Detection failed:', result?.error);
      state.page = { kind: 'notFound' };
    } else if (result.product) {
      state.detected = result.product;
      const already = state.products[result.product.productId];
      state.page = already ? { kind: 'tracked', product: already } : { kind: 'detected', product: result.product };
    } else {
      state.page = { kind: 'notFound' };
    }
  } catch (error) {
    // e.g. browser store pages, PDFs, pages blocked by policy
    debug('[Popup]', 'Cannot access page:', error?.message);
    state.page = { kind: 'blocked' };
  }
  renderPageCard();
}

function siteAccessNote() {
  const tab = state.tab;
  if (!tab || state.hasSiteAccess) return null;
  const domain = new URL(tab.url).hostname.replace(/^www\./, '');
  return h('div', { class: 'page-note' },
    h('span', {}, 'Allow background checks on ', h('strong', { text: domain }), ' so we can spot drops while you browse elsewhere.'),
    h('button', { class: 'btn btn-secondary btn-small', onclick: grantSiteAccess }, 'Allow')
  );
}

function renderPageCard() {
  const card = $('pageCard');
  card.textContent = '';
  // Element.append() would render null as the text "null"
  const append = card.append.bind(card);
  card.append = (...nodes) => append(...nodes.filter(n => n !== null && n !== undefined && n !== false));
  const { kind, product } = state.page;

  if (kind === 'loading') {
    card.append(h('div', { class: 'page-loading' }, h('span', { class: 'spinner' }), 'Looking for a product on this page…'));
    return;
  }

  if (kind === 'unsupported') {
    card.append(
      h('div', { class: 'page-eyebrow' }, h('span', { class: 'dot' }), 'This tab'),
      h('p', { class: 'page-text', text: 'Open a product page in any online store to start tracking its price.' })
    );
    return;
  }

  if (kind === 'blocked') {
    card.append(
      h('div', { class: 'page-eyebrow' }, h('span', { class: 'dot' }), 'This tab'),
      h('p', { class: 'page-text', text: "The browser doesn't let extensions read this page. Try a regular store page." })
    );
    return;
  }

  if (kind === 'tracked') {
    const change = changePercent(product);
    card.append(
      h('div', { class: 'page-eyebrow ok' }, h('span', { class: 'dot' }), 'Tracking this product'),
      h('div', { class: 'page-row' },
        h('div', { style: 'min-width:0;flex:1' },
          h('div', { class: 'page-title', text: product.title }),
          h('div', { class: 'page-price' },
            formatPrice(product.price?.numeric, product.price?.currency, product.price?.locale),
            ' ',
            Math.abs(change) >= 0.5 ? h('span', { class: `pill ${change < 0 ? 'down' : 'up'}`, text: `${change < 0 ? '−' : '+'}${Math.abs(change).toFixed(0)}%` }) : null
          ),
          h('div', { class: 'muted', text: `Since ${new Date(product.tracking?.firstSeen || Date.now()).toLocaleDateString()} · lowest ${formatPrice(lowestPrice(product), product.price?.currency, product.price?.locale)}` })
        )
      ),
      h('div', { class: 'page-actions' },
        h('button', { class: 'btn btn-secondary btn-small', onclick: () => toggleAlertEditor(product.productId), 'aria-expanded': String(state.editingId === product.productId) },
          icon(ICONS.bell), `Alert: ${describeAlert(product, state.settings, v => money(product, v))}`),
        h('button', { class: 'btn btn-secondary btn-small', onclick: startPicker }, icon(ICONS.target), 'Wrong price? Pick it')
      ),
      state.editingId === product.productId && state.products[product.productId] ? alertEditor(state.products[product.productId]) : null,
      siteAccessNote()
    );
    return;
  }

  if (kind === 'detected') {
    card.append(
      h('div', { class: 'page-eyebrow' }, h('span', { class: 'dot' }), 'Product found'),
      h('div', { class: 'page-title', text: product.title }),
      h('div', { class: 'page-price', text: formatPrice(product.price?.numeric, product.price?.currency, product.price?.locale) }),
      h('div', { class: 'page-actions' },
        h('button', { class: 'btn btn-primary', id: 'trackBtn', onclick: trackDetected }, icon(ICONS.plus), 'Track price'),
        h('button', { class: 'btn btn-secondary', onclick: startPicker }, icon(ICONS.target), 'Not right? Pick price')
      )
    );
    return;
  }

  // notFound
  card.append(
    h('div', { class: 'page-eyebrow' }, h('span', { class: 'dot' }), 'No price found automatically'),
    h('p', { class: 'page-text', text: 'If this is a product page, point us to the price and we will keep an eye on it.' }),
    h('div', { class: 'page-actions' },
      h('button', { class: 'btn btn-primary', onclick: startPicker }, icon(ICONS.target), 'Pick price on page'),
      h('button', { class: 'btn btn-secondary', onclick: inspectCurrentPage }, icon(ICONS.refresh), 'Scan again')
    )
  );
}

async function trackDetected() {
  const btn = $('trackBtn');
  if (btn) btn.disabled = true;
  try {
    const response = await browser.runtime.sendMessage({ type: 'PRODUCT_DETECTED', data: state.detected, source: 'manual' });
    if (!response?.success) throw new Error(response?.error || 'Could not save');
    await loadProducts();
    state.page = { kind: 'tracked', product: response.data.product || state.detected };
    renderPageCard();
    toast(response.data.alreadyTracked ? 'Already tracking - price updated' : 'Tracking started');
  } catch (error) {
    debugError('[Popup]', 'Track failed:', error);
    toast(error.message === 'Maximum product limit reached'
      ? 'Product limit reached - remove some or raise the limit in Settings'
      : 'Could not track this product', { type: 'error' });
    if (btn) btn.disabled = false;
  }
}

async function startPicker() {
  try {
    await executeScript({ target: { tabId: state.tab.id }, func: startPickerInPage });
    window.close();
  } catch (error) {
    debugError('[Popup]', 'Picker failed:', error);
    toast("Can't open the picker on this page", { type: 'error' });
  }
}

async function grantSiteAccess(url = state.tab?.url) {
  const targetUrl = typeof url === 'string' ? url : state.tab.url;
  // Must be the first await in the click handler (user gesture)
  const granted = await requestPermissionForUrl(targetUrl);
  if (granted) {
    if (state.tab?.url && new URL(state.tab.url).hostname === new URL(targetUrl).hostname) state.hasSiteAccess = true;
    toast('Background checks enabled for this store');
    renderPageCard();
    // Re-check this store's products right away (also clears "Allow checks")
    const host = new URL(targetUrl).hostname;
    const sameStore = Object.values(state.products).filter(p => p?.domain === host);
    for (const product of sameStore) {
      await send('REFRESH_SINGLE_PRODUCT', { productId: product.productId }).catch(() => {});
    }
    await loadProducts();
  } else {
    toast('Access not granted - prices update only when you visit the page', { duration: 4000 });
  }
}

// --------------------------------------------------------------- list

async function loadProducts() {
  try {
    const response = await send('GET_ALL_PRODUCTS');
    state.products = (response?.success && response.data) || {};
    await refreshAccessibleDomains();
  } catch (error) {
    debugError('[Popup]', 'Error loading products:', error);
    state.products = {};
  }
  renderList();
}

async function refreshAccessibleDomains() {
  const domains = new Set();
  for (const p of Object.values(state.products)) {
    if (p?.tracking?.status === 'no_permission' && p.url && !domains.has(p.domain)) {
      if (isUrlSupported(p.url) || await hasPermissionForUrl(p.url)) domains.add(p.domain);
    }
  }
  state.accessibleDomains = domains;
}

function visibleProducts() {
  let list = Object.values(state.products).filter(p => p && p.price);
  const q = state.query.trim().toLowerCase();
  if (q) list = list.filter(p => `${p.title} ${p.domain}`.toLowerCase().includes(q));
  if (state.filter === 'drops') list = list.filter(p => changePercent(p) <= -0.5);
  if (state.filter === 'attention') list = list.filter(needsAttention);

  const sorters = {
    recent: (a, b) => (b.tracking?.lastChecked || 0) - (a.tracking?.lastChecked || 0),
    drop: (a, b) => changePercent(a) - changePercent(b),
    'price-asc': (a, b) => a.price.numeric - b.price.numeric,
    'price-desc': (a, b) => b.price.numeric - a.price.numeric,
    name: (a, b) => (a.title || '').localeCompare(b.title || '')
  };
  return list.sort(sorters[state.sort] || sorters.recent);
}

function renderList() {
  const all = Object.values(state.products).filter(p => p && p.price);
  $('countAll').textContent = all.length;
  $('countDrops').textContent = all.filter(p => changePercent(p) <= -0.5).length;
  $('countAttention').textContent = all.filter(needsAttention).length;
  $('tagline').textContent = all.length ? `Watching ${all.length} product${all.length === 1 ? '' : 's'}` : 'Price tracking for any store';

  const lastChecked = Math.max(0, ...all.map(p => p.tracking?.lastChecked || 0));
  $('lastCheck').textContent = lastChecked ? `Last check ${timeAgo(lastChecked)}` : '';

  const hasAny = all.length > 0;
  $('toolbar').hidden = !hasAny || all.length < 4;
  $('filterChips').hidden = !hasAny;
  $('emptyState').hidden = hasAny;

  const container = $('productsList');
  container.textContent = '';
  if (!hasAny) return;

  const list = visibleProducts();
  if (list.length === 0) {
    container.append(h('div', { class: 'list-empty', text: state.query ? 'No products match your search.' : 'Nothing here right now.' }));
    return;
  }

  for (const product of list) container.append(productCard(product));
}

function productCard(product) {
  const { currency, locale } = product.price;
  const change = changePercent(product);
  const base = baselinePrice(product);
  const status = product.tracking?.status;

  let statusEl = null;
  if (status === 'no_permission' && !state.accessibleDomains.has(product.domain)) {
    statusEl = h('button', {
      class: 'status',
      title: 'Allow access so prices can be checked in the background',
      onclick: e => { e.stopPropagation(); grantSiteAccess(product.url); }
    }, 'Allow checks');
  } else if (status === 'unsafe_url') {
    statusEl = h('span', { class: 'status', title: 'This was saved from a cart/checkout link, so it is no longer checked. Open the product page and track it again.' }, 'Re-track needed');
  } else if (status === 'captcha_detected') {
    statusEl = h('span', { class: 'status', title: 'The store asked for a CAPTCHA. Visiting the page refreshes the price.' }, 'Blocked by store');
  } else if (needsAttention(product)) {
    statusEl = h('span', { class: 'status', title: 'The last checks could not read the price. Visit the page or use “Pick price”.' }, 'Check failed');
  }

  const thumb = h('div', { class: 'thumb', text: (storeName(product.domain)[0] || '?').toUpperCase() });
  if (product.hasImage) {
    browser.storage.local.get(`img_${product.productId}`).then(r => {
      const src = r[`img_${product.productId}`];
      if (src) {
        thumb.textContent = '';
        thumb.append(h('img', { src, alt: '' }));
      }
    }).catch(() => {});
  }

  const card = h('article', { class: 'card', role: 'listitem', 'data-id': product.productId },
    thumb,
    h('div', { class: 'card-body' },
      h('button', { class: 'card-title', title: product.title, onclick: () => openProduct(product) }, product.title),
      h('div', { class: 'card-meta' },
        h('span', { text: storeName(product.domain) }),
        '·',
        h('span', { text: timeAgo(product.tracking?.lastChecked) }),
        alertBadge(product),
        product.availability === 'OutOfStock' ? h('span', { class: 'status', title: 'Out of stock on the last check' }, 'Out of stock') : null,
        statusEl
      )
    ),
    h('div', { class: 'pricing' },
      h('div', { class: 'price-now', text: formatPrice(product.price.numeric, currency, locale) }),
      Math.abs(change) >= 0.5
        ? h('div', { style: 'display:flex;gap:6px;align-items:center' },
            h('span', { class: 'price-was', text: formatPrice(base, currency, locale) }),
            h('span', { class: `pill ${change < 0 ? 'down' : 'up'}`, text: `${change < 0 ? '−' : '+'}${Math.abs(change).toFixed(0)}%` }))
        : null,
      sparkline(product)
    ),
    h('div', { class: 'card-actions' },
      h('button', { class: 'icon-btn', title: 'Price alert', 'aria-label': `Price alert for ${product.title}`, 'aria-expanded': String(state.editingId === product.productId), onclick: () => toggleAlertEditor(product.productId) }, icon(ICONS.bell)),
      h('button', { class: 'icon-btn', title: 'Check price now', 'aria-label': `Check price of ${product.title}`, onclick: e => refreshOne(product, e.currentTarget) }, icon(ICONS.refresh)),
      h('button', { class: 'icon-btn', title: 'Open store page', 'aria-label': `Open ${product.title}`, onclick: () => openProduct(product) }, icon(ICONS.open)),
      h('button', { class: 'icon-btn danger', title: 'Stop tracking', 'aria-label': `Stop tracking ${product.title}`, onclick: () => removeProduct(product) }, icon(ICONS.trash))
    )
  );
  const editingInPageCard = state.page.kind === 'tracked' && state.page.product?.productId === product.productId;
  if (state.editingId === product.productId && !editingInPageCard) {
    card.classList.add('editing');
    card.append(alertEditor(product));
  }
  return card;
}

// --------------------------------------------------------- price alerts

function money(product, value) {
  return formatPrice(value, product.price?.currency, product.price?.locale);
}

function alertBadge(product) {
  const alert = getAlert(product);
  if (alert.mode === 'default') return null;
  return h('button', {
    class: `alert-badge ${alert.mode === 'off' ? 'off' : ''}`,
    title: 'Edit price alert',
    onclick: e => { e.stopPropagation(); toggleAlertEditor(product.productId); }
  }, icon(ICONS.bell), describeAlert(product, state.settings, v => money(product, v)));
}

function toggleAlertEditor(productId) {
  if (state.editingId === productId) {
    state.editingId = null;
    state.alertDraft = null;
  } else {
    const product = state.products[productId];
    const alert = getAlert(product);
    state.editingId = productId;
    state.alertDraft = {
      mode: alert.mode,
      targetPrice: alert.targetPrice ?? suggestTarget(product),
      percent: alert.percent ?? globalMinDrop(state.settings),
      backInStock: alert.backInStock !== false
    };
  }
  renderList();
  renderPageCard();
  document.querySelector('.alert-editor select')?.focus();
}

function suggestTarget(product) {
  // 10% under the current price, rounded to something human
  const p = product.price?.numeric || 0;
  const t = p * 0.9;
  return t >= 100 ? Math.floor(t) : Math.floor(t * 100) / 100;
}

function alertEditor(product) {
  const draft = state.alertDraft;
  const currency = product.price?.currency || '';
  const minDrop = globalMinDrop(state.settings);

  const select = h('select', { 'aria-label': 'When to notify me', onchange: e => { draft.mode = e.target.value; rerenderEditor(); } },
    ...[
      ['default', `Drops of ${minDrop}% or more (default)`],
      ['any', 'Any price drop'],
      ['below', 'Price falls below…'],
      ['percent', 'Drops of at least…'],
      ['off', 'No price alerts']
    ].map(([value, label]) => h('option', { value, selected: draft.mode === value }, label))
  );

  let extra = null;
  if (draft.mode === 'below') {
    extra = h('label', { class: 'alert-field' },
      'Notify at or below',
      h('input', {
        type: 'number', min: '0', step: '0.01', inputmode: 'decimal', value: draft.targetPrice,
        'aria-label': `Target price in ${currency}`,
        oninput: e => { draft.targetPrice = e.target.value; },
        onkeydown: e => { if (e.key === 'Enter') saveAlert(product); }
      }),
      h('span', { class: 'muted', text: currency }),
      h('span', { class: 'muted', text: `now ${money(product, product.price?.numeric)}` })
    );
  } else if (draft.mode === 'percent') {
    extra = h('label', { class: 'alert-field' },
      'Drop of at least',
      h('input', {
        type: 'number', min: '1', max: '99', step: '1', value: draft.percent, 'aria-label': 'Minimum drop in percent',
        oninput: e => { draft.percent = e.target.value; },
        onkeydown: e => { if (e.key === 'Enter') saveAlert(product); }
      }),
      h('span', { class: 'muted', text: '%' })
    );
  }

  return h('div', { class: 'alert-editor', onclick: e => e.stopPropagation() },
    h('div', { class: 'alert-title' }, icon(ICONS.bell), 'Price alert'),
    select,
    extra,
    h('label', { class: 'alert-check' },
      h('input', { type: 'checkbox', checked: draft.backInStock && draft.mode !== 'off', disabled: draft.mode === 'off', onchange: e => { draft.backInStock = e.target.checked; } }),
      'Also tell me when it’s back in stock'
    ),
    h('div', { class: 'alert-actions' },
      h('button', { class: 'btn btn-secondary btn-small', onclick: () => toggleAlertEditor(product.productId) }, 'Cancel'),
      h('button', { class: 'btn btn-primary btn-small', onclick: () => saveAlert(product) }, 'Save alert')
    )
  );
}

function rerenderEditor() {
  renderList();
  renderPageCard();
}

async function saveAlert(product) {
  const draft = state.alertDraft;
  try {
    const response = await send('SET_ALERT', {
      productId: product.productId,
      alert: { mode: draft.mode, targetPrice: Number(draft.targetPrice), percent: Number(draft.percent), backInStock: draft.backInStock }
    });
    if (!response?.success) throw new Error(response?.error || 'Could not save');
    state.products[product.productId] = { ...state.products[product.productId], alert: response.data.alert };
    state.editingId = null;
    state.alertDraft = null;
    renderList();
    if (state.page.kind === 'tracked' && state.page.product?.productId === product.productId) {
      state.page.product = state.products[product.productId];
    }
    renderPageCard();
    toast(`Alert saved: ${describeAlert(state.products[product.productId], state.settings, v => money(product, v))}`);
  } catch (error) {
    toast(error.message, { type: 'error' });
  }
}

function openProduct(product) {
  const url = sanitizeProductUrl(product?.url);
  if (url) browser.tabs.create({ url });
  else toast('This link was a cart/checkout link - track the product page again', { type: 'error' });
}

async function refreshOne(product, button) {
  button.disabled = true;
  button.classList.add('spinning');
  try {
    const response = await send('REFRESH_SINGLE_PRODUCT', { productId: product.productId });
    const result = response?.data?.checkResult;
    if (response?.data?.product) state.products[product.productId] = response.data.product;
    renderList();
    if (result?.status === 'price_drop' || (result?.newPrice && result.newPrice < result.oldPrice)) toast('Price dropped!');
    else if (result?.status === 'error') toast(result.error || 'Could not read the price', { type: 'error' });
    else toast('Price is up to date');
  } catch (error) {
    toast('Could not check the price', { type: 'error' });
  } finally {
    button.disabled = false;
    button.classList.remove('spinning');
  }
}

async function removeProduct(product) {
  const imageKey = `img_${product.productId}`;
  let image = null;
  try { image = (await browser.storage.local.get(imageKey))[imageKey] || null; } catch (_) { /* ignore */ }
  const snapshot = JSON.parse(JSON.stringify(state.products[product.productId] || product));

  const card = document.querySelector(`.card[data-id="${CSS.escape(product.productId)}"]`);
  card?.classList.add('removing');

  try {
    await send('DELETE_PRODUCT', { productId: product.productId });
    delete state.products[product.productId];
    setTimeout(renderList, 180);
    if (state.page.kind === 'tracked' && state.page.product?.productId === product.productId) {
      state.page = { kind: 'notFound' };
      inspectCurrentPage();
    }
    toast('Stopped tracking', {
      duration: 6000,
      action: {
        label: 'Undo',
        run: async () => {
          await send('RESTORE_PRODUCT', { product: snapshot, image });
          await loadProducts();
          inspectCurrentPage();
        }
      }
    });
  } catch (error) {
    card?.classList.remove('removing');
    toast('Could not remove product', { type: 'error' });
  }
}

async function refreshAll() {
  const btn = $('refreshBtn');
  btn.disabled = true;
  btn.classList.add('spinning');
  try {
    const response = await browser.runtime.sendMessage({ type: 'FORCE_CHECK_ALL', data: { batchSize: 5 } });
    const drops = response?.data?.priceDrops || 0;
    await loadProducts();
    toast(drops ? `${drops} price drop${drops === 1 ? '' : 's'} found` : 'All prices checked');
  } catch (error) {
    toast('Could not check prices', { type: 'error' });
  } finally {
    btn.disabled = false;
    btn.classList.remove('spinning');
  }
}

// ---------------------------------------------------------------- init

function bindEvents() {
  $('refreshBtn').addEventListener('click', refreshAll);
  $('themeToggleBtn').addEventListener('click', cycleTheme);
  $('settingsBtn').addEventListener('click', () => browser.runtime.openOptionsPage());
  $('historyBtn').addEventListener('click', () => browser.tabs.create({ url: browser.runtime.getURL('options/price-history.html') }));

  $('searchInput').addEventListener('input', e => { state.query = e.target.value; renderList(); });
  $('sortSelect').addEventListener('change', e => { state.sort = e.target.value; renderList(); });

  document.querySelectorAll('#filterChips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#filterChips .chip').forEach(c => {
        c.classList.toggle('active', c === chip);
        c.setAttribute('aria-selected', String(c === chip));
      });
      state.filter = chip.dataset.filter;
      renderList();
    });
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.products) {
      state.products = changes.products.newValue || {};
      renderList();
      if (state.page.kind === 'tracked') {
        const fresh = state.products[state.page.product?.productId];
        if (fresh) { state.page.product = fresh; renderPageCard(); }
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await initTheme();
  bindEvents();
  try {
    [state.tab] = await browser.tabs.query({ active: true, currentWindow: true });
  } catch (error) {
    debugError('[Popup]', 'Could not read active tab:', error);
  }
  try {
    const r = await send('GET_SETTINGS');
    state.settings = r?.data || null;
  } catch (_) { /* defaults */ }
  await loadProducts();
  inspectCurrentPage();
});
