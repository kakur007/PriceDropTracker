import browser from '../utils/browser-polyfill.js';

import { getSettings, updateSettings, getStorageStats, exportData, importData, clearAllData } from '../background/storage-manager.js';
import { debounce } from '../utils/debounce.js';
import { showSuccess, showError, showWarning } from '../utils/toast.js';
import { debug, debugError } from '../utils/debug.js';
import { initTheme, getThemePreference, setThemePreference } from '../utils/theme.js';
import { getGrantedPermissions, removePermissionForUrl } from '../utils/permission-manager.js';
import { productsToCsv, csvFormatForLocale } from '../utils/csv-export.js';

let currentSettings = null;

// Initialize settings page
document.addEventListener('DOMContentLoaded', async () => {
  // Apply dark mode based on user preference
  await initTheme();

  await loadSettings();
  await loadStorageStats();
  await loadSiteAccess();
  setupEventListeners();
  setupExtras();
});

async function setupExtras() {
  document.getElementById('versionText').textContent = `v${browser.runtime.getManifest().version}`;

  const themeSelect = document.getElementById('themeSelect');
  themeSelect.value = await getThemePreference();
  themeSelect.addEventListener('change', async () => {
    await setThemePreference(themeSelect.value);
    showSaveIndicator('Theme updated');
  });

  try {
    const { products = {} } = await browser.storage.local.get('products');
    const last = Math.max(0, ...Object.values(products).map(p => p?.tracking?.lastChecked || 0));
    if (last) {
      document.getElementById('lastCheckText').textContent =
        `Runs a check for all tracked products. Last check: ${new Date(last).toLocaleString()}.`;
    }
  } catch (_) { /* cosmetic */ }

  // CSV export
  document.getElementById('exportCsvBtn').addEventListener('click', async () => {
    try {
      const { products = {} } = await browser.storage.local.get('products');
      if (Object.keys(products).length === 0) {
        showWarning('No tracked products to export yet');
        return;
      }
      const csv = productsToCsv(products, csvFormatForLocale(navigator.language));
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `price-genius-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showSaveIndicator('CSV downloaded');
    } catch (error) {
      debugError('[Settings]', 'CSV export failed:', error);
      showError('Could not export CSV');
    }
  });

  // Keyboard shortcuts
  await loadShortcuts();
  document.getElementById('shortcutsBtn').addEventListener('click', async () => {
    if (browser.commands?.openShortcutSettings) {
      await browser.commands.openShortcutSettings(); // Firefox 137+
    } else if (navigator.userAgent.includes('Firefox')) {
      showWarning('Open about:addons → gear icon → Manage Extension Shortcuts');
    } else {
      browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
    }
  });

  browser.permissions?.onAdded?.addListener(loadSiteAccess);
  browser.permissions?.onRemoved?.addListener(loadSiteAccess);
}

async function loadShortcuts() {
  const list = document.getElementById('shortcutList');
  list.textContent = '';
  const labels = {
    _execute_action: 'Open Price Genius',
    'track-page': 'Track this page (or pick its price)'
  };
  let commands = [];
  try { commands = await browser.commands.getAll(); } catch (_) { /* unsupported */ }
  for (const cmd of commands) {
    if (!labels[cmd.name]) continue;
    const li = document.createElement('li');
    const key = document.createElement('kbd');
    key.textContent = cmd.shortcut || 'Not set';
    const text = document.createElement('span');
    text.textContent = labels[cmd.name];
    li.append(key, text);
    list.append(li);
  }
}

/**
 * List stores the user granted access to (optional host permissions).
 */
async function loadSiteAccess() {
  const list = document.getElementById('siteAccessList');
  const builtIn = new Set(browser.runtime.getManifest().host_permissions || []);
  const origins = (await getGrantedPermissions()).filter(o => !builtIn.has(o) && o !== '<all_urls>');

  // Patterns come in pairs (*://shop.com/* and *://*.shop.com/*) - show each store once
  const hosts = [...new Set(origins
    .map(o => (o.match(/^[^:]+:\/\/(?:\*\.)?([^/]+)\//) || [])[1])
    .filter(Boolean))].sort();

  list.textContent = '';
  if (hosts.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No extra stores yet. Use "Allow" in the popup on any store to add it here.';
    list.append(li);
    return;
  }

  for (const host of hosts) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = host.replace(/^www\./, '');
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary btn-small';
    btn.textContent = 'Remove access';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await removePermissionForUrl(`https://${host}/`);
      showSaveIndicator(`Removed access to ${name.textContent}`);
      await loadSiteAccess();
    });
    li.append(name, btn);
    list.append(li);
  }
}

