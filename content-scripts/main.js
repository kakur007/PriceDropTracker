/**
import { debug, debugWarn, debugError } from '../utils/debug.js';
 * Main Content Script Entry Point
 * This script is injected into product pages and coordinates product detection
 *
 * Firefox Note: Content scripts listed in manifest.json cannot use top-level
 * ES6 imports. We must use dynamic imports only.
 */

// Get browser API (available globally in content scripts)
const browser = chrome || browser;

debug('[main]', '[Price Drop Tracker] Content script loaded on:', window.location.hostname);

// Import all modules dynamically (Firefox requires this approach)
(async function() {
  try {
    debug('[main]', '[Price Drop Tracker] Starting product detection initialization...');

    // Dynamically import the product detector module
    const detectorUrl = browser.runtime.getURL('content-scripts/product-detector.js');
    debug('[main]', '[Price Drop Tracker] Loading detector from:', detectorUrl);

    const { detectProduct } = await import(detectorUrl);

    debug('[main]', '[Price Drop Tracker] ✓ Detector module loaded successfully');
    debug('[main]', '[Price Drop Tracker] Extension initialized on', window.location.hostname);

    // Wait a bit for the page to fully load dynamic content
    setTimeout(async () => {
      try {
        debug('[main]', '[Price Drop Tracker] Running product detection...');
        const product = await detectProduct();

        if (product) {
          debug('[main]', '[Price Drop Tracker] ✅ Product detected:', product.title);
          debug('[main]', '[Price Drop Tracker] Price:', `${product.price.symbol}${product.price.numeric}`);
          debug('[main]', '[Price Drop Tracker] Detection method:', product.detectionMethod);
          debug('[main]', '[Price Drop Tracker] Confidence:', (product.confidence * 100).toFixed(0) + '%');

          // Send product to background script for storage
          try {
            debug('[main]', '[Price Drop Tracker] Sending product to background for storage...');
            const response = await browser.runtime.sendMessage({
              type: 'PRODUCT_DETECTED',
              data: product
            });

            if (response && response.success) {
              if (response.data.alreadyTracked) {
                debug('[main]', '[Price Drop Tracker] ℹ️ Product is already being tracked');
              } else {
                debug('[main]', '[Price Drop Tracker] ✅ Product added to tracking list');
              }
            } else {
              debugError('[main]', '[Price Drop Tracker] ❌ Failed to save product:', response?.error);
            }
          } catch (sendError) {
            debugError('[main]', '[Price Drop Tracker] ❌ Error sending message to background:', sendError);
          }
        } else {
          debug('[main]', '[Price Drop Tracker] ℹ️ No product detected on this page');
        }
      } catch (error) {
        debugError('[main]', '[Price Drop Tracker] ❌ Error detecting product:', error);
        debugError('[main]', '[Price Drop Tracker] Error stack:', error.stack);
      }
    }, 1500);

  } catch (error) {
    debugError('[main]', '[Price Drop Tracker] ❌ Failed to load product detector:', error);
    debugError('[main]', '[Price Drop Tracker] Error stack:', error.stack);
  }
})();
