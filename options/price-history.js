import browser from '../utils/browser-polyfill.js';

import { debug, debugError } from '../utils/debug.js';

let allProducts = {};
let selectedProductId = null;
let currentChart = null;

// Check Chart.js availability on load
if (!window.Chart) {
  console.error('[PriceHistory] Chart.js not loaded at script initialization!');
} else {
  console.log('[PriceHistory] Chart.js loaded successfully, version:', window.Chart.version);
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
  // Apply dark mode based on user preference
  applyTheme();

  await loadProducts();

  // Add search handler
  const searchInput = document.getElementById('productSearch');
  if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
  }
});

/**
 * Apply theme (dark/light mode)
 */
function applyTheme() {
  browser.storage.local.get(['theme'], (result) => {
    const theme = result.theme || 'light';
    document.body.setAttribute('data-theme', theme);
  });
}

/**
 * Load all tracked products
 */
async function loadProducts() {
  try {
    const result = await browser.storage.local.get(['products']);
    const products = result.products || {};

    allProducts = products;
    const productIds = Object.keys(products);

    const productListEl = document.getElementById('productList');
    const emptyStateEl = document.getElementById('emptyState');

    if (productIds.length === 0) {
      productListEl.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 24px;">No tracked products found</p>';
      emptyStateEl.style.display = 'block';
      return;
    }

    // Hide empty state
    emptyStateEl.style.display = 'none';

    // Group products by domain
    const groupedProducts = groupProductsByDomain(products);

    // Render grouped product list
    renderGroupedProducts(groupedProducts);

    debug('[Price History]', `Loaded ${productIds.length} products from ${Object.keys(groupedProducts).length} stores`);
  } catch (error) {
    debugError('[Price History] Error loading products:', error);
  }
}

/**
 * Group products by domain/store
 */
function groupProductsByDomain(products) {
  const grouped = {};

  Object.entries(products).forEach(([productId, product]) => {
    const domain = product.domain || 'unknown';

    if (!grouped[domain]) {
      grouped[domain] = [];
    }

    grouped[domain].push({ id: productId, ...product });
  });

  return grouped;
}

/**
 * Get friendly store name from domain
 */
function getStoreName(domain) {
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();

  if (cleanDomain.includes('amazon')) return 'Amazon';
  if (cleanDomain.includes('ebay')) return 'eBay';
  if (cleanDomain.includes('walmart')) return 'Walmart';
  if (cleanDomain.includes('target')) return 'Target';
  if (cleanDomain.includes('bestbuy')) return 'Best Buy';
  if (cleanDomain.includes('etsy')) return 'Etsy';
  if (cleanDomain.includes('aliexpress')) return 'AliExpress';
  if (cleanDomain.includes('zalando')) return 'Zalando';
  if (cleanDomain.includes('asos')) return 'ASOS';
  if (cleanDomain.includes('newegg')) return 'Newegg';
  if (cleanDomain.includes('costco')) return 'Costco';
  if (cleanDomain.includes('homedepot')) return 'Home Depot';
  if (cleanDomain.includes('lowes')) return "Lowe's";
  if (cleanDomain.includes('wayfair')) return 'Wayfair';
  if (cleanDomain.includes('overstock')) return 'Overstock';
  if (cleanDomain.includes('mediamarkt')) return 'MediaMarkt';

  // Fallback: capitalize first part of domain
  const parts = cleanDomain.split('.');
  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
}

/**
 * Render grouped products
 */
function renderGroupedProducts(groupedProducts) {
  const productListEl = document.getElementById('productList');
  productListEl.innerHTML = '';

  // Sort domains alphabetically by store name
  const sortedDomains = Object.keys(groupedProducts).sort((a, b) => {
    return getStoreName(a).localeCompare(getStoreName(b));
  });

  sortedDomains.forEach(domain => {
    const products = groupedProducts[domain];
    const storeGroup = createStoreGroup(domain, products);
    productListEl.appendChild(storeGroup);
  });
}

/**
 * Create a store group with products
 */
