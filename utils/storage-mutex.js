import browser from './browser-polyfill.js';
import { debug, debugWarn, debugError } from './debug.js';

/**
 * Storage Mutex - Prevents race conditions in chrome.storage operations
 *
 * CRITICAL FIX: chrome.storage operations are asynchronous but NOT transactional.
 * When popup and service worker both modify storage simultaneously, the
 * "Read-Modify-Write" pattern can cause data loss (last write wins).
 *
 * This mutex ensures only one context can modify storage at a time.
 *
 * Example race condition without mutex:
 * 1. Context A reads products: {product1: {...}}
 * 2. Context B reads products: {product1: {...}}
 * 3. Context A adds product2, writes: {product1: {...}, product2: {...}}
 * 4. Context B adds product3, writes: {product1: {...}, product3: {...}}
 * Result: product2 is LOST (overwritten by Context B)
 *
 * With mutex:
 * 1. Context A acquires lock
 * 2. Context B tries to acquire lock, waits...
 * 3. Context A reads, modifies, writes, releases lock
 * 4. Context B acquires lock, reads (including product2), modifies, writes
 * Result: Both product2 and product3 are saved
 */

class StorageMutex {
  /**
   * @param {string} lockKey - Storage key for the lock
   * @param {number} timeout - Maximum time to wait for lock (ms)
   */
  constructor(lockKey = 'storage_mutex_lock', timeout = 5000) {
    this.lockKey = lockKey;
    this.timeout = timeout;
    this.checkInterval = 50; // Check lock status every 50ms
  }

  /**
   * Acquire the lock (wait if necessary)
   * @returns {Promise<string>} Lock ID (used for releasing)
   */
  async acquire() {
    const lockId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    while (true) {
      // Try to acquire lock
      const acquired = await this.tryAcquire(lockId);

      if (acquired) {
        debug('[StorageMutex]', `Lock acquired: ${lockId}`);
        return lockId;
      }

      // Check timeout
      if (Date.now() - startTime > this.timeout) {
        debugError('[StorageMutex]', `Lock timeout after ${this.timeout}ms`);
        // Force acquire to prevent deadlock
        await this.forceAcquire(lockId);
        return lockId;
      }

      // Wait before retrying
      await this.sleep(this.checkInterval);
    }
  }

  /**
   * Try to acquire the lock (non-blocking)
   * @param {string} lockId - Unique lock identifier
   * @returns {Promise<boolean>} True if acquired
   */
  async tryAcquire(lockId) {
    try {
      const result = await browser.storage.local.get(this.lockKey);
      const lock = result[this.lockKey];

      // No lock exists, try to acquire
      if (!lock) {
        await browser.storage.local.set({
          [this.lockKey]: {
            id: lockId,
            timestamp: Date.now()
          }
        });
        return true;
      }

      // Lock expired (held for more than 10 seconds = likely a crash)
      if (Date.now() - lock.timestamp > 10000) {
        debugWarn('[StorageMutex]', `Stale lock detected (${lock.id}), forcing acquire`);
        await browser.storage.local.set({
          [this.lockKey]: {
            id: lockId,
            timestamp: Date.now()
          }
        });
        return true;
      }

      // Lock held by another context
      return false;
    } catch (error) {
      debugError('[StorageMutex]', 'Error trying to acquire lock:', error);
      return false;
    }
  }

  /**
   * Force acquire the lock (use after timeout to prevent deadlock)
   * @param {string} lockId - Unique lock identifier
   * @returns {Promise<void>}
   */
  async forceAcquire(lockId) {
    try {
      await browser.storage.local.set({
        [this.lockKey]: {
          id: lockId,
          timestamp: Date.now()
        }
      });
      debugWarn('[StorageMutex]', `Lock force-acquired: ${lockId}`);
    } catch (error) {
      debugError('[StorageMutex]', 'Error force-acquiring lock:', error);
    }
  }

  /**
   * Release the lock
   * @param {string} lockId - Lock ID returned from acquire()
   * @returns {Promise<void>}
   */
  async release(lockId) {
    try {
      const result = await browser.storage.local.get(this.lockKey);
      const lock = result[this.lockKey];

      // Only release if we own the lock
      if (lock && lock.id === lockId) {
        await browser.storage.local.remove(this.lockKey);
        debug('[StorageMutex]', `Lock released: ${lockId}`);
      } else {
        debugWarn('[StorageMutex]', `Attempted to release lock not owned: ${lockId}`);
      }
    } catch (error) {
      debugError('[StorageMutex]', 'Error releasing lock:', error);
    }
  }

  /**
   * Execute a function with lock protection
   * @param {Function} fn - Async function to execute
   * @returns {Promise<any>} Result of the function
   */
  async withLock(fn) {
    const lockId = await this.acquire();

    try {
      return await fn();
    } finally {
      await this.release(lockId);
    }
  }

  /**
   * Helper to sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Global mutex instance for product storage operations
const productStorageMutex = new StorageMutex('product_storage_mutex', 5000);

export { StorageMutex, productStorageMutex };
