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

import browser, { executeScript } from '../utils/browser-polyfill.js';
import { StorageManager } from './storage-manager.js';
import { checkAllProducts, checkSingleProduct, PriceCheckResult } from './price-checker.js';
import { showBatchPriceDropNotifications, showInfoNotification } from '../utils/notification-manager.js';
import { debug, debugWarn, debugError } from '../utils/debug.js';

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
  FORCE_CHECK_ALL: 'FORCE_CHECK_ALL',
  REFRESH_SINGLE_PRODUCT: 'REFRESH_SINGLE_PRODUCT'
};

debug('[ServiceWorker]', 'Price Drop Tracker: Service worker initializing...');

/**
 * Extension installation handler
 * Sets up default settings and alarms on first install
 */
browser.runtime.onInstalled.addListener(async (details) => {
  debug('[ServiceWorker]', 'Extension installed/updated:', details.reason);

  try {
    if (details.reason === 'install') {
      debug('[ServiceWorker]', 'First time installation - setting up defaults');

      // Open welcome page on first install
      browser.tabs.create({ url: browser.runtime.getURL('onboarding/welcome.html') });

      // Initialize default settings
      await StorageManager.initializeSettings();

      // Set up initial alarms
      await setupAlarms();

      debug('[ServiceWorker]', 'Default settings and alarms configured');
    } else if (details.reason === 'update') {
      debug('[ServiceWorker]', 'Extension updated - checking alarms');

      // Ensure alarms are set up after update
      await setupAlarms();
    }

    // Update badge to show tracked product count
    await updateBadge();

  } catch (error) {
    debugError('[ServiceWorker]', 'Error during installation:', error);
  }
});

/**
 * Browser startup handler
 * Ensures alarms are active when browser starts
 */
browser.runtime.onStartup.addListener(async () => {
  debug('[ServiceWorker]', 'Browser started, service worker active');

  try {
    // Verify alarms are set up
    await setupAlarms();

    // Update badge
    await updateBadge();

  } catch (error) {
    debugError('[ServiceWorker]', 'Error during startup:', error);
  }
});

/**
 * Set up periodic alarms
 * - Price check alarm (based on user settings)
 * - Daily cleanup alarm (removes old products)
 */
