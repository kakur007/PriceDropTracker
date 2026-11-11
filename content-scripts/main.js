/**
 * Main Content Script Entry Point
 *
 * Runs on supported stores (manifest) and on any store the user granted
 * access to (registered dynamically by the service worker).
 *
 * - Retries detection while JS-rendered pages finish loading
 * - Re-runs on single-page-app navigation (URL changes without reload)
 * - Lets the background either start tracking (auto-track) or refresh the
 *   price of an already tracked product from the live page
 *
 * Content scripts declared in the manifest cannot use static imports in
 * Firefox, so modules are loaded with dynamic import().
 */

(function () {
  if (window.__PRICE_GENIUS_MAIN__) return; // injected twice (manifest + dynamic)
  window.__PRICE_GENIUS_MAIN__ = true;

  const api = typeof globalThis.browser !== 'undefined'
    ? globalThis.browser
    : (typeof globalThis.chrome !== 'undefined' ? globalThis.chrome : null);

  if (!api?.runtime?.getURL) return;

  const TAG = '[Price Genius]';
  const RETRY_DELAYS = [600, 1200, 2000, 3500, 6000];

  let detectorPromise = null;
  let panelPromise = null;

  function loadPanel() {
    if (!panelPromise) {
      panelPromise = import(api.runtime.getURL('content-scripts/page-panel.js'));
    }
    return panelPromise;
  }

  async function getSettings() {
    try {
      return (await api.storage.local.get('settings')).settings || null;
    } catch (_) {
      return null;
    }
  }
  let runId = 0;
  let lastUrl = location.href;
  let handledUrl = null;

  function loadDetector() {
    if (!detectorPromise) {
      detectorPromise = import(api.runtime.getURL('content-scripts/product-detector.js'));
    }
    return detectorPromise;
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function run() {
    const myRun = ++runId;
    const url = location.href;
    loadPanel().then(m => m.removePagePanel()).catch(() => {});

    let detector;
    try {
      detector = await loadDetector();
    } catch (error) {
      console.warn(TAG, 'Could not load detector:', error);
      return;
    }

    for (const delay of RETRY_DELAYS) {
      await sleep(delay);
      if (myRun !== runId || location.href !== url) return; // navigated away

      let product = null;
      try {
        product = await detector.detectProduct({ mode: 'auto' });
      } catch (error) {
        console.warn(TAG, 'Detection error:', error);
      }
      if (!product) continue;

      handledUrl = url;
      try {
        const response = await api.runtime.sendMessage({
          type: 'PRODUCT_DETECTED',
          data: product,
          source: 'auto'
        });
        const result = response?.data;
        const tracked = response?.success && (result?.added || result?.alreadyTracked) ? result.product : null;

        let panelShown = false;
        try {
          const { showPagePanel } = await loadPanel();
          if (myRun === runId) panelShown = showPagePanel({ product, tracked, settings: await getSettings() });
        } catch (error) {
          console.warn(TAG, 'Panel error:', error);
        }

        if (!panelShown && response?.success && result?.added) {
          detector.showTrackingBadge(product, `Tracking at ${product.price.formatted || product.price.numeric}`);
        }
      } catch (error) {
        console.warn(TAG, 'Could not reach background:', error);
      }
      return;
    }
  }

  // SPA navigation: many modern stores never reload the page
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (handledUrl !== lastUrl) run();
    }
  }, 1000);

  run();
})();
