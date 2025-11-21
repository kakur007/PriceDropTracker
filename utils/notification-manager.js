/**
 * Notification Manager - Handle price drop notifications
 *
 * Features:
 * - Price drop notifications with proper formatting
 * - Notification cooldown to avoid spam
 * - Notification grouping for multiple drops
 * - Click handling to open product pages
 * - Settings integration (respect user preferences)
 * - Cross-browser compatibility (Chrome & Firefox)
 */

import browser from './browser-polyfill.js';
import { StorageManager } from '../background/storage-manager.js';
import { isFirefox } from './browser-polyfill.js';
import { debug, debugWarn, debugError } from '../utils/debug.js';

/**
 * Default cooldown period (30 minutes)
 * Won't show the same notification for a product within this time
 */
const DEFAULT_COOLDOWN_MS = 30 * 60 * 1000;

/**
 * CRITICAL FIX: Store cooldowns in chrome.storage instead of memory
 * Service workers are ephemeral and shut down after 30 seconds of inactivity.
 * An in-memory Map would be reset, causing notification spam.
 * Storage key: 'notificationCooldowns' -> { productId: timestamp }
 */

/**
 * Show a price drop notification
 *
 * @param {Object} product - Product object from storage
 * @param {number} oldPrice - Previous price
 * @param {number} newPrice - New (lower) price
 * @param {number} dropPercentage - Price drop percentage
 * @returns {Promise<string|null>} - Notification ID or null if not shown
 */
export async function showPriceDropNotification(product, oldPrice, newPrice, dropPercentage) {
  try {
    // Check if notifications are enabled
    const settings = await StorageManager.getSettings();
    if (!settings.notifications.enabled) {
      debug('[notification-manager]', '[Notifications] Notifications disabled in settings');
      return null;
    }

    // Check if drop meets minimum threshold
    const minThreshold = settings.notifications.minDropPercentage || settings.notifications.minDropPercent || 5;
    if (dropPercentage < minThreshold) {
      debug('[notification-manager]', `[Notifications] Drop ${dropPercentage}% below threshold ${minThreshold}%`);
      return null;
    }

    // Check cooldown
    if (isOnCooldown(product.productId)) {
      debug('[notification-manager]', `[Notifications] Product ${product.productId} is on cooldown`);
      return null;
    }

    // Format the notification
    const title = '🔔 Price Drop Alert!';
    const dropAmount = (oldPrice - newPrice).toFixed(2);

    // Truncate title if too long
    const truncatedTitle = product.title.length > 60
      ? product.title.slice(0, 60) + '...'
      : product.title;

    const message = `${truncatedTitle}

Was: ${formatPrice(oldPrice, product.currency, product.locale)}
Now: ${formatPrice(newPrice, product.currency, product.locale)}
Save: ${formatPrice(parseFloat(dropAmount), product.currency, product.locale)} (${dropPercentage.toFixed(0)}% off)`;

    // Create the notification
    // Firefox doesn't support requireInteraction and silent properties
    const notificationOptions = {
      type: 'basic',
      iconUrl: browser.runtime.getURL('assets/icons/icon-128.png'),
      title,
      message,
      priority: 2
    };

    // Add Chrome-specific properties only on Chrome
    if (!isFirefox()) {
      notificationOptions.requireInteraction = false;
      notificationOptions.silent = false;
    }

    const notificationId = await browser.notifications.create(product.productId, notificationOptions);

    debug('[notification-manager]', `[Notifications] Created notification: ${notificationId} for product: ${product.title}`);

    // Set cooldown
    setCooldown(product.productId);

    // Auto-clear after 10 seconds
    setTimeout(() => {
      browser.notifications.clear(notificationId).catch(err => {
        debugWarn('[notification-manager]', '[Notifications] Error clearing notification:', err);
      });
    }, 10000);

    return notificationId;

  } catch (error) {
    debugError('[notification-manager]', '[Notifications] Error creating price drop notification:', error);
    return null;
  }
}

/**
 * Show multiple price drop notifications (batched)
 * Groups multiple drops into a summary notification if more than 3
 *
 * @param {Array} priceDrops - Array of { product, oldPrice, newPrice, dropPercentage }
 * @returns {Promise<number>} - Number of notifications shown
 */
