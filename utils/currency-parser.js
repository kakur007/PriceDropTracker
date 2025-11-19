/**
 * Currency Parser Module
 * Parses price strings in various formats and currencies
 * Handles multi-currency, multiple number formats, and ambiguous cases
 */

import {
  CURRENCIES,
  CURRENCY_SYMBOLS,
  DOMAIN_CURRENCY,
  LOCALE_CURRENCY,
  NUMBER_FORMATS
} from './currency-data.js';

/**
 * Main parsing function
 * @param {string} rawPriceString - The raw price text (e.g., "$99.99", "1.299,99 €")
 * @param {Object} contextData - Optional context information
 * @param {string} contextData.domain - Website domain (e.g., "amazon.co.uk")
 * @param {string} contextData.locale - Page locale (e.g., "en-GB")
 * @param {string} contextData.expectedCurrency - Expected currency code (e.g., "GBP")
 * @returns {Object|null} Parsed price object or null if parsing fails
 */
export function parsePrice(rawPriceString, contextData = {}) {
  // Handle null/undefined/empty input
  if (!rawPriceString || typeof rawPriceString !== 'string') {
    return null;
  }

  // Phase 1: Clean the price string
  const cleaned = cleanPriceString(rawPriceString);
  if (!cleaned) {
    return null;
  }

  // Handle special cases
  if (cleaned.toLowerCase() === 'free' || cleaned === '0') {
    return {
      numeric: 0,
      currency: contextData.expectedCurrency || 'USD',
      symbol: '$',
      formatted: 'FREE',
      raw: rawPriceString,
      locale: contextData.locale || 'en-US',
      confidence: 0.5,
      method: 'special'
    };
  }

  // Phase 2: Detect currency
  const currencyData = detectCurrency(cleaned, contextData);
  if (!currencyData) {
    return null;
  }

  // Phase 3: Parse the number
  const numericValue = parseNumber(cleaned, currencyData.code, contextData);
  if (numericValue === null || isNaN(numericValue) || numericValue < 0) {
    return null;
  }

  // Phase 4: Validate the result
  if (numericValue > 99999999) {
    // Price too high, likely parsing error
    return null;
  }

  // Phase 5: Calculate final confidence
  const confidence = calculateConfidence({
    detectionMethod: currencyData.method,
    detectionConfidence: currencyData.confidence,
    hasContext: !!(contextData.domain || contextData.locale),
    currencyMatches: contextData.expectedCurrency === currencyData.code,
    numericValid: numericValue > 0 && numericValue < 9999999
  });

  // Phase 6: Build result object
  const currency = CURRENCIES[currencyData.code];
  return {
    numeric: numericValue,
    currency: currencyData.code,
    symbol: currency?.symbol || currencyData.symbol,
    formatted: rawPriceString.trim(),
    raw: rawPriceString,
    locale: contextData.locale || guessLocale(contextData.domain, currencyData.code),
    confidence: confidence,
    method: currencyData.method
  };
}

/**
 * Clean and normalize the price string
 * @param {string} str - Raw price string
 * @returns {string|null} Cleaned string or null
 */
