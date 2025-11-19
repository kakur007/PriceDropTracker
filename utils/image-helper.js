/**
import { debug, debugWarn, debugError } from '../utils/debug.js';
 * Image Helper - Storage functions for product thumbnails
 *
 * NOTE: This file contains only storage-related functions that require browser APIs.
 * For thumbnail generation (canvas/DOM operations), use ../utils/thumbnail-generator.js
 *
 * This separation prevents "browser is not defined" errors in content scripts.
 */

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
    debugError('[image-helper]', '[ImageHelper] Error loading image:', error);
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
    debug('[image-helper]', `[ImageHelper] Saved thumbnail for product: ${productId}`);
  } catch (error) {
    debugError('[image-helper]', '[ImageHelper] Error saving image:', error);
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
    debug('[image-helper]', `[ImageHelper] Deleted thumbnail for product: ${productId}`);
  } catch (error) {
    debugError('[image-helper]', '[ImageHelper] Error deleting image:', error);
  }
}
