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

import browser from '../utils/browser-polyfill.js';
import { isUrlSupportedOrPermitted } from '../utils/domain-validator.js';
import { sanitizeProductUrl } from '../utils/url-sanitizer.js';
import { StorageManager } from './storage-manager.js';
import { checkAllProducts, checkSingleProduct, PriceCheckResult } from './price-checker.js';
import { showBatchPriceDropNotifications, showInfoNotification, showBackInStockNotification } from '../utils/notification-manager.js';
import { variantKey } from '../utils/page-extractor.js';
import { shouldNotifyDrop, shouldNotifyBackInStock, sanitizeAlert, normalizeAvailability } from '../utils/alert-rules.js';
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
  REFRESH_SINGLE_PRODUCT: 'REFRESH_SINGLE_PRODUCT',
  FIND_PRODUCT_BY_URL: 'FIND_PRODUCT_BY_URL',
  RESTORE_PRODUCT: 'RESTORE_PRODUCT',
  SET_ALERT: 'SET_ALERT',
  SYNC_SITE_ACCESS: 'SYNC_SITE_ACCESS'
};

debug('[ServiceWorker]', 'Price Drop Tracker: Service worker initializing...');

function isCheckingEnabled(settings) {
  return settings?.checking?.enabled !== false;
}

function getCheckIntervalMinutes(settings) {
  const hours = Number(settings?.checking?.interval) || 6;
  return Math.max(30, Math.round(hours * 60));
}

