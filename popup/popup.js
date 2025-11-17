/**
 * Price Drop Tracker - Popup UI Logic
 * Displays tracked products with price information and controls
 */

let allProducts = {};
let currentFilter = 'all';

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await initializeTheme();
  await loadProducts();
  setupEventListeners();
});

/**
 * Initialize theme from saved preference
 */
async function initializeTheme() {
  try {
    const result = await chrome.storage.local.get(['theme']);
    const theme = result.theme || 'light';
    applyTheme(theme);
  } catch (error) {
    console.error('[Popup] Error loading theme:', error);
    applyTheme('light');
  }
}

/**
 * Apply theme to document
 */
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}

/**
 * Update theme toggle icon
 */
function updateThemeIcon(theme) {
  const lightIcon = document.querySelector('.theme-icon-light');
  const darkIcon = document.querySelector('.theme-icon-dark');

  if (theme === 'dark') {
    lightIcon.style.display = 'none';
    darkIcon.style.display = 'block';
  } else {
    lightIcon.style.display = 'block';
    darkIcon.style.display = 'none';
  }
}

/**
 * Toggle between light and dark theme
 */
async function toggleTheme() {
  const currentTheme = document.body.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';

  applyTheme(newTheme);

  // Save preference
  try {
    await chrome.storage.local.set({ theme: newTheme });
  } catch (error) {
    console.error('[Popup] Error saving theme:', error);
  }
}

/**
 * Load all products from storage
 */
async function loadProducts() {
  try {
    showLoading();

    // Get products via message to background script
    const response = await chrome.runtime.sendMessage({
      type: 'GET_ALL_PRODUCTS'
    });

    if (response && response.success) {
      allProducts = response.data || {};
    } else {
      allProducts = {};
    }

    const productIds = Object.keys(allProducts);

    if (productIds.length === 0) {
      showEmptyState();
      updateStats({});
      return;
    }

    updateStats(allProducts);
    displayProducts(allProducts, currentFilter);

  } catch (error) {
    console.error('[Popup] Error loading products:', error);
    showError('Failed to load products');
    updateStats({});
  }
}

/**
 * Update statistics display
 */
function updateStats(products) {
  const productArray = Object.values(products);
  const totalProducts = productArray.length;

  let priceDrops = 0;
  for (const product of productArray) {
    if (hasActivePriceDrop(product)) {
      priceDrops++;
    }
  }

  document.getElementById('totalProducts').textContent = totalProducts;
  document.getElementById('priceDrops').textContent = priceDrops;
}

/**
 * Check if product has an active price drop
 */
function hasActivePriceDrop(product) {
  if (!product.priceHistory || product.priceHistory.length < 2) {
    return false;
  }

  const firstPrice = product.priceHistory[0].price;
  const currentPrice = product.price.numeric;

  return currentPrice < firstPrice;
}

/**
 * Group products by domain
 */
function groupProductsByDomain(products) {
  const groups = {};

  products.forEach(product => {
    const domain = product.domain || 'unknown';

    if (!groups[domain]) {
      groups[domain] = [];
    }

    groups[domain].push(product);
  });

  // Sort groups: known stores first, then custom sites alphabetically
  const knownStores = ['amazon.com', 'ebay.com', 'walmart.com', 'target.com', 'bestbuy.com'];
  const sortedGroups = {};

  // Add known stores first
  knownStores.forEach(store => {
    const matchingDomain = Object.keys(groups).find(domain => domain.includes(store.replace('.com', '')));
    if (matchingDomain && groups[matchingDomain]) {
      sortedGroups[matchingDomain] = groups[matchingDomain];
    }
  });

  // Add remaining custom sites alphabetically
  Object.keys(groups)
    .filter(domain => !Object.keys(sortedGroups).includes(domain))
    .sort()
    .forEach(domain => {
      sortedGroups[domain] = groups[domain];
    });

  return sortedGroups;
}

/**
 * Display products based on filter
 */
