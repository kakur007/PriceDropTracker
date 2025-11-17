/**
 * Debug Utility
 * Provides controlled logging that can be toggled on/off for production
 */

// Set to false for production, true for development
const DEBUG_ENABLED = true; // TODO: Set to false before Chrome Web Store submission

/**
 * Debug logger - only logs when DEBUG_ENABLED is true
 * @param {string} context - The context/module name (e.g., '[Popup]', '[Storage]')
 * @param {...any} args - Arguments to log
 */
export function debug(context, ...args) {
  if (DEBUG_ENABLED) {
    console.log(context, ...args);
  }
}

/**
 * Debug error logger - always logs errors regardless of DEBUG_ENABLED
 * @param {string} context - The context/module name
 * @param {...any} args - Arguments to log
 */
export function debugError(context, ...args) {
  console.error(context, ...args);
}

/**
 * Debug warning logger - only logs when DEBUG_ENABLED is true
 * @param {string} context - The context/module name
 * @param {...any} args - Arguments to log
 */
export function debugWarn(context, ...args) {
  if (DEBUG_ENABLED) {
    console.warn(context, ...args);
  }
}

/**
 * Check if debug mode is enabled
 * @returns {boolean} True if debug mode is enabled
 */
export function isDebugEnabled() {
  return DEBUG_ENABLED;
}

/**
 * Performance timing utility
 * @param {string} label - Label for the timer
 * @returns {Function} Function to call when timing is complete
 */
export function debugTime(label) {
  if (DEBUG_ENABLED) {
    console.time(label);
    return () => console.timeEnd(label);
  }
  return () => {}; // No-op if debug disabled
}
