import { getSettings, updateSettings, getStorageStats, exportData, importData, clearAllData } from '../background/storage-manager.js';

let currentSettings = null;

// Initialize settings page
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadStorageStats();
  setupEventListeners();
});

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

  } catch (error) {
    console.error('[Settings] Error loading settings:', error);
    showError('Failed to load settings');
  }
}

async function loadStorageStats() {
  try {
    const stats = await getStorageStats();

    document.getElementById('productCount').textContent = stats.productCount;
    document.getElementById('storageUsed').textContent = (stats.bytesUsed / 1024).toFixed(1) + ' KB';

  } catch (error) {
    console.error('[Settings] Error loading stats:', error);
  }
}

function setupEventListeners() {
  // Track changes to all settings inputs
  const inputs = ['trackingDuration', 'maxProducts', 'checkInterval', 'notificationsEnabled', 'minDropPercentage', 'maxNotificationsPerDay'];

  inputs.forEach(id => {
    const element = document.getElementById(id);
    element.addEventListener('change', handleSettingChange);
  });

  // Check now button
  document.getElementById('checkNowBtn').addEventListener('click', async () => {
    document.getElementById('checkNowBtn').textContent = 'Checking...';
    document.getElementById('checkNowBtn').disabled = true;

    chrome.runtime.sendMessage({ type: 'CHECK_NOW' }, (response) => {
      document.getElementById('checkNowBtn').textContent = 'Check All Prices Now';
      document.getElementById('checkNowBtn').disabled = false;

      if (response.success) {
        showSaveIndicator('Price check completed');
      } else {
        showError('Price check failed');
      }
    });
  });

  // Export data
  document.getElementById('exportDataBtn').addEventListener('click', async () => {
    try {
      const data = await exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `price-tracker-backup-${Date.now()}.json`;
      a.click();

      URL.revokeObjectURL(url);
      showSaveIndicator('Data exported');

    } catch (error) {
      console.error('[Settings] Export error:', error);
      showError('Failed to export data');
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
        showSaveIndicator('Data imported successfully');
        await loadStorageStats();
      } else {
        showError('Failed to import data');
      }

    } catch (error) {
      console.error('[Settings] Import error:', error);
      showError('Invalid data file');
    }

    e.target.value = ''; // Reset file input
  });

  // Clear data
  document.getElementById('clearDataBtn').addEventListener('click', async () => {
    if (!confirm('⚠️ This will permanently delete all tracked products. Are you sure?')) {
      return;
    }

    if (!confirm('This cannot be undone. Really delete everything?')) {
      return;
    }

    try {
      await clearAllData();
      showSaveIndicator('All data cleared');
      await loadStorageStats();

    } catch (error) {
      console.error('[Settings] Clear error:', error);
      showError('Failed to clear data');
    }
  });

  // Give feedback link
  document.getElementById('giveFeedbackLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/yourusername/price-drop-tracker/issues' });
  });
}

async function handleSettingChange(e) {
  try {
    const settingId = e.target.id;
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;

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

    const newSettings = {
      [section]: {
        [key]: value
      }
    };

    // If check interval changed, notify service worker
    if (settingId === 'checkInterval') {
      chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings: newSettings
      });
    }

    await updateSettings(newSettings);
    showSaveIndicator();

  } catch (error) {
    console.error('[Settings] Save error:', error);
    showError('Failed to save settings');
  }
}

function showSaveIndicator(message = 'Settings saved') {
  const indicator = document.getElementById('saveIndicator');
  indicator.textContent = `✓ ${message}`;
  indicator.style.display = 'block';

  setTimeout(() => {
    indicator.style.display = 'none';
  }, 2000);
}

function showError(message) {
  alert(message);
}
