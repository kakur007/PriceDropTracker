/**
 * Firefox Background Script Wrapper
 *
 * Firefox's background.scripts doesn't support type="module" directly,
 * so we use dynamic import to load our ES6 module service worker.
 */

console.log('[Firefox Wrapper] Starting background script...');

// Use dynamic import to load the ES6 module
import('./service-worker.js')
  .then(() => {
    console.log('[Firefox Wrapper] Service worker module loaded successfully');
  })
  .catch((error) => {
    console.error('[Firefox Wrapper] Error loading service worker:', error);
  });