export async function showBatchPriceDropNotifications(priceDrops) {
  try {
    if (!priceDrops || priceDrops.length === 0) {
      return 0;
    }

    debug('[notification-manager]', `[Notifications] Showing ${priceDrops.length} price drop notifications`);

    // If 3 or fewer, show individual notifications
    if (priceDrops.length <= 3) {
      let count = 0;
      for (const drop of priceDrops) {
        const result = await showPriceDropNotification(
          drop.product,
          drop.oldPrice,
          drop.newPrice,
          drop.dropPercentage
        );
        if (result) count++;
      }
      return count;
    }

    // If more than 3, show a summary notification
    const settings = await StorageManager.getSettings();
    if (!settings.notifications.enabled) {
      return 0;
    }

    const title = `🎉 ${priceDrops.length} Price Drops!`;

    // List top 3 drops
    const topDrops = priceDrops
      .sort((a, b) => b.dropPercentage - a.dropPercentage)
      .slice(0, 3);

    let message = 'Top deals:\n';
    topDrops.forEach((drop, index) => {
      const truncatedTitle = drop.product.title.length > 40
        ? drop.product.title.slice(0, 40) + '...'
        : drop.product.title;
      message += `${index + 1}. ${truncatedTitle} (${drop.dropPercentage.toFixed(0)}% off)\n`;
    });

    if (priceDrops.length > 3) {
      message += `\n+${priceDrops.length - 3} more deals!`;
    }

    // Firefox doesn't support requireInteraction property
    const batchOptions = {
      type: 'basic',
      iconUrl: browser.runtime.getURL('assets/icons/icon-128.png'),
      title,
      message,
      priority: 2
    };

    // Add Chrome-specific properties only on Chrome
    if (!isFirefox()) {
      batchOptions.requireInteraction = false;
    }

    await browser.notifications.create('batch-price-drops', batchOptions);

    debug('[notification-manager]', '[Notifications] Created batch notification');

    // Set cooldowns for all products
    priceDrops.forEach(drop => setCooldown(drop.product.productId));

    return 1; // One summary notification

  } catch (error) {
    debugError('[notification-manager]', '[Notifications] Error creating batch notifications:', error);
    return 0;
  }
}

/**
 * Show an informational notification
 *
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - Notification ID
 */
export async function showInfoNotification(title, message, options = {}) {
  try {
    const settings = await StorageManager.getSettings();

    // Only check settings if onAddProduct notification
    if (options.type === 'product_added' && !settings.notifications.onAddProduct) {
      debug('[notification-manager]', '[Notifications] Product added notifications disabled');
      return null;
    }

    // Firefox doesn't support silent property
    const infoOptions = {
      type: 'basic',
      iconUrl: browser.runtime.getURL('assets/icons/icon-128.png'),
      title,
      message,
      priority: options.priority || 0
    };

    // Add Chrome-specific properties only on Chrome
    if (!isFirefox()) {
      infoOptions.silent = options.silent !== undefined ? options.silent : true;
    }

    const notificationId = await browser.notifications.create(infoOptions);

    debug('[notification-manager]', `[Notifications] Created info notification: ${title}`);

    // Auto-clear after duration if specified
    if (options.duration) {
      setTimeout(() => {
        browser.notifications.clear(notificationId).catch(err => {
          debugWarn('[notification-manager]', '[Notifications] Error clearing notification:', err);
        });
      }, options.duration);
    }

    return notificationId;

  } catch (error) {
    debugError('[notification-manager]', '[Notifications] Error creating info notification:', error);
    return null;
  }
}

/**
 * Show error notification
 *
 * @param {string} message - Error message
 * @returns {Promise<string>} - Notification ID
 */
export async function showErrorNotification(message) {
  try {
    // Firefox doesn't support silent property
    const errorOptions = {
      type: 'basic',
      iconUrl: browser.runtime.getURL('assets/icons/icon-128.png'),
      title: '⚠️ Price Drop Tracker Error',
      message,
      priority: 1
    };

    // Add Chrome-specific properties only on Chrome
    if (!isFirefox()) {
      errorOptions.silent = false;
    }

    const notificationId = await browser.notifications.create(errorOptions);

    debug('[notification-manager]', `[Notifications] Created error notification: ${message}`);

    // Auto-clear after 8 seconds
    setTimeout(() => {
      browser.notifications.clear(notificationId).catch(err => {
        debugWarn('[notification-manager]', '[Notifications] Error clearing notification:', err);
      });
    }, 8000);

    return notificationId;

  } catch (error) {
    debugError('[notification-manager]', '[Notifications] Error creating error notification:', error);
    return null;
  }
}

/**
 * Format price for display
 *
 * @param {number} amount - Price amount
 * @param {string} currency - Currency code (e.g., 'USD')
 * @param {string} locale - Locale string (e.g., 'en-US')
 * @returns {string} - Formatted price string
 */