/**
 * Load settings from storage and populate form fields
 */
async function loadSettings() {
  try {
    currentSettings = await getSettings();

    // Populate form fields
    document.getElementById('pagePanel').checked = currentSettings.display?.pagePanel !== false;
    document.getElementById('autoTrack').checked = currentSettings.tracking.autoTrack === true && currentSettings.tracking.autoTrackOptIn === true;
    document.getElementById('trackingDuration').value = currentSettings.tracking.duration;
    document.getElementById('maxProducts').value = currentSettings.tracking.maxProducts;
    document.getElementById('checkInterval').value = currentSettings.checking.interval;
    document.getElementById('notificationsEnabled').checked = currentSettings.notifications.enabled;
    document.getElementById('minDropPercentage').value = currentSettings.notifications.minDropPercentage;
    document.getElementById('maxNotificationsPerDay').value = currentSettings.notifications.maxPerDay;

    // Advanced settings
    document.getElementById('debugMode').checked = currentSettings.advanced?.debugMode || false;

    debug('[Settings]', 'Settings loaded successfully');
  } catch (error) {
    debugError('[Settings] Error loading settings:', error);
    showError('Failed to load settings. Please try refreshing the page.');
  }
}

/**
 * Load and display storage statistics
 */
async function loadStorageStats() {
  try {
    const stats = await getStorageStats();

    document.getElementById('productCount').textContent = stats.productCount;
    document.getElementById('storageUsed').textContent = (stats.bytesUsed / 1024).toFixed(1) + ' KB';

    // Warn if storage is getting full (>90%)
    if (stats.percentageUsed > 90) {
      showWarning('Storage is nearly full! Consider removing old products or exporting your data.');
    } else if (stats.percentageUsed > 75) {
      debug('[Settings]', `Storage usage: ${stats.percentageUsed.toFixed(1)}%`);
    }

  } catch (error) {
    debugError('[Settings] Error loading stats:', error);
  }
}

/**
 * Set up all event listeners for the settings page
 */
