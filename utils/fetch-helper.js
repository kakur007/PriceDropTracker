/**
 * Fetch Helper - Network utilities with retry logic and rate limiting
 *
 * Provides robust HTTP fetching with:
 * - Exponential backoff retry logic
 * - Rate limiting to avoid being blocked
 * - Timeout handling
 * - Error standardization
 */

/**
 * Rate Limiter - Implements token bucket algorithm
 * Default: 10 requests per minute to avoid being blocked by retailers
 */
class RateLimiter {
  /**
   * @param {number} maxRequests - Maximum requests per window
   * @param {number} windowMs - Time window in milliseconds (default: 60000 = 1 minute)
   */
  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = []; // Array of timestamps
  }

  /**
   * Wait if necessary to stay within rate limit
   * @returns {Promise<void>}
   */
  async waitIfNeeded() {
    const now = Date.now();

    // Remove requests older than the window
    this.requests = this.requests.filter(timestamp => now - timestamp < this.windowMs);

    // If we're at the limit, wait until the oldest request expires
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest) + 100; // +100ms buffer

      console.log(`[RateLimiter] Limit reached (${this.requests.length}/${this.maxRequests}). Waiting ${waitTime}ms...`);
      await this.sleep(waitTime);

      // Recursively check again after waiting
      return this.waitIfNeeded();
    }

    // Record this request
    this.requests.push(now);
  }

  /**
   * Helper to sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset the rate limiter (useful for testing)
   */
  reset() {
    this.requests = [];
  }

  /**
   * Get current request count in the window
   * @returns {number}
   */
  getCurrentCount() {
    const now = Date.now();
    this.requests = this.requests.filter(timestamp => now - timestamp < this.windowMs);
    return this.requests.length;
  }
}

/**
 * Fetch with retry logic and exponential backoff
 *
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.timeout - Request timeout in ms (default: 10000)
 * @param {number} options.initialDelay - Initial delay before first retry in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay between retries in ms (default: 10000)
 * @param {boolean} options.useRateLimiter - Whether to use rate limiting (default: true)
 * @param {RateLimiter} options.rateLimiter - Custom rate limiter instance
 * @returns {Promise<Response>} - Fetch response
 * @throws {Error} - If all retries fail
 */
