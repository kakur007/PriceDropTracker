/**
 * Main Content Script Entry Point
 * This script is injected into product pages and coordinates product detection
 */

// Import all modules dynamically
(async function() {
  try {
    // Dynamically import the product detector module
    const { detectProduct } = await import(chrome.runtime.getURL('content-scripts/product-detector.js'));

    console.log('[Price Drop Tracker] Extension initialized on', window.location.hostname);

    // Wait a bit for the page to fully load dynamic content
    setTimeout(async () => {
      try {
        const product = await detectProduct();
        if (product) {
          console.log('[Price Drop Tracker] ✓ Product detected:', product.title);
          console.log('[Price Drop Tracker] Price:', `${product.price.symbol}${product.price.numeric}`);
          console.log('[Price Drop Tracker] Detection method:', product.detectionMethod);
          console.log('[Price Drop Tracker] Confidence:', (product.confidence * 100).toFixed(0) + '%');

          // TODO: In Session 4, we'll save this to storage
        } else {
          console.log('[Price Drop Tracker] No product detected on this page');
        }
      } catch (error) {
        console.error('[Price Drop Tracker] Error detecting product:', error);
      }
    }, 1500);

  } catch (error) {
    console.error('[Price Drop Tracker] Failed to load product detector:', error);
  }
})();
