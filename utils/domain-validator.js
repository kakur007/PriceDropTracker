/**
 * Domain Validator - Check if domains are supported by the extension
 *
 * Maintains a list of supported e-commerce domains that the extension
 * has host permissions for in manifest.json
 */

/**
 * List of supported domains (must match manifest.json host_permissions)
 */
const SUPPORTED_DOMAINS = [
  // Amazon
  'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.it',
  'amazon.es', 'amazon.ca', 'amazon.com.au', 'amazon.co.jp', 'amazon.in',
  'amazon.com.mx', 'amazon.com.br', 'amazon.nl', 'amazon.se',

  // eBay
  'ebay.com', 'ebay.co.uk', 'ebay.de', 'ebay.fr', 'ebay.it',
  'ebay.es', 'ebay.ca', 'ebay.com.au',

  // Major US Retailers
  'walmart.com', 'target.com', 'bestbuy.com',

  // Other E-commerce
  'etsy.com', 'aliexpress.com', 'newegg.com', 'costco.com',
  'homedepot.com', 'lowes.com', 'wayfair.com', 'overstock.com',

  // Shopify stores (generic)
  'myshopify.com'
];

/**
 * Extract domain from URL
 * @param {string} url - Full URL
 * @returns {string|null} - Domain or null if invalid
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase();
  } catch (error) {
    console.error('[DomainValidator] Invalid URL:', url, error);
    return null;
  }
}

/**
 * Check if a domain is supported
 * @param {string} domain - Domain to check (e.g., 'amazon.com' or 'www.amazon.com')
 * @returns {boolean} - True if supported
 */
function isDomainSupported(domain) {
  if (!domain) return false;

  // Remove 'www.' prefix if present
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();

  // Check exact match
  if (SUPPORTED_DOMAINS.includes(cleanDomain)) {
    return true;
  }

  // Check if it's a subdomain of a supported domain
  for (const supportedDomain of SUPPORTED_DOMAINS) {
    if (cleanDomain.endsWith('.' + supportedDomain) || cleanDomain === supportedDomain) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a URL is from a supported domain
 * @param {string} url - Full URL to check
 * @returns {boolean} - True if URL is from a supported domain
 */
function isUrlSupported(url) {
  const domain = extractDomain(url);
  if (!domain) return false;

  return isDomainSupported(domain);
}

/**
 * Get user-friendly store name from domain
 * @param {string} domain - Domain name
 * @returns {string} - Friendly store name
 */
function getStoreName(domain) {
  if (!domain) return 'Unknown Store';

  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();

  // Map domains to friendly names
  if (cleanDomain.includes('amazon')) return 'Amazon';
  if (cleanDomain.includes('ebay')) return 'eBay';
  if (cleanDomain.includes('walmart')) return 'Walmart';
  if (cleanDomain.includes('target')) return 'Target';
  if (cleanDomain.includes('bestbuy')) return 'Best Buy';
  if (cleanDomain.includes('etsy')) return 'Etsy';
  if (cleanDomain.includes('aliexpress')) return 'AliExpress';
  if (cleanDomain.includes('newegg')) return 'Newegg';
  if (cleanDomain.includes('costco')) return 'Costco';
  if (cleanDomain.includes('homedepot')) return 'Home Depot';
  if (cleanDomain.includes('lowes')) return "Lowe's";
  if (cleanDomain.includes('wayfair')) return 'Wayfair';
  if (cleanDomain.includes('overstock')) return 'Overstock';
  if (cleanDomain.includes('myshopify')) return 'Shopify Store';

  // Fallback: capitalize first letter of domain
  return cleanDomain.split('.')[0].charAt(0).toUpperCase() + cleanDomain.split('.')[0].slice(1);
}

/**
 * Get list of all supported stores for display
 * @returns {string[]} - Array of supported store names
 */
function getSupportedStoresList() {
  return [
    'Amazon (all regions)',
    'eBay (all regions)',
    'Walmart',
    'Target',
    'Best Buy',
    'Etsy',
    'AliExpress',
    'Newegg',
    'Costco',
    'Home Depot',
    "Lowe's",
    'Wayfair',
    'Overstock',
    'Shopify Stores'
  ];
}

/**
 * Validate URL and provide detailed error if unsupported
 * @param {string} url - URL to validate
 * @returns {Object} - { valid: boolean, error?: string, domain?: string }
 */
function validateUrl(url) {
  const domain = extractDomain(url);

  if (!domain) {
    return {
      valid: false,
      error: 'Invalid URL format'
    };
  }

  if (!isDomainSupported(domain)) {
    return {
      valid: false,
      error: `${getStoreName(domain)} (${domain}) is not currently supported`,
      domain,
      supportedStores: getSupportedStoresList()
    };
  }

  return {
    valid: true,
    domain,
    storeName: getStoreName(domain)
  };
}

// Export functions
export {
  SUPPORTED_DOMAINS,
  extractDomain,
  isDomainSupported,
  isUrlSupported,
  getStoreName,
  getSupportedStoresList,
  validateUrl
};