function createStoreGroup(domain, products) {
  const group = document.createElement('div');
  group.className = 'store-group';
  group.dataset.domain = domain;

  // Store header
  const header = document.createElement('div');
  header.className = 'store-group-header';

  const storeName = getStoreName(domain);
  const nameSpan = document.createElement('span');
  nameSpan.textContent = storeName;

  const count = document.createElement('span');
  count.className = 'store-group-count';
  count.textContent = products.length;

  header.appendChild(nameSpan);
  header.appendChild(count);

  // Toggle collapse on header click
  header.addEventListener('click', (e) => {
    if (e.target === header || e.target === nameSpan || e.target === count) {
      items.classList.toggle('collapsed');
    }
  });

  // Store items container
  const items = document.createElement('div');
  items.className = 'store-group-items';

  products.forEach(product => {
    const productItem = createProductItem(product.id, product);
    items.appendChild(productItem);
  });

  group.appendChild(header);
  group.appendChild(items);

  return group;
}

/**
 * Handle search input
 */
function handleSearch(event) {
  const query = event.target.value.toLowerCase().trim();

  const storeGroups = document.querySelectorAll('.store-group');

  storeGroups.forEach(group => {
    const domain = group.dataset.domain;
    const storeName = getStoreName(domain).toLowerCase();
    const items = group.querySelectorAll('.product-item');

    let visibleCount = 0;

    items.forEach(item => {
      const title = item.querySelector('.product-item-title').textContent.toLowerCase();
      const itemDomain = item.querySelector('.product-item-domain')?.textContent.toLowerCase() || '';

      // Match against title, domain, or store name
      const matches = !query ||
                     title.includes(query) ||
                     itemDomain.includes(query) ||
                     storeName.includes(query);

      if (matches) {
        item.style.display = 'flex';
        visibleCount++;
      } else {
        item.style.display = 'none';
      }
    });

    // Hide/show entire group based on visibility
    if (visibleCount === 0) {
      group.style.display = 'none';
    } else {
      group.style.display = 'block';
      // Update count
      const countEl = group.querySelector('.store-group-count');
      countEl.textContent = visibleCount;
    }
  });
}

/**
 * Create a product list item
 */
function createProductItem(productId, product) {
  const div = document.createElement('div');
  div.className = 'product-item';
  div.dataset.productId = productId;

  // Product image
  const img = document.createElement('img');
  img.src = '../assets/icons/icon-48.png'; // Default placeholder

  // Load image from separate storage if available
  if (product.hasImage) {
    const imageKey = `img_${productId}`;
    browser.storage.local.get(imageKey).then(result => {
      if (result[imageKey]) {
        img.src = result[imageKey];
      }
    }).catch(error => {
      console.error('[PriceHistory] Error loading image:', error);
      // Keep placeholder on error
    });
  }

  img.onerror = () => {
    img.src = '../assets/icons/icon-48.png';
  };

  // Product content
  const content = document.createElement('div');
  content.className = 'product-item-content';

  // Product info (title + domain)
  const info = document.createElement('div');
  info.className = 'product-item-info';

  const title = document.createElement('div');
  title.className = 'product-item-title';
  title.textContent = product.title || 'Unknown Product';

  const domain = document.createElement('div');
  domain.className = 'product-item-domain';
  domain.textContent = product.domain || '';

  info.appendChild(title);
  info.appendChild(domain);

  // Product price
  const price = document.createElement('div');
  price.className = 'product-item-price';
  price.textContent = product.price?.formatted || 'N/A';

  content.appendChild(info);
  content.appendChild(price);

  div.appendChild(img);
  div.appendChild(content);

  // Click handler
  div.addEventListener('click', () => {
    selectProduct(productId);
  });

  return div;
}

/**
 * Select a product and display its chart
 */
function selectProduct(productId) {
  selectedProductId = productId;
  const product = allProducts[productId];

  if (!product) {
    debugError('[Price History] Product not found:', productId);
    return;
  }

  // Update UI - highlight selected product
  document.querySelectorAll('.product-item').forEach(item => {
    if (item.dataset.productId === productId) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });

  // Show chart section
  document.getElementById('chartSection').style.display = 'block';

  // Render chart
  renderChart(product);
  renderStats(product);

  debug('[Price History] Selected product:', product.title);
}

/**
 * Render price history chart
 */
