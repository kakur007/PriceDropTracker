/**
 * Price Drop Tracker - Popup UI Logic
 * Displays tracked products with price information and controls
 */

let allProducts = {};
let currentFilter = 'all';

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadProducts();
  setupEventListeners();
});

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
 * Display products based on filter
 */
function displayProducts(products, filter) {
  const container = document.getElementById('productsList');
  const filteredProducts = filterProducts(products, filter);

  if (filteredProducts.length === 0) {
    if (filter === 'all') {
      showEmptyState();
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h2>No products match this filter</h2>
          <p>Try selecting a different tab to view more products.</p>
        </div>
      `;
      hideLoading();
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

  container.innerHTML = filteredProducts.map(product => createProductCard(product)).join('');

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

  let firstPrice = currentPrice;
  if (product.priceHistory && product.priceHistory.length > 0) {
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
        ${product.image ?
          `<img class="product-image"
                src="${product.image}"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                loading="lazy"
                alt="${escapeHtml(product.title)}">
           <div class="product-image-placeholder" style="display:none;">📦</div>`
          : '<div class="product-image-placeholder">📦</div>'}
        <div class="product-info">
          <div class="product-title">${escapeHtml(product.title)}</div>
          <div class="product-store">${storeName}</div>
          ${isStale ? '<div class="stale-indicator" title="Could not update price. The product page may have changed.">⚠️ Update failed</div>' : ''}
        </div>
      </div>

      <div class="product-pricing">
        <div class="price-info">
          <span class="current-price">${formattedCurrent}</span>
          ${hasPriceChange ? `<span class="original-price">${formattedOriginal}</span>` : ''}
        </div>
        ${hasDropped ? `
          <div class="price-drop">
            ↓ ${Math.abs(priceChangePercent).toFixed(0)}%
          </div>
        ` : hasIncreased ? `
          <div class="price-increase">
            ↑ ${Math.abs(priceChangePercent).toFixed(0)}%
          </div>
        ` : ''}
      </div>

      <div class="product-actions">
        <button class="btn-small btn-visit">Visit Page</button>
        <button class="btn-small btn-danger btn-delete">Remove</button>
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
 * Set up event listeners
 */
function setupEventListeners() {
  // Track This Page button - for sites not auto-tracked
  const trackThisPageBtn = document.getElementById('trackThisPageBtn');
  trackThisPageBtn.addEventListener('click', async () => {
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        showTemporaryMessage('Unable to access current tab', 'error');
        return;
      }

      // Show loading state
      trackThisPageBtn.disabled = true;
      trackThisPageBtn.innerHTML = '<span>⏳</span>';

      // Inject and execute the content script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['utils/currency-parser.js']
      });

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['utils/product-hasher.js']
      });

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-scripts/product-detector.js']
      });

      // Wait a moment for detection to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Reload products to show the newly tracked item
      await loadProducts();

      // Show success message
      showTemporaryMessage('Product scan complete!', 'success');

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
