/**
 * Alert rules - decides whether a price change deserves a notification.
 *
 * Each product may carry its own rule in `product.alert`:
 *   { mode: 'default' | 'any' | 'percent' | 'below' | 'off',
 *     percent?: number,       // for 'percent'
 *     targetPrice?: number,   // for 'below'
 *     backInStock?: boolean } // notify when it becomes available again
 *
 * 'default' uses the global "minimum drop" setting. Pure functions only, so
 * the popup, background and tests share exactly the same logic.
 */

export const DEFAULT_ALERT = Object.freeze({ mode: 'default', backInStock: true });

export function getAlert(product) {
  return { ...DEFAULT_ALERT, ...(product?.alert || {}) };
}

export function globalMinDrop(settings) {
  const n = Number(settings?.notifications?.minDropPercentage ?? settings?.notifications?.minDropPercent);
  return n > 0 ? n : 5;
}

/**
 * @returns {{notify: boolean, reason: string}}
 */
export function shouldNotifyDrop(product, oldPrice, newPrice, settings) {
  if (settings?.notifications?.enabled === false) return { notify: false, reason: 'notifications disabled' };
  if (!(oldPrice > 0) || !(newPrice > 0) || newPrice >= oldPrice) return { notify: false, reason: 'not a drop' };

  const alert = getAlert(product);
  const dropPercent = ((oldPrice - newPrice) / oldPrice) * 100;

  switch (alert.mode) {
    case 'off':
      return { notify: false, reason: 'alerts off for product' };
    case 'any':
      return { notify: true, reason: 'any drop' };
    case 'below': {
      const target = Number(alert.targetPrice);
      if (!(target > 0)) return { notify: dropPercent >= globalMinDrop(settings), reason: 'no target set' };
      return newPrice <= target
        ? { notify: true, reason: `at or below target ${target}` }
        : { notify: false, reason: `above target ${target}` };
    }
    case 'percent': {
      const min = Number(alert.percent) > 0 ? Number(alert.percent) : globalMinDrop(settings);
      return dropPercent >= min
        ? { notify: true, reason: `drop ${dropPercent.toFixed(1)}% >= ${min}%` }
        : { notify: false, reason: `drop ${dropPercent.toFixed(1)}% < ${min}%` };
    }
    default: {
      const min = globalMinDrop(settings);
      return dropPercent >= min
        ? { notify: true, reason: `drop ${dropPercent.toFixed(1)}% >= ${min}%` }
        : { notify: false, reason: `drop ${dropPercent.toFixed(1)}% < ${min}%` };
    }
  }
}

export function shouldNotifyBackInStock(product, settings) {
  if (settings?.notifications?.enabled === false) return false;
  const alert = getAlert(product);
  return alert.mode !== 'off' && alert.backInStock !== false;
}

/**
 * Normalise schema.org / platform availability values.
 * @returns {'InStock'|'OutOfStock'|null}
 */
export function normalizeAvailability(value) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).toLowerCase();
  if (/outofstock|out_of_stock|out of stock|soldout|sold_out|sold out|discontinued|unavailable/.test(s)) return 'OutOfStock';
  if (/instock|in_stock|in stock|limitedavailability|onlineonly|instoreonly|preorder|presale|backorder|available/.test(s)) return 'InStock';
  return null;
}

/**
 * Short human description of the rule, for the UI.
 */
export function describeAlert(product, settings, formatPrice = v => String(v)) {
  const alert = getAlert(product);
  switch (alert.mode) {
    case 'off': return 'Alerts off';
    case 'any': return 'Any drop';
    case 'below': return Number(alert.targetPrice) > 0 ? `Below ${formatPrice(Number(alert.targetPrice))}` : 'Below target';
    case 'percent': return `Drops ≥ ${Number(alert.percent) || globalMinDrop(settings)}%`;
    default: return `Drops ≥ ${globalMinDrop(settings)}%`;
  }
}

/**
 * Validate an alert coming from the UI.
 */
export function sanitizeAlert(input) {
  const modes = ['default', 'any', 'percent', 'below', 'off'];
  const alert = {
    mode: modes.includes(input?.mode) ? input.mode : 'default',
    backInStock: input?.backInStock !== false
  };
  if (alert.mode === 'below') {
    const t = Number(input?.targetPrice);
    if (!(t > 0) || t > 99999999) throw new Error('Enter a target price above 0');
    alert.targetPrice = Math.round(t * 100) / 100;
  }
  if (alert.mode === 'percent') {
    const p = Number(input?.percent);
    if (!(p > 0 && p < 100)) throw new Error('Enter a percentage between 1 and 99');
    alert.percent = Math.round(p);
  }
  return alert;
}
