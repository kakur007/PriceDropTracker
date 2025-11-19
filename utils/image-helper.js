/**
 * Image Helper - Optimized thumbnail generation for local caching
 *
 * Creates small, compressed thumbnails to prevent storage bloat
 * while maintaining privacy by caching images locally
 */

/**
 * Create an optimized thumbnail from an image URL
 * Uses canvas to resize and compress the image
 * This function works in any context (content script, popup, background)
 *
 * @param {string} imageUrl - URL of the image to thumbnail
 * @param {number} width - Target width in pixels (default: 80)
 * @param {number} height - Target height in pixels (default: 80)
 * @returns {Promise<string|null>} - Data URL of compressed thumbnail or null
 */
export async function createOptimizedThumbnail(imageUrl, width = 80, height = 80) {
  if (!imageUrl || imageUrl.startsWith('data:')) {
    return imageUrl; // Already a data URL or invalid
  }

  return new Promise((resolve) => {
    const img = new Image();

    // Required for canvas export when image is from different origin
    img.crossOrigin = "Anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');

        // Calculate dimensions to maintain aspect ratio
        const imgAspect = img.width / img.height;
        const targetAspect = width / height;

        let drawWidth, drawHeight, offsetX = 0, offsetY = 0;

        if (imgAspect > targetAspect) {
          // Image is wider - fit to height
          drawHeight = height;
          drawWidth = height * imgAspect;
          offsetX = -(drawWidth - width) / 2;
        } else {
          // Image is taller - fit to width
          drawWidth = width;
          drawHeight = width / imgAspect;
          offsetY = -(drawHeight - height) / 2;
        }

        // Draw the image (centered and cropped)
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

        // Convert to JPEG with 70% quality for optimal size/quality balance
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

          // Sanity check - ensure thumbnail is small enough
          if (dataUrl.length > 50000) { // 50KB max
            console.warn('[ImageHelper] Thumbnail too large, trying lower quality...');
            const smallerDataUrl = canvas.toDataURL('image/jpeg', 0.5);
            resolve(smallerDataUrl);
          } else {
            resolve(dataUrl);
          }
        } catch (e) {
          // CORS or security error - cannot export canvas data
          console.warn('[ImageHelper] Cannot export canvas due to CORS:', e.message);
          resolve(null);
        }
      } catch (error) {
        console.error('[ImageHelper] Error creating thumbnail:', error);
        resolve(null);
      }
    };

    img.onerror = (error) => {
      console.warn('[ImageHelper] Error loading image:', imageUrl, error);
      resolve(null);
    };

    // Set timeout to avoid hanging
    setTimeout(() => {
      if (!img.complete) {
        console.warn('[ImageHelper] Image load timeout:', imageUrl);
        resolve(null);
      }
    }, 5000);

    img.src = imageUrl;
  });
}

/**
 * Get image from separate storage
 * NOTE: This function requires browser API - use only in background/popup contexts
 * @param {string} productId - Product ID
 * @returns {Promise<string|null>} - Data URL or null
 */
export async function getProductImage(productId) {
  try {
    const { default: browser } = await import('./browser-polyfill.js');
    const imageKey = `img_${productId}`;
    const result = await browser.storage.local.get(imageKey);
    return result[imageKey] || null;
  } catch (error) {
    console.error('[ImageHelper] Error loading image:', error);
    return null;
  }
}

/**
 * Save image to separate storage
 * NOTE: This function requires browser API - use only in background/popup contexts
 * @param {string} productId - Product ID
 * @param {string} imageDataUrl - Image data URL
 * @returns {Promise<void>}
 */
export async function saveProductImage(productId, imageDataUrl) {
  try {
    const { default: browser } = await import('./browser-polyfill.js');
    const imageKey = `img_${productId}`;
    await browser.storage.local.set({ [imageKey]: imageDataUrl });
    console.log(`[ImageHelper] Saved thumbnail for product: ${productId}`);
  } catch (error) {
    console.error('[ImageHelper] Error saving image:', error);
    throw error;
  }
}

/**
 * Delete image from separate storage
 * NOTE: This function requires browser API - use only in background/popup contexts
 * @param {string} productId - Product ID
 * @returns {Promise<void>}
 */
export async function deleteProductImage(productId) {
  try {
    const { default: browser } = await import('./browser-polyfill.js');
    const imageKey = `img_${productId}`;
    await browser.storage.local.remove(imageKey);
    console.log(`[ImageHelper] Deleted thumbnail for product: ${productId}`);
  } catch (error) {
    console.error('[ImageHelper] Error deleting image:', error);
  }
}