function formatPrice(amount, currency = 'USD', locale = 'en-US') {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: currency === 'JPY' ? 0 : 2,
      maximumFractionDigits: currency === 'JPY' ? 0 : 2
    }).format(amount);
  } catch (error) {
    debugWarn('[notification-manager]', '[Notifications] Error formatting price:', error);
    // Fallback to simple formatting
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Check if a product is on notification cooldown
 *
 * @param {string} productId - Product ID
 * @returns {boolean} - True if on cooldown
 */
async function isOnCooldown(productId) {
  try {
    const result = await browser.storage.local.get('notificationCooldowns');
    const cooldowns = result.notificationCooldowns || {};

    const lastNotification = cooldowns[productId];

    if (!lastNotification) {
      return false;
    }

    const timeSinceLastNotification = Date.now() - lastNotification;
    return timeSinceLastNotification < DEFAULT_COOLDOWN_MS;
  } catch (error) {
    debugWarn('[notification-manager]', '[Notifications] Error checking cooldown:', error);
    // On error, assume not on cooldown (better to notify than to miss)
    return false;
  }
}

/**
 * Set cooldown for a product (storage-based to survive service worker restarts)
 *
 * @param {string} productId - Product ID
 * @returns {Promise<void>}
 */
async function setCooldown(productId) {
  try {
    // Get existing cooldowns
    const result = await browser.storage.local.get('notificationCooldowns');
    const cooldowns = result.notificationCooldowns || {};

    // Set this product's cooldown
    cooldowns[productId] = Date.now();

    // Clean up expired cooldowns while we're here (don't let object grow forever)
    const now = Date.now();
    Object.keys(cooldowns).forEach(id => {
      if (now - cooldowns[id] > DEFAULT_COOLDOWN_MS) {
        delete cooldowns[id];
      }
    });

    // Save back to storage
    await browser.storage.local.set({ notificationCooldowns: cooldowns });

    debug('[notification-manager]', `[Notifications] Cooldown set for product: ${productId}`);
  } catch (error) {
    debugError('[notification-manager]', '[Notifications] Error setting cooldown:', error);
    // Continue execution even if cooldown fails
  }
}

/**
 * Clear cooldown for a product (useful for testing)
 *
 * @param {string} productId - Product ID
 * @returns {Promise<void>}
 */
export async function clearCooldown(productId) {
  try {
    const result = await browser.storage.local.get('notificationCooldowns');
    const cooldowns = result.notificationCooldowns || {};

    delete cooldowns[productId];

    await browser.storage.local.set({ notificationCooldowns: cooldowns });
  } catch (error) {
    debugError('[notification-manager]', '[Notifications] Error clearing cooldown:', error);
  }
}

/**
 * Clear all cooldowns (useful for testing)
 * @returns {Promise<void>}
 */
export async function clearAllCooldowns() {
  try {
    await browser.storage.local.set({ notificationCooldowns: {} });
  } catch (error) {
    debugError('[notification-manager]', '[Notifications] Error clearing all cooldowns:', error);
  }
}

/**
 * Handle notification clicks
 * Opens the product page when user clicks the notification
 */
if (typeof chrome !== 'undefined' && chrome.notifications) {
  chrome.notifications.onClicked.addListener(async (notificationId) => {
    try {
      debug('[notification-manager]', `[Notifications] Notification clicked: ${notificationId}`);

      // Handle batch notification clicks
      if (notificationId === 'batch-price-drops') {
        // Open the extension popup
        chrome.action.openPopup().catch(() => {
          debug('[notification-manager]', '[Notifications] Could not open popup, opening in new tab');
          chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html') });
        });
        chrome.notifications.clear(notificationId);
        return;
      }

      // Get the product by ID
      const product = await StorageManager.getProduct(notificationId);

      if (product && product.url) {
        // Open product page in new tab
        await chrome.tabs.create({ url: product.url });
        debug('[notification-manager]', `[Notifications] Opened product page: ${product.url}`);
      } else {
        debugWarn('[notification-manager]', `[Notifications] Product not found: ${notificationId}`);
      }

      // Clear the notification
      chrome.notifications.clear(notificationId);

    } catch (error) {
      debugError('[notification-manager]', '[Notifications] Error handling notification click:', error);
    }
  });

  // Handle notification close events
  chrome.notifications.onClosed.addListener((notificationId, byUser) => {
    if (byUser) {
      debug('[notification-manager]', `[Notifications] Notification closed by user: ${notificationId}`);
    }
  });
}

// Export functions
export {
  formatPrice,
  isOnCooldown,
  setCooldown
};
