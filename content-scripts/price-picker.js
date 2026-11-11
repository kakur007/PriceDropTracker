/**
 * Price Picker - lets the user click the price on any page.
 *
 * Fallback for stores where automatic detection fails. The chosen element is
 * remembered as a CSS selector, which the background checker re-reads on
 * every refresh.
 *
 * Imported dynamically from an injected function (popup).
 */

import { buildProductFromElement, showTrackingBadge } from './product-detector.js';
import { parsePrice } from '../utils/currency-parser.js';

const api = typeof globalThis.browser !== 'undefined' ? globalThis.browser : globalThis.chrome;

let active = null;

export function startPicker() {
  if (active) return;

  const host = document.createElement('div');
  host.id = 'price-genius-picker';
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
  const shadow = host.attachShadow({ mode: 'closed' });

  shadow.innerHTML = `
    <style>
      .bar{position:fixed;top:16px;left:50%;transform:translateX(-50%);pointer-events:auto;
        display:flex;align-items:center;gap:12px;padding:10px 12px 10px 16px;border-radius:14px;
        background:#0f172a;color:#f8fafc;font:500 14px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
        box-shadow:0 12px 32px rgba(15,23,42,.4)}
      .bar small{display:block;color:#94a3b8;font-size:12px;font-weight:400}
      button{all:unset;cursor:pointer;padding:6px 12px;border-radius:8px;background:#1e293b;color:#e2e8f0;font-size:13px}
      button:hover{background:#334155}
      .box{position:fixed;pointer-events:none;border:2px solid #14b8a6;background:rgba(20,184,166,.12);
        border-radius:6px;transition:all .06s ease-out;display:none}
      .tag{position:fixed;pointer-events:none;background:#14b8a6;color:#04201d;font:600 12px/1 system-ui,sans-serif;
        padding:4px 6px;border-radius:5px;display:none;white-space:nowrap}
    </style>
    <div class="bar" role="dialog" aria-label="Pick the price">
      <div>Click the product's price<small>Price Genius will check that spot for changes · Esc to cancel</small></div>
      <button type="button" data-cancel>Cancel</button>
    </div>
    <div class="box"></div>
    <div class="tag"></div>`;

  const box = shadow.querySelector('.box');
  const tag = shadow.querySelector('.tag');
  let current = null;

  const priceOf = el => {
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 60) return null;
    const parsed = parsePrice(text, { domain: location.hostname, locale: document.documentElement.lang });
    return parsed && parsed.numeric > 0 ? parsed : null;
  };

  // Climb to the smallest ancestor whose text parses as a price
  const resolveTarget = el => {
    for (let node = el, i = 0; node && node !== document.body && i < 4; node = node.parentElement, i++) {
      if (priceOf(node)) return node;
    }
    return null;
  };

  const onMove = e => {
    const target = resolveTarget(document.elementFromPoint(e.clientX, e.clientY));
    current = target;
    if (!target) {
      box.style.display = 'none';
      tag.style.display = 'none';
      return;
    }
    const r = target.getBoundingClientRect();
    Object.assign(box.style, { display: 'block', left: `${r.left - 3}px`, top: `${r.top - 3}px`, width: `${r.width + 6}px`, height: `${r.height + 6}px` });
    const p = priceOf(target);
    tag.textContent = `Track ${p.formatted}`;
    Object.assign(tag.style, { display: 'block', left: `${r.left - 3}px`, top: `${Math.max(4, r.top - 26)}px` });
  };

  const block = e => {
    if (e.composedPath().includes(host)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  const onClick = async e => {
    if (e.composedPath().includes(host)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const target = current || resolveTarget(e.target);
    if (!target) return;
    stop();

    const product = await buildProductFromElement(target);
    if (!product) {
      showTrackingBadge(null, "Couldn't read a price there - try again");
      return;
    }
    try {
      const response = await api.runtime.sendMessage({ type: 'PRODUCT_DETECTED', data: product, source: 'manual' });
      const msg = response?.data?.alreadyTracked ? 'Updated - now watching this price' : `Tracking at ${product.price.formatted}`;
      showTrackingBadge(product, msg);
    } catch (error) {
      showTrackingBadge(null, 'Could not save - please try again');
    }
  };

  const onKey = e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      stop();
    }
  };

  // Listen on window in the capture phase so we run before any page handler,
  // and swallow every press-type event: a click on the price must never reach
  // the store (e.g. a price inside an "Add to cart" button).
  const BLOCKED = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'dblclick', 'auxclick', 'contextmenu', 'submit'];

  function stop() {
    window.removeEventListener('mousemove', onMove, true);
    window.removeEventListener('click', onClick, true);
    for (const type of BLOCKED) window.removeEventListener(type, block, true);
    window.removeEventListener('keydown', onKey, true);
    host.remove();
    // Keep swallowing the tail of the current click for a moment
    setTimeout(() => { active = null; }, 0);
  }

  shadow.querySelector('[data-cancel]').addEventListener('click', stop);
  window.addEventListener('mousemove', onMove, true);
  window.addEventListener('click', onClick, true);
  for (const type of BLOCKED) window.addEventListener(type, block, { capture: true, passive: false });
  window.addEventListener('keydown', onKey, true);
  (document.body || document.documentElement).appendChild(host);
  active = { stop };
}
