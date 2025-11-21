/**
 * Currency Data Module
 * Comprehensive currency definitions, symbols, and mappings for multi-currency support
 * Supports 30+ major world currencies
 */

/**
 * Main currency definitions
 * Contains display symbol, full name, decimal places, and format preference
 */
export const CURRENCIES = {
  // Americas
  USD: {
    symbol: '$',
    name: 'US Dollar',
    decimals: 2,
    format: 'symbol_value' // $99.99
  },
  CAD: {
    symbol: '$',
    name: 'Canadian Dollar',
    decimals: 2,
    format: 'symbol_value' // $99.99
  },
  MXN: {
    symbol: '$',
    name: 'Mexican Peso',
    decimals: 2,
    format: 'symbol_value' // $99.99
  },
  BRL: {
    symbol: 'R$',
    name: 'Brazilian Real',
    decimals: 2,
    format: 'symbol_value' // R$99,99
  },

  // Europe
  EUR: {
    symbol: '€',
    name: 'Euro',
    decimals: 2,
    format: 'value_symbol' // 99,99 €
  },
  GBP: {
    symbol: '£',
    name: 'British Pound',
    decimals: 2,
    format: 'symbol_value' // £99.99
  },
  CHF: {
    symbol: 'CHF',
    name: 'Swiss Franc',
    decimals: 2,
    format: 'symbol_value' // CHF 99.99
  },
  SEK: {
    symbol: 'kr',
    name: 'Swedish Krona',
    decimals: 2,
    format: 'value_symbol' // 99,99 kr
  },
  NOK: {
    symbol: 'kr',
    name: 'Norwegian Krone',
    decimals: 2,
    format: 'value_symbol' // 99,99 kr
  },
  DKK: {
    symbol: 'kr',
    name: 'Danish Krone',
    decimals: 2,
    format: 'value_symbol' // 99,99 kr
  },
  PLN: {
    symbol: 'zł',
    name: 'Polish Zloty',
    decimals: 2,
    format: 'value_symbol' // 99,99 zł
  },
  CZK: {
    symbol: 'Kč',
    name: 'Czech Koruna',
    decimals: 2,
    format: 'value_symbol' // 99,99 Kč
  },
  HUF: {
    symbol: 'Ft',
    name: 'Hungarian Forint',
    decimals: 0, // No decimals
    format: 'value_symbol' // 9999 Ft
  },
  RON: {
    symbol: 'lei',
    name: 'Romanian Leu',
    decimals: 2,
    format: 'value_symbol' // 99,99 lei
  },
  BGN: {
    symbol: 'лв',
    name: 'Bulgarian Lev',
    decimals: 2,
    format: 'value_symbol' // 99,99 лв
  },

  // Asia-Pacific
  JPY: {
    symbol: '¥',
    name: 'Japanese Yen',
    decimals: 0, // No decimals
    format: 'symbol_value' // ¥9,999
  },
  CNY: {
    symbol: '¥',
    name: 'Chinese Yuan',
    decimals: 2,
    format: 'symbol_value' // ¥99.99
  },
  KRW: {
    symbol: '₩',
    name: 'South Korean Won',
    decimals: 0, // No decimals
    format: 'symbol_value' // ₩9,999
  },
  INR: {
    symbol: '₹',
    name: 'Indian Rupee',
    decimals: 2,
    format: 'symbol_value' // ₹99.99
  },
  AUD: {
    symbol: '$',
    name: 'Australian Dollar',
    decimals: 2,
    format: 'symbol_value' // $99.99
  },
  NZD: {
    symbol: '$',
    name: 'New Zealand Dollar',
    decimals: 2,
    format: 'symbol_value' // $99.99
  },
  SGD: {
    symbol: '$',
    name: 'Singapore Dollar',
    decimals: 2,
    format: 'symbol_value' // $99.99
  },
  HKD: {
    symbol: '$',
    name: 'Hong Kong Dollar',
    decimals: 2,
    format: 'symbol_value' // $99.99
  },
  THB: {
    symbol: '฿',
    name: 'Thai Baht',
    decimals: 2,
    format: 'symbol_value' // ฿99.99
  },
  PHP: {
    symbol: '₱',
    name: 'Philippine Peso',
    decimals: 2,
    format: 'symbol_value' // ₱99.99
  },
  IDR: {
    symbol: 'Rp',
    name: 'Indonesian Rupiah',
    decimals: 0, // Often no decimals
    format: 'symbol_value' // Rp9,999
  },
  MYR: {
    symbol: 'RM',
    name: 'Malaysian Ringgit',
    decimals: 2,
    format: 'symbol_value' // RM99.99
  },
  VND: {
    symbol: '₫',
    name: 'Vietnamese Dong',
    decimals: 0, // No decimals
    format: 'value_symbol' // 99,999 ₫
  },

  // Eastern Europe
  RUB: {
    symbol: '₽',
    name: 'Russian Ruble',
    decimals: 2,
    format: 'value_symbol' // 99,99 ₽
  },
  UAH: {
    symbol: '₴',
    name: 'Ukrainian Hryvnia',
    decimals: 2,
    format: 'value_symbol' // 99,99 ₴
  },

  // Middle East
  AED: {
    symbol: 'د.إ',
    name: 'UAE Dirham',
    decimals: 2,
    format: 'symbol_value' // د.إ 99.99
  },
  SAR: {
    symbol: '﷼',
    name: 'Saudi Riyal',
    decimals: 2,
    format: 'symbol_value' // ﷼99.99
  },
  ILS: {
    symbol: '₪',
    name: 'Israeli Shekel',
    decimals: 2,
    format: 'symbol_value' // ₪99.99
  },

  // Africa
  ZAR: {
    symbol: 'R',
    name: 'South African Rand',
    decimals: 2,
    format: 'symbol_value' // R99.99
  },
  EGP: {
    symbol: '£',
    name: 'Egyptian Pound',
    decimals: 2,
    format: 'symbol_value' // £99.99
  },

  // Other
  TRY: {
    symbol: '₺',
    name: 'Turkish Lira',
    decimals: 2,
    format: 'symbol_value' // ₺99,99
  }
};

