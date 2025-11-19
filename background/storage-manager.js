// Price Drop Tracker - Storage Manager
// Handles all data persistence using Browser Storage API

import browser from '../utils/browser-polyfill.js';
import { debug, debugWarn, debugError } from '../utils/debug.js';

/**
 * Default settings for the extension
 * These are used when no settings have been saved yet
 */
const DEFAULT_SETTINGS = {
  tracking: {
    duration: 30,        // Days to track products
    maxProducts: 100,    // Maximum number of products to track
    autoRemoveExpired: true
  },
  checking: {
    interval: 6,         // Hours between price checks
    batchSize: 5,        // Number of products to check at once
    timeout: 10000,      // Request timeout in milliseconds
    retryAttempts: 3     // Number of retry attempts for failed checks
  },
  notifications: {
    enabled: true,
    minDropPercentage: 5,  // Minimum price drop % to trigger notification
    maxPerDay: 3,          // Maximum notifications per day
    sound: true,
    badge: true
  },
  privacy: {
    activityLog: true,
    analytics: false
  },
  advanced: {
    debugMode: false,
    verboseTiming: false
  }
};

/**
 * Saves or updates a product in storage
 * @param {Object} productData - Product data to save
 * @returns {Promise<string>} Product ID
 */
export async function saveProduct(productData) {
  try {
    // Extract and separate image thumbnail if present
    let imageThumbnail = null;
    if (productData.imageThumbnail) {
      imageThumbnail = productData.imageThumbnail;
      delete productData.imageThumbnail; // Remove from main product object
    }
    // Also remove imageUrl if it somehow still exists
    if (productData.imageUrl) {
      delete productData.imageUrl;
    }

    // Get existing products
    const result = await browser.storage.local.get(['products', 'metadata']);
    const products = result.products || {};
    const metadata = result.metadata || { totalProducts: 0, lastCleanup: Date.now(), storageUsed: 0 };

    const productId = productData.productId;

    // Check if product exists
    if (products[productId]) {
      // Update existing
      const existing = products[productId];

      // Add to price history if price changed
      if (existing.price.numeric !== productData.price.numeric) {
        existing.priceHistory = existing.priceHistory || [];
        const now = Date.now();

        // Add ONLY the actual current price change
        // Do NOT add fake historical entries with backdated timestamps
        // The regularPrice is already stored in the price object itself
        existing.priceHistory.push({
          price: productData.price.numeric,
          currency: productData.price.currency,
          timestamp: now,
          checkMethod: productData.detectionMethod
        });

        // Limit history to 30 entries
        if (existing.priceHistory.length > 30) {
          existing.priceHistory = existing.priceHistory.slice(-30);
        }
      }

      // Update fields
      existing.price = productData.price;
      existing.tracking.lastViewed = Date.now();
      existing.tracking.lastChecked = Date.now();

      products[productId] = existing;
    } else {
      // Check max products limit
      const settings = await getSettings();
      if (Object.keys(products).length >= settings.tracking.maxProducts) {
        throw new Error('Maximum product limit reached');
      }

      // Create new product entry
      // Initialize price history with only the ACTUAL current price
      // The regularPrice (if any) is already stored in productData.price.regularPrice
      // We should NOT create fake historical entries with backdated timestamps
      const now = Date.now();
      const priceHistory = [{
        price: productData.price.numeric,
        currency: productData.price.currency,
        timestamp: now,
        checkMethod: productData.detectionMethod
      }];

      products[productId] = {
        ...productData,
        priceHistory,
        tracking: {
          firstSeen: Date.now(),
          lastViewed: Date.now(),
          lastChecked: Date.now(),
          checkCount: 1,
          failedChecks: 0,
          status: 'tracking'
        },
        notifications: {
          lastNotified: null,
          notificationCount: 0,
          userDismissed: false
        }
      };

      metadata.totalProducts++;
    }

    // Save back to storage
    await browser.storage.local.set({ products, metadata });

    // Save image thumbnail separately to keep product data lean
    if (imageThumbnail) {
      const imageKey = `img_${productId}`;
      await browser.storage.local.set({ [imageKey]: imageThumbnail });
      debug('[storage-manager]', `[Storage] Saved thumbnail for product: ${productId}`);
    }

    debug('[storage-manager]', `[Storage] Saved product: ${productId}`);
    return productId;

  } catch (error) {
    debugError('[storage-manager]', '[Storage] Error saving product:', error);
    throw error;
  }
}

/**
 * Retrieves a single product by ID
 * @param {string} productId - Product ID to retrieve
 * @returns {Promise<Object|null>} Product data or null if not found
 */
