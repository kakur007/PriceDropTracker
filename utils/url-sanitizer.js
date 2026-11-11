/**
 * URL Sanitizer - make product URLs safe to re-open and re-fetch.
 *
 * Many stores encode actions in GET URLs (WooCommerce `?add-to-cart=77`,
 * OpenCart `route=checkout/cart/add`, Magento `/checkout/cart/add/...`, many
 * themes `?action=add`). If such a URL is saved as the product URL, every
 * background price check would repeat the action - e.g. add the product to
 * the cart again. We strip action/session/tracking parameters and refuse
 * URLs whose path is itself an action.
 */

// Query parameters that perform an action or carry session/tracking state
const ACTION_PARAMS = [
  /^add[-_]?to[-_]?(cart|basket|bag|wishlist)$/i,
  /^(add|buy|order|remove|delete|clear|empty)([-_]?(item|product|cart|now))?$/i,
  /^(action|do|cmd|task|op|operation|func|event)$/i,
  /^(qty|quantity|amount|count)$/i,
  /^(cart|basket|checkout|wishlist|compare)([-_].*)?$/i,
  /^(_wpnonce|nonce|token|csrf|_token|form_key|formkey|security|sessionid|sid|session|phpsessid|jsessionid)$/i,
  /^(utm_.*|gclid|fbclid|msclkid|dclid|yclid|mc_cid|mc_eid|_ga|_gl|ref|ref_|tag|affid|aff_id|campaign|trk|_trkparms|_trksid|hash|spm|scm|pvid|algo_.*|ws_ab_test)$/i
];

// Path fragments that are actions, never product pages
const ACTION_PATH = /\/(cart|basket|checkout|wishlist|compare)\/(add|update|remove|delete)\b|\/(add[-_]?to[-_]?cart|addtocart|cart\/add|basket\/add)\b|\/(cart|basket|checkout|bag|panier|warenkorb|ostukorv)\/?$/i;

// route=... values used by OpenCart and similar for actions
const ACTION_ROUTE = /(cart|checkout|wishlist|compare|account|login|logout)\//i;

/**
 * @param {string} url
 * @returns {string|null} cleaned URL, or null when the URL is an action URL
 */
export function sanitizeProductUrl(url) {
  if (!url || typeof url !== 'string') return null;
  let u;
  try {
    u = new URL(url);
  } catch (_) {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  if (ACTION_PATH.test(u.pathname)) return null;

  const route = u.searchParams.get('route');
  if (route && ACTION_ROUTE.test(route)) return null;

  for (const key of Array.from(u.searchParams.keys())) {
    if (ACTION_PARAMS.some(re => re.test(key))) u.searchParams.delete(key);
  }

  u.hash = '';
  u.username = '';
  u.password = '';
  return u.toString();
}

/**
 * True when the URL would perform an action if requested.
 */
export function isActionUrl(url) {
  return sanitizeProductUrl(url) === null;
}