/**
 * Currency symbol to currency code mapping
 * Note: Some symbols are ambiguous and map to multiple currencies
 * Context (domain, locale) should be used to disambiguate
 */
export const CURRENCY_SYMBOLS = {
  // Dollar sign - highly ambiguous!
  '$': ['USD', 'CAD', 'AUD', 'NZD', 'SGD', 'HKD', 'MXN'],
  'USD': ['USD'],  // ISO code
  'CAD': ['CAD'],  // ISO code
  'AUD': ['AUD'],  // ISO code
  'NZD': ['NZD'],  // ISO code
  'SGD': ['SGD'],  // ISO code
  'HKD': ['HKD'],  // ISO code
  'MXN': ['MXN'],  // ISO code

  // Yen - ambiguous between Japan and China
  '¥': ['JPY', 'CNY'],
  'JPY': ['JPY'],  // ISO code
  'CNY': ['CNY'],  // ISO code

  // Euro - unambiguous
  '€': ['EUR'],
  'EUR': ['EUR'],  // ISO code

  // Pound - ambiguous between UK and Egypt
  '£': ['GBP', 'EGP'],
  'GBP': ['GBP'],  // ISO code

  // Krona/Krone - ambiguous between Nordic countries
  'kr': ['SEK', 'NOK', 'DKK'],
  'SEK': ['SEK'],
  'NOK': ['NOK'],
  'DKK': ['DKK'],

  // R - ambiguous
  'R': ['ZAR'],
  'R$': ['BRL'],

  // Won
  '₩': ['KRW'],

  // Rupee
  '₹': ['INR'],

  // Baht
  '฿': ['THB'],

  // Peso
  '₱': ['PHP'],

  // Rupiah
  'Rp': ['IDR'],

  // Ringgit
  'RM': ['MYR'],

  // Dong
  '₫': ['VND'],

  // Ruble
  '₽': ['RUB'],

  // Hryvnia
  '₴': ['UAH'],

  // Zloty
  'zł': ['PLN'],

  // Koruna
  'Kč': ['CZK'],

  // Forint
  'Ft': ['HUF'],

  // Leu
  'lei': ['RON'],

  // Lev
  'лв': ['BGN'],
  'lv': ['BGN'],

  // Swiss Franc
  'CHF': ['CHF'],

  // Dirham
  'د.إ': ['AED'],

  // Riyal
  '﷼': ['SAR'],

  // Shekel
  '₪': ['ILS'],

  // Lira
  '₺': ['TRY']
};

/**
 * Domain TLD to currency mapping
 * Used as fallback when currency cannot be determined from symbols
 */