export async function getProduct(productId) {
  try {
    const result = await browser.storage.local.get('products');
    const products = result.products || {};
    return products[productId] || null;
  } catch (error) {
    debugError('[storage-manager]', '[Storage] Error getting product:', error);
    return null;
  }
}

/**
 * Retrieves all products
 * @returns {Promise<Object>} Object containing all products
 */
export async function getAllProducts() {
  try {
    const result = await browser.storage.local.get('products');
    return result.products || {};
  } catch (error) {
    debugError('[storage-manager]', '[Storage] Error getting all products:', error);
    return {};
  }
}

/**
 * Deletes a product from storage
 * @param {string} productId - Product ID to delete
 * @returns {Promise<boolean>} Success status
 */
export async function deleteProduct(productId) {
  try {
    const result = await browser.storage.local.get(['products', 'metadata']);
    const products = result.products || {};
    const metadata = result.metadata || {};

    if (products[productId]) {
      delete products[productId];
      metadata.totalProducts = Math.max(0, (metadata.totalProducts || 0) - 1);

      await browser.storage.local.set({ products, metadata });

      // Also delete associated image thumbnail
      const imageKey = `img_${productId}`;
      await browser.storage.local.remove(imageKey);

      debug('[storage-manager]', `[Storage] Deleted product and thumbnail: ${productId}`);
      return true;
    }

    return false;
  } catch (error) {
    debugError('[storage-manager]', '[Storage] Error deleting product:', error);
    return false;
  }
}

/**
 * Updates the price for a product
 * @param {string} productId - Product ID
 * @param {Object} newPriceData - New price data
 * @returns {Promise<Object|null>} Updated product or null
 */
export async function updateProductPrice(productId, newPriceData) {
  try {
    const product = await getProduct(productId);
    if (!product) return null;

    // Add to price history
    product.priceHistory = product.priceHistory || [];
    product.priceHistory.push({
      price: newPriceData.numeric,
      currency: newPriceData.currency,
      timestamp: Date.now(),
      checkMethod: newPriceData.detectionMethod || 'unknown'
    });

    // Limit history
    if (product.priceHistory.length > 30) {
      product.priceHistory = product.priceHistory.slice(-30);
    }

    // Update price
    product.price = newPriceData;
    product.tracking.lastChecked = Date.now();
    product.tracking.checkCount++;
    product.tracking.failedChecks = 0; // Reset on success

    // Save
    const products = await getAllProducts();
    products[productId] = product;
    await browser.storage.local.set({ products });

    return product;
  } catch (error) {
    debugError('[storage-manager]', '[Storage] Error updating product price:', error);
    return null;
  }
}

/**
 * Removes old or expired products based on settings
 * @returns {Promise<number>} Count of deleted products
 */
export async function cleanupOldProducts() {
  try {
    const products = await getAllProducts();
    const settings = await getSettings();
    const now = Date.now();
    const maxAge = settings.tracking.duration * 24 * 60 * 60 * 1000; // Convert days to ms

    let deletedCount = 0;

    for (const [productId, product] of Object.entries(products)) {
      const age = now - product.tracking.firstSeen;

      // Delete if too old
      if (age > maxAge) {
        await deleteProduct(productId);
        deletedCount++;
        continue;
      }

      // Delete if marked expired
      if (product.tracking.status === 'expired') {
        await deleteProduct(productId);
        deletedCount++;
        continue;
      }

      // Delete if too many failed checks (7+ consecutive failures)
      if (product.tracking.failedChecks >= 7) {
        await deleteProduct(productId);
        deletedCount++;
        continue;
      }
    }

    // Update metadata
    const metadata = {
      totalProducts: Object.keys(products).length - deletedCount,
      lastCleanup: now,
      storageUsed: 0 // Will be calculated if needed
    };
    await browser.storage.local.set({ metadata });

    debug('[storage-manager]', `[Storage] Cleaned up ${deletedCount} old products`);
    return deletedCount;

  } catch (error) {
    debugError('[storage-manager]', '[Storage] Error cleaning up:', error);
    return 0;
  }
}

/**
 * Gets current settings or defaults
 * @returns {Promise<Object>} Settings object
 */
