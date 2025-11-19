/**
 * Debug Utility
 * Smart caching system that reads debug mode from settings and listens for changes
 * Production-ready: defaults to false, can be enabled via extension settings
 */

import browser from './browser-polyfill.js';

// Default to false (Production ready)
let isDebugEnabled = false;

// 1. Initialize from storage immediately
// Note: This is async, so the very first milliseconds of logs might be missed.
// That is acceptable for a production extension.
if (browser && browser.storage) {
  browser.storage.local.get('settings').then((data) => {
    if (data.settings?.advanced?.debugMode) {
      isDebugEnabled = true;
      console.log('🐞 [Price Genius] Debug Mode Enabled');
    }
  }).catch(() => {}); // Ignore errors in tests/offline
}

// 2. Listen for live changes (e.g., user toggles switch in Options)
if (browser && browser.storage) {
  browser.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
      const newDebugState = changes.settings.newValue?.advanced?.debugMode || false;
      if (newDebugState !== isDebugEnabled) {
        isDebugEnabled = newDebugState;
        console.log(`🐞 [Price Genius] Debug Mode ${isDebugEnabled ? 'Enabled' : 'Disabled'}`);
      }
    }
  });
}

/**
 * Debug logger - only logs when debug mode is enabled
 * @param {string} context - The context/module name (e.g., '[Popup]', '[Storage]')
 * @param {...any} args - Arguments to log
 */
export function debug(context, ...args) {
  if (isDebugEnabled) {
    // Use a distinctive color/style for better visibility
    console.log(`%c${context}`, 'color: #1eadbd; font-weight: bold;', ...args);
  }
}

/**
 * Debug error logger - ALWAYS logs errors regardless of debug mode
 * Errors should always be visible for troubleshooting
 * @param {string} context - The context/module name
 * @param {...any} args - Arguments to log
 */
export function debugError(context, ...args) {
  // Always show errors, even in production
  console.error(`%c${context}`, 'color: #dc2626; font-weight: bold;', ...args);
}

/**
 * Debug warning logger - only logs when debug mode is enabled
 * @param {string} context - The context/module name
 * @param {...any} args - Arguments to log
 */
export function debugWarn(context, ...args) {
  if (isDebugEnabled) {
    console.warn(context, ...args);
  }
}

/**
 * Check if debug mode is currently enabled
 * @returns {boolean} True if debug mode is enabled
 */
export function isDebugModeEnabled() {
  return isDebugEnabled;
}

/**
 * Performance timing utility
 * @param {string} label - Label for the timer
 * @returns {Function} Function to call when timing is complete
 */
export function debugTime(label) {
  if (isDebugEnabled) {
    console.time(label);
    return () => console.timeEnd(label);
  }
  return () => {}; // No-op if debug disabled
}
