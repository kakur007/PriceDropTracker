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

          // Send product to background script for storage
          try {
            const response = await chrome.runtime.sendMessage({
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
    console.error('[Price Drop Tracker] Failed to load product detector:', error);
  }
})();
