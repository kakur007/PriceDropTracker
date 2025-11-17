/**
 * Price Drop Tracker - Background Service Worker
 *
 * Handles:
 * - Extension installation and initialization
 * - Periodic alarms for price checking
 * - Message passing from content scripts
 * - Badge updates
 * - Settings management
 */

import { StorageManager } from './storage-manager.js';
import { checkAllProducts, checkSingleProduct, PriceCheckResult } from './price-checker.js';
import { showBatchPriceDropNotifications, showInfoNotification, showErrorNotification } from '../utils/notification-manager.js';
import { validateUrl, getSupportedStoresList, isUrlSupportedOrPermitted, isUrlSupported } from '../utils/domain-validator.js';
import { checkPermissionStatus, extractDomain } from '../utils/permission-manager.js';

// Alarm names
const ALARMS = {
  PRICE_CHECK: 'price-check',
  DAILY_CLEANUP: 'daily-cleanup'
};

// Message types
const MESSAGE_TYPES = {
  PRODUCT_DETECTED: 'PRODUCT_DETECTED',
  CHECK_PRODUCT: 'CHECK_PRODUCT',
  GET_PRODUCT: 'GET_PRODUCT',
  DELETE_PRODUCT: 'DELETE_PRODUCT',
  GET_ALL_PRODUCTS: 'GET_ALL_PRODUCTS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  GET_SETTINGS: 'GET_SETTINGS',
  CHECK_NOW: 'CHECK_NOW',
  FORCE_CHECK_ALL: 'FORCE_CHECK_ALL'
};

console.log('[ServiceWorker] Price Drop Tracker: Service worker initializing...');

/**
 * Extension installation handler
 * Sets up default settings and alarms on first install
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[ServiceWorker] Extension installed/updated:', details.reason);

  try {
    if (details.reason === 'install') {
      console.log('[ServiceWorker] First time installation - setting up defaults');

      // Open welcome page on first install
      chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/welcome.html') });

      // Initialize default settings
      await StorageManager.initializeSettings();

      // Set up initial alarms
      await setupAlarms();

      console.log('[ServiceWorker] Default settings and alarms configured');
    } else if (details.reason === 'update') {
      console.log('[ServiceWorker] Extension updated - checking alarms');

      // Ensure alarms are set up after update
      await setupAlarms();
    }

    // Update badge to show tracked product count
    await updateBadge();

  } catch (error) {
    console.error('[ServiceWorker] Error during installation:', error);
  }
});

/**
 * Browser startup handler
 * Ensures alarms are active when browser starts
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('[ServiceWorker] Browser started, service worker active');

  try {
    // Verify alarms are set up
    await setupAlarms();

    // Update badge
    await updateBadge();

  } catch (error) {
    console.error('[ServiceWorker] Error during startup:', error);
  }
});

/**
 * Set up periodic alarms
 * - Price check alarm (based on user settings)
 * - Daily cleanup alarm (removes old products)
 */
async function setupAlarms() {
  console.log('[ServiceWorker] Setting up alarms...');

  try {
    // Get current settings
    const settings = await StorageManager.getSettings();

    // Clear existing alarms
    await chrome.alarms.clearAll();

    // Set up price check alarm
    if (settings.tracking.enabled) {
      const checkIntervalMinutes = settings.tracking.checkInterval / 60; // Convert seconds to minutes

      console.log(`[ServiceWorker] Creating price check alarm: every ${checkIntervalMinutes} minutes`);

      chrome.alarms.create(ALARMS.PRICE_CHECK, {
        delayInMinutes: 1, // First check in 1 minute
        periodInMinutes: checkIntervalMinutes
      });
    } else {
      console.log('[ServiceWorker] Price checking is disabled in settings');
    }

    // Set up daily cleanup alarm (runs at 3 AM)
    console.log('[ServiceWorker] Creating daily cleanup alarm');

    chrome.alarms.create(ALARMS.DAILY_CLEANUP, {
      when: getNextCleanupTime(),
      periodInMinutes: 24 * 60 // 24 hours
    });

    console.log('[ServiceWorker] Alarms configured successfully');

  } catch (error) {
    console.error('[ServiceWorker] Error setting up alarms:', error);
  }
}

/**
 * Get timestamp for next cleanup (3 AM)
 * @returns {number} - Timestamp in milliseconds
 */
function getNextCleanupTime() {
  const now = new Date();
  const next = new Date();

  next.setHours(3, 0, 0, 0); // 3 AM

  // If 3 AM has passed today, schedule for tomorrow
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next.getTime();
}

