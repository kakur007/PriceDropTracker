/**
 * Page Panel - small, dismissible card on product pages.
 *
 * Shows for products the user tracks (tracked price, lowest seen, alert) and
 * for discounts worth checking ("Is this deal real?"). Rendered in a closed
 * shadow root so store CSS can't break it and it can't break the store.
 */

import { evaluateDeal } from '../utils/deal-check.js';
import { describeAlert } from '../utils/alert-rules.js';

const api = typeof globalThis.browser !== 'undefined' ? globalThis.browser : globalThis.chrome;
const HOST_ID = 'price-genius-panel';

function money(value, product) {
  if (!(value > 0)) return '';
  try {
    return new Intl.NumberFormat(product?.price?.locale || document.documentElement.lang || undefined, {
      style: 'currency',
      currency: product?.price?.currency || 'USD'
    }).format(value);
  } catch (_) {
    return `${value.toFixed(2)} ${product?.price?.currency || ''}`.trim();
  }
}

function dismissKey(url) {
  return `pg-panel-dismissed:${url.split('#')[0]}`;
}

export function removePagePanel() {
  document.getElementById(HOST_ID)?.remove();
}

/**
 * @param {Object} opts
 * @param {Object} opts.product - detected product (current page)
 * @param {Object|null} opts.tracked - stored product if tracked
 * @param {Object|null} opts.settings
 * @returns {boolean} whether a panel was shown
 */
export function showPagePanel({ product, tracked, settings }) {
  removePagePanel();
  if (!product?.price?.numeric) return false;
  if (settings?.display?.pagePanel === false) return false;

  try {
    if (sessionStorage.getItem(dismissKey(location.href))) return false;
  } catch (_) { /* storage blocked: still fine to show */ }

  const fmt = v => money(v, product);
  const verdict = evaluateDeal({
    current: product.price.numeric,
    claimedRegular: product.dealSignals?.claimedRegular,
    lowest30: product.dealSignals?.lowest30,
    history: tracked?.priceHistory || [],
    format: fmt
  });

  // Untracked products: only when the store prints its 30-day lowest price,
  // so the verdict is a fact we can show, not a guess. (Many stores don't
  // show it; tracked products rely on the user's own price history.)
  const verifiable = product.dealSignals?.lowest30 > 0;
  if (!tracked && !(verifiable && verdict && verdict.status !== 'unverified')) {
    return false;
  }

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483646;';
  const root = host.attachShadow({ mode: 'closed' });

  root.innerHTML = `
    <style>
      :host { all: initial; }
      .card {
        --bg:#ffffff; --text:#0f172a; --muted:#64748b; --border:#e2e8f0; --soft:#f1f5f9;
        --accent:#0e9fb0; --on-accent:#fff; --good:#047857; --good-bg:#dcfce7; --warn:#b45309; --warn-bg:#fef3c7;
        width: 288px; box-sizing: border-box; padding: 12px 14px 14px;
        background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 14px;
        box-shadow: 0 12px 32px rgba(15,23,42,.18);
        font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        animation: rise .3s ease-out;
      }
      @media (prefers-color-scheme: dark) {
        .card { --bg:#131c2e; --text:#e8edf5; --muted:#8a96aa; --border:#243149; --soft:#1b2638;
          --accent:#2cc5d6; --on-accent:#04222a; --good:#34d399; --good-bg:#0f3326; --warn:#fbbf24; --warn-bg:#3a2a0c; }
      }
      .top { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
      .brand { display:flex; align-items:center; gap:6px; font-weight:650; font-size:12px; color:var(--muted); letter-spacing:.02em; }
      .logo { width:18px; height:18px; border-radius:5px; display:block; }
      .close { all:unset; cursor:pointer; width:22px; height:22px; border-radius:6px; display:grid; place-items:center; color:var(--muted); }
      .close:hover { background:var(--soft); color:var(--text); }
      .close:focus-visible, .btn:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
      .verdict { border-radius:10px; padding:8px 10px; margin-bottom:8px; }
      .verdict b { display:block; font-size:13.5px; }
      .verdict span { color:var(--text); opacity:.85; }
      .warn { background:var(--warn-bg); } .warn b { color:var(--warn); }
      .good { background:var(--good-bg); } .good b { color:var(--good); }
      .neutral { background:var(--soft); }
      .rows { display:grid; grid-template-columns:auto 1fr; gap:3px 10px; margin:2px 0 0; }
      .rows dt { color:var(--muted); } .rows dd { margin:0; text-align:right; font-weight:600; font-variant-numeric:tabular-nums; }
      .btn { all:unset; box-sizing:border-box; cursor:pointer; margin-top:10px; width:100%; text-align:center;
        padding:8px 12px; border-radius:9px; background:var(--accent); color:var(--on-accent); font-weight:650; }
      .btn[disabled] { opacity:.6; cursor:default; }
      .hint { margin-top:8px; font-size:11.5px; color:var(--muted); }
      @keyframes rise { from { transform:translateY(12px); opacity:0 } to { transform:none; opacity:1 } }
      @media (prefers-reduced-motion: reduce) { .card { animation:none } }
    </style>
    <div class="card" role="complementary" aria-label="Price Genius">
      <div class="top">
        <div class="brand"><img class="logo" alt=""><span class="label"></span></div>
        <button class="close" type="button" aria-label="Close Price Genius panel" title="Hide on this page">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="body"></div>
    </div>`;

  root.querySelector('.logo').src = api.runtime.getURL('assets/icons/icon-64.png');
  const label = root.querySelector('.label');
  const body = root.querySelector('.body');
  label.textContent = tracked ? 'Price Genius · tracking' : 'Price Genius · deal check';

  if (verdict) {
    const box = document.createElement('div');
    box.className = `verdict ${verdict.tone}`;
    const b = document.createElement('b');
    b.textContent = verdict.headline;
    const s = document.createElement('span');
    s.textContent = verdict.detail;
    box.append(b, s);
    body.append(box);
  }

  if (tracked) {
    const prices = (tracked.priceHistory || []).map(e => e.price).filter(p => p > 0);
    const lowest = prices.length ? Math.min(...prices) : tracked.price?.numeric;
    const since = tracked.tracking?.firstSeen ? new Date(tracked.tracking.firstSeen).toLocaleDateString() : null;
    const dl = document.createElement('dl');
    dl.className = 'rows';
    const row = (k, v) => {
      if (!v) return;
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      dl.append(dt, dd);
    };
    row('Now', fmt(product.price.numeric));
    row('Lowest seen', fmt(lowest));
    if (since) row('Tracking since', since);
    row('Your alert', describeAlert(tracked, settings, fmt));
    body.append(dl);
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'Change the alert from the Price Genius toolbar icon.';
    body.append(hint);
  } else {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.type = 'button';
    btn.textContent = `Track price · ${fmt(product.price.numeric)}`;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Saving…';
      try {
        const response = await api.runtime.sendMessage({ type: 'PRODUCT_DETECTED', data: product, source: 'manual' });
        if (!response?.success) throw new Error(response?.error);
        showPagePanel({ product, tracked: response.data.product || product, settings });
      } catch (_) {
        btn.disabled = false;
        btn.textContent = 'Could not save - try again';
      }
    });
    body.append(btn);
  }

  root.querySelector('.close').addEventListener('click', () => {
    try { sessionStorage.setItem(dismissKey(location.href), '1'); } catch (_) { /* ignore */ }
    host.remove();
  });

  (document.body || document.documentElement).appendChild(host);
  return true;
}