function isAutoTrackEnabled(settings) {
  return settings?.tracking?.autoTrack !== false;
}

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

    await syncDynamicContentScripts();
    await sanitizeStoredProductUrls();

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
    await syncDynamicContentScripts();
    await sanitizeStoredProductUrls();

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

    // Set up price check alarm.
    // Settings store the interval in HOURS under `checking.interval`.
    // (Older code read non-existent `tracking.enabled/checkInterval`, so the
    // periodic alarm was never created.)
    if (isCheckingEnabled(settings)) {
      const checkIntervalMinutes = getCheckIntervalMinutes(settings);

      debug('[ServiceWorker]', `Creating price check alarm: every ${checkIntervalMinutes} minutes`);

      browser.alarms.create(ALARMS.PRICE_CHECK, {
        delayInMinutes: 1,
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

    if (!isCheckingEnabled(settings)) {
      debug('[ServiceWorker]', '[ServiceWorker] Price checking is disabled, skipping');
      return;
    }

    // Check products older than ~90% of the interval (alarms drift a little)
    const maxAge = getCheckIntervalMinutes(settings) * 60 * 1000 * 0.9;

    const results = await checkAllProducts({
      batchSize: 10,
      delayBetweenChecks: 2000,
      maxAge: maxAge
    });

    debug('[ServiceWorker]', `[ServiceWorker] Price check complete:`, results);

    // Update badge with new data
    await updateBadge();

    // Send notifications for price drops if enabled
    await notifyCheckResults(results.details);

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
    await StorageManager.cleanupOldProducts();

    debug('[ServiceWorker]', '[ServiceWorker] Cleanup complete');

    // Update badge
    await updateBadge();

  } catch (error) {
    debugError('[ServiceWorker]', '[ServiceWorker] Error during cleanup:', error);
  }
}

/**
 * Notify about price drops and restocks found by a check run.
 * Every decision goes through alert-rules.js (per-product rules).
 * @param {Array} checkDetails - results from price-checker
 */
async function notifyCheckResults(checkDetails = []) {
  try {
    const settings = await StorageManager.getSettings();
    if (settings.notifications?.enabled === false) return;

    const drops = [];
    for (const r of checkDetails) {
      const product = await StorageManager.getProduct(r.productId);
      if (!product) continue;

      if (r.status === PriceCheckResult.PRICE_DROP) {
        const decision = shouldNotifyDrop(product, r.oldPrice, r.newPrice, settings);
        debug('[ServiceWorker]', `Drop on ${product.productId}: ${decision.reason}`);
        if (decision.notify) {
          drops.push({ product, oldPrice: r.oldPrice, newPrice: r.newPrice, dropPercentage: Math.abs(r.changePercent || 0) });
          continue; // one notification per product
        }
      }

      if (r.backInStock && shouldNotifyBackInStock(product, settings)) {
        await showBackInStockNotification(product);
      }
    }

    if (drops.length) await showBatchPriceDropNotifications(drops);
  } catch (error) {
    debugError('[ServiceWorker]', 'Error sending notifications:', error);
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
      return await handleProductDetected(data, sender, message.source || 'manual');

    case MESSAGE_TYPES.FIND_PRODUCT_BY_URL:
      return await findTrackedProductByUrl(data.url);

    case MESSAGE_TYPES.SET_ALERT: {
      const product = await StorageManager.getProduct(data.productId);
      if (!product) throw new Error('Product not found');
      product.alert = sanitizeAlert(data.alert);
      await StorageManager.saveProduct(product);
      return { alert: product.alert };
    }

    case MESSAGE_TYPES.RESTORE_PRODUCT: {
      // Undo for delete: write the product back exactly as it was
      const { product, image } = data;
      if (!product?.productId) throw new Error('Invalid product');
      const stored = await browser.storage.local.get('products');
      const products = stored.products || {};
      products[product.productId] = product;
      const toSet = { products };
      if (image) toSet[`img_${product.productId}`] = image;
      await browser.storage.local.set(toSet);
      await updateBadge();
      return { restored: true };
    }

    case MESSAGE_TYPES.SYNC_SITE_ACCESS:
      await syncDynamicContentScripts();
      return { synced: true };

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
      await notifyCheckResults([{ productId: data.productId, ...refreshResult }]);
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
        await notifyCheckResults(results.details);

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
      await notifyCheckResults(forceResults.details);

      return forceResults;

    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

/**
 * Normalise a product URL for "same product?" comparisons.
 * Keeps variant-like query params, drops tracking noise.
 */
function normalizeProductUrl(url) {
  try {
    const u = new URL(url);
    const keep = ['variant', 'sku', 'id', 'pid', 'product_id', 'productid', 'item', 'color', 'colour', 'size', 'v'];
    const params = new URLSearchParams();
    for (const [k, v] of u.searchParams) {
      if (keep.includes(k.toLowerCase())) params.append(k.toLowerCase(), v);
    }
    const query = params.toString();
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}${query ? '?' + query : ''}`.toLowerCase();
  } catch (_) {
    return url;
  }
}

/**
 * @param {string} url
 * @param {Object|null|undefined} variant - when given (incl. null), the
 *   variant must match too, so two pack sizes of one product stay separate
 */
async function findTrackedProductByUrl(url, variant) {
  if (!url) return null;
  const target = normalizeProductUrl(url);
  const all = await StorageManager.getAllProducts();
  return Object.values(all || {}).find(p =>
    p?.url && normalizeProductUrl(p.url) === target &&
    (variant === undefined || variantKey(p.variant) === variantKey(variant))
  ) || null;
}

/**
 * Handle product detected on a page.
 *  - already tracked  -> refresh its price from the live page
 *  - new + manual     -> start tracking
 *  - new + auto       -> start tracking if auto-track is on
 * @returns {Promise<{added:boolean, alreadyTracked:boolean, product:Object, priceChanged?:boolean}>}
 */
async function handleProductDetected(productData, sender, source = 'manual') {
  debug('[ServiceWorker]', `Product detected (${source}):`, productData.title, productData.url);

  const safeUrl = sanitizeProductUrl(productData.url);
  if (!safeUrl) throw new Error('This page is not a product page');
  productData.url = safeUrl;

  let existing =
    (await StorageManager.getProduct(productData.productId)) ||
    (await findTrackedProductByUrl(productData.url, productData.variant || null));

  // Re-picking a price on a product saved before variants were remembered:
  // upgrade that entry instead of creating a duplicate.
  if (!existing && source === 'manual' && productData.variant) {
    const legacy = await findTrackedProductByUrl(productData.url, null);
    if (legacy) {
      legacy.variant = productData.variant;
      legacy.title = productData.title;
      legacy.priceSelector = productData.priceSelector || legacy.priceSelector;
      legacy.detectionMethod = productData.detectionMethod;
      await StorageManager.saveProduct(legacy);
      existing = legacy;
    }
  }

  if (existing) {
    let priceChanged = false;

    // Back in stock, seen on a live visit
    const liveAvailability = normalizeAvailability(productData.availability);
    if (liveAvailability && liveAvailability !== existing.availability) {
      const wasOut = existing.availability === 'OutOfStock';
      existing.availability = liveAvailability;
      await StorageManager.saveProduct(existing);
      if (wasOut && liveAvailability === 'InStock' && shouldNotifyBackInStock(existing, await StorageManager.getSettings())) {
        await showBackInStockNotification(existing);
      }
    }
    const newPrice = productData.price?.numeric;
    const sameCurrency = !existing.price?.currency || existing.price.currency === productData.price?.currency;

    // Manual re-tracking (e.g. user picked a different price element) wins
    if (source === 'manual' && productData.priceSelector) {
      existing.priceSelector = productData.priceSelector;
      existing.detectionMethod = productData.detectionMethod;
      await StorageManager.saveProduct(existing);
    }

    if (newPrice > 0 && sameCurrency && Math.abs(newPrice - existing.price.numeric) >= 0.01) {
      const oldPrice = existing.price.numeric;
      await StorageManager.updateProductPrice(existing.productId, {
        ...existing.price,
        numeric: newPrice,
        formatted: productData.price.formatted,
        regularPrice: productData.price.regularPrice || existing.price.regularPrice,
        detectionMethod: `live:${productData.detectionMethod}`
      });
      priceChanged = true;
      await updateBadge();

      const refreshed = await StorageManager.getProduct(existing.productId);
      const settings = await StorageManager.getSettings();
      if (shouldNotifyDrop(refreshed, oldPrice, newPrice, settings).notify) {
        await showBatchPriceDropNotifications([{
          product: refreshed,
          oldPrice,
          newPrice,
          dropPercentage: Math.abs(((newPrice - oldPrice) / oldPrice) * 100)
        }]);
      }
    } else {
      // Still reachable: clear stale flags
      existing.tracking = { ...(existing.tracking || {}), failedChecks: 0, status: 'active', lastChecked: Date.now() };
      await StorageManager.saveProduct(existing);
    }

    return {
      added: false,
      alreadyTracked: true,
      priceChanged,
      product: await StorageManager.getProduct(existing.productId)
    };
  }

  if (source === 'auto') {
    // Same page, other variant already tracked (page opened on its default
    // variant): don't add the default as a second product, don't touch prices
    const sameUrl = await findTrackedProductByUrl(productData.url);
    if (sameUrl) {
      return { added: false, alreadyTracked: true, priceChanged: false, product: sameUrl };
    }

    const settings = await StorageManager.getSettings();
    if (!isAutoTrackEnabled(settings)) {
      return { added: false, alreadyTracked: false, product: null };
    }
  }

  const imageSourceUrl = productData.imageSourceUrl;
  delete productData.imageSourceUrl;

  await StorageManager.saveProduct(productData);
  await updateBadge();

  if (!productData.hasImage && imageSourceUrl) {
    // Fire and forget: thumbnails are cosmetic
    createThumbnailInBackground(productData.productId, imageSourceUrl).catch(() => {});
  }

  if (source === 'auto') {
    await showInfoNotification('Now tracking', productData.title, { type: 'product_added', duration: 5000 });
  }

  return { added: true, alreadyTracked: false, product: productData };
}

/**
 * Build a thumbnail in the background, where host permissions avoid the
 * canvas CORS taint that content scripts hit on most CDNs.
 */
async function createThumbnailInBackground(productId, imageUrl) {
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return;
  const response = await fetch(imageUrl, { credentials: 'omit' });
  if (!response.ok) return;
  const bitmap = await createImageBitmap(await response.blob());
  const size = 80;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  const scale = Math.min(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.75 });
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  await browser.storage.local.set({ [`img_${productId}`]: dataUrl });
  const product = await StorageManager.getProduct(productId);
  if (product) {
    product.hasImage = true;
    await StorageManager.saveProduct(product);
  }
}

/**
 * One-off cleanup for products saved by older versions: strip cart/action
 * parameters from stored URLs (e.g. ?add-to-cart=123) so background checks
 * stop repeating them. Products whose URL *is* an action are paused.
 */
async function sanitizeStoredProductUrls() {
  try {
    const { products = {} } = await browser.storage.local.get('products');
    let changed = 0;
    for (const product of Object.values(products)) {
      if (!product?.url) continue;
      const safe = sanitizeProductUrl(product.url);
      if (safe && safe !== product.url) {
        product.url = safe;
        changed++;
      } else if (!safe && product.tracking?.status !== 'unsafe_url') {
        product.tracking = { ...(product.tracking || {}), status: 'unsafe_url' };
        changed++;
      }
    }
    if (changed) {
      await browser.storage.local.set({ products });
      debug('[ServiceWorker]', `Sanitized ${changed} stored product URL(s)`);
    }
  } catch (error) {
    debugWarn('[ServiceWorker]', 'URL cleanup failed:', error);
  }
}

/**
 * Keep a dynamic content script registered for every store the user granted
 * access to, so those stores behave like built-in ones (auto price refresh
 * on visit, SPA support) instead of needing the popup button every time.
 */
const DYNAMIC_SCRIPT_ID = 'price-genius-granted-sites';

async function syncDynamicContentScripts() {
  if (!browser.scripting?.registerContentScripts || !browser.permissions?.getAll) return;
  try {
    const { origins = [] } = await browser.permissions.getAll();
    const manifestOrigins = new Set(browser.runtime.getManifest().host_permissions || []);
    const granted = origins.filter(o => !manifestOrigins.has(o) && o !== '<all_urls>' && /^(\*|https?):\/\//.test(o));

    const existing = await browser.scripting.getRegisteredContentScripts({ ids: [DYNAMIC_SCRIPT_ID] }).catch(() => []);
    if (existing.length) {
      await browser.scripting.unregisterContentScripts({ ids: [DYNAMIC_SCRIPT_ID] });
    }
    if (granted.length === 0) return;

    await browser.scripting.registerContentScripts([{
      id: DYNAMIC_SCRIPT_ID,
      matches: granted,
      js: ['content-scripts/main.js'],
      runAt: 'document_idle',
      persistAcrossSessions: true
    }]);
    debug('[ServiceWorker]', 'Registered content script for granted sites:', granted);
  } catch (error) {
    debugWarn('[ServiceWorker]', 'Could not sync dynamic content scripts:', error);
  }
}

/**
 * Update extension badge with tracked product count
 */
async function updateBadge() {
  try {
    const allProducts = await StorageManager.getAllProducts();
    const count = Object.keys(allProducts || {}).length;

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
 * Site access changes: keep dynamic content scripts in sync and retry
 * products that were waiting for permission.
 */
browser.permissions.onAdded.addListener(async (permissions) => {
  await syncDynamicContentScripts();
  try {
    const all = await StorageManager.getAllProducts();
    const waiting = Object.values(all || {}).filter(p => p?.tracking?.status === 'no_permission');
    for (const product of waiting) {
      if (await isUrlSupportedOrPermitted(product.url)) {
        // Access exists now: clear the flag whatever the check finds
        product.tracking = { ...(product.tracking || {}), status: 'active', failedChecks: 0 };
        await StorageManager.saveProduct(product);
        await checkSingleProduct(product.productId);
      }
    }
    await updateBadge();
  } catch (error) {
    debugWarn('[ServiceWorker]', 'Error re-checking products after permission grant:', error);
  }
});

browser.permissions.onRemoved?.addListener(() => {
  syncDynamicContentScripts();
});

/**
 * Keyboard shortcut: track the product on the current tab. The shortcut
 * grants activeTab, so this works on any store. If nothing is detected,
 * the price picker opens instead.
 */
browser.commands?.onCommand?.addListener(async (command) => {
  if (command !== 'track-page') return;
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/i.test(tab.url || '')) return;
    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        const api = typeof browser !== 'undefined' ? browser : chrome;
        window.__PRICE_TRACKER_MANUAL_MODE__ = true;
        const detector = await import(api.runtime.getURL('content-scripts/product-detector.js'));
        const product = await detector.detectProduct({ mode: 'manual' });
        if (!product) {
          const { startPicker } = await import(api.runtime.getURL('content-scripts/price-picker.js'));
          startPicker();
          return;
        }
        const response = await api.runtime.sendMessage({ type: 'PRODUCT_DETECTED', data: product, source: 'manual' });
        const msg = !response?.success
          ? (response?.error || 'Could not track this product')
          : response.data?.alreadyTracked ? 'Already tracking this product' : `Tracking at ${product.price.formatted}`;
        detector.showTrackingBadge(product, msg);
      }
    });
  } catch (error) {
    debugWarn('[ServiceWorker]', 'Track shortcut failed:', error);
  }
});

debug('[ServiceWorker]', '[ServiceWorker] Service worker ready');