function displayProducts(products, filter) {
  const container = document.getElementById('productsList');
  const filteredProducts = filterProducts(products, filter);

  if (filteredProducts.length === 0) {
    if (filter === 'all') {
      showEmptyState();
    } else {
      hideEmptyState();  // Hide the global empty state
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h2>No products match this filter</h2>
          <p>Try selecting a different tab to view more products.</p>
        </div>
      `;
      hideLoading();
      document.getElementById('productsList').style.display = 'block';  // Make sure list is visible
    }
    return;
  }

  hideLoading();
  hideEmptyState();

  // Sort by last checked (most recent first)
  filteredProducts.sort((a, b) => {
    const aChecked = a.tracking?.lastChecked || 0;
    const bChecked = b.tracking?.lastChecked || 0;
    return bChecked - aChecked;
  });

  // Group products by domain
  const groupedProducts = groupProductsByDomain(filteredProducts);

  // Create HTML for grouped products
  container.innerHTML = Object.entries(groupedProducts).map(([domain, products]) => {
    const storeName = getStoreName(domain);
    const productCards = products.map(product => createProductCard(product)).join('');

    return `
      <div class="product-group">
        <div class="group-header" data-domain="${escapeHtml(domain)}">
          <div class="group-info">
            <span class="group-name">${escapeHtml(storeName)}</span>
            <span class="group-count">${products.length} ${products.length === 1 ? 'product' : 'products'}</span>
          </div>
          <svg class="group-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="group-products">
          ${productCards}
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners to group headers for collapse/expand
  container.querySelectorAll('.group-header').forEach(header => {
    header.addEventListener('click', (e) => {
      const group = header.closest('.product-group');
      group.classList.toggle('collapsed');
    });
  });

  // Add event listeners to cards
  container.querySelectorAll('.product-card').forEach(card => {
    const productId = card.dataset.productId;

    card.querySelector('.product-header').addEventListener('click', () => {
      openProduct(productId);
    });

    card.querySelector('.btn-visit')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openProduct(productId);
    });

    card.querySelector('.btn-refresh')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await handleRefreshSingleProduct(productId, e.currentTarget);
    });

    card.querySelector('.btn-delete')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await handleDeleteProduct(productId);
    });
  });
}

/**
 * Filter products based on selected filter
 */
function filterProducts(products, filter) {
  const productArray = Object.values(products);

  if (filter === 'all') {
    return productArray;
  }

  if (filter === 'drops') {
    return productArray.filter(product => hasActivePriceDrop(product));
  }

  if (filter === 'expiring') {
    const now = Date.now();
    const twentyFiveDays = 25 * 24 * 60 * 60 * 1000;
    return productArray.filter(product => {
      const age = now - (product.tracking?.firstSeen || now);
      return age > twentyFiveDays;
    });
  }

  return productArray;
}

/**
 * Create HTML for a product card
 */