async function renderChart(product) {
  const priceHistory = product.priceHistory || [];

  if (priceHistory.length === 0) {
    // No history - show current price only
    priceHistory.push({
      price: product.price.numeric,
      currency: product.price.currency,
      timestamp: product.tracking?.firstSeen || Date.now()
    });
  }

  // Prepare chart data
  const labels = priceHistory.map(entry => {
    const date = new Date(entry.timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  const prices = priceHistory.map(entry => entry.price);

  // Update chart title
  const chartTitle = document.getElementById('chartTitle');
  chartTitle.textContent = `${product.title.substring(0, 60)}${product.title.length > 60 ? '...' : ''}`;

  // Get current theme for chart colors
  const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
  const textColor = isDarkMode ? '#f9fafb' : '#111827';
  const gridColor = isDarkMode ? '#374151' : '#e5e7eb';
  const lineColor = '#2563eb';
  const fillColor = isDarkMode ? 'rgba(37, 99, 235, 0.1)' : 'rgba(37, 99, 235, 0.05)';

  // Destroy existing chart if any
  if (currentChart) {
    currentChart.destroy();
  }

  // Check if Chart.js is loaded (defensive check for slow connections)
  if (!window.Chart) {
    console.error('[PriceHistory] Chart.js is not loaded yet, waiting...');
    // Wait for it to load (up to 5 seconds)
    await new Promise((resolve) => {
      let attempts = 0;
      const checkChart = setInterval(() => {
        if (window.Chart || attempts++ > 50) {
          clearInterval(checkChart);
          resolve();
        }
      }, 100);
    });
  }

  if (!window.Chart) {
    console.error('[PriceHistory] Cannot render chart - Chart.js not available after timeout');
    // Show error message to user
    const chartWrapper = document.querySelector('.chart-wrapper');
    if (chartWrapper) {
      chartWrapper.innerHTML = `
        <div style="text-align: center; padding: 64px 24px; color: #dc2626;">
          <p style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">⚠️ Chart Library Failed to Load</p>
          <p style="color: #6b7280;">Please refresh the page or check your internet connection.</p>
        </div>
      `;
    }
    return;
  }

  // Create new chart
  // Chart.js is loaded via script tag and attached to window
  const ctx = document.getElementById('priceChart').getContext('2d');
  currentChart = new window.Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: `Price (${product.price.currency})`,
        data: prices,
        borderColor: lineColor,
        backgroundColor: fillColor,
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: lineColor,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
          titleColor: textColor,
          bodyColor: textColor,
          borderColor: gridColor,
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return `${product.price.symbol}${context.parsed.y.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            color: textColor,
            callback: function(value) {
              return product.price.symbol + value.toFixed(2);
            }
          },
          grid: {
            color: gridColor
          }
        },
        x: {
          ticks: {
            color: textColor,
            maxRotation: 45,
            minRotation: 0
          },
          grid: {
            color: gridColor
          }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    }
  });
}

/**
 * Render price statistics
 */
function renderStats(product) {
  const priceHistory = product.priceHistory || [];
  const currentPriceValue = product.price.numeric;
  const symbol = product.price.symbol || '$';

  // Calculate stats
  let lowestPrice = currentPriceValue;
  let highestPrice = currentPriceValue;
  let totalPrice = currentPriceValue;
  let count = 1;

  if (priceHistory.length > 0) {
    priceHistory.forEach(entry => {
      const price = entry.price;
      if (price < lowestPrice) lowestPrice = price;
      if (price > highestPrice) highestPrice = price;
      totalPrice += price;
      count++;
    });
  }

  const averagePrice = totalPrice / count;
  const firstPrice = priceHistory.length > 0 ? priceHistory[0].price : currentPriceValue;
  const priceChange = currentPriceValue - firstPrice;
  const priceChangePercent = firstPrice > 0 ? (priceChange / firstPrice) * 100 : 0;

  // Update UI
  document.getElementById('currentPrice').textContent = `${symbol}${currentPriceValue.toFixed(2)}`;
  document.getElementById('lowestPrice').textContent = `${symbol}${lowestPrice.toFixed(2)}`;
  document.getElementById('highestPrice').textContent = `${symbol}${highestPrice.toFixed(2)}`;
  document.getElementById('averagePrice').textContent = `${symbol}${averagePrice.toFixed(2)}`;

  const priceChangeEl = document.getElementById('priceChange');
  const changeSign = priceChange >= 0 ? '+' : '';
  priceChangeEl.textContent = `${changeSign}${symbol}${Math.abs(priceChange).toFixed(2)} (${changeSign}${priceChangePercent.toFixed(1)}%)`;

  // Color coding
  if (priceChange < 0) {
    priceChangeEl.className = 'stat-value positive'; // Price drop is good
  } else if (priceChange > 0) {
    priceChangeEl.className = 'stat-value negative'; // Price increase is bad
  } else {
    priceChangeEl.className = 'stat-value';
  }
}
