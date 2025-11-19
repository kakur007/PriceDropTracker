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

/**
 * Cross-browser script execution
 * Handles differences between Manifest V3 (scripting API) and V2 (tabs API)
 *
 * @param {Object} options - Execution options
 * @param {Object} options.target - Target tab {tabId: number}
 * @param {Function} options.func - Function to execute (MV3) or files to inject (MV2)
 * @param {Array} options.args - Arguments to pass to the function
 * @param {Array<string>} options.files - Files to inject (MV2 only)
 * @returns {Promise<Array>} Execution results
 */
export async function executeScript(options) {
  const { target, func, files, args } = options;

  // Manifest V3: Use scripting API (Chrome, newer Firefox)
  if (browserAPI.scripting && browserAPI.scripting.executeScript) {
    console.log('[BrowserPolyfill] Using Manifest V3 scripting API');
    return await browserAPI.scripting.executeScript({
      target: target,
      func: func,
      args: args || []
    });
  }

  // Manifest V2: Use tabs API (Firefox, older browsers)
  if (browserAPI.tabs && browserAPI.tabs.executeScript) {
    console.log('[BrowserPolyfill] Using Manifest V2 tabs API');

    // Convert function to code string for tabs.executeScript
    // For MV2, we need to handle args manually by creating a wrapper
    let code;
    if (func && args && args.length > 0) {
      // Create wrapper that calls the function with args
      code = `(${func.toString()})(${args.map(arg => JSON.stringify(arg)).join(', ')})`;
    } else {
      code = func ? `(${func.toString()})()` : undefined;
    }

    const result = await browserAPI.tabs.executeScript(target.tabId, {
      code: code,
      file: files ? files[0] : undefined
    });

    // Wrap result to match scripting API format
    return result ? [{ result: result[0] }] : [];
  }

  throw new Error('No script execution API available');
}

console.log(`[BrowserPolyfill] Initialized for ${getBrowserName()}`);