function createProductCard(product) {
  // Get price information
  const currentPrice = product.price.numeric;
  const currency = product.price.currency;
  const locale = product.price.locale || 'en-US';

  // Determine the original/regular price
  // Priority 1: Use regularPrice from product.price (e.g., from WooCommerce <del> tag)
  // Priority 2: Fall back to first price in history
  let firstPrice = currentPrice;
  if (product.price.regularPrice && product.price.regularPrice > currentPrice) {
    // Product is currently on sale - use the regular price
    firstPrice = product.price.regularPrice;
  } else if (product.priceHistory && product.priceHistory.length > 0) {
    // Use first historical price
    firstPrice = product.priceHistory[0].price;
  }

  const hasPriceChange = firstPrice !== currentPrice;
  const priceDiff = currentPrice - firstPrice;
  const priceChangePercent = firstPrice > 0 ? ((priceDiff / firstPrice) * 100) : 0;
  const hasDropped = priceDiff < 0;
  const hasIncreased = priceDiff > 0;

  // Format prices
  const formattedCurrent = formatPrice(currentPrice, currency, locale);
  const formattedOriginal = formatPrice(firstPrice, currency, locale);

  // Check if product is stale (failed checks)
  const isStale = product.tracking?.status === 'stale' || (product.tracking?.failedChecks || 0) >= 3;

  // Get store name from domain
  const storeName = getStoreName(product.domain);

  return `
    <div class="product-card ${isStale ? 'stale' : ''}" data-product-id="${product.productId}">
      <div class="product-header">
        ${product.imageUrl ?
          `<img class="product-image"
                src="${product.imageUrl}"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                loading="lazy"
                alt="${escapeHtml(product.title)}">
           <div class="product-image-placeholder" style="display:none;">📦</div>`
          : '<div class="product-image-placeholder">📦</div>'}
        <div class="product-info">
          <div class="product-title">${escapeHtml(product.title)}</div>
          <div class="product-store">${storeName}</div>
          <div class="product-pricing">
            <span class="current-price">${formattedCurrent}</span>
            ${hasPriceChange ? `<span class="original-price">${formattedOriginal}</span>` : ''}
            ${hasDropped ? `<span class="price-drop">${Math.abs(priceChangePercent).toFixed(0)}%</span>` : ''}
            ${hasIncreased ? `<span class="price-increase">${Math.abs(priceChangePercent).toFixed(0)}%</span>` : ''}
          </div>
          ${isStale ? '<div class="stale-indicator" title="Could not update price. The product page may have changed.">⚠️ Update failed</div>' : ''}
        </div>
      </div>

      <div class="product-actions">
        <button class="product-icon-btn btn-refresh" title="Refresh price">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.65 2.35C12.2 0.9 10.21 0 8 0C3.58 0 0.01 3.58 0.01 8C0.01 12.42 3.58 16 8 16C11.73 16 14.84 13.45 15.73 10H13.65C12.83 12.33 10.61 14 8 14C4.69 14 2 11.31 2 8C2 4.69 4.69 2 8 2C9.66 2 11.14 2.69 12.22 3.78L9 7H16V0L13.65 2.35Z" fill="currentColor"/>
          </svg>
        </button>
        <button class="product-icon-btn btn-visit" title="Visit page">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 9V14C14 14.5304 13.7893 15.0391 13.4142 15.4142C13.0391 15.7893 12.5304 16 12 16H2C1.46957 16 0.960859 15.7893 0.585786 15.4142C0.210714 15.0391 0 14.5304 0 14V4C0 3.46957 0.210714 2.96086 0.585786 2.58579C0.960859 2.21071 1.46957 2 2 2H7M11 0H16M16 0V5M16 0L7 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="product-icon-btn btn-delete" title="Remove product">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 4H3.33333H14M5.33333 4V2.66667C5.33333 2.31304 5.47381 1.97391 5.72386 1.72386C5.97391 1.47381 6.31304 1.33333 6.66667 1.33333H9.33333C9.68696 1.33333 10.0261 1.47381 10.2761 1.72386C10.5262 1.97391 10.6667 2.31304 10.6667 2.66667V4M12.6667 4V13.3333C12.6667 13.687 12.5262 14.0261 12.2761 14.2761C12.0261 14.5262 11.687 14.6667 11.3333 14.6667H4.66667C4.31304 14.6667 3.97391 14.5262 3.72386 14.2761C3.47381 14.0261 3.33333 13.687 3.33333 13.3333V4H12.6667Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Format price using Intl.NumberFormat
 */
function formatPrice(amount, currency = 'USD', locale = 'en-US') {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2,
      maximumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2
    }).format(amount);
  } catch (error) {
    console.warn('[Popup] Error formatting price:', error);
    // Fallback to simple formatting
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Get friendly store name from domain
 */
function getStoreName(domain) {
  if (!domain) return 'Unknown Store';

  if (domain.includes('amazon')) return 'Amazon';
  if (domain.includes('ebay')) return 'eBay';
  if (domain.includes('walmart')) return 'Walmart';
  if (domain.includes('target')) return 'Target';
  if (domain.includes('bestbuy')) return 'Best Buy';

  // Return domain without www.
  return domain.replace('www.', '');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Execute product detection on the current tab
 * @param {number} tabId - Tab ID to run detection on
 * @returns {Promise<Object>} - Detection result
 */
async function executeProductDetection(tabId) {
  try {
    console.log('[Popup] Executing script on tab:', tabId);

    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: async () => {
        try {
          // Dynamically import the detector module
          const detectorUrl = chrome.runtime.getURL('content-scripts/product-detector.js');
          const { detectProduct } = await import(detectorUrl);

          console.log('[Price Drop Tracker] Manual detection started...');

          // Wait for page to be fully loaded
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Detect product
          const productData = await detectProduct();

          if (productData) {
            console.log('[Price Drop Tracker] Product detected, sending to background...');

            // Send to background for storage
            const response = await chrome.runtime.sendMessage({
              type: 'PRODUCT_DETECTED',
              data: productData
            });

            console.log('[Price Drop Tracker] Background response:', response);

            if (response && response.success && !response.data.alreadyTracked) {
              console.log('[Price Drop Tracker] ✓ Product tracked:', productData.title);

              // Show on-page confirmation with brand colors
              const badge = document.createElement('div');
              badge.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #1eadbd;
                color: white;
                padding: 14px 22px;
                border-radius: 10px;
                box-shadow: 0 6px 20px rgba(30, 173, 189, 0.3);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 15px;
                font-weight: 600;
                z-index: 999999;
                animation: slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                display: flex;
                align-items: center;
                gap: 10px;
              `;
              badge.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="10" r="10" fill="white" fill-opacity="0.2"/>
                  <path d="M6 10L9 13L14 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>Now tracking: ${productData.price.formatted}</span>
              `;

              const style = document.createElement('style');
              style.textContent = `
                @keyframes slideIn {
                  from {
                    transform: translateY(100px);
                    opacity: 0;
                  }
                  to {
                    transform: translateY(0);
                    opacity: 1;
                  }
                }
              `;
              document.head.appendChild(style);
              document.body.appendChild(badge);

              setTimeout(() => {
                badge.style.transition = 'all 0.3s ease';
                badge.style.opacity = '0';
                badge.style.transform = 'translateY(20px)';
                setTimeout(() => badge.remove(), 300);
              }, 5000);

              return { success: true, product: productData };
            } else if (response && response.success && response.data.alreadyTracked) {
              return { success: false, error: 'Already tracking this product' };
            } else {
              return { success: false, error: response.error || 'Unable to track product' };
            }
          } else {
            console.log('[Price Drop Tracker] No product detected');
            return { success: false, error: 'No product found on this page' };
          }
        } catch (error) {
          console.error('[Price Drop Tracker] Detection error:', error);
          return { success: false, error: error.message };
        }
      }
    });

    console.log('[Popup] Script execution results:', results);

    if (!results || results.length === 0) {
      console.error('[Popup] No results from script execution');
      return { success: false, error: 'Script execution failed' };
    }

    return results[0].result;

  } catch (error) {
    console.error('[Popup] Error executing script:', error);
    return { success: false, error: `Script injection failed: ${error.message}` };
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Track This Page button - for sites not auto-tracked
  const trackThisPageBtn = document.getElementById('trackThisPageBtn');
  trackThisPageBtn.addEventListener('click', async () => {
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id || !tab.url) {
        showTemporaryMessage('Unable to access current tab', 'error');
        return;
      }

      // Show loading state
      trackThisPageBtn.disabled = true;
      trackThisPageBtn.innerHTML = '<span>⏳</span>';

      // CRITICAL: Check and request permissions FIRST, before any async work
      // This must happen immediately in the user gesture handler
      const { isUrlSupported } = await import('../utils/domain-validator.js');
      const { hasPermissionForUrl, requestPermissionForUrl } = await import('../utils/permission-manager.js');

      const isDefaultSupported = isUrlSupported(tab.url);
      console.log('[Popup] Is default supported:', isDefaultSupported);

      // If not in default list, check if we have permission
      let justGrantedPermission = false;
      if (!isDefaultSupported) {
        const hasPermission = await hasPermissionForUrl(tab.url);
        console.log('[Popup] Has permission:', hasPermission);

        if (!hasPermission) {
          // Request permission RIGHT NOW while still in user gesture
          console.log('[Popup] Requesting permission for:', tab.url);

          // IMPORTANT: Requesting permission will close the popup!
          // The service worker will automatically detect and track the product after permission is granted
          const granted = await requestPermissionForUrl(tab.url);

          if (!granted) {
            console.log('[Popup] Permission denied by user');
            showTemporaryMessage('Permission denied. Cannot track products on this site.', 'error');
            trackThisPageBtn.innerHTML = '<span>➕</span>';
            trackThisPageBtn.disabled = false;
            return;
          }

          console.log('[Popup] Permission granted! Service worker will auto-detect product...');

          // The popup will close when permission dialog appears
          // The service worker's chrome.permissions.onAdded listener will:
          // 1. Detect the new permission
          // 2. Check if it matches the active tab
          // 3. Automatically run product detection
          // 4. Save the product and show confirmation

          // No need to do anything else - just let the popup close
          return;
        }
      }

      // Now that we have permission, execute product detection
      let result = await executeProductDetection(tab.id);
      console.log('[Popup] First execution result:', result);

      if (result && result.success) {
        // Reload products to show the newly tracked item
        await loadProducts();
        showTemporaryMessage('Product tracked successfully!', 'success');
      } else {
        const errorMsg = result && result.error ? result.error : 'Unable to detect product';
        showTemporaryMessage(errorMsg, 'error');
      }

      // Reset button
      trackThisPageBtn.innerHTML = '<span>➕</span>';
      trackThisPageBtn.disabled = false;

    } catch (error) {
      console.error('[Popup] Error tracking page:', error);
      showTemporaryMessage('Failed to scan page. Make sure you\'re on a product page.', 'error');
      trackThisPageBtn.innerHTML = '<span>➕</span>';
      trackThisPageBtn.disabled = false;
    }
  });

  // Tab filters
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      displayProducts(allProducts, currentFilter);
    });
  });

  // Refresh button
  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.addEventListener('click', async () => {
    // Add spinning animation
    refreshBtn.classList.add('refreshing');
    refreshBtn.disabled = true;

    try {
      // Send message to background to force check all products
      const response = await chrome.runtime.sendMessage({
        type: 'FORCE_CHECK_ALL',
        data: { batchSize: 5 }
      });

      if (response && response.success) {
        console.log('[Popup] Force check complete:', response.data);
      }

      // Reload products after a short delay
      setTimeout(async () => {
        await loadProducts();
        refreshBtn.classList.remove('refreshing');
        refreshBtn.disabled = false;
      }, 1000);

    } catch (error) {
      console.error('[Popup] Error refreshing:', error);
      refreshBtn.classList.remove('refreshing');
      refreshBtn.disabled = false;
    }
  });

  // Theme toggle button
  document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);

  // Settings button
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

/**
 * Open product page in new tab
 */
function openProduct(productId) {
  const product = allProducts[productId];
  if (product && product.url) {
    chrome.tabs.create({ url: product.url });
  }
}

/**
 * Handle refreshing a single product
 */
async function handleRefreshSingleProduct(productId, buttonElement) {
  try {
    // Add loading state to button
    buttonElement.classList.add('refreshing');
    buttonElement.disabled = true;

    // Request price check for this specific product
    const response = await chrome.runtime.sendMessage({
      type: 'REFRESH_SINGLE_PRODUCT',
      data: { productId }
    });

    if (response && response.success) {
      // Update the product in our local cache
      const updatedProduct = response.data.product;
      if (updatedProduct) {
        allProducts[productId] = updatedProduct;
        displayProducts(allProducts, currentFilter);
        updateStats(allProducts);

        showTemporaryMessage('Price updated!', 'success');
      }
    } else {
      showTemporaryMessage('Failed to update price', 'error');
    }
  } catch (error) {
    console.error('[Popup] Error refreshing product:', error);
    showTemporaryMessage('Failed to update price', 'error');
  } finally {
    // Remove loading state
    buttonElement.classList.remove('refreshing');
    buttonElement.disabled = false;
  }
}

/**
 * Handle deleting a product
 */
async function handleDeleteProduct(productId) {
  if (!confirm('Remove this product from tracking?')) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'DELETE_PRODUCT',
      data: { productId }
    });

    if (response && response.success) {
      delete allProducts[productId];
      displayProducts(allProducts, currentFilter);
      updateStats(allProducts);
    } else {
      showError('Failed to delete product');
    }
  } catch (error) {
    console.error('[Popup] Error deleting product:', error);
    showError('Failed to delete product');
  }
}

/**
 * Show loading state
 */
function showLoading() {
  document.getElementById('loadingState').style.display = 'block';
  document.getElementById('productsList').style.display = 'none';
  document.getElementById('emptyState').style.display = 'none';
}

/**
 * Hide loading state
 */
function hideLoading() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('productsList').style.display = 'block';
}

/**
 * Show empty state
 */
function showEmptyState() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('productsList').style.display = 'none';
  document.getElementById('emptyState').style.display = 'block';
}

/**
 * Hide empty state
 */
function hideEmptyState() {
  document.getElementById('emptyState').style.display = 'none';
}

/**
 * Show error message
 */
function showError(message) {
  console.error('[Popup]', message);
  hideLoading();
  document.getElementById('productsList').innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⚠️</div>
      <h2>Error</h2>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

/**
 * Show temporary message to user
 */
function showTemporaryMessage(message, type = 'success') {
  // Remove any existing message
  const existing = document.querySelector('.temp-message');
  if (existing) existing.remove();

  // Create message element
  const messageEl = document.createElement('div');
  messageEl.className = `temp-message temp-message-${type}`;
  messageEl.textContent = message;

  // Add CSS if not already added
  if (!document.getElementById('temp-message-styles')) {
    const style = document.createElement('style');
    style.id = 'temp-message-styles';
    style.textContent = `
      .temp-message {
        position: fixed;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideUp 0.3s ease;
      }
      .temp-message-success {
        background: #16a34a;
        color: white;
      }
      .temp-message-error {
        background: #dc2626;
        color: white;
      }
      @keyframes slideUp {
        from { transform: translate(-50%, 100px); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(messageEl);

  // Remove after 3 seconds
  setTimeout(() => {
    messageEl.style.transition = 'opacity 0.3s ease';
    messageEl.style.opacity = '0';
    setTimeout(() => messageEl.remove(), 300);
  }, 3000);
}
