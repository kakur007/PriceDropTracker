import { debug, debugError } from '../utils/debug.js';

let allProducts = {};
let selectedProductId = null;
let currentChart = null;

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
  // Apply dark mode based on user preference
  applyTheme();

  await loadProducts();
});

/**
 * Apply theme (dark/light mode)
 */
function applyTheme() {
  chrome.storage.local.get(['theme'], (result) => {
    const theme = result.theme || 'light';
    document.body.setAttribute('data-theme', theme);
  });
}

/**
 * Load all tracked products
 */
async function loadProducts() {
  try {
    const result = await chrome.storage.local.get(['products']);
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

    // Render product list
    productListEl.innerHTML = '';
    productIds.forEach(productId => {
      const product = products[productId];
      const productItem = createProductItem(productId, product);
      productListEl.appendChild(productItem);
    });

    debug('[Price History]', `Loaded ${productIds.length} products`);
  } catch (error) {
    debugError('[Price History] Error loading products:', error);
  }
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
  if (product.imageUrl) {
    img.src = product.imageUrl;
    img.onerror = () => {
      img.src = '../assets/icons/icon-48.png';
    };
  } else {
    img.src = '../assets/icons/icon-48.png';
  }

  // Product content
  const content = document.createElement('div');
  content.className = 'product-item-content';

  const title = document.createElement('div');
  title.className = 'product-item-title';
  title.textContent = product.title || 'Unknown Product';

  const price = document.createElement('div');
  price.className = 'product-item-price';
  price.textContent = product.price?.formatted || 'N/A';

  content.appendChild(title);
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
function renderChart(product) {
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

  // Create new chart
  const ctx = document.getElementById('priceChart').getContext('2d');
  currentChart = new Chart(ctx, {
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
