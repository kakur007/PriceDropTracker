import { getSettings, updateSettings, getStorageStats, exportData, importData, clearAllData } from '../background/storage-manager.js';
import { debounce } from '../utils/debounce.js';
import { showSuccess, showError, showWarning } from '../utils/toast.js';
import { debug, debugError } from '../utils/debug.js';

let currentSettings = null;

// Initialize settings page
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadStorageStats();
  setupEventListeners();
});

/**
 * Load settings from storage and populate form fields
 */
async function loadSettings() {
  try {
    currentSettings = await getSettings();

    // Populate form fields
    document.getElementById('trackingDuration').value = currentSettings.tracking.duration;
    document.getElementById('maxProducts').value = currentSettings.tracking.maxProducts;
    document.getElementById('checkInterval').value = currentSettings.checking.interval;
    document.getElementById('notificationsEnabled').checked = currentSettings.notifications.enabled;
    document.getElementById('minDropPercentage').value = currentSettings.notifications.minDropPercentage;
    document.getElementById('maxNotificationsPerDay').value = currentSettings.notifications.maxPerDay;

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
  const inputs = ['trackingDuration', 'maxProducts', 'checkInterval', 'notificationsEnabled', 'minDropPercentage', 'maxNotificationsPerDay'];

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

    chrome.runtime.sendMessage({ type: 'CHECK_NOW' }, (response) => {
      btn.textContent = 'Check All Prices Now';
      btn.disabled = false;
      btn.setAttribute('aria-busy', 'false');

      if (response && response.success) {
        showSuccess('Price check completed successfully!');
        debug('[Settings]', 'Manual price check completed');
      } else {
        showError('Price check failed. Please try again.');
        debugError('[Settings]', 'Price check failed:', response);
      }
    });
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
    chrome.tabs.create({ url: 'https://github.com/yourusername/price-drop-tracker/issues' });
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
      'trackingDuration': ['tracking', 'duration'],
      'maxProducts': ['tracking', 'maxProducts'],
      'checkInterval': ['checking', 'interval'],
      'notificationsEnabled': ['notifications', 'enabled'],
      'minDropPercentage': ['notifications', 'minDropPercentage'],
      'maxNotificationsPerDay': ['notifications', 'maxPerDay']
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

    // If check interval changed, notify service worker to reschedule
    if (settingId === 'checkInterval') {
      chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings: newSettings
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
  indicator.style.display = 'block';
  indicator.setAttribute('role', 'status');
  indicator.setAttribute('aria-live', 'polite');

  setTimeout(() => {
    indicator.style.display = 'none';
  }, 2000);
}
