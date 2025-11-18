/**
 * Browser API Polyfill
 *
 * Provides a unified API that works across Chrome and Firefox.
 *
 * Chrome uses the `chrome` namespace with callback-based APIs.
 * Firefox uses the `browser` namespace with Promise-based APIs.
 *
 * This polyfill ensures code works on both browsers by:
 * 1. Using the native `browser` object if available (Firefox)
 * 2. Falling back to `chrome` object (Chrome/Edge/Brave)
 * 3. Wrapping callback-based APIs to return Promises
 *
 * Usage:
 *   import browser from './utils/browser-polyfill.js';
 *   const data = await browser.storage.local.get(['key']);
 */

// Detect which API is available
const browserAPI = (() => {
  // Firefox and modern browsers have native 'browser' namespace with Promises
  if (typeof browser !== 'undefined' && browser.runtime) {
    console.log('[BrowserPolyfill] Using native browser API (Firefox/Promise-based)');
    return browser;
  }

  // Chrome and Chromium-based browsers use 'chrome' namespace
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('[BrowserPolyfill] Using Chrome API (Chromium/Callback-based)');

    // Return chrome API as-is since modern Chrome also supports Promises
    // Chrome has been Promise-compatible since Manifest V3
    return chrome;
  }

  // Fallback for non-extension contexts (testing, etc.)
  console.warn('[BrowserPolyfill] No browser extension API detected');
  return null;
})();

/**
 * Export the unified browser API
 * This object can be used identically in Chrome and Firefox
 */
export default browserAPI;

/**
 * Helper function to check if we're running in Firefox
 * Useful for browser-specific behavior when needed
 */
export function isFirefox() {
  return typeof browser !== 'undefined' && browser.runtime && typeof InstallTrigger !== 'undefined';
}

/**
 * Helper function to check if we're running in Chrome
 * Useful for browser-specific behavior when needed
 */
export function isChrome() {
  return typeof chrome !== 'undefined' && chrome.runtime && !isFirefox();
}

/**
 * Get browser name for logging/debugging
 */
export function getBrowserName() {
  if (isFirefox()) return 'Firefox';
  if (isChrome()) return 'Chrome';
  return 'Unknown';
}

console.log(`[BrowserPolyfill] Initialized for ${getBrowserName()}`);
