## SESSION 7: Notification System (45 minutes)

### **Objective**
Create the notification manager for price drop alerts.

### **Files to Create**
1. `utils/notification-manager.js` - Notification handling

---

### **TASK 7.1: Create utils/notification-manager.js**

**Prompt:**
```
Create notification-manager.js using Chrome's notifications API.

Handle price drop notifications with grouping and cooldown logic.

```javascript
export async function showPriceDropNotification(product, oldPrice, newPrice, dropPercentage) {
  try {
    const title = '🔔 Price Drop Alert!';
    const dropAmount = (oldPrice.numeric - newPrice.numeric).toFixed(2);
    const message = `${product.title.slice(0, 60)}${product.title.length > 60 ? '...' : ''}

Was: ${formatPrice(oldPrice)}
Now: ${formatPrice(newPrice)}
Save: ${formatPrice({ ...oldPrice, numeric: parseFloat(dropAmount) })} (${dropPercentage.toFixed(0)}%)`;

    const notificationId = await chrome.notifications.create(product.productId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icons/icon-128.png'),
      title,
      message,
      priority: 2,
      requireInteraction: false,
      silent: false
    });

    console.log(`[Notifications] Created notification: ${notificationId}`);
    
    // Auto-clear after 10 seconds
    setTimeout(() => {
      chrome.notifications.clear(notificationId);
    }, 10000);
    
    return notificationId;
    
  } catch (error) {
    console.error('[Notifications] Error creating notification:', error);
    return null;
  }
}

export async function showInfoNotification(title, message) {
  return chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('assets/icons/icon-128.png'),
    title,
    message,
    priority: 0,
    silent: true
  });
}

function formatPrice(priceData) {
  return new Intl.NumberFormat(priceData.locale || 'en-US', {
    style: 'currency',
    currency: priceData.currency || 'USD',
    minimumFractionDigits: priceData.currency === 'JPY' ? 0 : 2
  }).format(priceData.numeric);
}

// Handle notification clicks (open product page)
chrome.notifications?.onClicked?.addListener(async (notificationId) => {
  const { getAllProducts } = await import('../background/storage-manager.js');
  const products = await getAllProducts();
  
  if (products[notificationId]) {
    chrome.tabs.create({ url: products[notificationId].url });
  }
  
  chrome.notifications.clear(notificationId);
});
```

Add proper error handling and logging.
```

---

## SESSION 8: Popup UI (2 hours)

### **Objective**
Create the extension popup showing tracked products.

### **Files to Create**
1. `popup/popup.html` - Popup structure
2. `popup/popup.js` - Popup logic
3. `popup/popup.css` - Popup styling

---

### **TASK 8.1: Create popup/popup.html**

**Prompt:**
```
Create popup.html with a clean, modern UI for displaying tracked products.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Price Drop Tracker</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header class="header">
      <h1 class="title">Price Drop Tracker</h1>
      <div class="header-actions">
        <button id="refreshBtn" class="icon-btn" title="Refresh prices">
          <span>🔄</span>
        </button>
        <button id="settingsBtn" class="icon-btn" title="Settings">
          <span>⚙️</span>
        </button>
      </div>
    </header>

    <!-- Stats Bar -->
    <div class="stats-bar">
      <div class="stat">
        <span class="stat-value" id="totalProducts">0</span>
        <span class="stat-label">Tracking</span>
      </div>
      <div class="stat">
        <span class="stat-value" id="priceDrops">0</span>
        <span class="stat-label">Drops</span>
      </div>
    </div>

    <!-- Filter Tabs -->
    <div class="tabs">
      <button class="tab active" data-filter="all">All</button>
      <button class="tab" data-filter="drops">Price Drops</button>
      <button class="tab" data-filter="expiring">Expiring Soon</button>
    </div>

    <!-- Products List -->
    <div id="productsList" class="products-list">
      <!-- Products will be inserted here -->
    </div>

    <!-- Empty State -->
    <div id="emptyState" class="empty-state" style="display: none;">
      <div class="empty-icon">📦</div>
      <h2>No products tracked yet</h2>
      <p>Visit any product page on Amazon, eBay, Walmart, Target, or Best Buy to start tracking prices automatically.</p>
    </div>

    <!-- Loading State -->
    <div id="loadingState" class="loading-state">
      <div class="spinner"></div>
      <p>Loading products...</p>
    </div>
  </div>

  <script type="module" src="popup.js"></script>
</body>
</html>
```

Keep HTML semantic and accessible.
```

---

### **TASK 8.2: Create popup/popup.css**

**Prompt:**
```
Create popup.css with modern, clean styling.

Design Requirements:
- Width: 400px
- Max height: 600px
- Scrollable product list
- Card-based product layout
- Price drop indicators (green)
- Responsive hover states
- Loading spinner
- Empty state illustration

Color Scheme:
- Primary: #2563eb (blue)
- Success: #16a34a (green)
- Danger: #dc2626 (red)
- Background: #f9fafb
- Card: #ffffff
- Text: #111827
- Text secondary: #6b7280

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 400px;
  max-height: 600px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  background: #f9fafb;
  color: #111827;
}

.container {
  display: flex;
  flex-direction: column;
  max-height: 600px;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
}

.title {
  font-size: 18px;
  font-weight: 600;
  color: #2563eb;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: #f3f4f6;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.2s;
}

.icon-btn:hover {
  background: #e5e7eb;
}

/* Stats Bar */
.stats-bar {
  display: flex;
  gap: 16px;
  padding: 12px 16px;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #2563eb;
}

