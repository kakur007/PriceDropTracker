import { debug, debugWarn, debugError } from './debug.js';

/**
 * Thumbnail Generator - Image compression utility
 *
 * Creates small, compressed thumbnails for local caching
 * Works in any context (content script, popup, background, options)
 * NO browser API dependencies - pure DOM/Canvas operations
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

    // Add cache-busting parameter to prevent Chrome cache conflict
    // When page preloads image without CORS, and we request with CORS,
    // Chrome throws "credentials mode does not match" error
    // Cache-busting forces a unique request that can use CORS properly
    const cacheBustUrl = imageUrl.includes('?')
      ? `${imageUrl}&_cb=${Date.now()}`
      : `${imageUrl}?_cb=${Date.now()}`;

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
            debugWarn('[thumbnail-generator]', '[ThumbnailGenerator] Thumbnail too large, trying lower quality...');
            const smallerDataUrl = canvas.toDataURL('image/jpeg', 0.5);
            resolve(smallerDataUrl);
          } else {
            resolve(dataUrl);
          }
        } catch (e) {
          // CORS or security error - cannot export canvas data
          debugWarn('[thumbnail-generator]', '[ThumbnailGenerator] Cannot export canvas due to CORS:', e.message);
          resolve(null);
        }
      } catch (error) {
        debugError('[thumbnail-generator]', '[ThumbnailGenerator] Error creating thumbnail:', error);
        resolve(null);
      }
    };

    img.onerror = (error) => {
      debugWarn('[thumbnail-generator]', '[ThumbnailGenerator] Error loading image:', imageUrl, error);
      resolve(null);
    };

    // Set timeout to avoid hanging
    setTimeout(() => {
      if (!img.complete) {
        debugWarn('[thumbnail-generator]', '[ThumbnailGenerator] Image load timeout:', imageUrl);
        resolve(null);
      }
    }, 5000);

    // Use cache-busted URL to avoid CORS cache conflicts
    img.src = cacheBustUrl;
  });
}
