/**
 * Main Content Script Entry Point
 * This script is injected into product pages and coordinates product detection
 *
 * NOTE: This is NOT an ES6 module for Firefox MV2 compatibility
 * Content scripts in MV2 don't support module imports
 */

// Use the global browser object (provided by Firefox or polyfilled by Chrome)
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

(async function() {
  try {
    console.log('[Price Drop Tracker] Extension initialized on', window.location.hostname);

    // Load the product detector module dynamically as a script
    // Since it's a web_accessible_resource, we can load it as a module
    const detectorUrl = browserAPI.runtime.getURL('content-scripts/product-detector.js');

    // Use dynamic import if available (Firefox 89+), otherwise inject as script tag
    let detectProduct;

    try {
      // Try dynamic import first (works in newer Firefox with modules)
      const module = await import(detectorUrl);
      detectProduct = module.detectProduct;
    } catch (importError) {
      console.log('[Price Drop Tracker] Dynamic import failed, using script injection:', importError.message);

      // Fallback: inject as script tag and wait for it to load
      // This won't work well because product-detector.js is also a module
      // So we'll just log an error for now
      console.error('[Price Drop Tracker] Cannot load product detector in this environment');
      console.error('[Price Drop Tracker] Please use Firefox 89+ or switch to Manifest V3');
      return;
    }

    // Wait a bit for the page to fully load dynamic content
    setTimeout(async () => {
      try {
        const product = await detectProduct();
        if (product) {
          console.log('[Price Drop Tracker] ✓ Product detected:', product.title);
          console.log('[Price Drop Tracker] Price:', `${product.price.symbol}${product.price.numeric}`);
          console.log('[Price Drop Tracker] Detection method:', product.detectionMethod);
          console.log('[Price Drop Tracker] Confidence:', (product.confidence * 100).toFixed(0) + '%');

          // Send product to background script for storage
          try {
            const response = await browserAPI.runtime.sendMessage({
              type: 'PRODUCT_DETECTED',
              data: product
            });

            if (response && response.success) {
              if (response.data.alreadyTracked) {
                console.log('[Price Drop Tracker] ✓ Product is already being tracked');
              } else {
                console.log('[Price Drop Tracker] ✓ Product added to tracking list');
              }
            } else {
              console.error('[Price Drop Tracker] Failed to save product:', response?.error);
            }
          } catch (sendError) {
            console.error('[Price Drop Tracker] Error sending message to background:', sendError);
          }
        } else {
          console.log('[Price Drop Tracker] No product detected on this page');
        }
      } catch (error) {
        console.error('[Price Drop Tracker] Error detecting product:', error);
      }
    }, 1500);

  } catch (error) {
    console.error('[Price Drop Tracker] Failed to initialize product tracker:', error);
  }
})();