/**
 * Alarm listener
 * Handles periodic tasks
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log(`[ServiceWorker] Alarm triggered: ${alarm.name}`);

  try {
    if (alarm.name === ALARMS.PRICE_CHECK) {
      await handlePriceCheckAlarm();
    } else if (alarm.name === ALARMS.DAILY_CLEANUP) {
      await handleCleanupAlarm();
    }
  } catch (error) {
    console.error(`[ServiceWorker] Error handling alarm ${alarm.name}:`, error);
  }
});

/**
 * Handle price check alarm
 * Checks all products that need updating
 */
async function handlePriceCheckAlarm() {
  console.log('[ServiceWorker] Running periodic price check...');

  try {
    const settings = await StorageManager.getSettings();

    if (!settings.tracking.enabled) {
      console.log('[ServiceWorker] Price checking is disabled, skipping');
      return;
    }

    // Check products older than the check interval
    const maxAge = settings.tracking.checkInterval * 1000; // Convert seconds to ms

    const results = await checkAllProducts({
      batchSize: 10,
      delayBetweenChecks: 2000,
      maxAge: maxAge
    });

    console.log(`[ServiceWorker] Price check complete:`, results);

    // Update badge with new data
    await updateBadge();

    // Send notifications for price drops if enabled
    if (settings.notifications.enabled && results.priceDrops > 0) {
      await notifyPriceDrops(results.details);
    }

  } catch (error) {
    console.error('[ServiceWorker] Error during price check:', error);
  }
}

/**
 * Handle cleanup alarm
 * Removes old and expired products
 */
async function handleCleanupAlarm() {
  console.log('[ServiceWorker] Running daily cleanup...');

  try {
    const settings = await StorageManager.getSettings();
    const maxAgeDays = settings.tracking.maxAge;

    await StorageManager.cleanupOldProducts(maxAgeDays);

    console.log('[ServiceWorker] Cleanup complete');

    // Update badge
    await updateBadge();

  } catch (error) {
    console.error('[ServiceWorker] Error during cleanup:', error);
  }
}

/**
 * Send notifications for price drops
 * @param {Array} checkDetails - Detailed price check results from price-checker
 */
async function notifyPriceDrops(checkDetails) {
  const priceDrops = checkDetails.filter(r => r.status === PriceCheckResult.PRICE_DROP);

  if (priceDrops.length === 0) {
    return;
  }

  console.log(`[ServiceWorker] Sending notifications for ${priceDrops.length} price drops`);

  try {
    // Get full product data for each drop
    const dropData = await Promise.all(
      priceDrops.map(async (drop) => {
        const product = await StorageManager.getProduct(drop.productId);
        if (!product) {
          console.warn(`[ServiceWorker] Product not found for notification: ${drop.productId}`);
          return null;
        }

        return {
          product,
          oldPrice: drop.oldPrice,
          newPrice: drop.newPrice,
          dropPercentage: Math.abs(drop.changePercent || 0)
        };
      })
    );

    // Filter out any null results
    const validDrops = dropData.filter(d => d !== null);

    if (validDrops.length > 0) {
      // Use the notification manager to handle batching and cooldowns
      await showBatchPriceDropNotifications(validDrops);
    }

  } catch (error) {
    console.error('[ServiceWorker] Error sending price drop notifications:', error);
  }
}

/**
 * Message listener
 * Handles messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[ServiceWorker] Message received:', message.type, sender.tab?.url);

  // Ignore messages meant for offscreen document (PARSE_HTML)
  if (message.type === 'PARSE_HTML') {
    // This message is for the offscreen document, not the service worker
    return false;
  }

  // Handle message asynchronously
  handleMessage(message, sender)
    .then(response => {
      sendResponse({ success: true, data: response });
    })
    .catch(error => {
      console.error('[ServiceWorker] Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    });

  // Return true to indicate async response
  return true;
});

/**
 * Handle incoming messages
 * @param {Object} message - Message object
 * @param {Object} sender - Sender information
 * @returns {Promise<any>} - Response data
 */