async function setupAlarms() {
  debug('[ServiceWorker]', 'Setting up alarms...');

  try {
    // Get current settings
    const settings = await StorageManager.getSettings();

    // Clear existing alarms
    await browser.alarms.clearAll();

    // Set up price check alarm
    if (settings.tracking.enabled) {
      const checkIntervalMinutes = settings.tracking.checkInterval / 60; // Convert seconds to minutes

      debug('[ServiceWorker]', `Creating price check alarm: every ${checkIntervalMinutes} minutes`);

      browser.alarms.create(ALARMS.PRICE_CHECK, {
        delayInMinutes: 1, // First check in 1 minute
        periodInMinutes: checkIntervalMinutes
      });
    } else {
      debug('[ServiceWorker]', 'Price checking is disabled in settings');
    }

    // Set up daily cleanup alarm (runs at 3 AM)
    debug('[ServiceWorker]', 'Creating daily cleanup alarm');

    browser.alarms.create(ALARMS.DAILY_CLEANUP, {
      when: getNextCleanupTime(),
      periodInMinutes: 24 * 60 // 24 hours
    });

    debug('[ServiceWorker]', 'Alarms configured successfully');

  } catch (error) {
    debugError('[ServiceWorker]', 'Error setting up alarms:', error);
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
browser.alarms.onAlarm.addListener(async (alarm) => {
  debug('[ServiceWorker]', `[ServiceWorker] Alarm triggered: ${alarm.name}`);

  try {
    if (alarm.name === ALARMS.PRICE_CHECK) {
      await handlePriceCheckAlarm();
    } else if (alarm.name === ALARMS.DAILY_CLEANUP) {
      await handleCleanupAlarm();
    }
  } catch (error) {
    debugError('[ServiceWorker]', `[ServiceWorker] Error handling alarm ${alarm.name}:`, error);
  }
});

/**
 * Handle price check alarm
 * Checks all products that need updating
 */
async function handlePriceCheckAlarm() {
  debug('[ServiceWorker]', '[ServiceWorker] Running periodic price check...');

  try {
    const settings = await StorageManager.getSettings();

    if (!settings.tracking.enabled) {
      debug('[ServiceWorker]', '[ServiceWorker] Price checking is disabled, skipping');
      return;
    }

    // Check products older than the check interval
    const maxAge = settings.tracking.checkInterval * 1000; // Convert seconds to ms

    const results = await checkAllProducts({
      batchSize: 10,
      delayBetweenChecks: 2000,
      maxAge: maxAge
    });

    debug('[ServiceWorker]', `[ServiceWorker] Price check complete:`, results);

    // Update badge with new data
    await updateBadge();

    // Send notifications for price drops if enabled
    if (settings.notifications.enabled && results.priceDrops > 0) {
      await notifyPriceDrops(results.details);
    }

  } catch (error) {
    debugError('[ServiceWorker]', '[ServiceWorker] Error during price check:', error);
  }
}

/**
 * Handle cleanup alarm
 * Removes old and expired products
 */
async function handleCleanupAlarm() {
  debug('[ServiceWorker]', '[ServiceWorker] Running daily cleanup...');

  try {
    const settings = await StorageManager.getSettings();
    const maxAgeDays = settings.tracking.maxAge;

    await StorageManager.cleanupOldProducts(maxAgeDays);

    debug('[ServiceWorker]', '[ServiceWorker] Cleanup complete');

    // Update badge
    await updateBadge();

  } catch (error) {
    debugError('[ServiceWorker]', '[ServiceWorker] Error during cleanup:', error);
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

  debug('[ServiceWorker]', `[ServiceWorker] Sending notifications for ${priceDrops.length} price drops`);

  try {
    // Get full product data for each drop
    const dropData = await Promise.all(
      priceDrops.map(async (drop) => {
        const product = await StorageManager.getProduct(drop.productId);
        if (!product) {
          debugWarn('[ServiceWorker]', `[ServiceWorker] Product not found for notification: ${drop.productId}`);
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
    debugError('[ServiceWorker]', '[ServiceWorker] Error sending price drop notifications:', error);
  }
}

/**
 * Message listener
 * Handles messages from content scripts and popup
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  debug('[ServiceWorker]', '[ServiceWorker] Message received:', message.type, sender.tab?.url);

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
      debugError('[ServiceWorker]', '[ServiceWorker] Error handling message:', error);
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

    case MESSAGE_TYPES.REFRESH_SINGLE_PRODUCT:
      debug('[ServiceWorker]', '[ServiceWorker] Refreshing single product:', data.productId);
      const refreshResult = await checkSingleProduct(data.productId);
      await updateBadge();
      // Return the updated product
      const refreshedProduct = await StorageManager.getProduct(data.productId);
      return { product: refreshedProduct, checkResult: refreshResult };

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
        debugError('[ServiceWorker]', '[ServiceWorker] CHECK_NOW error:', error);
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
  debug('[ServiceWorker]', '[ServiceWorker] Product detected:', productData.title, 'ID:', productData.productId);
  debug('[ServiceWorker]', '[ServiceWorker] Product URL:', productData.url);

  try {
    // Check if product already exists
    const existingProduct = await StorageManager.getProduct(productData.productId);

    if (existingProduct) {
      debug('[ServiceWorker]', '[ServiceWorker] ℹ️ Product already tracked:', productData.productId);
      return {
        alreadyTracked: true,
        product: existingProduct
      };
    }

    // Save new product
    // NOTE: Permissions are now checked in popup.js BEFORE calling this function
    debug('[ServiceWorker]', '[ServiceWorker] Saving new product:', productData.productId);
    await StorageManager.saveProduct(productData);

    debug('[ServiceWorker]', '[ServiceWorker] ✓ New product saved successfully:', productData.productId);

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
    debugError('[ServiceWorker]', '[ServiceWorker] Error handling detected product:', error);
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

    // Firefox MV2 uses browserAction, MV3 uses action
    const badgeAPI = browser.action || browser.browserAction;

    if (!badgeAPI) {
      debugWarn('[ServiceWorker]', '[ServiceWorker] No badge API available');
      return;
    }

    if (count > 0) {
      await badgeAPI.setBadgeText({ text: count.toString() });
      await badgeAPI.setBadgeBackgroundColor({ color: '#4CAF50' });
    } else {
      await badgeAPI.setBadgeText({ text: '' });
    }

  } catch (error) {
    debugError('[ServiceWorker]', '[ServiceWorker] Error updating badge:', error);
  }
}

/**
 * Listen for new permissions being granted
 * Automatically run product detection when user grants permission for a custom site
 */
browser.permissions.onAdded.addListener(async (permissions) => {
  debug('[ServiceWorker]', '=================================================');
  debug('[ServiceWorker]', '[ServiceWorker] 🔔 PERMISSIONS ADDED EVENT FIRED');
  debug('[ServiceWorker]', '[ServiceWorker] New permissions granted:', permissions.origins);
  debug('[ServiceWorker]', '=================================================');

  try {
    // Get the currently active tab
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });

    debug('[ServiceWorker]', '[ServiceWorker] Active tab info:', {
      id: activeTab?.id,
      url: activeTab?.url,
      title: activeTab?.title
    });

    if (!activeTab || !activeTab.id || !activeTab.url) {
      debug('[ServiceWorker]', '[ServiceWorker] ❌ No active tab found after permission grant');
      return;
    }

    // Check if the permission matches the active tab's domain
    const tabHostname = new URL(activeTab.url).hostname;
    debug('[ServiceWorker]', '[ServiceWorker] Checking if permission matches active tab hostname:', tabHostname);

    const permissionMatches = permissions.origins.some(origin => {
      // Convert origin pattern to regex
      // *://example.com/* or *://*.example.com/*
      const pattern = origin
        .replace(/\*/g, '.*')
        .replace(/\./g, '\\.');
      const regex = new RegExp(pattern);
      const matches = regex.test(activeTab.url);
      debug('[ServiceWorker]', `[ServiceWorker] Testing pattern "${origin}" against "${activeTab.url}": ${matches}`);
      return matches;
    });

    if (!permissionMatches) {
      debug('[ServiceWorker]', '[ServiceWorker] ❌ Permission granted for different site, ignoring automatic tracking');
      return;
    }

    debug('[ServiceWorker]', '[ServiceWorker] ✓ Permission granted for active tab, starting auto-detection...');

    // Wait a moment for page to be ready after reload (if it was reloaded)
    debug('[ServiceWorker]', '[ServiceWorker] Waiting 1.5s for page to be ready...');
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Calculate detector URL in service worker context where browser polyfill exists
    const detectorUrl = browser.runtime.getURL('content-scripts/product-detector.js');

    // Inject and run product detection
    debug('[ServiceWorker]', '[ServiceWorker] Injecting product detection script into tab:', activeTab.id);
    const results = await executeScript({
      target: { tabId: activeTab.id },
      func: async (scriptUrl) => {
        // Define API wrapper for Chrome/Firefox compatibility
        // In injected functions, we don't have access to browser polyfill
        const api = window.chrome || window.browser;

        try {
          debug('[ServiceWorker]', '[Price Drop Tracker] 🚀 Starting auto-detection after permission grant...');
          debug('[ServiceWorker]', '[Price Drop Tracker] Loading detector module from:', scriptUrl);
          const { detectProduct } = await import(scriptUrl);

          debug('[ServiceWorker]', '[Price Drop Tracker] Detector module loaded, waiting 1s for page readiness...');
          // Wait for page to be fully loaded
          await new Promise(resolve => setTimeout(resolve, 1000));

          debug('[ServiceWorker]', '[Price Drop Tracker] Running product detection...');
          const productData = await detectProduct();

          if (productData) {
            debug('[ServiceWorker]', '[Price Drop Tracker] ✅ Product detected:', productData.title);
            debug('[ServiceWorker]', '[Price Drop Tracker] Product ID:', productData.productId);
            debug('[ServiceWorker]', '[Price Drop Tracker] Price:', productData.price.formatted);
            debug('[ServiceWorker]', '[Price Drop Tracker] Sending to background for storage...');

            // Use callback-style messaging for Chrome compatibility
            const response = await new Promise((resolve, reject) => {
              api.runtime.sendMessage({
                type: 'PRODUCT_DETECTED',
                data: productData
              }, response => {
                if (api.runtime.lastError) {
                  reject(api.runtime.lastError);
                } else {
                  resolve(response);
                }
              });
            });

            debug('[ServiceWorker]', '[Price Drop Tracker] Background response:', response);

            if (response && response.success && !response.data.alreadyTracked) {
              debug('[ServiceWorker]', '[Price Drop Tracker] ✓ Product auto-tracked successfully!');
              return { success: true };
            } else if (response && response.success && response.data.alreadyTracked) {
              debug('[ServiceWorker]', '[Price Drop Tracker] ℹ️ Product was already being tracked');
              return { success: false, alreadyTracked: true };
            }

            return { success: false, alreadyTracked: response?.data?.alreadyTracked };
          } else {
            debug('[ServiceWorker]', '[Price Drop Tracker] ⚠️ No product detected on this page');
            return { success: false, error: 'No product found' };
          }
        } catch (error) {
          debugError('[ServiceWorker]', '[Price Drop Tracker] ❌ Auto-detection error:', error);
          debugError('[ServiceWorker]', '[Price Drop Tracker] Error stack:', error.stack);
          return { success: false, error: error.message };
        }
      },
      args: [detectorUrl]
    });

    debug('[ServiceWorker]', '[ServiceWorker] Script execution completed, results:', results);

    const result = results?.[0]?.result;
    if (result && result.success) {
      debug('[ServiceWorker]', '[ServiceWorker] ✅ Product auto-tracked successfully after permission grant!');
      debug('[ServiceWorker]', '=================================================');
    } else if (result && result.alreadyTracked) {
      debug('[ServiceWorker]', '[ServiceWorker] ℹ️ Product was already being tracked');
      debug('[ServiceWorker]', '=================================================');
    } else {
      debug('[ServiceWorker]', '[ServiceWorker] ⚠️ Auto-detection completed but no product added:', result);
      debug('[ServiceWorker]', '=================================================');
    }

  } catch (error) {
    debugError('[ServiceWorker]', '[ServiceWorker] ❌ Error during auto-detection after permission grant:', error);
    debugError('[ServiceWorker]', '[ServiceWorker] Error stack:', error.stack);
    debug('[ServiceWorker]', '=================================================');
  }
});

debug('[ServiceWorker]', '[ServiceWorker] Service worker ready');
