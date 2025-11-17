/**
 * Notification Manager - Handle price drop notifications
 *
 * Features:
 * - Price drop notifications with proper formatting
 * - Notification cooldown to avoid spam
 * - Notification grouping for multiple drops
 * - Click handling to open product pages
 * - Settings integration (respect user preferences)
 */

import { StorageManager } from '../background/storage-manager.js';

/**
 * Notification cooldown tracking
 * Prevents spamming the same notification multiple times
 * Format: { productId: timestamp }
 */
const notificationCooldowns = new Map();

/**
 * Default cooldown period (30 minutes)
 * Won't show the same notification for a product within this time
 */
const DEFAULT_COOLDOWN_MS = 30 * 60 * 1000;

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
      console.log('[Notifications] Notifications disabled in settings');
      return null;
    }

    // Check if drop meets minimum threshold
    if (dropPercentage < settings.notifications.minDropPercent) {
      console.log(`[Notifications] Drop ${dropPercentage}% below threshold ${settings.notifications.minDropPercent}%`);
      return null;
    }

    // Check cooldown
    if (isOnCooldown(product.id)) {
      console.log(`[Notifications] Product ${product.id} is on cooldown`);
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
    const notificationId = await chrome.notifications.create(product.id, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
      title,
      message,
      priority: 2,
      requireInteraction: false,
      silent: false
    });

    console.log(`[Notifications] Created notification: ${notificationId} for product: ${product.title}`);

    // Set cooldown
    setCooldown(product.id);

    // Auto-clear after 10 seconds
    setTimeout(() => {
      chrome.notifications.clear(notificationId).catch(err => {
        console.warn('[Notifications] Error clearing notification:', err);
      });
    }, 10000);

    return notificationId;

  } catch (error) {
    console.error('[Notifications] Error creating price drop notification:', error);
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

    console.log(`[Notifications] Showing ${priceDrops.length} price drop notifications`);

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

    await chrome.notifications.create('batch-price-drops', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
      title,
      message,
      priority: 2,
      requireInteraction: false
    });

    console.log('[Notifications] Created batch notification');

    // Set cooldowns for all products
    priceDrops.forEach(drop => setCooldown(drop.product.id));

    return 1; // One summary notification

  } catch (error) {
    console.error('[Notifications] Error creating batch notifications:', error);
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
      console.log('[Notifications] Product added notifications disabled');
      return null;
    }

    const notificationId = await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
      title,
      message,
      priority: options.priority || 0,
      silent: options.silent !== undefined ? options.silent : true
    });

    console.log(`[Notifications] Created info notification: ${title}`);

    // Auto-clear after duration if specified
    if (options.duration) {
      setTimeout(() => {
        chrome.notifications.clear(notificationId).catch(err => {
          console.warn('[Notifications] Error clearing notification:', err);
        });
      }, options.duration);
    }

    return notificationId;

  } catch (error) {
    console.error('[Notifications] Error creating info notification:', error);
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
    const notificationId = await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
      title: '⚠️ Price Drop Tracker Error',
      message,
      priority: 1,
      silent: false
    });

    console.log(`[Notifications] Created error notification: ${message}`);

    // Auto-clear after 8 seconds
    setTimeout(() => {
      chrome.notifications.clear(notificationId).catch(err => {
        console.warn('[Notifications] Error clearing notification:', err);
      });
    }, 8000);

    return notificationId;

  } catch (error) {
    console.error('[Notifications] Error creating error notification:', error);
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
    console.warn('[Notifications] Error formatting price:', error);
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
function isOnCooldown(productId) {
  const lastNotification = notificationCooldowns.get(productId);

  if (!lastNotification) {
    return false;
  }

  const timeSinceLastNotification = Date.now() - lastNotification;
  return timeSinceLastNotification < DEFAULT_COOLDOWN_MS;
}

/**
 * Set cooldown for a product
 *
 * @param {string} productId - Product ID
 */
function setCooldown(productId) {
  notificationCooldowns.set(productId, Date.now());

  // Clean up old cooldowns after they expire
  setTimeout(() => {
    notificationCooldowns.delete(productId);
  }, DEFAULT_COOLDOWN_MS + 1000);
}

/**
 * Clear cooldown for a product (useful for testing)
 *
 * @param {string} productId - Product ID
 */
export function clearCooldown(productId) {
  notificationCooldowns.delete(productId);
}

/**
 * Clear all cooldowns (useful for testing)
 */
export function clearAllCooldowns() {
  notificationCooldowns.clear();
}

/**
 * Handle notification clicks
 * Opens the product page when user clicks the notification
 */
if (typeof chrome !== 'undefined' && chrome.notifications) {
  chrome.notifications.onClicked.addListener(async (notificationId) => {
    try {
      console.log(`[Notifications] Notification clicked: ${notificationId}`);

      // Handle batch notification clicks
      if (notificationId === 'batch-price-drops') {
        // Open the extension popup
        chrome.action.openPopup().catch(() => {
          console.log('[Notifications] Could not open popup, opening in new tab');
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
        console.log(`[Notifications] Opened product page: ${product.url}`);
      } else {
        console.warn(`[Notifications] Product not found: ${notificationId}`);
      }

      // Clear the notification
      chrome.notifications.clear(notificationId);

    } catch (error) {
      console.error('[Notifications] Error handling notification click:', error);
    }
  });

  // Handle notification close events
  chrome.notifications.onClosed.addListener((notificationId, byUser) => {
    if (byUser) {
      console.log(`[Notifications] Notification closed by user: ${notificationId}`);
    }
  });
}

// Export functions
export {
  formatPrice,
  isOnCooldown,
  setCooldown
};