function cleanPriceString(str) {
  // Remove common price-related text and prefixes
  let cleaned = str
    .replace(/\bRRP\b:?/gi, '')      // Remove "RRP" (Recommended Retail Price) - Amazon UK issue
    .replace(/\bSRP\b:?/gi, '')      // Remove "SRP" (Suggested Retail Price)
    .replace(/\bMSRP\b:?/gi, '')     // Remove "MSRP" (Manufacturer's Suggested Retail Price)
    .replace(/price:/gi, '')
    .replace(/was:/gi, '')
    .replace(/now:/gi, '')
    .replace(/sale:/gi, '')
    .replace(/from:/gi, '')
    .replace(/only:/gi, '')
    .replace(/approximately/gi, '')  // Remove "approximately" (eBay conversion rates)
    .replace(/approx\.?/gi, '')      // Remove "approx" or "approx."
    .replace(/~\s*/g, '')            // Remove tilde used for approximate values
    .trim();

  // Handle non-breaking spaces
  cleaned = cleaned
    .replace(/\u00A0/g, ' ')
    .replace(/\u202F/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If it says "call for price" or similar, return null
  if (/call|contact|quote/i.test(cleaned)) {
    return null;
  }

  // Handle price ranges - take the lowest price
  if (cleaned.includes('-') || cleaned.includes('–')) {
    const parts = cleaned.split(/[-–]/);
    if (parts.length >= 2) {
      // Return the first price (lowest)
      cleaned = parts[0].trim();
    }
  }

  return cleaned || null;
}

/**
 * Detect currency from the price string
 * @param {string} str - Cleaned price string
 * @param {Object} context - Context data
 * @returns {Object|null} Currency detection result
 */
function detectCurrency(str, context) {
  // Method 1: ISO code detection (highest confidence)
  const isoCodes = Object.keys(CURRENCIES);
  const isoRegex = new RegExp(`\\b(${isoCodes.join('|')})\\b`, 'i');
  const isoMatch = str.match(isoRegex);

  if (isoMatch) {
    const code = isoMatch[1].toUpperCase();
    return {
      code: code,
      symbol: CURRENCIES[code].symbol,
      confidence: 0.95,
      method: 'iso_code'
    };
  }

  // Method 2: Symbol detection
  const symbolData = detectCurrencySymbol(str, context);
  if (symbolData) {
    return symbolData;
  }

  // Method 3: Domain-based fallback
  if (context.domain) {
    const domainCurrency = getDomainCurrency(context.domain);
    if (domainCurrency) {
      return {
        code: domainCurrency,
        symbol: CURRENCIES[domainCurrency].symbol,
        confidence: 0.70,
        method: 'domain'
      };
    }
  }

  // Method 4: Locale-based fallback
  if (context.locale) {
    const localeCurrency = LOCALE_CURRENCY[context.locale];
    if (localeCurrency) {
      return {
        code: localeCurrency,
        symbol: CURRENCIES[localeCurrency].symbol,
        confidence: 0.65,
        method: 'locale'
      };
    }
  }

  // Method 5: Expected currency fallback
  if (context.expectedCurrency && CURRENCIES[context.expectedCurrency]) {
    return {
      code: context.expectedCurrency,
      symbol: CURRENCIES[context.expectedCurrency].symbol,
      confidence: 0.60,
      method: 'expected'
    };
  }

  // Default to USD if nothing else works
  return {
    code: 'USD',
    symbol: '$',
    confidence: 0.50,
    method: 'default'
  };
}

/**
 * Detect currency from symbol
 * @param {string} str - Price string
 * @param {Object} context - Context data
 * @returns {Object|null} Symbol detection result
 */
function detectCurrencySymbol(str, context) {
  // Define priority order - check stronger/more specific symbols first
  const prioritySymbols = ['£', '€', '₹', '¥', '₩', '฿', '₱', '₽', '₴', '₪', '₺', '₫', '﷼'];
  const weakSymbols = ['R', 'kr']; // Ambiguous symbols that need context

  // Check priority symbols first
  for (const symbol of prioritySymbols) {
    if (str.includes(symbol) && CURRENCY_SYMBOLS[symbol]) {
      const currencies = CURRENCY_SYMBOLS[symbol];
      if (currencies.length === 1) {
        return {
          code: currencies[0],
          symbol: symbol,
          confidence: 0.90,
          method: 'symbol'
        };
      }
      // Multiple possibilities - need to disambiguate
      const disambiguated = disambiguateCurrency(currencies, context);
      return {
        code: disambiguated,
        symbol: symbol,
        confidence: context.domain || context.locale ? 0.85 : 0.75,
        method: 'symbol_disambiguated'
      };
    }
  }

  // Check dollar sign (common but ambiguous)
  if (str.includes('$')) {
    const currencies = CURRENCY_SYMBOLS['$'];
    const disambiguated = disambiguateCurrency(currencies, context);
    return {
      code: disambiguated,
      symbol: '$',
      confidence: context.domain || context.locale ? 0.85 : 0.75,
      method: 'symbol_disambiguated'
    };
  }

  // Check multi-character symbols (more specific)
  if (str.includes('R$')) {
    return {
      code: 'BRL',
      symbol: 'R$',
      confidence: 0.90,
      method: 'symbol'
    };
  }

  if (str.includes('Rp')) {
    return {
      code: 'IDR',
      symbol: 'Rp',
      confidence: 0.90,
      method: 'symbol'
    };
  }

  if (str.includes('RM')) {
    return {
      code: 'MYR',
      symbol: 'RM',
      confidence: 0.90,
      method: 'symbol'
    };
  }

  // Check weak symbols only if we have strong context and they appear at start
  for (const symbol of weakSymbols) {
    // For 'R', only match if it appears at the beginning followed by digit/space
    if (symbol === 'R') {
      const rMatch = str.match(/\bR\s*\d/);
      if (rMatch && context.domain) {
        // Check if domain suggests ZAR (South Africa)
        if (context.domain.includes('.za') || context.expectedCurrency === 'ZAR') {
          return {
            code: 'ZAR',
            symbol: 'R',
            confidence: 0.80,
            method: 'symbol_contextual'
          };
        }
      }
      // Don't match 'R' without strong context
      continue;
    }

    // For other weak symbols, check with lower confidence
    if (str.includes(symbol) && CURRENCY_SYMBOLS[symbol]) {
      const currencies = CURRENCY_SYMBOLS[symbol];
      const disambiguated = disambiguateCurrency(currencies, context);
      return {
        code: disambiguated,
        symbol: symbol,
        confidence: context.domain || context.locale ? 0.75 : 0.65,
        method: 'symbol_weak'
      };
    }
  }

  return null;
}

/**
 * Disambiguate between multiple possible currencies
 * @param {string[]} currencies - Possible currency codes
 * @param {Object} context - Context data
 * @returns {string} Most likely currency code
 */
function disambiguateCurrency(currencies, context) {
  // Use domain to disambiguate
  if (context.domain) {
    const domainCurrency = getDomainCurrency(context.domain);
    if (domainCurrency && currencies.includes(domainCurrency)) {
      return domainCurrency;
    }
  }

  // Use locale to disambiguate
  if (context.locale) {
    const localeCurrency = LOCALE_CURRENCY[context.locale];
    if (localeCurrency && currencies.includes(localeCurrency)) {
      return localeCurrency;
    }
  }

  // Use expected currency
  if (context.expectedCurrency && currencies.includes(context.expectedCurrency)) {
    return context.expectedCurrency;
  }

  // Return first option (usually most common)
  return currencies[0];
}

/**
 * Get currency from domain TLD
 * @param {string} domain - Domain name
 * @returns {string|null} Currency code
 */
function getDomainCurrency(domain) {
  // Check for exact matches first (e.g., amazon.co.uk)
  for (const [tld, currency] of Object.entries(DOMAIN_CURRENCY)) {
    if (domain.endsWith(tld)) {
      return currency;
    }
  }
  return null;
}

/**
 * Parse numeric value from string
 * @param {string} str - Price string
 * @param {string} currencyCode - Detected currency code
 * @param {Object} context - Context data
 * @returns {number|null} Parsed number
 */
function parseNumber(str, currencyCode, context) {
  // Remove currency symbols and codes
  let numStr = str;

  // Remove ISO codes
  numStr = numStr.replace(/\b[A-Z]{3}\b/g, '');

  // Remove all currency symbols
  for (const symbol of Object.keys(CURRENCY_SYMBOLS)) {
    numStr = numStr.replace(new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
  }

  // Remove any remaining letters
  numStr = numStr.replace(/[a-zA-Z]/g, '');

  // Trim
  numStr = numStr.trim();

  // Now we should have only digits and separators
  // Identify separators
  const hasComma = numStr.includes(',');
  const hasPeriod = numStr.includes('.');
  const hasSpace = numStr.includes(' ');

  // Get currency info
  const currency = CURRENCIES[currencyCode];
  const hasDecimals = currency && currency.decimals > 0;

  // Determine decimal separator
  let decimalSeparator = '.';
  let thousandsSeparator = ',';

  // Try to use locale format if available
  if (context.locale && NUMBER_FORMATS[context.locale]) {
    decimalSeparator = NUMBER_FORMATS[context.locale].decimal;
    thousandsSeparator = NUMBER_FORMATS[context.locale].thousands;
  } else {
    // Smart detection based on separators
    if (hasComma && hasPeriod) {
      // Both present - last one is decimal
      const lastComma = numStr.lastIndexOf(',');
      const lastPeriod = numStr.lastIndexOf('.');

      if (lastPeriod > lastComma) {
        decimalSeparator = '.';
        thousandsSeparator = ',';
      } else {
        decimalSeparator = ',';
        thousandsSeparator = '.';
      }
    } else if (hasComma && !hasPeriod) {
      // Only comma - could be thousands or decimal
      const parts = numStr.split(',');
      if (parts.length === 2 && parts[1].length === 2) {
        // Format like "99,99" - comma is decimal
        decimalSeparator = ',';
        thousandsSeparator = '.';
      } else {
        // Format like "9,999" - comma is thousands
        decimalSeparator = '.';
        thousandsSeparator = ',';
      }
    } else if (!hasComma && hasPeriod) {
      // Only period - could be thousands or decimal
      const parts = numStr.split('.');
      if (parts.length === 2 && parts[1].length <= 2) {
        // Format like "99.99" - period is decimal
        decimalSeparator = '.';
        thousandsSeparator = ',';
      } else {
        // Format like "9.999" - period is thousands
        decimalSeparator = ',';
        thousandsSeparator = '.';
      }
    } else if (hasSpace) {
      // Space is thousands separator (Nordic/French)
      decimalSeparator = ',';
      thousandsSeparator = ' ';
    }
  }

  // For currencies without decimals, there is no decimal separator
  if (!hasDecimals) {
    thousandsSeparator = hasComma ? ',' : (hasPeriod ? '.' : (hasSpace ? ' ' : ''));
    decimalSeparator = null;
  }

  // Clean the number string
  // Remove thousands separators
  if (thousandsSeparator) {
    numStr = numStr.replace(new RegExp('\\' + thousandsSeparator, 'g'), '');
  }

  // Replace decimal separator with period
  if (decimalSeparator && decimalSeparator !== '.') {
    numStr = numStr.replace(decimalSeparator, '.');
  }

  // Remove any remaining spaces
  numStr = numStr.replace(/\s/g, '');

  // Parse as float
  const value = parseFloat(numStr);

  // Validate
  if (isNaN(value) || value < 0) {
    return null;
  }

  // Round to appropriate decimal places
  const decimals = currency?.decimals ?? 2;
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Calculate final confidence score
 * @param {Object} data - Detection data
 * @returns {number} Confidence score (0-1)
 */
function calculateConfidence(data) {
  let confidence = data.detectionConfidence || 0.5;

  // Boost confidence if context confirms
  if (data.hasContext) {
    confidence += 0.05;
  }

  if (data.currencyMatches) {
    confidence += 0.05;
  }

  // Reduce confidence for edge cases
  if (!data.numericValid) {
    confidence -= 0.15;
  }

  // Clamp between 0 and 1
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Guess locale from domain and currency
 * @param {string} domain - Domain name
 * @param {string} currencyCode - Currency code
 * @returns {string} Locale code
 */
function guessLocale(domain, currencyCode) {
  // Try to match domain to locale
  if (domain) {
    if (domain.includes('.co.uk') || domain.includes('.uk')) return 'en-GB';
    if (domain.includes('.de')) return 'de-DE';
    if (domain.includes('.fr')) return 'fr-FR';
    if (domain.includes('.es')) return 'es-ES';
    if (domain.includes('.it')) return 'it-IT';
    if (domain.includes('.ca')) return domain.includes('amazon') ? 'en-CA' : 'fr-CA';
    if (domain.includes('.com.au') || domain.includes('.au')) return 'en-AU';
    if (domain.includes('.co.jp') || domain.includes('.jp')) return 'ja-JP';
    if (domain.includes('.in')) return 'en-IN';
    if (domain.includes('.com.br') || domain.includes('.br')) return 'pt-BR';
  }

  // Fallback to currency-based guess
  const currencyToLocale = {
    'USD': 'en-US',
    'CAD': 'en-CA',
    'GBP': 'en-GB',
    'EUR': 'de-DE',
    'JPY': 'ja-JP',
    'CNY': 'zh-CN',
    'KRW': 'ko-KR',
    'INR': 'en-IN',
    'AUD': 'en-AU',
    'NZD': 'en-NZ',
    'SGD': 'en-SG',
    'HKD': 'en-HK',
    'MXN': 'es-MX',
    'BRL': 'pt-BR',
    'SEK': 'sv-SE',
    'NOK': 'nb-NO',
    'DKK': 'da-DK',
    'PLN': 'pl-PL',
    'RUB': 'ru-RU',
    'TRY': 'tr-TR'
  };

  return currencyToLocale[currencyCode] || 'en-US';
}