.stat-label {
  font-size: 11px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Tabs */
.tabs {
  display: flex;
  padding: 8px 16px;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  gap: 8px;
}

.tab {
  flex: 1;
  padding: 6px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.tab:hover {
  background: #f3f4f6;
}

.tab.active {
  background: #eff6ff;
  color: #2563eb;
}

/* Products List */
.products-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.product-card {
  background: #ffffff;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid #e5e7eb;
  transition: all 0.2s;
  cursor: pointer;
}

.product-card:hover {
  border-color: #2563eb;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.1);
}

.product-card.stale {
  opacity: 0.7;
  border-color: #fbbf24;
  background: #fffbeb;
}

.stale-indicator {
  font-size: 11px;
  color: #f59e0b;
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.product-header {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.product-image {
  width: 60px;
  height: 60px;
  object-fit: contain;
  border-radius: 4px;
  background: #f9fafb;
}

.product-image-placeholder {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 24px;
}

.product-info {
  flex: 1;
  min-width: 0;
}

.product-title {
  font-size: 13px;
  font-weight: 500;
  color: #111827;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.product-store {
  font-size: 11px;
  color: #6b7280;
}

.product-pricing {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.price-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.current-price {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}

.original-price {
  font-size: 13px;
  color: #6b7280;
  text-decoration: line-through;
}

.price-drop {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: #dcfce7;
  color: #16a34a;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.product-actions {
  display: flex;
  gap: 4px;
  margin-top: 8px;
}

.btn-small {
  flex: 1;
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-small:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

.btn-danger {
  color: #dc2626;
  border-color: #fecaca;
}

.btn-danger:hover {
  background: #fef2f2;
  border-color: #fca5a5;
}

/* Empty State */
.empty-state {
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h2 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #111827;
}

.empty-state p {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.6;
}

/* Loading State */
.loading-state {
  padding: 48px 24px;
  text-align: center;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-state p {
  font-size: 13px;
  color: #6b7280;
}

/* Scrollbar */
.products-list::-webkit-scrollbar {
  width: 6px;
}

.products-list::-webkit-scrollbar-track {
  background: #f3f4f6;
}

.products-list::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.products-list::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
```

Use modern CSS with smooth transitions.
```

---

### **TASK 8.3: Create popup/popup.js**

**Prompt:**
```
Create popup.js with logic for displaying and interacting with products.

Import storage-manager and notification-manager.

```javascript
import { getAllProducts, deleteProduct } from '../background/storage-manager.js';
import { comparePrices } from '../content-scripts/price-extractor.js';

let allProducts = {};
let currentFilter = 'all';

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadProducts();
  setupEventListeners();
});

async function loadProducts() {
  try {
    showLoading();
    
    allProducts = await getAllProducts();
    const productIds = Object.keys(allProducts);
    
    if (productIds.length === 0) {
      showEmptyState();
      return;
    }
    
    updateStats(allProducts);
    displayProducts(allProducts, currentFilter);
    
  } catch (error) {
    console.error('[Popup] Error loading products:', error);
    showError('Failed to load products');
  }
}

function updateStats(products) {
  const productIds = Object.keys(products);
  const totalProducts = productIds.length;
  
  let priceDrops = 0;
  for (const product of Object.values(products)) {
    if (product.priceHistory && product.priceHistory.length > 1) {
      const latest = product.priceHistory[product.priceHistory.length - 1];
      const first = product.priceHistory[0];
      if (latest.price < first.price) {
        priceDrops++;
      }
    }
  }
  
  document.getElementById('totalProducts').textContent = totalProducts;
  document.getElementById('priceDrops').textContent = priceDrops;
}

function displayProducts(products, filter) {
  const container = document.getElementById('productsList');
  const filteredProducts = filterProducts(products, filter);
  
  if (filteredProducts.length === 0) {
    showEmptyState();
    return;
  }
  
  hideLoading();
  hideEmptyState();
  
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

function filterProducts(products, filter) {
  const productArray = Object.values(products);
  
  if (filter === 'all') {
    return productArray;
  }
  
  if (filter === 'drops') {
    return productArray.filter(product => {
      if (!product.priceHistory || product.priceHistory.length < 2) return false;
      const latest = product.priceHistory[product.priceHistory.length - 1];
      const first = product.priceHistory[0];
      return latest.price < first.price;
    });
  }
  
  if (filter === 'expiring') {
    const now = Date.now();
    const twentyFiveDays = 25 * 24 * 60 * 60 * 1000;
    return productArray.filter(product => {
      const age = now - product.tracking.firstSeen;
      return age > twentyFiveDays;
    });
  }
  
  return productArray;
}

function createProductCard(product) {
  const firstPrice = product.priceHistory[0];
  const currentPrice = product.price;
  
  const comparison = comparePrices(
    { numeric: firstPrice.price, currency: firstPrice.currency },
    { numeric: currentPrice.numeric, currency: currentPrice.currency }
  );
  
  const hasDropped = comparison.comparable && comparison.dropped;
  const dropPercentage = hasDropped ? comparison.percentage : 0;
  
  const formattedCurrent = formatPrice(currentPrice);
  const formattedOriginal = formatPrice({ ...currentPrice, numeric: firstPrice.price });
  
  // Check if product is stale (failed checks)
  const isStale = product.tracking.status === 'stale' || product.tracking.failedChecks >= 3;
  
  return `
    <div class="product-card ${isStale ? 'stale' : ''}" data-product-id="${product.productId}">
      <div class="product-header">
        ${product.imageUrl ? 
          `<img class="product-image" 
                src="${product.imageUrl}" 
                onerror="this.style.display='none'"
                loading="lazy"
                alt="${product.title}">` 
          : '<div class="product-image-placeholder">📦</div>'}
        <div class="product-info">
          <div class="product-title">${product.title}</div>
          <div class="product-store">${product.domain}</div>
          ${isStale ? '<div class="stale-indicator" title="Could not update price. The product page may have changed.">⚠️ Update failed</div>' : ''}
        </div>
      </div>
      
      <div class="product-pricing">
        <div class="price-info">
          <span class="current-price">${formattedCurrent}</span>
          ${hasDropped ? `<span class="original-price">${formattedOriginal}</span>` : ''}
        </div>
        ${hasDropped ? `
          <div class="price-drop">
            ↓ ${dropPercentage.toFixed(0)}%
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

function formatPrice(priceData) {
  return new Intl.NumberFormat(priceData.locale || 'en-US', {
    style: 'currency',
    currency: priceData.currency || 'USD',
    minimumFractionDigits: priceData.currency === 'JPY' ? 0 : 2
  }).format(priceData.numeric);
}

function setupEventListeners() {
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
  document.getElementById('refreshBtn').addEventListener('click', async () => {
    chrome.runtime.sendMessage({ type: 'CHECK_NOW' }, (response) => {
      if (response.success) {
        loadProducts();
      }
    });
  });
  
  // Settings button
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

function openProduct(productId) {
  const product = allProducts[productId];
  if (product) {
    chrome.tabs.create({ url: product.url });
  }
}

async function handleDeleteProduct(productId) {
  if (confirm('Remove this product from tracking?')) {
    await deleteProduct(productId);
    delete allProducts[productId];
    displayProducts(allProducts, currentFilter);
    updateStats(allProducts);
  }
}

function showLoading() {
  document.getElementById('loadingState').style.display = 'block';
  document.getElementById('productsList').style.display = 'none';
  document.getElementById('emptyState').style.display = 'none';
}

function hideLoading() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('productsList').style.display = 'block';
}

function showEmptyState() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('productsList').style.display = 'none';
  document.getElementById('emptyState').style.display = 'block';
}

function hideEmptyState() {
  document.getElementById('emptyState').style.display = 'none';
}

function showError(message) {
  alert(message);
}
```

Add proper error handling and user feedback.
```

---

### **SESSION 8 COMPLETION CHECKLIST**

- [ ] popup.html created with all UI elements
- [ ] popup.css created with modern styling
- [ ] popup.js created with full functionality
- [ ] Product cards display correctly
- [ ] Filters work properly
- [ ] Actions (visit, delete) work
- [ ] Empty state shows when no products
- [ ] Loading state displays during fetch

### **Testing Session 8**

1. Load extension
2. Track some products by visiting product pages
3. Click extension icon to open popup
4. Verify:
   - Products display correctly
   - Images load
   - Prices format properly by currency
   - Price drops show in green
   - Filter tabs work
   - Visit button opens product page
   - Delete button removes product
   - Stats update correctly

---

## SESSION 9: Settings Page (1 hour)

### **Objective**
Create the settings/options page for user preferences.

### **Files to Create**
1. `options/settings.html` - Settings page structure
2. `options/settings.js` - Settings logic
3. `options/settings.css` - Settings styling

---

### **TASK 9.1: Create options/settings.html**

**Prompt:**
```
Create settings.html with a comprehensive settings interface.

Include sections for:
- Tracking preferences
- Price check frequency
- Notification settings
- Data management
- Activity log
- About/version info

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Price Drop Tracker - Settings</title>
  <link rel="stylesheet" href="settings.css">
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>Settings</h1>
      <p class="subtitle">Configure your Price Drop Tracker preferences</p>
    </header>

    <div class="settings-grid">
      <!-- Tracking Settings -->
      <section class="settings-section">
        <h2>Tracking</h2>
        
        <div class="setting-item">
          <label for="trackingDuration">Tracking Duration</label>
          <select id="trackingDuration" class="select">
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30" selected>30 days</option>
            <option value="60">60 days</option>
          </select>
          <p class="setting-description">How long to track products before auto-removal</p>
        </div>

        <div class="setting-item">
          <label for="maxProducts">Maximum Products</label>
          <select id="maxProducts" class="select">
            <option value="50">50 products</option>
            <option value="100" selected>100 products</option>
            <option value="150">150 products</option>
          </select>
          <p class="setting-description">Maximum number of products to track simultaneously</p>
        </div>
      </section>

      <!-- Price Checking -->
      <section class="settings-section">
        <h2>Price Checking</h2>
        
        <div class="setting-item">
          <label for="checkInterval">Check Frequency</label>
          <select id="checkInterval" class="select">
            <option value="3">Every 3 hours</option>
            <option value="6" selected>Every 6 hours</option>
            <option value="12">Every 12 hours</option>
            <option value="24">Once daily</option>
          </select>
          <p class="setting-description">How often to check product prices</p>
        </div>

        <div class="setting-item">
          <button id="checkNowBtn" class="btn btn-secondary">Check All Prices Now</button>
          <p class="setting-description">Manually trigger price check for all products</p>
        </div>
      </section>

      <!-- Notifications -->
      <section class="settings-section">
        <h2>Notifications</h2>
        
        <div class="setting-item">
          <label class="checkbox-label">
            <input type="checkbox" id="notificationsEnabled" checked>
            <span>Enable notifications</span>
          </label>
        </div>

        <div class="setting-item">
          <label for="minDropPercentage">Minimum Drop Percentage</label>
          <select id="minDropPercentage" class="select">
            <option value="5" selected>5%</option>
            <option value="10">10%</option>
            <option value="15">15%</option>
            <option value="20">20%</option>
          </select>
          <p class="setting-description">Only notify for drops above this threshold</p>
        </div>

        <div class="setting-item">
          <label for="maxNotificationsPerDay">Max Notifications Per Day</label>
          <select id="maxNotificationsPerDay" class="select">
            <option value="3" selected>3 per day</option>
            <option value="5">5 per day</option>
            <option value="10">10 per day</option>
            <option value="999">Unlimited</option>
          </select>
          <p class="setting-description">Limit daily notification volume</p>
        </div>
      </section>

      <!-- Data Management -->
      <section class="settings-section">
        <h2>Data Management</h2>
        
        <div class="setting-item">
          <div class="storage-info">
            <div class="storage-stat">
              <span class="stat-label">Products tracked:</span>
              <span class="stat-value" id="productCount">0</span>
            </div>
            <div class="storage-stat">
              <span class="stat-label">Storage used:</span>
              <span class="stat-value" id="storageUsed">0 KB</span>
            </div>
          </div>
        </div>

        <div class="setting-item">
          <button id="exportDataBtn" class="btn btn-secondary">Export All Data</button>
          <p class="setting-description">Download your tracking data as JSON</p>
        </div>

        <div class="setting-item">
          <button id="importDataBtn" class="btn btn-secondary">Import Data</button>
          <input type="file" id="importFileInput" accept=".json" style="display: none;">
          <p class="setting-description">Restore data from a previous export</p>
        </div>

        <div class="setting-item">
          <button id="clearDataBtn" class="btn btn-danger">Clear All Data</button>
          <p class="setting-description">⚠️ Permanently delete all tracked products</p>
        </div>
      </section>

      <!-- Activity Log -->
      <section class="settings-section full-width">
        <h2>Activity Log</h2>
        <div id="activityLog" class="activity-log">
          <!-- Log entries will be inserted here -->
        </div>
      </section>

      <!-- About -->
      <section class="settings-section full-width">
        <h2>About</h2>
        <div class="about-info">
          <p><strong>Price Drop Tracker</strong> - Version 1.0.0</p>
          <p>Automatically track product prices and get notified when they drop.</p>
          <p>100% privacy-focused - all data stays on your device.</p>
          <div class="about-links">
            <a href="https://github.com/yourusername/price-drop-tracker" target="_blank">GitHub</a>
            <a href="https://github.com/yourusername/price-drop-tracker/issues" target="_blank">Report Issue</a>
            <a href="#" id="giveFeedbackLink">Give Feedback</a>
          </div>
        </div>
      </section>
    </div>

    <!-- Save Indicator -->
    <div id="saveIndicator" class="save-indicator" style="display: none;">
      ✓ Settings saved
    </div>
  </div>

  <script type="module" src="settings.js"></script>
</body>
</html>
```

Keep structure clean and accessible.
```

---

### **TASK 9.2: Create options/settings.css**

**Prompt:**
```
Create settings.css with clean, form-focused styling.

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  background: #f9fafb;
  color: #111827;
  padding: 24px;
}

.container {
  max-width: 800px;
  margin: 0 auto;
}

.header {
  margin-bottom: 32px;
}

.header h1 {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 8px;
}

.subtitle {
  font-size: 14px;
  color: #6b7280;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.settings-section {
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #e5e7eb;
}

.settings-section.full-width {
  grid-column: 1 / -1;
}

.settings-section h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 20px;
  color: #111827;
}

.setting-item {
  margin-bottom: 20px;
}

.setting-item:last-child {
  margin-bottom: 0;
}

.setting-item label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

.setting-description {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: #ffffff;
  color: #111827;
  cursor: pointer;
}

.select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-danger {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.btn-danger:hover {
  background: #fee2e2;
  border-color: #fca5a5;
}

.storage-info {
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.storage-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.storage-stat:last-child {
  margin-bottom: 0;
}

.stat-label {
  font-size: 13px;
  color: #6b7280;
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.activity-log {
  max-height: 300px;
  overflow-y: auto;
  background: #f9fafb;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #e5e7eb;
}

.log-entry {
  font-size: 12px;
  color: #6b7280;
  padding: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-entry-time {
  font-weight: 500;
  color: #374151;
}

.about-info {
  line-height: 1.6;
}

.about-info p {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 12px;
}

.about-info strong {
  color: #111827;
  font-weight: 600;
}

.about-links {
  display: flex;
  gap: 16px;
  margin-top: 16px;
}

.about-links a {
  font-size: 14px;
  color: #2563eb;
  text-decoration: none;
}

.about-links a:hover {
  text-decoration: underline;
}

.save-indicator {
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 12px 16px;
  background: #16a34a;
  color: #ffffff;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease;
}

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

@media (max-width: 768px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
```

Use modern CSS with smooth animations.
```

---

### **TASK 9.3: Create options/settings.js**

**Prompt:**
```
Create settings.js with full settings management logic.

```javascript
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
```

Add proper error handling and user feedback.
```

---

### **SESSION 9 COMPLETION CHECKLIST**

- [ ] settings.html created with all options
- [ ] settings.css created with form styling
- [ ] settings.js created with full functionality
- [ ] Settings load correctly from storage
- [ ] Settings save on change
- [ ] Export/import data works
- [ ] Clear data works with confirmation
- [ ] Storage stats display correctly
- [ ] Check now button triggers price check

### **Testing Session 9**

1. Right-click extension icon → Options
2. Verify all settings load correctly
3. Change settings and verify they save
4. Test export data (downloads JSON file)
5. Test import data (restores from JSON)
6. Test clear data (removes all products after confirmation)
7. Test "Check Now" button (triggers price check)

---

## SESSION 10: Integration & Content Script Activation (1 hour)

### **Objective**
Wire up the content script to detect products, communicate with the background script, and create a first-run onboarding experience.

### **Files to Modify**
1. Update `content-scripts/product-detector.js` - Add auto-detection on page load
2. Update `manifest.json` - Ensure content scripts are properly configured

### **Files to Create**
1. `onboarding/welcome.html` - First-run welcome page
2. `onboarding/welcome.css` - Welcome page styles

---

### **TASK 10.1: Update product-detector.js with Auto-Detection**

**Prompt:**
```
At the end of content-scripts/product-detector.js, add initialization code that runs on page load:

```javascript
// Auto-detect product when page loads
(async function initialize() {
  // Wait for page to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detectAndSave);
  } else {
    detectAndSave();
  }
})();

async function detectAndSave() {
  try {
    console.log('[Price Drop Tracker] Page loaded, checking for product...');
    
    // Wait a bit for dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const productData = await detectProduct();
    
    if (productData) {
      // Check if already tracking
      const response = await chrome.runtime.sendMessage({
        type: 'PRODUCT_DETECTED',
        data: productData
      });
      
      if (response.success) {
        console.log('[Price Drop Tracker] Product saved:', response.productId);
        showTrackingBadge(productData);
      }
    }
  } catch (error) {
    console.error('[Price Drop Tracker] Detection error:', error);
  }
}

function showTrackingBadge(product) {
  // Create subtle notification badge
  const badge = document.createElement('div');
  badge.id = 'price-tracker-badge';
  badge.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #2563eb;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 999999;
      animation: slideIn 0.3s ease;
    ">
      ✓ Now tracking price: ${product.price.formatted}
    </div>
    <style>
      @keyframes slideIn {
        from { transform: translateY(100px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    </style>
  `;
  
  document.body.appendChild(badge);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    badge.style.transition = 'opacity 0.3s ease';
    badge.style.opacity = '0';
    setTimeout(() => badge.remove(), 300);
  }, 5000);
}
```

This makes the extension automatically detect and track products as users browse.
```

---

### **TASK 10.2: Create onboarding/welcome.html**

**Prompt:**
```
Create a simple, friendly welcome page for first-time users.

This page opens automatically when the extension is installed.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Price Drop Tracker!</title>
  <link rel="stylesheet" href="welcome.css">
</head>
<body>
  <div class="container">
    <div class="hero">
      <div class="icon">💰</div>
      <h1>Welcome to Price Drop Tracker!</h1>
      <p class="tagline">Never miss a deal again</p>
    </div>

    <div class="content">
      <section class="feature">
        <div class="feature-icon">✨</div>
        <h2>Automatic Price Tracking</h2>
        <p>Just browse normally. The extension automatically detects and tracks product prices as you shop. No manual adding, no wishlists, no hassle.</p>
      </section>

      <section class="feature">
        <div class="feature-icon">🔔</div>
        <h2>Smart Notifications</h2>
        <p>Get notified when prices drop on products you've viewed. Set your own thresholds (5%, 10%, 15%, or 20%) to control alerts.</p>
      </section>

      <section class="feature">
        <div class="feature-icon">🌍</div>
        <h2>Multi-Currency Support</h2>
        <p>Works across 30+ currencies and major stores including Amazon, eBay, Walmart, Target, and Best Buy.</p>
      </section>

      <section class="feature">
        <div class="feature-icon">🔒</div>
        <h2>100% Private</h2>
        <p>All data stays on YOUR device. No external servers, no tracking, no data collection. We take your privacy seriously.</p>
      </section>

      <div class="permissions-section">
        <h2>Why We Need Permissions</h2>
        <div class="permission-item">
          <strong>Access product pages:</strong> To detect products and check prices automatically
        </div>
        <div class="permission-item">
          <strong>Storage:</strong> To save your tracked products locally on your device
        </div>
        <div class="permission-item">
          <strong>Notifications:</strong> To alert you when prices drop
        </div>
        <div class="permission-item">
          <strong>Alarms:</strong> To schedule price checks every few hours
        </div>
        <p class="permissions-note">
          <strong>Important:</strong> We ONLY access product pages from e-commerce sites. 
          We do NOT track your browsing history, read your emails, or access personal sites.
        </p>
      </div>

      <div class="cta-section">
        <h2>Ready to Start Saving?</h2>
        <p>Visit any product page on Amazon, eBay, Walmart, Target, or Best Buy to start tracking prices!</p>
        <button id="getStartedBtn" class="cta-button">Get Started</button>
      </div>
    </div>

    <footer>
      <p>Questions? <a href="https://github.com/yourusername/price-drop-tracker/issues" target="_blank">Get Support</a></p>
    </footer>
  </div>

  <script>
    document.getElementById('getStartedBtn').addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://www.amazon.com' });
      window.close();
    });
  </script>
</body>
</html>
```

Keep the tone friendly and reassuring, especially about privacy.
```

---

### **TASK 10.3: Create onboarding/welcome.css**

**Prompt:**
```
Create welcome.css with clean, modern styling for the onboarding page.

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #1f2937;
  padding: 40px 20px;
  min-height: 100vh;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.hero {
  text-align: center;
  padding: 60px 40px 40px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.icon {
  font-size: 80px;
  margin-bottom: 20px;
}

.hero h1 {
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 12px;
}

.tagline {
  font-size: 18px;
  opacity: 0.95;
}

.content {
  padding: 40px;
}

.feature {
  margin-bottom: 32px;
  padding: 24px;
  background: #f9fafb;
  border-radius: 12px;
  border-left: 4px solid #667eea;
}

.feature-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.feature h2 {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 8px;
}

.feature p {
  font-size: 15px;
  line-height: 1.6;
  color: #6b7280;
}

.permissions-section {
  background: #fffbeb;
  border: 2px solid #fbbf24;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 32px;
}

.permissions-section h2 {
  font-size: 20px;
  font-weight: 600;
  color: #92400e;
  margin-bottom: 16px;
}

.permission-item {
  font-size: 14px;
  color: #78350f;
  margin-bottom: 12px;
  padding-left: 24px;
  position: relative;
}

.permission-item::before {
  content: "✓";
  position: absolute;
  left: 0;
  color: #059669;
  font-weight: bold;
}

.permission-item strong {
  color: #92400e;
}

.permissions-note {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #fcd34d;
  font-size: 14px;
  color: #78350f;
  line-height: 1.6;
}

.cta-section {
  text-align: center;
  padding: 32px 24px;
  background: #f3f4f6;
  border-radius: 12px;
}

.cta-section h2 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #1f2937;
}

.cta-section p {
  font-size: 15px;
  color: #6b7280;
  margin-bottom: 24px;
}

.cta-button {
  padding: 14px 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.cta-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
}

footer {
  padding: 24px;
  text-align: center;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

footer p {
  font-size: 14px;
  color: #6b7280;
}

footer a {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
}

footer a:hover {
  text-decoration: underline;
}
```

Use a gradient hero for visual appeal, keep the rest clean and readable.
```

---

### **TASK 10.4: Update background/service-worker.js to Open Welcome Page**

**Prompt:**
```
Update the chrome.runtime.onInstalled listener in background/service-worker.js to open the welcome page on first install:

```javascript
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Service Worker] Extension installed/updated');
  
  // Open welcome page on first install
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/welcome.html') });
  }
  
  // Create alarm for price checking
  const settings = await getSettings();
  await setupPriceCheckAlarm(settings.checking.interval);
  
  // Create alarm for daily cleanup
  chrome.alarms.create('cleanup', { periodInMinutes: 1440 }); // 24 hours
  
  // Run initial check after 5 minutes
  chrome.alarms.create('initialCheck', { delayInMinutes: 5 });
});
```

This provides a better first-time user experience and explains permissions upfront.
```

---

### **SESSION 10 COMPLETION CHECKLIST**

- [ ] product-detector.js updated with auto-detection
- [ ] welcome.html created with onboarding flow
- [ ] welcome.css created with gradient design
- [ ] service-worker.js opens welcome page on install
- [ ] manifest.json includes onboarding/welcome.html (if using web_accessible_resources)
- [ ] Tracking badge appears when products detected
- [ ] Products save to storage automatically

### **Testing Session 10**

1. Remove and reinstall extension
2. Welcome page should open automatically
3. Click "Get Started" button (opens Amazon)
4. Visit a product page
5. Tracking badge should appear
6. Open popup - product should be listed
7. Verify all permissions are working

---

## SESSION 11: Comprehensive Testing (2 hours)

### **Objective**
Thoroughly test all functionality across different sites and scenarios.

### **Files to Create**
1. `tests/test-sites.json` - List of test URLs
2. `tests/manual-test-checklist.md` - Testing procedures

---

### **TASK 11.1: Create tests/test-sites.json**

**Prompt:**
```
Create test-sites.json with real product URLs for testing:

```json
{
  "amazon": [
    {
      "url": "https://www.amazon.com/dp/B08N5WRWNW",
      "description": "Amazon US - Electronics",
      "expectedCurrency": "USD"
    },
    {
      "url": "https://www.amazon.co.uk/dp/B08N5WRWNW",
      "description": "Amazon UK - Same product",
      "expectedCurrency": "GBP"
    },
    {
      "url": "https://www.amazon.de/dp/B08N5WRWNW",
      "description": "Amazon Germany",
      "expectedCurrency": "EUR"
    },
    {
      "url": "https://www.amazon.co.jp/dp/B08N5WRWNW",
      "description": "Amazon Japan",
      "expectedCurrency": "JPY"
    }
  ],
  "ebay": [
    {
      "url": "https://www.ebay.com/itm/185053838278",
      "description": "eBay US",
      "expectedCurrency": "USD"
    },
    {
      "url": "https://www.ebay.co.uk/itm/185053838278",
      "description": "eBay UK",
      "expectedCurrency": "GBP"
    }
  ],
  "walmart": [
    {
      "url": "https://www.walmart.com/ip/Apple-AirPods-Pro-2nd-Generation/1752657021",
      "description": "Walmart",
      "expectedCurrency": "USD"
    }
  ],
  "target": [
    {
      "url": "https://www.target.com/p/apple-airpods-pro-2nd-generation/-/A-85978622",
      "description": "Target",
      "expectedCurrency": "USD"
    }
  ],
  "bestbuy": [
    {
      "url": "https://www.bestbuy.com/site/apple-airpods-pro-2nd-generation/6447382.p",
      "description": "Best Buy",
      "expectedCurrency": "USD"
    }
  ]
}
```

Use real, active product URLs for accurate testing.
```

---

### **TASK 11.2: Create tests/manual-test-checklist.md**

**Prompt:**
```
Create a comprehensive manual testing checklist:

# Manual Testing Checklist

## Setup
- [ ] Extension loaded in Chrome
- [ ] All permissions granted
- [ ] No console errors on load

## Product Detection Tests

### Amazon
- [ ] Visit Amazon.com product page
- [ ] Price detected correctly (USD)
- [ ] Title extracted
- [ ] Image loaded
- [ ] Tracking badge appears
- [ ] Product saved to storage
- [ ] Visit Amazon.co.uk product
- [ ] Currency correctly detected as GBP
- [ ] Visit Amazon.de product
- [ ] Currency correctly detected as EUR
- [ ] Visit Amazon.co.jp product
- [ ] Currency correctly detected as JPY (no decimals)

### eBay
- [ ] Visit eBay.com product page
- [ ] Price detected correctly
- [ ] Product tracked

### Walmart
- [ ] Visit Walmart product page
- [ ] Detection works

### Target
- [ ] Visit Target product page
- [ ] Detection works

### Best Buy
- [ ] Visit Best Buy product page
- [ ] Detection works

## Currency Parsing Tests
- [ ] US format: $1,299.99 → 1299.99 USD
- [ ] EU format: 1.299,99 € → 1299.99 EUR
- [ ] UK format: £1,299.99 → 1299.99 GBP
- [ ] JP format: ¥9,999 → 9999 JPY
- [ ] Nordic format: 1 299,99 kr → 1299.99 SEK

## Background Price Checking
- [ ] Set check interval to 3 hours
- [ ] Manually trigger check: chrome.alarms.create('priceCheck', {delayInMinutes: 0.1})
- [ ] Watch service worker console for check progress
- [ ] Verify prices update in storage
- [ ] Verify failed checks are logged
- [ ] Verify stale products marked after 3 failures

## Notifications
- [ ] Enable notifications in settings
- [ ] Manually change a product price (edit storage)
- [ ] Trigger price check
- [ ] Notification appears for price drop
- [ ] Click notification opens product page
- [ ] Notification respects min drop percentage setting
- [ ] Notification respects max per day limit

## Popup UI
- [ ] Click extension icon
- [ ] Products display correctly
- [ ] Images load
- [ ] Prices format correctly per currency
- [ ] Price drops show in green
- [ ] Filter tabs work (All, Price Drops, Expiring Soon)
- [ ] Visit button opens product page
- [ ] Delete button removes product
- [ ] Refresh button triggers price check
- [ ] Settings button opens settings page
- [ ] Stats update correctly
- [ ] Empty state shows when no products
- [ ] Loading state shows during fetch

## Settings Page
- [ ] Right-click extension → Options
- [ ] All settings load correctly
- [ ] Change tracking duration → saves
- [ ] Change max products → saves
- [ ] Change check interval → saves & updates alarm
- [ ] Toggle notifications → saves
- [ ] Change min drop % → saves
- [ ] Change max notifications/day → saves
- [ ] Export data downloads JSON file
- [ ] Import data restores from JSON
- [ ] Clear data removes all (with confirmation)
- [ ] Storage stats display correctly
- [ ] Check now button works

## Edge Cases
- [ ] Non-product pages don't trigger detection
- [ ] Shopping cart pages ignored
- [ ] Search results pages ignored
- [ ] Product with no image handles gracefully
- [ ] Product with very long title truncates
- [ ] Product price changes currency → handles gracefully
- [ ] Product goes out of stock → marks as stale
- [ ] Product page 404 → marks as stale
- [ ] Rate limiting doesn't crash extension
- [ ] Storage quota warning appears at 90%

## Performance
- [ ] Extension memory < 50MB with 100 products
- [ ] Popup opens in < 500ms
- [ ] Background checks complete in < 5min for 100 products
- [ ] No UI freezing or lag
- [ ] Content script doesn't slow page load

## Cross-Browser Compatibility (if supporting)
- [ ] Works in Chrome
- [ ] Works in Edge
- [ ] Works in Brave

## Final Checks
- [ ] No console errors anywhere
- [ ] All features work as expected
- [ ] Privacy: no external network calls except product pages
- [ ] Privacy: no tracking or analytics
- [ ] User data stays local
- [ ] Extension can be uninstalled cleanly
```

Use this checklist before submitting to Chrome Web Store.
```

---

## SESSION 12: Polish & Bug Fixes (1 hour)

### **Objective**
Fix any remaining bugs and polish the user experience.

### **Common Issues to Address**

**Prompt:**
```
Review and fix these common issues:

1. **Error Handling**
   - Wrap all async operations in try-catch
   - Show user-friendly error messages
   - Log errors with context for debugging
   - Never let extension crash silently

2. **Performance Optimization**
   - Debounce settings saves (300ms delay)
   - Lazy load images in popup
   - Use IntersectionObserver for scroll performance
   - Compress stored images to thumbnails (<100KB each)

3. **User Experience**
   - Add loading states to all async actions
   - Show success feedback for user actions
   - Disable buttons during operations
   - Add keyboard shortcuts (optional)
   - Improve empty state messaging

4. **Accessibility**
   - Add aria-labels to icon buttons
   - Ensure proper focus management
   - Support keyboard navigation
   - High contrast mode compatibility

5. **Edge Cases**
   - Handle products with no images
   - Handle extremely long titles (truncate)
   - Handle invalid URLs gracefully
   - Handle storage quota exceeded
   - Handle network timeouts

6. **Code Quality**
   - Add JSDoc comments to complex functions
   - Remove console.logs from production (or wrap in DEBUG flag)
   - Consistent error handling patterns
   - DRY principles applied

Create a "polish" pass through all files addressing these items.
```

---

## SESSION 13: Chrome Web Store Submission (2 hours)

### **Objective**
Prepare all assets and documentation for Chrome Web Store submission.

### **Files to Create**
1. Store assets (images)
2. Privacy policy
3. Promotional materials

---

### **TASK 13.1: Create Store Assets**

**Prompt:**
```
Create placeholder descriptions for required store assets:

1. **Icon.png Files** (already have placeholders)
   - 16x16, 32x32, 48x48, 128x128
   - Design: Blue price tag with white downward arrow
   - Clean, professional look

2. **Promotional Images**
   Create placeholder specifications in assets/store/:
   
   - promo-1280x800.png: Hero image showing extension in action
   - screenshot-1.png (1280x800): Popup showing tracked products
   - screenshot-2.png (1280x800): Product page with tracking badge
   - screenshot-3.png (1280x800): Settings page
   - screenshot-4.png (1280x800): Price drop notification
   - screenshot-5.png (1280x800): Multiple currencies example

3. **Demo Video** (optional but recommended)
   - 30-60 seconds
   - Show: browsing product → auto-tracking → price drop → notification
   - Upload to YouTube as unlisted
   - Add link to store listing

Create a file assets/store/ASSET_REQUIREMENTS.md documenting all needed assets.
```

---

### **TASK 13.2: Create Privacy Policy**

**Prompt:**
```
Create PRIVACY_POLICY.md in project root:

# Privacy Policy for Price Drop Tracker

**Last Updated: [Date]**

## Overview
Price Drop Tracker ("the Extension") is committed to protecting your privacy. This policy explains what data we collect, how we use it, and your rights.

## Data Collection
The Extension collects and stores the following data **LOCALLY ON YOUR DEVICE ONLY**:

### Information Stored Locally
- Product URLs you visit
- Product titles, prices, and images
- Price history for tracked products
- Your settings and preferences
- Timestamps of product views and price checks

### Information NOT Collected
- We do NOT collect browsing history beyond product pages
- We do NOT collect personal information (name, email, etc.)
- We do NOT track your behavior across websites
- We do NOT use analytics or tracking scripts
- We do NOT sell or share any data with third parties

## How We Use Data
All data is stored locally using Chrome's storage API and is used solely to:
- Track product prices you've visited
- Notify you of price drops
- Display your tracked products in the extension

## Data Storage
- All data is stored locally on your device
- No data is transmitted to external servers
- No cloud backups are created
- Data persists until you manually delete it or uninstall the extension

## Permissions Explained
The Extension requests the following permissions:

- **storage**: To save your tracked products locally
- **alarms**: To schedule periodic price checks
- **notifications**: To alert you of price drops
- **tabs**: To detect when you visit product pages
- **host_permissions**: To access product pages for price checking
  - We ONLY access specific e-commerce sites (Amazon, eBay, etc.)
  - We ONLY extract product information (title, price, image)
  - We do NOT access banking, email, or personal sites

## Your Rights
You have complete control over your data:
- **View**: See all tracked products in the extension popup
- **Export**: Download your data as JSON from settings
- **Delete**: Remove individual products or clear all data
- **Uninstall**: Completely removes all extension data

## Third-Party Services
The Extension does NOT use any third-party services, analytics, or tracking.

## Children's Privacy
The Extension does not target children under 13 and does not knowingly collect data from children.

## Changes to Privacy Policy
We will notify users of any privacy policy changes by updating the "Last Updated" date and posting in extension release notes.

## Contact
For privacy concerns or questions:
- Email: [your-email@example.com]
- GitHub Issues: [repository-url]/issues

## Open Source
This Extension is open source. You can review the code at:
[GitHub repository URL]

---

By using Price Drop Tracker, you agree to this privacy policy.
```

Host this on GitHub Pages or your own website for the store listing.
```

---

### **TASK 13.3: Create Store Listing Text**

**Prompt:**
```
Create STORE_LISTING.md with copy for Chrome Web Store:

# Chrome Web Store Listing

## Short Description (132 characters max)
Automatically track product prices and get notified when they drop. Works on Amazon, eBay, Walmart, Target, and Best Buy. No setup needed.

## Detailed Description
**Never miss a deal again with Price Drop Tracker!**

🎯 **Zero Setup Required**
Just browse normally - the extension automatically detects and tracks product prices as you shop. No manual adding, no wishlists, no hassle.

💰 **Save Money Automatically**
Get instant notifications when prices drop on products you've viewed. Set your own thresholds (5%, 10%, 15%, or 20%) to control when you're notified.

🌍 **Multi-Currency Support**
Works seamlessly across 30+ currencies including USD, EUR, GBP, JPY, CAD, AUD, and more. Automatically detects the correct currency for each store.

🛒 **Supported Stores**
- Amazon (all regional sites: .com, .co.uk, .de, .fr, .it, .es, .ca, .com.au, .co.jp, .in)
- eBay (all regional sites)
- Walmart
- Target
- Best Buy
- More stores coming soon!

📊 **Track Up to 100 Products**
Keep tabs on your favorite products for 30 days (configurable from 7 to 60 days).

🔔 **Smart Notifications**
- Set minimum price drop percentage
- Limit notifications per day
- Click notification to instantly visit the product

🔒 **100% Private**
- All data stored locally on YOUR device
- No external servers
- No tracking or analytics
- No data collection or sharing
- Open source code for transparency

⚡ **Features**
- Automatic price tracking
- Background price monitoring (every 3-24 hours)
- Price history graphs
- Currency-aware comparisons
- Export/import your data
- Clean, modern interface

🎨 **Easy to Use**
1. Install extension
2. Browse product pages normally
3. Extension automatically tracks prices
4. Get notified when prices drop
5. Save money!

**Perfect for:**
- Online shoppers looking for deals
- Price-conscious consumers
- Gift planners waiting for sales
- Anyone who wants to save money

**Why Choose Price Drop Tracker?**
- ✓ No account required
- ✓ No credit card needed
- ✓ Completely free
- ✓ Privacy-focused
- ✓ Open source
- ✓ Regular updates
- ✓ Responsive support

**Support & Feedback**
- Report issues: [GitHub Issues URL]
- Feature requests: [GitHub Issues URL]
- Email: [your-email]

**Privacy Policy**: [Link to privacy policy]

---

Install now and never pay full price again!
```

Character limits: Short description (132), Detailed description (unlimited but keep under 5000)
```

---

### **TASK 13.4: Complete Store Submission Checklist**

**Prompt:**
```
Create SUBMISSION_CHECKLIST.md:

# Chrome Web Store Submission Checklist

## Pre-Submission

### Code Review
- [ ] All console.logs removed or wrapped in DEBUG flag
- [ ] No TODO comments in production code
- [ ] All error handling implemented
- [ ] All features tested and working
- [ ] No known bugs
- [ ] Code is clean and documented

### Assets Prepared
- [ ] Icon files (16, 32, 48, 128) created
- [ ] 5 screenshots (1280x800) taken
- [ ] Promotional image (1280x800) created
- [ ] Demo video recorded (optional)
- [ ] Privacy policy published online

### Documentation
- [ ] README.md complete
- [ ] PRIVACY_POLICY.md complete
- [ ] CHANGELOG.md created
- [ ] LICENSE file present (MIT)

### Testing
- [ ] Manual test checklist 100% complete
- [ ] Tested on Chrome latest version
- [ ] Tested on at least 10 product pages per store
- [ ] All currencies tested
- [ ] Performance acceptable
- [ ] No memory leaks

### Store Listing
- [ ] Short description written (≤132 chars)
- [ ] Detailed description written
- [ ] Category selected: Shopping
- [ ] Language: English
- [ ] Maturity rating: Everyone
- [ ] Privacy policy URL ready
- [ ] Support email set up

### Developer Account
- [ ] Chrome Web Store developer account created ($5 one-time fee)
- [ ] Payment method added
- [ ] Identity verified

## Submission Steps

1. **Package Extension**
   - [ ] Create ZIP of extension folder
   - [ ] Include only necessary files (exclude .git, node_modules, tests, etc.)
   - [ ] Verify ZIP is < 20MB

2. **Upload to Chrome Web Store**
   - [ ] Go to Chrome Web Store Developer Dashboard
   - [ ] Click "New Item"
   - [ ] Upload ZIP file
   - [ ] Wait for upload to complete

3. **Fill Store Listing**
   - [ ] Add detailed description
   - [ ] Add short description
   - [ ] Upload icon (128x128)
   - [ ] Upload promotional images
   - [ ] Upload screenshots (at least 1, recommended 5)
   - [ ] Add promotional video URL (optional)
   - [ ] Select category: Shopping
   - [ ] Add website URL (GitHub repo)
   - [ ] Add support URL (GitHub issues)
   - [ ] Add privacy policy URL

4. **Configure Distribution**
   - [ ] Visibility: Public
   - [ ] Regions: All regions (or select specific)
   - [ ] Pricing: Free

5. **Submit for Review**
   - [ ] Review all information
   - [ ] Accept terms and conditions
   - [ ] Click "Submit for Review"

## Post-Submission

### During Review (typically 1-3 days)
- [ ] Monitor email for review updates
- [ ] Be prepared to respond to reviewer questions
- [ ] Have additional documentation ready if needed

### If Rejected
- [ ] Read rejection reason carefully
- [ ] Address all issues mentioned
- [ ] Update extension and resubmit
- [ ] Common rejection reasons:
  - Insufficient permission justification
  - Privacy policy issues
  - Functionality not clear
  - Misleading screenshots

### After Approval
- [ ] Test extension from Web Store
- [ ] Monitor reviews and ratings
- [ ] Respond to user feedback
- [ ] Plan future updates

## Marketing (Optional)
- [ ] Create landing page
- [ ] Post on social media
- [ ] Submit to extension directories
- [ ] Write blog post
- [ ] Create tutorial video
- [ ] Reach out to tech blogs

## Ongoing Maintenance
- [ ] Monitor error reports
- [ ] Update site adapters when stores change
- [ ] Release updates every 2-3 months
- [ ] Respond to user reviews
- [ ] Add requested features
```

This checklist ensures nothing is missed during submission.
```

---

### **SESSION 13 COMPLETION CHECKLIST**

- [ ] All store assets created or documented
- [ ] Privacy policy written and published
- [ ] Store listing text written
- [ ] Submission checklist created
- [ ] Extension packaged as ZIP
- [ ] Developer account ready
- [ ] Ready to submit!

---

## FINAL PROJECT COMPLETION CHECKLIST

### Development Complete
- [ ] All 13 sessions completed
- [ ] All files created
- [ ] All features implemented
- [ ] All tests passing
- [ ] No critical bugs

### Documentation Complete
- [ ] README.md
- [ ] PRIVACY_POLICY.md
- [ ] CHANGELOG.md
- [ ] LICENSE
- [ ] Code comments
- [ ] User guide

### Ready for Launch
- [ ] Extension tested thoroughly
- [ ] Store assets prepared
- [ ] Listing text written
- [ ] Privacy policy published
- [ ] Submission checklist reviewed

### Post-Launch Plan
- [ ] Monitor reviews
- [ ] Respond to feedback
- [ ] Plan feature updates
- [ ] Maintain site adapters
- [ ] Release schedule (monthly/quarterly)

---

## CONGRATULATIONS! 🎉

You now have a complete, production-ready Chrome extension for automatic price tracking.

**Next Steps:**
1. Complete final testing using manual-test-checklist.md
2. Create store assets (icons, screenshots)
3. Package extension as ZIP
4. Submit to Chrome Web Store
5. Launch and market your extension!

**Estimated Timeline:**
- Development: 2-3 weeks (following all sessions)
- Testing: 3-5 days
- Store preparation: 2-3 days
- Review time: 1-3 days
- **Total: ~3-4 weeks from start to launch**

Good luck! 🚀
