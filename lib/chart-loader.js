/**
 * Chart.js Loader - Bridge between UMD and ES modules
 *
 * This module waits for the Chart.js UMD script to load and exports it.
 * Solves the race condition between non-module script and ES modules.
 */

/**
 * Wait for Chart.js to be available on window
 * @returns {Promise<typeof Chart>}
 */
function waitForChart() {
  return new Promise((resolve) => {
    // Check if already loaded
    if (window.Chart) {
      resolve(window.Chart);
      return;
    }

    // Poll for Chart.js (it should load very quickly)
    const checkInterval = setInterval(() => {
      if (window.Chart) {
        clearInterval(checkInterval);
        resolve(window.Chart);
      }
    }, 50);

    // Timeout after 5 seconds (should never happen in practice)
    setTimeout(() => {
      clearInterval(checkInterval);
      if (window.Chart) {
        resolve(window.Chart);
      } else {
        console.error('[Chart Loader] Timeout waiting for Chart.js');
        resolve(null);
      }
    }, 5000);
  });
}

// Export the Chart constructor
export default await waitForChart();
