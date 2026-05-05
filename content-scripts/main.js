/**
 * Main Content Script Entry Point
 * This script is injected into product pages and coordinates product detection
 *
 * Firefox Note: Content scripts listed in manifest.json cannot use top-level
 * ES6 imports. We must use dynamic imports only.
 *
 * NOTE: This file uses console.log directly instead of debug() utility
 * because it cannot import modules (would cause "Cannot use import outside module" error)
 */

// Get browser API (available globally in content scripts)
// Use globalThis to avoid shadowing Firefox's browser global.
const extensionApi = typeof globalThis.browser !== 'undefined'
  ? globalThis.browser
  : (typeof globalThis.chrome !== 'undefined' ? globalThis.chrome : null);

console.log('[Price Drop Tracker] Content script loaded on:', window.location.hostname);

// Import all modules dynamically (Firefox requires this approach)
(async function() {
  try {
    if (!extensionApi) {
      console.error('[Price Drop Tracker] Browser extension API is not available');
      return;
    }

    console.log('[Price Drop Tracker] Starting product detection initialization...');

    // main.js owns automatic detection. Prevent product-detector.js from also
    // running its auto-detection IIFE when imported below.
    window.__PRICE_TRACKER_MANUAL_MODE__ = true;

    // Dynamically import the product detector module
    // Using inline browser.runtime.getURL() to satisfy Firefox static analyzer
    console.log('[Price Drop Tracker] Loading detector from:', extensionApi.runtime.getURL('content-scripts/product-detector.js'));

    const { detectProduct } = await import(extensionApi.runtime.getURL('content-scripts/product-detector.js'));

    console.log('[Price Drop Tracker] ✓ Detector module loaded successfully');
    console.log('[Price Drop Tracker] Extension initialized on', window.location.hostname);

    // Wait a bit for the page to fully load dynamic content
    setTimeout(async () => {
      try {
        console.log('[Price Drop Tracker] Running product detection...');
        const product = await detectProduct();

        if (product) {
          console.log('[Price Drop Tracker] ✅ Product detected:', product.title);
          console.log('[Price Drop Tracker] Price:', `${product.price.symbol}${product.price.numeric}`);
          console.log('[Price Drop Tracker] Detection method:', product.detectionMethod);
          console.log('[Price Drop Tracker] Confidence:', (product.confidence * 100).toFixed(0) + '%');

          // Send product to background script for storage
          try {
            console.log('[Price Drop Tracker] Sending product to background for storage...');
            const response = await extensionApi.runtime.sendMessage({
              type: 'PRODUCT_DETECTED',
              data: product
            });

            if (response && response.success) {
              if (response.data.alreadyTracked) {
                console.log('[Price Drop Tracker] ℹ️ Product is already being tracked');
              } else {
                console.log('[Price Drop Tracker] ✅ Product added to tracking list');
              }
            } else {
              console.error('[Price Drop Tracker] ❌ Failed to save product:', response?.error);
            }
          } catch (sendError) {
            console.error('[Price Drop Tracker] ❌ Error sending message to background:', sendError);
          }
        } else {
          console.log('[Price Drop Tracker] ℹ️ No product detected on this page');
        }
      } catch (error) {
        console.error('[Price Drop Tracker] ❌ Error detecting product:', error);
        console.error('[Price Drop Tracker] Error stack:', error.stack);
      }
    }, 1500);

  } catch (error) {
    console.error('[Price Drop Tracker] ❌ Failed to load product detector:', error);
    console.error('[Price Drop Tracker] Error stack:', error.stack);
  }
})();