export async function getSettings() {
  try {
    const result = await browser.storage.local.get('settings');
    return result.settings || DEFAULT_SETTINGS;
  } catch (error) {
    debugError('[storage-manager]', '[Storage] Error getting settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Updates settings (merges with existing)
 * @param {Object} newSettings - New settings to merge
 * @returns {Promise<Object>} Updated settings
 */
export async function updateSettings(newSettings) {
  try {
    if (!newSettings || typeof newSettings !== 'object') {
      debugError('[storage-manager]', '[Storage] Invalid settings provided:', newSettings);
      throw new Error('Invalid settings object');
    }

    const currentSettings = await getSettings();

    // Deep merge - only merge properties that exist in newSettings
    const updated = {
      tracking: { ...currentSettings.tracking, ...(newSettings.tracking || {}) },
      checking: { ...currentSettings.checking, ...(newSettings.checking || {}) },
      notifications: { ...currentSettings.notifications, ...(newSettings.notifications || {}) },
      privacy: { ...currentSettings.privacy, ...(newSettings.privacy || {}) },
      advanced: { ...currentSettings.advanced, ...(newSettings.advanced || {}) }
    };

    // Validate
    if (updated.tracking && (updated.tracking.duration < 7 || updated.tracking.duration > 90)) {
      throw new Error('Invalid tracking duration');
    }
    if (updated.checking && (updated.checking.interval < 1 || updated.checking.interval > 48)) {
      throw new Error('Invalid check interval');
    }

    await browser.storage.local.set({ settings: updated });
    debug('[storage-manager]', '[Storage] Settings updated');
    return updated;

  } catch (error) {
    debugError('[storage-manager]', '[Storage] Error updating settings:', error);
    throw error;
  }
}

/**
 * Gets storage statistics
 * @returns {Promise<Object|null>} Storage stats
 */
export async function getStorageStats() {
  try {
    const result = await browser.storage.local.get(null); // Get all data
    const products = result.products || {};
    const productIds = Object.keys(products);

    // Calculate approximate size
    const jsonSize = JSON.stringify(result).length;
    const bytesUsed = jsonSize * 2; // Rough estimate (Unicode characters)

    // Find oldest and newest
    let oldest = Date.now();
    let newest = 0;

    for (const product of Object.values(products)) {
      if (product.tracking.firstSeen < oldest) oldest = product.tracking.firstSeen;
      if (product.tracking.firstSeen > newest) newest = product.tracking.firstSeen;
    }

    return {
      productCount: productIds.length,
      bytesUsed,
      bytesAvailable: 10485760 - bytesUsed, // 10MB limit
      percentageUsed: (bytesUsed / 10485760) * 100,
      oldestProduct: oldest === Date.now() ? null : oldest,
      newestProduct: newest === 0 ? null : newest
    };

  } catch (error) {
    debugError('[storage-manager]', '[Storage] Error getting stats:', error);
    return null;
  }
}

/**
 * Exports all data as JSON string
 * @returns {Promise<string|null>} JSON string of all data
 */
export async function exportData() {
  try {
    const result = await chrome.storage.local.get(null);
    return JSON.stringify(result, null, 2);
  } catch (error) {
    debugError('[storage-manager]', '[Storage] Error exporting data:', error);
    return null;
  }
}

/**
 * Imports data from JSON string
 * @param {string} jsonString - JSON string to import
 * @returns {Promise<boolean>} Success status
 */
export async function importData(jsonString) {
  try {
    const data = JSON.parse(jsonString);

    // Validate structure
    if (!data.products || typeof data.products !== 'object') {
      throw new Error('Invalid data structure');
    }

    // Import
    await browser.storage.local.set(data);
    debug('[storage-manager]', '[Storage] Data imported successfully');
    return true;

  } catch (error) {
    debugError('[storage-manager]', '[Storage] Error importing data:', error);
    return false;
  }
}

/**
 * Clears all data from storage
 * @returns {Promise<boolean>} Success status
 */
export async function clearAllData() {
  try {
    await browser.storage.local.clear();
    debug('[storage-manager]', '[Storage] All data cleared');
    return true;
  } catch (error) {
    debugError('[storage-manager]', '[Storage] Error clearing data:', error);
    return false;
  }
}

/**
 * Initialize settings with defaults if not present
 * Called on extension installation
 * @returns {Promise<void>}
 */
export async function initializeSettings() {
  const settings = await getSettings();
  // getSettings already returns defaults if settings don't exist
  // Just save them to ensure they're persisted
  await browser.storage.local.set({ settings });
  debug('[storage-manager]', '[Storage] Settings initialized with defaults');
}

/**
 * Save settings to storage (alias for updateSettings for compatibility)
 * @param {object} settings - Settings object to save
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  return await updateSettings(settings);
}

/**
 * StorageManager namespace object for compatibility with service worker
 * Provides all storage functions as methods
 */
export const StorageManager = {
  saveProduct,
  getProduct,
  getAllProducts,
  deleteProduct,
  updateProductPrice,
  cleanupOldProducts,
  getSettings,
  updateSettings,
  saveSettings,
  initializeSettings,
  getStorageStats,
  exportData,
  importData,
  clearAllData
};