async function handleMessage(message, sender) {
  const { type, data = {} } = message;

  switch (type) {
    case MESSAGE_TYPES.PRODUCT_DETECTED:
      return await handleProductDetected(data, sender);

    case MESSAGE_TYPES.CHECK_PRODUCT:
      return await checkSingleProduct(data.productId);

    case MESSAGE_TYPES.GET_PRODUCT:
      return await StorageManager.getProduct(data.productId);

    case MESSAGE_TYPES.DELETE_PRODUCT:
      await StorageManager.deleteProduct(data.productId);
      await updateBadge();
      return { deleted: true };

    case MESSAGE_TYPES.GET_ALL_PRODUCTS:
      return await StorageManager.getAllProducts();

    case MESSAGE_TYPES.UPDATE_SETTINGS:
      await StorageManager.saveSettings(data.settings);
      // Re-setup alarms with new settings
      await setupAlarms();
      return { updated: true };

    case MESSAGE_TYPES.GET_SETTINGS:
      return await StorageManager.getSettings();

    case MESSAGE_TYPES.CHECK_NOW:
      try {
        const results = await checkAllProducts({
          batchSize: data.batchSize || 10,
          maxAge: 0 // Check all products regardless of age
        });
        await updateBadge();

        // Send notifications for any price drops found
        const settings = await StorageManager.getSettings();
        if (settings.notifications.enabled && results.priceDrops > 0) {
          await notifyPriceDrops(results.details);
        }

        return { success: true, results };
      } catch (error) {
        console.error('[ServiceWorker] CHECK_NOW error:', error);
        return { success: false, error: error.message };
      }

    case MESSAGE_TYPES.FORCE_CHECK_ALL:
      const forceResults = await checkAllProducts({
        batchSize: data.batchSize || 10,
        maxAge: 0 // Check all products regardless of age
      });
      await updateBadge();

      // Send notifications for any price drops found
      const forceSettings = await StorageManager.getSettings();
      if (forceSettings.notifications.enabled && forceResults.priceDrops > 0) {
        await notifyPriceDrops(forceResults.details);
      }

      return forceResults;

    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

/**
 * Handle product detected from content script
 * @param {Object} productData - Detected product data
 * @param {Object} sender - Sender information
 * @returns {Promise<Object>} - Saved product or status
 */
async function handleProductDetected(productData, sender) {
  console.log('[ServiceWorker] Product detected:', productData.title, 'ID:', productData.productId);
  console.log('[ServiceWorker] Product URL:', productData.url);

  try {
    // Check if URL is in default supported list
    const isDefaultSupported = isUrlSupported(productData.url);
    console.log('[ServiceWorker] Is default supported:', isDefaultSupported);

    // Check if we have permission for this URL
    const permissionStatus = await checkPermissionStatus(productData.url, isDefaultSupported);
    console.log('[ServiceWorker] Permission status:', permissionStatus);

    // If we need to request permission, return status to trigger UI prompt
    if (permissionStatus.needsRequest && !permissionStatus.hasPermission) {
      console.log('[ServiceWorker] ⚠️ Permission needed for:', extractDomain(productData.url));

      return {
        needsPermission: true,
        domain: extractDomain(productData.url),
        url: productData.url,
        productData: productData // Send back so we can retry after permission granted
      };
    }

    // Check if we have permission (either from manifest or granted at runtime)
    const hasPermission = await isUrlSupportedOrPermitted(productData.url);
    console.log('[ServiceWorker] Has permission (final check):', hasPermission);

    if (!hasPermission) {
      console.warn('[ServiceWorker] ✗ No permission for domain:', productData.url);

      await showErrorNotification(
        `Cannot track this product: No permission to access ${extractDomain(productData.url)}. You can grant permission when prompted.`
      );

      return {
        error: 'No permission for this domain',
        domain: extractDomain(productData.url)
      };
    }

    // Check if product already exists
    const existingProduct = await StorageManager.getProduct(productData.productId);

    if (existingProduct) {
      console.log('[ServiceWorker] ℹ️ Product already tracked:', productData.productId);
      return {
        alreadyTracked: true,
        product: existingProduct
      };
    }

    // Save new product
    console.log('[ServiceWorker] Saving new product:', productData.productId);
    await StorageManager.saveProduct(productData);

    console.log('[ServiceWorker] ✓ New product saved successfully:', productData.productId);

    // Update badge
    await updateBadge();

    // Show notification if enabled
    await showInfoNotification(
      'Product Added',
      `Now tracking: ${productData.title}`,
      { type: 'product_added', duration: 5000 }
    );

    return {
      alreadyTracked: false,
      product: productData
    };

  } catch (error) {
    console.error('[ServiceWorker] Error handling detected product:', error);
    throw error;
  }
}

/**
 * Update extension badge with tracked product count
 */
async function updateBadge() {
  try {
    const allProducts = await StorageManager.getAllProducts();
    const count = allProducts.length;

    if (count > 0) {
      await chrome.action.setBadgeText({ text: count.toString() });
      await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }

  } catch (error) {
    console.error('[ServiceWorker] Error updating badge:', error);
  }
}

console.log('[ServiceWorker] Service worker ready');