async function fetchWithRetry(url, options = {}) {
  const {
    maxRetries = 3,
    timeout = 10000,
    initialDelay = 1000,
    maxDelay = 10000,
    useRateLimiter = true,
    rateLimiter = globalRateLimiter,
    ...fetchOptions
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Wait for rate limiter if enabled
      if (useRateLimiter && rateLimiter) {
        await rateLimiter.waitIfNeeded();
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        console.log(`[FetchHelper] Attempt ${attempt + 1}/${maxRetries + 1}: ${url}`);

        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Check if response is OK (status 200-299)
        if (!response.ok) {
          // For 429 (Too Many Requests) or 503 (Service Unavailable), retry
          if (response.status === 429 || response.status === 503) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          // For 404 or other client errors, don't retry
          if (response.status >= 400 && response.status < 500) {
            console.warn(`[FetchHelper] Client error ${response.status}, not retrying: ${url}`);
            return response; // Return the response, let caller handle it
          }

          // For server errors (500+), retry
          if (response.status >= 500) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        }

        // Success!
        console.log(`[FetchHelper] Success on attempt ${attempt + 1}: ${url}`);
        return response;

      } catch (fetchError) {
        clearTimeout(timeoutId);

        // Check if it's a timeout/abort error
        if (fetchError.name === 'AbortError') {
          throw new Error(`Request timeout after ${timeout}ms`);
        }

        throw fetchError;
      }

    } catch (error) {
      lastError = error;
      console.warn(`[FetchHelper] Attempt ${attempt + 1} failed: ${error.message}`);

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        console.error(`[FetchHelper] All ${maxRetries + 1} attempts failed for ${url}`);
        throw new Error(`Failed to fetch ${url} after ${maxRetries + 1} attempts: ${error.message}`);
      }

      // Calculate exponential backoff delay
      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);

      // Add jitter (±20%) to avoid thundering herd
      const jitter = delay * 0.2 * (Math.random() * 2 - 1);
      const finalDelay = Math.max(0, delay + jitter);

      console.log(`[FetchHelper] Waiting ${Math.round(finalDelay)}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }
  }

  // This should never be reached, but just in case
  throw lastError;
}

/**
 * Fetch HTML content from a URL
 * Convenience wrapper around fetchWithRetry for HTML content
 *
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options (same as fetchWithRetry)
 * @returns {Promise<string>} - HTML content as string
 * @throws {Error} - If fetch fails or response is not OK
 */
async function fetchHTML(url, options = {}) {
  // Note: User-Agent is intentionally NOT set here
  // Browsers automatically include their native User-Agent which is:
  // 1. More legitimate (not spoofed)
  // 2. Consistent with the browser's actual identity
  // 3. Less likely to be flagged as suspicious by anti-bot systems
  const response = await fetchWithRetry(url, {
    ...options,
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.text();
}

/**
 * Fetch JSON content from a URL
 * Convenience wrapper around fetchWithRetry for JSON content
 *
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options (same as fetchWithRetry)
 * @returns {Promise<any>} - Parsed JSON object
 * @throws {Error} - If fetch fails, response is not OK, or JSON parsing fails
 */
async function fetchJSON(url, options = {}) {
  const response = await fetchWithRetry(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Check if a URL is accessible (returns 200-299)
 *
 * @param {string} url - URL to check
 * @param {Object} options - Fetch options
 * @returns {Promise<boolean>} - True if accessible, false otherwise
 */
async function isUrlAccessible(url, options = {}) {
  try {
    const response = await fetchWithRetry(url, {
      ...options,
      method: 'HEAD', // Use HEAD to avoid downloading content
      maxRetries: 1 // Only try once for accessibility check
    });

    return response.ok;
  } catch (error) {
    console.warn(`[FetchHelper] URL not accessible: ${url}`, error.message);
    return false;
  }
}

/**
 * Download an image and convert it to a data URL
 * This caches images locally to prevent privacy leaks
 *
 * @param {string} imageUrl - URL of the image to download
 * @param {Object} options - Fetch options
 * @returns {Promise<string|null>} - Data URL or null if failed
 */
async function downloadImageAsDataURL(imageUrl, options = {}) {
  if (!imageUrl || imageUrl.startsWith('data:')) {
    return imageUrl; // Already a data URL
  }

  try {
    console.log(`[FetchHelper] Downloading image for local caching: ${imageUrl}`);

    const response = await fetchWithRetry(imageUrl, {
      ...options,
      maxRetries: 2,
      timeout: 8000,
      useRateLimiter: true
    });

    if (!response.ok) {
      console.warn(`[FetchHelper] Failed to download image: ${response.status}`);
      return null;
    }

    // Get the image as a blob
    const blob = await response.blob();

    // Limit image size to 100KB to avoid storage bloat
    if (blob.size > 100 * 1024) {
      console.warn(`[FetchHelper] Image too large (${(blob.size / 1024).toFixed(1)}KB), skipping cache`);
      return null;
    }

    // Convert blob to data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => {
        console.error('[FetchHelper] Error reading image blob');
        reject(new Error('Failed to convert image to data URL'));
      };
      reader.readAsDataURL(blob);
    });

  } catch (error) {
    console.warn(`[FetchHelper] Error downloading image: ${error.message}`);
    return null;
  }
}

// Global rate limiter instance (10 requests/minute)
// Shared across all fetch operations unless overridden
const globalRateLimiter = new RateLimiter(10, 60000);

// Export for use in other modules
export {
  RateLimiter,
  fetchWithRetry,
  fetchHTML,
  fetchJSON,
  isUrlAccessible,
  downloadImageAsDataURL,
  globalRateLimiter
};
