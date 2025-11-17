/**
 * Permission Manager - Dynamic host permissions management
 *
 * Allows users to grant permissions for any e-commerce site they want to track,
 * not just the predefined list in manifest.json
 */

/**
 * Check if we have permission to access a URL
 * @param {string} url - URL to check
 * @returns {Promise<boolean>} - True if permission granted
 */
export async function hasPermissionForUrl(url) {
  try {
    const urlObj = new URL(url);
    const origin = `${urlObj.protocol}//${urlObj.hostname}/*`;

    const hasPermission = await chrome.permissions.contains({
      origins: [origin]
    });

    return hasPermission;
  } catch (error) {
    console.error('[PermissionManager] Error checking permission:', error);
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

    const hasPermission = await chrome.permissions.contains({
      origins: patterns
    });

    return hasPermission;
  } catch (error) {
    console.error('[PermissionManager] Error checking domain permission:', error);
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

    console.log('[PermissionManager] Requesting permission for:', patterns);

    const granted = await chrome.permissions.request({
      origins: patterns
    });

    if (granted) {
      console.log('[PermissionManager] Permission granted for:', domain);
    } else {
      console.log('[PermissionManager] Permission denied for:', domain);
    }

    return granted;
  } catch (error) {
    console.error('[PermissionManager] Error requesting permission:', error);
    return false;
  }
}

/**
 * Get all currently granted optional permissions
 * @returns {Promise<string[]>} - Array of origin patterns
 */
export async function getGrantedPermissions() {
  try {
    const permissions = await chrome.permissions.getAll();
    return permissions.origins || [];
  } catch (error) {
    console.error('[PermissionManager] Error getting permissions:', error);
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

    const removed = await chrome.permissions.remove({
      origins: patterns
    });

    if (removed) {
      console.log('[PermissionManager] Permission removed for:', domain);
    }

    return removed;
  } catch (error) {
    console.error('[PermissionManager] Error removing permission:', error);
    return false;
  }
}

/**
 * Check if domain needs permission request
 * (i.e., not in default manifest permissions)
 *
 * @param {string} url - URL to check
 * @returns {Promise<Object>} - { needsRequest: boolean, hasPermission: boolean }
 */
export async function checkPermissionStatus(url) {
  try {
    const hasPermission = await hasPermissionForUrl(url);

    // If we have permission, no need to request
    if (hasPermission) {
      return {
        needsRequest: false,
        hasPermission: true
      };
    }

    // Check if it's in default manifest permissions
    // (This would already be granted at install time)
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // Import domain validator to check if it's a default supported domain
    const { isDomainSupported } = await import('./domain-validator.js');

    if (isDomainSupported(domain)) {
      // Should have permission from manifest, but doesn't?
      // Might be a permission issue
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
    console.error('[PermissionManager] Error checking permission status:', error);
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
if (typeof chrome !== 'undefined' && chrome.permissions) {
  chrome.permissions.onAdded.addListener((permissions) => {
    console.log('[PermissionManager] Permissions added:', permissions.origins);
  });

  chrome.permissions.onRemoved.addListener((permissions) => {
    console.log('[PermissionManager] Permissions removed:', permissions.origins);
  });
}
