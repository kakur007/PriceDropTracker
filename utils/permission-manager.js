/**
 * Permission Manager - Dynamic host permissions management
 *
 * Allows users to grant permissions for any e-commerce site they want to track,
 * not just the predefined list in manifest.json
 */

import browser from './browser-polyfill.js';
import { debug, debugWarn, debugError } from '../utils/debug.js';

/**
 * Check if we have permission to access a URL
 * @param {string} url - URL to check
 * @returns {Promise<boolean>} - True if permission granted
 */
export async function hasPermissionForUrl(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // Check for the same wildcard patterns that requestPermissionForUrl grants
    // This must match exactly what was granted to work correctly
    const patterns = [
      `*://${domain}/*`,
      `*://*.${domain}/*` // Include subdomains
    ];

    const hasPermission = await browser.permissions.contains({
      origins: patterns
    });

    return hasPermission;
  } catch (error) {
    debugError('[permission-manager]', '[PermissionManager] Error checking permission:', error);
    return false;
  }
}

/**
 * Check if we have permission to access a domain
 * @param {string} domain - Domain to check (e.g., 'example.com')
 * @returns {Promise<boolean>} - True if permission granted
 */
export async function hasPermissionForDomain(domain) {
  try {
    // Try both http and https
    const patterns = [
      `*://${domain}/*`,
      `*://*.${domain}/*` // Include subdomains
    ];

    const hasPermission = await browser.permissions.contains({
      origins: patterns
    });

    return hasPermission;
  } catch (error) {
    debugError('[permission-manager]', '[PermissionManager] Error checking domain permission:', error);
    return false;
  }
}

/**
 * Request permission to access a URL
 * This MUST be called from a user gesture (button click, etc.)
 *
 * @param {string} url - URL to request permission for
 * @returns {Promise<boolean>} - True if permission granted
 */
export async function requestPermissionForUrl(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // Request permission for the entire domain (including subdomains)
    const patterns = [
      `*://${domain}/*`,
      `*://*.${domain}/*`
    ];

    debug('[permission-manager]', '[PermissionManager] Requesting permission for:', patterns);

    const granted = await browser.permissions.request({
      origins: patterns
    });

    if (granted) {
      debug('[permission-manager]', '[PermissionManager] Permission granted for:', domain);
    } else {
      debug('[permission-manager]', '[PermissionManager] Permission denied for:', domain);
    }

    return granted;
  } catch (error) {
    debugError('[permission-manager]', '[PermissionManager] Error requesting permission:', error);
    return false;
  }
}

/**
 * Get all currently granted optional permissions
 * @returns {Promise<string[]>} - Array of origin patterns
 */
export async function getGrantedPermissions() {
  try {
    const permissions = await browser.permissions.getAll();
    return permissions.origins || [];
  } catch (error) {
    debugError('[permission-manager]', '[PermissionManager] Error getting permissions:', error);
    return [];
  }
}

/**
 * Remove permission for a URL (cleanup when product is deleted)
 * @param {string} url - URL to remove permission for
 * @returns {Promise<boolean>} - True if successfully removed
 */
export async function removePermissionForUrl(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    const patterns = [
      `*://${domain}/*`,
      `*://*.${domain}/*`
    ];

    const removed = await browser.permissions.remove({
      origins: patterns
    });

    if (removed) {
      debug('[permission-manager]', '[PermissionManager] Permission removed for:', domain);
    }

    return removed;
  } catch (error) {
    debugError('[permission-manager]', '[PermissionManager] Error removing permission:', error);
    return false;
  }
}

/**
 * Check if domain needs permission request
 *
 * @param {string} url - URL to check
 * @param {boolean} isDefaultSupported - Whether this domain is in default manifest list
 * @returns {Promise<Object>} - { needsRequest: boolean, hasPermission: boolean }
 */
export async function checkPermissionStatus(url, isDefaultSupported = false) {
  try {
    const hasPermission = await hasPermissionForUrl(url);

    // If we have permission, no need to request
    if (hasPermission) {
      return {
        needsRequest: false,
        hasPermission: true
      };
    }

    // If it's in default manifest but we don't have permission, something's wrong
    if (isDefaultSupported) {
      return {
        needsRequest: false,
        hasPermission: false,
        error: 'Permission should exist but is missing'
      };
    }

    // Not in default list and no permission = needs request
    return {
      needsRequest: true,
      hasPermission: false
    };

  } catch (error) {
    debugError('[permission-manager]', '[PermissionManager] Error checking permission status:', error);
    return {
      needsRequest: false,
      hasPermission: false,
      error: error.message
    };
  }
}

/**
 * Extract domain from URL for display
 * @param {string} url - Full URL
 * @returns {string} - Domain name
 */
export function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    return url;
  }
}

// Listen for permission changes
if (browser && browser.permissions) {
  browser.permissions.onAdded.addListener((permissions) => {
    debug('[permission-manager]', '[PermissionManager] Permissions added:', permissions.origins);
  });

  browser.permissions.onRemoved.addListener((permissions) => {
    debug('[permission-manager]', '[PermissionManager] Permissions removed:', permissions.origins);
  });
}