export const DOMAIN_CURRENCY = {
  // Generic
  '.com': 'USD',

  // Americas
  '.us': 'USD',
  '.ca': 'CAD',
  '.mx': 'MXN',
  '.com.br': 'BRL',
  '.br': 'BRL',

  // Europe
  '.co.uk': 'GBP',
  '.uk': 'GBP',
  '.de': 'EUR',
  '.fr': 'EUR',
  '.es': 'EUR',
  '.it': 'EUR',
  '.nl': 'EUR',
  '.be': 'EUR',
  '.at': 'EUR',
  '.pt': 'EUR',
  '.ie': 'EUR',
  '.fi': 'EUR',
  '.gr': 'EUR',
  '.ee': 'EUR',  // Estonia
  '.lv': 'EUR',  // Latvia
  '.lt': 'EUR',  // Lithuania
  '.sk': 'EUR',  // Slovakia
  '.si': 'EUR',  // Slovenia
  '.cy': 'EUR',  // Cyprus
  '.mt': 'EUR',  // Malta
  '.lu': 'EUR',  // Luxembourg
  '.ch': 'CHF',
  '.se': 'SEK',
  '.no': 'NOK',
  '.dk': 'DKK',
  '.pl': 'PLN',
  '.cz': 'CZK',
  '.hu': 'HUF',
  '.ro': 'RON',
  '.bg': 'BGN',  // Bulgaria (Lev, not EUR yet but common in EU)

  // Asia-Pacific
  '.co.jp': 'JPY',
  '.jp': 'JPY',
  '.cn': 'CNY',
  '.com.cn': 'CNY',
  '.kr': 'KRW',
  '.co.kr': 'KRW',
  '.in': 'INR',
  '.com.au': 'AUD',
  '.au': 'AUD',
  '.co.nz': 'NZD',
  '.nz': 'NZD',
  '.sg': 'SGD',
  '.com.sg': 'SGD',
  '.hk': 'HKD',
  '.com.hk': 'HKD',
  '.th': 'THB',
  '.co.th': 'THB',
  '.ph': 'PHP',
  '.com.ph': 'PHP',
  '.id': 'IDR',
  '.co.id': 'IDR',
  '.my': 'MYR',
  '.com.my': 'MYR',
  '.vn': 'VND',
  '.com.vn': 'VND',

  // Eastern Europe
  '.ru': 'RUB',
  '.ua': 'UAH',

  // Middle East
  '.ae': 'AED',
  '.sa': 'SAR',
  '.il': 'ILS',

  // Africa
  '.za': 'ZAR',
  '.co.za': 'ZAR',
  '.eg': 'EGP',

  // Other
  '.tr': 'TRY'
};

/**
 * Locale code to currency mapping
 * Used as fallback when domain is ambiguous (e.g., .com)
 */
export const LOCALE_CURRENCY = {
  // Americas
  'en-US': 'USD',
  'en-CA': 'CAD',
  'fr-CA': 'CAD',
  'es-MX': 'MXN',
  'pt-BR': 'BRL',

  // Europe
  'en-GB': 'GBP',
  'de-DE': 'EUR',
  'fr-FR': 'EUR',
  'es-ES': 'EUR',
  'it-IT': 'EUR',
  'nl-NL': 'EUR',
  'nl-BE': 'EUR',
  'fr-BE': 'EUR',
  'de-AT': 'EUR',
  'pt-PT': 'EUR',
  'en-IE': 'EUR',
  'fi-FI': 'EUR',
  'el-GR': 'EUR',
  'et-EE': 'EUR',  // Estonian
  'lv-LV': 'EUR',  // Latvian
  'lt-LT': 'EUR',  // Lithuanian
  'sk-SK': 'EUR',  // Slovak
  'sl-SI': 'EUR',  // Slovenian
  'el-CY': 'EUR',  // Greek (Cyprus)
  'tr-CY': 'EUR',  // Turkish (Cyprus)
  'mt-MT': 'EUR',  // Maltese
  'lb-LU': 'EUR',  // Luxembourgish
  'de-LU': 'EUR',  // German (Luxembourg)
  'fr-LU': 'EUR',  // French (Luxembourg)
  'bg-BG': 'BGN',  // Bulgarian
  'de-CH': 'CHF',
  'fr-CH': 'CHF',
  'it-CH': 'CHF',
  'sv-SE': 'SEK',
  'nb-NO': 'NOK',
  'da-DK': 'DKK',
  'pl-PL': 'PLN',
  'cs-CZ': 'CZK',
  'hu-HU': 'HUF',
  'ro-RO': 'RON',

  // Asia-Pacific
  'ja-JP': 'JPY',
  'zh-CN': 'CNY',
  'ko-KR': 'KRW',
  'hi-IN': 'INR',
  'en-IN': 'INR',
  'en-AU': 'AUD',
  'en-NZ': 'NZD',
  'en-SG': 'SGD',
  'zh-HK': 'HKD',
  'en-HK': 'HKD',
  'th-TH': 'THB',
  'fil-PH': 'PHP',
  'en-PH': 'PHP',
  'id-ID': 'IDR',
  'ms-MY': 'MYR',
  'vi-VN': 'VND',

  // Eastern Europe
  'ru-RU': 'RUB',
  'uk-UA': 'UAH',

  // Middle East
  'ar-AE': 'AED',
  'ar-SA': 'SAR',
  'he-IL': 'ILS',
  'ar-IL': 'ILS',

  // Africa
  'en-ZA': 'ZAR',
  'ar-EG': 'EGP',

  // Other
  'tr-TR': 'TRY'
};

