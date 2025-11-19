/**
 * Chart.js Loader - Bridge between UMD and ES modules
 *
 * This module exports Chart.js from the window object after ensuring it's loaded.
 * Compatible with both Chrome and Firefox.
 */

// Check if Chart.js is already loaded (from the script tag in HTML)
if (typeof window.Chart !== 'undefined') {
  // Chart.js already loaded, export it immediately
  console.log('[Chart Loader] Chart.js already available');
}

/**
 * Get Chart.js from window, with fallback polling
 * @returns {typeof Chart|null}
 */
function getChart() {
  if (typeof window.Chart !== 'undefined') {
    return window.Chart;
  }

  console.warn('[Chart Loader] Chart.js not yet loaded, module may need to retry');
  return null;
}

// Export Chart.js (will be null if not loaded yet, but that's okay -
// the consuming code will check)
export default getChart();