function setupEventListeners() {
  // Track changes to all settings inputs with debouncing
  const inputs = ['pagePanel', 'autoTrack', 'trackingDuration', 'maxProducts', 'checkInterval', 'notificationsEnabled', 'minDropPercentage', 'maxNotificationsPerDay', 'debugMode'];

  // Debounce settings saves to prevent excessive writes (300ms delay)
  const debouncedSettingSave = debounce(handleSettingChange, 300);

  inputs.forEach(id => {
    const element = document.getElementById(id);
    // For checkboxes, save immediately; for others, debounce
    if (element.type === 'checkbox') {
      element.addEventListener('change', handleSettingChange);
    } else {
      element.addEventListener('change', debouncedSettingSave);
    }
  });

  // Check now button
  document.getElementById('checkNowBtn').addEventListener('click', async () => {
    const btn = document.getElementById('checkNowBtn');
    btn.textContent = 'Checking...';
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');

    try {
      const response = await browser.runtime.sendMessage({ type: 'CHECK_NOW' });

      if (response && response.success) {
        showSuccess('Price check completed successfully!');
        debug('[Settings]', 'Manual price check completed');
      } else {
        showError('Price check failed. Please try again.');
        debugError('[Settings]', 'Price check failed:', response);
      }
    } catch (error) {
      showError('Price check failed. Please try again.');
      debugError('[Settings]', 'Price check failed:', error);
    } finally {
      btn.textContent = 'Check now';
      btn.disabled = false;
      btn.setAttribute('aria-busy', 'false');
    }
  });

  // Export data
  document.getElementById('exportDataBtn').addEventListener('click', async () => {
    try {
      const data = await exportData();

      if (!data) {
        throw new Error('No data to export');
      }

      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `price-tracker-backup-${Date.now()}.json`;
      a.click();

      URL.revokeObjectURL(url);
      showSuccess('Data exported successfully!');
      debug('[Settings]', 'Data exported successfully');

    } catch (error) {
      debugError('[Settings] Export error:', error);
      showError('Failed to export data. Please try again.');
    }
  });

  // Import data
  document.getElementById('importDataBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });

  document.getElementById('importFileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const success = await importData(text);

      if (success) {
        showSuccess('Data imported successfully!');
        await loadStorageStats();
        debug('[Settings]', 'Data imported successfully');
      } else {
        throw new Error('Import failed');
      }

    } catch (error) {
      debugError('[Settings] Import error:', error);
      showError('Failed to import data. Please ensure the file is valid.');
    }

    e.target.value = ''; // Reset file input
  });

  // Clear data
  document.getElementById('clearDataBtn').addEventListener('click', async () => {
    // Use native confirm for critical actions
    if (!confirm('⚠️ This will permanently delete all tracked products. Are you sure?')) {
      return;
    }

    if (!confirm('This cannot be undone. Really delete everything?')) {
      return;
    }

    try {
      await clearAllData();
      showSuccess('All data has been cleared');
      await loadStorageStats();
      debug('[Settings]', 'All data cleared');

    } catch (error) {
      debugError('[Settings] Clear error:', error);
      showError('Failed to clear data. Please try again.');
    }
  });

  // Give feedback link
  document.getElementById('giveFeedbackLink').addEventListener('click', (e) => {
    e.preventDefault();
    browser.tabs.create({ url: 'https://github.com/kakur007/PriceDropTracker/issues' });
  });
}

/**
 * Handle setting change with validation and save
 * @param {Event} e - Change event from input element
 */
async function handleSettingChange(e) {
  try {
    const settingId = e.target.id;
    const value = e.target.type === 'checkbox' ? e.target.checked : parseInt(e.target.value, 10);

    // Map UI field to settings object path
    const settingMap = {
      'autoTrack': ['tracking', 'autoTrack'],
      'pagePanel': ['display', 'pagePanel'],
      'trackingDuration': ['tracking', 'duration'],
      'maxProducts': ['tracking', 'maxProducts'],
      'checkInterval': ['checking', 'interval'],
      'notificationsEnabled': ['notifications', 'enabled'],
      'minDropPercentage': ['notifications', 'minDropPercentage'],
      'maxNotificationsPerDay': ['notifications', 'maxPerDay'],
      'debugMode': ['advanced', 'debugMode']
    };

    const [section, key] = settingMap[settingId];

    if (!section || !key) {
      debugError('[Settings]', 'Unknown setting:', settingId);
      return;
    }

    const newSettings = {
      [section]: {
        [key]: value
      }
    };
    if (settingId === 'autoTrack') {
      newSettings.tracking.autoTrackOptIn = value;
    }

    // If check interval changed, notify service worker to reschedule
    if (settingId === 'checkInterval') {
      await browser.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        data: { settings: newSettings }
      });
    }

    await updateSettings(newSettings);
    showSaveIndicator();
    debug('[Settings]', `Updated ${settingId} to`, value);

  } catch (error) {
    debugError('[Settings] Save error:', error);
    showError('Failed to save setting. Please try again.');
  }
}

/**
 * Show save indicator (visual feedback for auto-save)
 * @param {string} message - Message to display
 */
function showSaveIndicator(message = 'Settings saved') {
  const indicator = document.getElementById('saveIndicator');
  indicator.textContent = `✓ ${message}`;
  indicator.hidden = false;
  clearTimeout(showSaveIndicator.timer);
  showSaveIndicator.timer = setTimeout(() => {
    indicator.hidden = true;
  }, 2000);
}