/**
 * Number formatting rules by locale
 * Different locales use different separators for thousands and decimals
 */
export const NUMBER_FORMATS = {
  // US/UK format: 1,299.99 (comma = thousands, period = decimal)
  'en-US': { decimal: '.', thousands: ',' },
  'en-GB': { decimal: '.', thousands: ',' },
  'en-AU': { decimal: '.', thousands: ',' },
  'en-NZ': { decimal: '.', thousands: ',' },
  'en-CA': { decimal: '.', thousands: ',' },
  'en-IN': { decimal: '.', thousands: ',' },
  'en-SG': { decimal: '.', thousands: ',' },
  'en-HK': { decimal: '.', thousands: ',' },
  'en-PH': { decimal: '.', thousands: ',' },
  'en-ZA': { decimal: '.', thousands: ',' },
  'ja-JP': { decimal: '.', thousands: ',' },
  'zh-CN': { decimal: '.', thousands: ',' },
  'ko-KR': { decimal: '.', thousands: ',' },
  'th-TH': { decimal: '.', thousands: ',' },

  // European format: 1.299,99 (period = thousands, comma = decimal)
  'de-DE': { decimal: ',', thousands: '.' },
  'de-AT': { decimal: ',', thousands: '.' },
  'de-CH': { decimal: ',', thousands: '.' },
  'nl-NL': { decimal: ',', thousands: '.' },
  'nl-BE': { decimal: ',', thousands: '.' },
  'es-ES': { decimal: ',', thousands: '.' },
  'es-MX': { decimal: ',', thousands: '.' },
  'pt-PT': { decimal: ',', thousands: '.' },
  'pt-BR': { decimal: ',', thousands: '.' },
  'it-IT': { decimal: ',', thousands: '.' },
  'pl-PL': { decimal: ',', thousands: '.' },
  'cs-CZ': { decimal: ',', thousands: '.' },
  'hu-HU': { decimal: ',', thousands: '.' },
  'ro-RO': { decimal: ',', thousands: '.' },
  'tr-TR': { decimal: ',', thousands: '.' },
  'ru-RU': { decimal: ',', thousands: '.' },
  'uk-UA': { decimal: ',', thousands: '.' },
  'id-ID': { decimal: ',', thousands: '.' },

  // French/Nordic/Baltic format: 1 299,99 (space = thousands, comma = decimal)
  'fr-FR': { decimal: ',', thousands: ' ' },
  'fr-BE': { decimal: ',', thousands: ' ' },
  'fr-CH': { decimal: ',', thousands: ' ' },
  'fr-CA': { decimal: ',', thousands: ' ' },
  'sv-SE': { decimal: ',', thousands: ' ' },
  'nb-NO': { decimal: ',', thousands: ' ' },
  'da-DK': { decimal: ',', thousands: ' ' },
  'fi-FI': { decimal: ',', thousands: ' ' },
  'et-EE': { decimal: ',', thousands: ' ' },  // Estonian
  'lv-LV': { decimal: ',', thousands: ' ' },  // Latvian
  'lt-LT': { decimal: ',', thousands: ' ' },  // Lithuanian
  'sk-SK': { decimal: ',', thousands: ' ' },  // Slovak
  'sl-SI': { decimal: ',', thousands: '.' },  // Slovenian
  'bg-BG': { decimal: ',', thousands: ' ' },  // Bulgarian
  'mt-MT': { decimal: ',', thousands: ' ' },  // Maltese
  'lb-LU': { decimal: ',', thousands: ' ' },  // Luxembourgish
  'de-LU': { decimal: ',', thousands: '.' },  // German (Luxembourg)
  'fr-LU': { decimal: ',', thousands: ' ' },  // French (Luxembourg)

  // Other
  'vi-VN': { decimal: ',', thousands: '.' },
  'ms-MY': { decimal: '.', thousands: ',' },
  'ar-AE': { decimal: '.', thousands: ',' },
  'ar-SA': { decimal: '.', thousands: ',' },
  'ar-EG': { decimal: '.', thousands: ',' },
  'he-IL': { decimal: '.', thousands: ',' },
  'el-GR': { decimal: ',', thousands: '.' }
};
