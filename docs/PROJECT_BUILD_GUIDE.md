# Price Drop Tracker - Complete AI Build Guide

## Project Overview

**Extension Name:** Price Drop Tracker  
**Type:** Chrome Extension (Manifest V3)  
**Purpose:** Automatically track product prices across e-commerce sites and notify users of price drops  
**Key Feature:** Zero-friction tracking - just browse normally, no manual setup required  
**Target Users:** Online shoppers who want to catch deals without manually monitoring prices

---

## Core Requirements

### **Essential Features (MVP)**
1. ✅ Automatic product page detection when user browses
2. ✅ Multi-currency price extraction (30+ currencies)
3. ✅ Background price checking every 6 hours
4. ✅ Price drop notifications (configurable threshold)
5. ✅ Popup dashboard showing tracked products
6. ✅ 30-day automatic tracking
7. ✅ Works on top 5 e-commerce sites (Amazon, eBay, Walmart, Target, Best Buy)

### **Technical Constraints**
- Chrome Extension Manifest V3
- 100% local storage (no external servers)
- Max 100 products tracked
- Storage limit: ~10MB
- Memory usage: <50MB
- Privacy-first: minimal permissions, no tracking

### **Supported E-commerce Sites (Priority)**
**Tier 1 (Launch):**
- Amazon (all regional domains: .com, .co.uk, .de, .fr, .it, .es, .ca, .com.au, .co.jp, .in)
- eBay (all regional domains)
- Walmart
- Target
- Best Buy

**Tier 2 (Post-launch):**
- Etsy, AliExpress, Shopify stores
- Regional: Zalando, ASOS, MediaMarkt

---

## Project Structure

```
price-drop-tracker/
├── manifest.json
├── README.md
├── CHANGELOG.md
├── LICENSE
├── .gitignore
│
├── background/
│   ├── service-worker.js        # Main background logic
│   ├── price-checker.js          # Scheduled price checking
│   └── storage-manager.js        # Data persistence
│
├── content-scripts/
│   ├── product-detector.js       # Identifies product pages
│   ├── price-extractor.js        # Extracts price data
│   └── site-adapters/
│       ├── base-adapter.js       # Abstract adapter class
│       ├── amazon.js             # Amazon-specific logic
│       ├── ebay.js               # eBay-specific logic
│       ├── walmart.js            # Walmart-specific logic
│       ├── target.js             # Target-specific logic
│       └── bestbuy.js            # Best Buy-specific logic
│
├── popup/
│   ├── popup.html                # Extension popup UI
│   ├── popup.js                  # Popup logic
│   └── popup.css                 # Popup styling
│
├── options/
│   ├── settings.html             # Settings page
│   ├── settings.js               # Settings logic
│   └── settings.css              # Settings styling
│
├── utils/
│   ├── currency-parser.js        # Parse prices in any currency
│   ├── currency-data.js          # Currency definitions
│   ├── notification-manager.js   # Notification handling
│   ├── product-hasher.js         # Generate unique product IDs
│   └── fetch-helper.js           # Network request utilities
│
├── assets/
│   ├── icons/
│   │   ├── icon-16.png
│   │   ├── icon-32.png
│   │   ├── icon-48.png
│   │   └── icon-128.png
│   └── images/
│       └── empty-state.svg
│
└── tests/
    ├── test-sites.json           # URLs for testing
    └── manual-test-checklist.md  # Testing procedures
```

---

## Data Structures

### **Product Data Model**
```javascript
{
  productId: "hash_of_domain_url_title",  // Unique identifier
  url: "https://amazon.com/dp/B08N5WRWNW",
  title: "Wireless Mouse Gaming RGB",
  
  price: {
    numeric: 99.99,
    currency: "USD",
    symbol: "$",
    formatted: "$99.99",
    locale: "en-US"
  },
  
  priceHistory: [
    {
      price: 99.99,
      currency: "USD",
      timestamp: 1700000000000,
      checkMethod: "schemaOrg"  // Which detection method worked
    },
    {
      price: 89.99,
      currency: "USD",
      timestamp: 1700021600000,
      checkMethod: "openGraph"
    }
  ],
  
  metadata: {
    image: "data:image/jpeg;base64,...",  // Thumbnail
    imageUrl: "https://example.com/image.jpg",  // STORE THIS, not base64!
    store: "amazon.com",
    category: "electronics",  // Optional
    sku: "B08N5WRWNW"  // If available
  },
  
  tracking: {
    firstSeen: 1700000000000,
    lastViewed: 1700000000000,
    lastChecked: 1700021600000,
    checkCount: 5,
    failedChecks: 0,
    status: "tracking"  // tracking, dropped, stale, expired
  },
  
  notifications: {
    lastNotified: null,
    notificationCount: 0,
    userDismissed: false
  }
}
```

### **Settings Model**
```javascript
{
  tracking: {
    duration: 30,  // days (7, 14, 30, 60)
    maxProducts: 100,  // (50, 100, 150)
    autoRemoveExpired: true
  },
  
  checking: {
    interval: 6,  // hours (3, 6, 12, 24)
    batchSize: 5,  // products checked simultaneously
    timeout: 10000,  // ms per request
    retryAttempts: 3
  },
  
  notifications: {
    enabled: true,
    minDropPercentage: 5,  // % (5, 10, 15, 20)
    maxPerDay: 3,
    sound: true,
    badge: true
  },
  
  privacy: {
    activityLog: true,  // Log all actions for transparency
    analytics: false  // Optional anonymous usage stats
  },
  
  advanced: {
    debugMode: false,
    verboseTiming: false
  }
}
```

---

## SESSION 1: Project Foundation & Setup (30 minutes)

### **Objective**
Create the basic Chrome Extension structure, manifest.json, and project scaffolding.

### **Files to Create**
1. `manifest.json` - Chrome Extension Manifest V3
2. `.gitignore` - Git ignore patterns
3. `README.md` - Project documentation
4. `LICENSE` - MIT License
5. All directory structure

---

### **TASK 1.1: Create manifest.json**

**Prompt:**
```
Create a Chrome Extension Manifest V3 file (manifest.json) with the following specifications:

METADATA:
- name: "Price Drop Tracker"
- version: "1.0.0"
- description: "Automatically track product prices and get notified when they drop. Works across major e-commerce sites with zero setup."
- author: Your name/company

PERMISSIONS (Minimal Approach for Initial Approval):
- "storage" - to save product data locally
- "alarms" - for scheduled background price checks
- "notifications" - for price drop alerts
- "tabs" - to detect visited pages

HOST PERMISSIONS (Start with specific domains):
- "*://*.amazon.com/*"
- "*://*.amazon.co.uk/*"
- "*://*.amazon.de/*"
- "*://*.amazon.fr/*"
- "*://*.amazon.it/*"
- "*://*.amazon.es/*"
- "*://*.amazon.ca/*"
- "*://*.amazon.com.au/*"
- "*://*.amazon.co.jp/*"
- "*://*.amazon.in/*"
- "*://*.ebay.com/*"
- "*://*.ebay.co.uk/*"
- "*://*.ebay.de/*"
- "*://*.walmart.com/*"
- "*://*.target.com/*"
- "*://*.bestbuy.com/*"

BACKGROUND SERVICE WORKER:
- service_worker: "background/service-worker.js"
- type: "module"

CONTENT SCRIPTS:
- matches: All host_permissions domains
- js: ["content-scripts/product-detector.js", "content-scripts/price-extractor.js"]
- run_at: "document_idle"
- all_frames: false

ACTION (Extension Icon):
- default_popup: "popup/popup.html"
- default_icon: icons in 16, 32, 48, 128 sizes

OPTIONS PAGE:
- page: "options/settings.html"
- open_in_tab: true

ICONS:
- 16x16, 32x32, 48x48, 128x128 (path: "assets/icons/icon-{size}.png")

CONTENT SECURITY POLICY:
- extension_pages: "script-src 'self'; object-src 'self'"
- No external scripts, no inline scripts

Include proper manifest_version: 3
```

**Validation Checklist:**
- [ ] Valid JSON syntax
- [ ] All required Manifest V3 fields present
- [ ] Permissions are minimal and justified
- [ ] Service worker specified correctly
- [ ] Content scripts target correct domains

---

### **TASK 1.2: Create .gitignore**

**Prompt:**
```
Create a .gitignore file for a Chrome Extension project with:

- Node.js patterns (node_modules/, npm-debug.log)
- OS files (.DS_Store, Thumbs.db, desktop.ini)
- IDE files (.vscode/, .idea/, *.swp, *.swo)
- Build artifacts (dist/, build/, *.zip)
- Test files (coverage/, .nyc_output/)
- Environment files (.env, .env.local)
- Chrome extension packaging (.crx, *.pem)
- Temporary files (*.tmp, *.temp, *~)
- Logs (*.log, logs/)

Keep the format clean and well-commented.
```

---

### **TASK 1.3: Create README.md**

**Prompt:**
```
Create a comprehensive README.md for the Price Drop Tracker Chrome Extension with:

SECTIONS:
1. Project Title & Tagline
   - "Price Drop Tracker - Never miss a deal again"
   - Brief 2-sentence description

2. Features
   - Automatic price tracking (no manual adding)
   - Multi-currency support (30+ currencies)
   - Background price monitoring
   - Price drop notifications
   - Works on major e-commerce sites
   - 100% privacy-focused (local storage only)

3. Installation (for users)
   - Chrome Web Store link (placeholder)
   - Manual installation from source

4. How It Works (user-facing)
   - Browse product pages normally
   - Extension automatically tracks prices
   - Get notified when prices drop
   - Click notification to visit product

5. Supported Sites
   - List of supported e-commerce platforms
   - Note about regional variants

6. Privacy & Permissions
   - Explain why each permission is needed
   - Emphasize no data collection, no tracking
   - All data stored locally

7. Development Setup (for contributors)
   - Prerequisites (Chrome, Node.js optional)
   - Installation steps
   - Loading unpacked extension
   - Testing instructions

8. Project Structure
   - Brief overview of key directories

9. Contributing
   - How to report bugs
   - How to request features
   - Pull request guidelines

10. License
    - MIT License

11. Roadmap
    - Phase 1: MVP features (current)
    - Phase 2: Advanced features (planned)

12. Support
    - Link to issues page
    - Contact information

Use clear markdown formatting, emojis where appropriate, and keep it professional yet friendly.
```

---

### **TASK 1.4: Create LICENSE**

**Prompt:**
```
Create an MIT License file with:
- Year: 2025
- Copyright holder: [Your name or company]
- Standard MIT License text

Use the standard MIT License template from https://opensource.org/licenses/MIT
```

---

### **TASK 1.5: Create Directory Structure**

**Prompt:**
```
Create all the following empty directories:

background/
content-scripts/
content-scripts/site-adapters/
popup/
options/
utils/
assets/
assets/icons/
assets/images/
tests/

Confirm all directories are created successfully.
```

---

### **TASK 1.6: Create Placeholder Icon Files**

**Prompt:**
```
For now, we need placeholder text files for icons that will be replaced with actual images later.

Create text files in assets/icons/:
- icon-16.png.txt (content: "16x16 icon placeholder - to be replaced with actual PNG")
- icon-32.png.txt (content: "32x32 icon placeholder - to be replaced with actual PNG")
- icon-48.png.txt (content: "48x48 icon placeholder - to be replaced with actual PNG")
- icon-128.png.txt (content: "128x128 icon placeholder - to be replaced with actual PNG")

Add a TODO.md in assets/icons/ explaining that these need to be replaced with actual PNG icons before release.

Note: For development, Chrome will show a default icon. Real icons needed before Chrome Web Store submission.
```

---

### **SESSION 1 COMPLETION CHECKLIST**

- [ ] manifest.json created and valid
- [ ] .gitignore created
- [ ] README.md created with all sections
- [ ] LICENSE file created
- [ ] All directories created
- [ ] Icon placeholders created
- [ ] Git repository initialized (`git init`)
- [ ] Initial commit made

### **Testing Session 1**
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the project directory
5. Extension should load without errors (even though it does nothing yet)
6. Check that icon appears in toolbar (default gray icon is fine for now)

---

## SESSION 2: Currency Support Foundation (1 hour)

### **Objective**
Build robust multi-currency parsing and handling before product detection. This is CRITICAL infrastructure.

### **Files to Create**
1. `utils/currency-data.js` - Currency definitions and mappings
2. `utils/currency-parser.js` - Price parsing logic
3. `tests/currency-parser.test.js` - Test cases

---

### **TASK 2.1: Create utils/currency-data.js**

**Prompt:**
```
Create a comprehensive currency data file (utils/currency-data.js) as an ES6 module with:

1. CURRENCIES object containing at least 30 major currencies with:
   - symbol: Display symbol (e.g., "$", "€", "£")
   - name: Full name (e.g., "US Dollar")
   - decimals: Number of decimal places (usually 2, but 0 for JPY/KRW)
   - format: "symbol_value" or "value_symbol" (e.g., $99.99 vs 99.99 €)

Include these currencies at minimum:
Americas: USD, CAD, MXN, BRL
Europe: EUR, GBP, CHF, SEK, NOK, DKK, PLN, CZK, HUF, RON
Asia-Pacific: JPY, CNY, KRW, INR, AUD, NZD, SGD, HKD, THB, PHP, IDR, MYR, VND
Eastern Europe: RUB, UAH
Middle East: AED, SAR, ILS
Africa: ZAR, EGP
Other: TRY

2. CURRENCY_SYMBOLS object mapping symbols to possible currency codes
   Handle ambiguous symbols (e.g., "$" could be USD, CAD, AUD, NZD, SGD, HKD, MXN)
   Examples:
   - "$": ["USD", "CAD", "AUD", "NZD", "SGD", "HKD", "MXN"]
   - "¥": ["JPY", "CNY"]
   - "kr": ["SEK", "NOK", "DKK"]
   - "R": ["ZAR", "BRL"]

3. DOMAIN_CURRENCY object mapping TLDs to likely currencies
   Examples:
   - ".com": "USD"
   - ".co.uk": "GBP"
   - ".de": "EUR"
   - ".fr": "EUR"
   - ".ca": "CAD"
   - ".com.au": "AUD"
   - ".co.jp": "JPY"
   ... (include 40+ domain mappings)

4. LOCALE_CURRENCY object mapping locale codes to currencies
   Examples:
   - "en-US": "USD"
   - "en-GB": "GBP"
   - "de-DE": "EUR"
   - "ja-JP": "JPY"
   ... (include 40+ locale mappings)

5. NUMBER_FORMATS object for different locales
   - decimalSeparator: "." or ","
   - thousandsSeparator: ",", ".", " ", or ""
   Examples:
   - "en-US": { decimal: ".", thousands: "," }  // 1,299.99
   - "de-DE": { decimal: ",", thousands: "." }  // 1.299,99
   - "fr-FR": { decimal: ",", thousands: " " }  // 1 299,99

Export all objects as named exports.
Use clear comments explaining ambiguous cases.
```

**Validation:**
- [ ] All 30+ currencies defined
- [ ] Ambiguous symbols documented
- [ ] Domain mappings cover major e-commerce sites
- [ ] ES6 export syntax used

---

### **TASK 2.2: Create utils/currency-parser.js**

**Prompt:**
```
Create utils/currency-parser.js as an ES6 module that exports a single function: parsePrice()

Import currency data from currency-data.js

FUNCTION SIGNATURE:
parsePrice(rawPriceString, contextData = {})

PARAMETERS:
- rawPriceString: The raw price text (e.g., "$99.99", "1.299,99 €", "¥9,999")
- contextData: Optional object with:
  - domain: Website domain (e.g., "amazon.co.uk")
  - locale: Page locale (e.g., "en-GB")
  - expectedCurrency: If known (e.g., "GBP")

RETURN OBJECT:
{
  numeric: 99.99,           // Always normalize to . as decimal
  currency: "USD",          // ISO 4217 code
  symbol: "$",              // Display symbol
  formatted: "$99.99",      // Original format preserved
  raw: "$99.99",           // Exact input
  locale: "en-US",         // Detected or provided locale
  confidence: 0.95,        // 0-1 confidence score
  method: "symbol"         // Detection method used
}

Returns null if parsing fails completely.

IMPLEMENTATION REQUIREMENTS:

1. CLEANING PHASE
   - Trim whitespace
   - Remove common text: "Price:", "Was:", "Now:", "Sale:", etc.
   - Handle non-breaking spaces (\\u00A0, \\u202F)
   - Keep only: digits, currency symbols, separators, decimal points

2. CURRENCY DETECTION (in priority order)
   a) ISO code detection (USD, EUR, GBP, etc.)
      - Regex: /\\b(USD|EUR|GBP|JPY|...)\\b/i
      - Confidence: 0.95
   
   b) Currency symbol detection
      - Check for €, $, £, ¥, ₽, kr, etc.
      - Use CURRENCY_SYMBOLS mapping
      - If ambiguous, use contextData to disambiguate
      - Confidence: 0.85 (0.95 if context confirms)
   
   c) Domain-based fallback
      - Extract TLD from domain
      - Use DOMAIN_CURRENCY mapping
      - Confidence: 0.70
   
   d) Locale-based fallback
      - Use LOCALE_CURRENCY mapping
      - Confidence: 0.65

3. NUMBER PARSING (handle multiple formats)
   
   STRATEGY:
   - Count separators: commas, periods, spaces
   - Determine which is decimal separator based on:
     * Last separator is usually decimal (e.g., "1,299.99" → . is decimal)
     * Single separator with 2 digits after = decimal (e.g., "99.99")
     * Known locale format from NUMBER_FORMATS
   
   CASES TO HANDLE:
   - US format: 1,299.99 (comma = thousands, period = decimal)
   - EU format: 1.299,99 (period = thousands, comma = decimal)
   - Nordic format: 1 299,99 (space = thousands, comma = decimal)
   - No separator: 99999 (assume no decimal if > 100, or ambiguous)
   - Japanese: ¥9,999 (comma = thousands, NO decimal for JPY)
   
   ALGORITHM:
   ```
   1. Remove all currency symbols and text
   2. Identify all separator characters in string
   3. If only one separator:
      - If 2-3 digits after: it's decimal
      - If more digits: it's thousands
   4. If multiple separators:
      - Last one is decimal (unless currency has 0 decimals like JPY)
      - Others are thousands
   5. Remove thousands separators
   6. Replace decimal separator with "."
   7. Parse as float
   ```

4. VALIDATION
   - Result must be positive number
   - Max 7 digits before decimal (no price over 9,999,999)
   - Max 4 digits after decimal
   - If validation fails: return null or reduce confidence

5. CONFIDENCE SCORING
   Start with base confidence from detection method, then:
   - +0.05 if contextData.expectedCurrency matches
   - -0.10 if currency is ambiguous and no context
   - -0.15 if number format is ambiguous
   - -0.20 if multiple possible interpretations
   - Clamp final score between 0 and 1

6. EDGE CASES TO HANDLE
   - "FREE" → { numeric: 0, currency: null, confidence: 0.5 }
   - "Call for price" → null
   - Price ranges "€99.99 - €149.99" → return lowest price, add isRange: true
   - Multiple currencies "USD $99.99 / EUR €89.99" → prefer context currency
   - Empty/null input → null
   - Non-price strings → null

HELPER FUNCTIONS (internal):
- cleanPriceString(str)
- detectCurrency(str, context)
- parseNumber(str, currency, context)
- disambiguateCurrency(possibleCurrencies, context)
- calculateConfidence(detectionData)

Add extensive inline comments explaining the logic.
Include error handling for all edge cases.
```

**Validation:**
- [ ] Handles all test cases from TASK 2.3
- [ ] Returns null for unparseable strings
- [ ] Confidence scores are reasonable
- [ ] ES6 export syntax used

---

### **TASK 2.3: Create tests/currency-parser.test.js**

**Prompt:**
```
Create a comprehensive test file for currency-parser.js with at least 50 test cases.

Format as a simple JavaScript file that can be run in console or with Node.js.

STRUCTURE:
```javascript
import { parsePrice } from '../utils/currency-parser.js';

const tests = [
  {
    name: "US Dollar - simple",
    input: "$99.99",
    expected: { numeric: 99.99, currency: "USD", confidence: 0.85 },
    context: {}
  },
  // ... more tests
];

let passed = 0;
let failed = 0;

tests.forEach(test => {
  const result = parsePrice(test.input, test.context);
  const match = (
    Math.abs(result.numeric - test.expected.numeric) < 0.01 &&
    result.currency === test.expected.currency &&
    result.confidence >= test.expected.confidence - 0.1
  );
  
  if (match) {
    passed++;
    console.log(`✅ ${test.name}`);
  } else {
    failed++;
    console.log(`❌ ${test.name}`);
    console.log(`   Input: ${test.input}`);
    console.log(`   Expected: ${JSON.stringify(test.expected)}`);
    console.log(`   Got: ${JSON.stringify(result)}`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
```

INCLUDE THESE TEST CATEGORIES:

1. US Format (10 tests)
   - $99.99
   - $1,299.99
   - US$99.99
   - 99.99 USD
   - $0.99
   - $9,999,999.99

2. European Format (10 tests)
   - 99,99 €
   - 1.299,99 €
   - €99,99
   - EUR 99,99
   - 99,99 EUR

3. UK Format (5 tests)
   - £99.99
   - £1,299.99
   - GBP 99.99

4. Japanese Yen (5 tests)
   - ¥9,999
   - ¥99,999
   - JPY 9999
   - ¥1,000,000

5. Nordic Currencies (5 tests)
   - 99,99 kr
   - 1 299,99 kr
   - SEK 99.99
   - 99.99 SEK

6. Other Currencies (5 tests)
   - ₹99.99 (INR)
   - R$99,99 (BRL)
   - ₽99,99 (RUB)
   - A$99.99 (AUD)

7. Ambiguous Cases (5 tests)
   - "$99.99" with domain: "amazon.ca" → CAD
   - "$99.99" with domain: "amazon.com.au" → AUD
   - "¥9,999" with locale: "ja-JP" → JPY
   - "¥99.99" with locale: "zh-CN" → CNY

8. Edge Cases (5 tests)
   - "FREE" → 0
   - "Call for price" → null
   - "€99.99 - €149.99" → 99.99 with isRange
   - "" (empty) → null
   - "Invalid text" → null

For each test, check:
- Numeric value (within 0.01 tolerance)
- Currency code
- Confidence (within 0.1 tolerance)
```

---

### **SESSION 2 COMPLETION CHECKLIST**

- [ ] currency-data.js created with 30+ currencies
- [ ] currency-parser.js created with parsePrice function
- [ ] Test file created with 50+ test cases
- [ ] All tests pass (or document failures for edge cases)
- [ ] Functions are well-commented
- [ ] ES6 modules syntax used correctly

### **Testing Session 2**

1. Open Chrome DevTools console
2. Load the test file
3. Run tests
4. Verify >90% tests pass
5. Document any failing edge cases for future improvement

### **Example Manual Test**
```javascript
// In browser console
import { parsePrice } from './utils/currency-parser.js';

// Test various formats
console.log(parsePrice("$99.99"));
console.log(parsePrice("1.299,99 €"));
console.log(parsePrice("£1,299.99"));
console.log(parsePrice("¥9,999", { domain: "amazon.co.jp" }));
```

---

## SESSION 3: Product Detection Core (1.5 hours)

### **Objective**
Build the multi-layer product detection system that identifies product pages and extracts basic information.

### **Files to Create**
1. `content-scripts/product-detector.js` - Main detection logic
2. `content-scripts/price-extractor.js` - Price extraction logic
3. `utils/product-hasher.js` - Generate unique product IDs

---

### **TASK 3.1: Create utils/product-hasher.js**

**Prompt:**
```
Create utils/product-hasher.js as an ES6 module that generates unique, consistent product IDs.

Export function: generateProductId(url, title, domain)

REQUIREMENTS:
1. Hash should be deterministic (same input = same output)
2. Hash should be unique enough to avoid collisions
3. Should handle URL variations (tracking params, session IDs)
4. Should normalize titles (lowercase, trim, remove extra spaces)

IMPLEMENTATION NOTE:
The product data structure should store imageUrl (the URL string), NOT base64-encoded image data.
This saves approximately 8KB per product (800KB for 100 products) in storage.
See enhanceProductData() in Session 3 for implementation.

ALGORITHM:
1. Extract clean product identifier from URL
   - For Amazon: extract ASIN (e.g., /dp/B08N5WRWNW → B08N5WRWNW)
   - For eBay: extract item ID (e.g., /itm/123456789 → 123456789)
   - For others: use pathname without query params
   
2. Normalize title
   - Convert to lowercase
   - Trim whitespace
   - Remove multiple spaces
   - Remove special characters except alphanumeric, spaces, dashes
   - Truncate to first 50 characters
   
3. Combine: domain + productIdentifier + normalizedTitle

4. Generate hash
   - Use simple but effective hashing (djb2 or similar)
   - Return as hex string (8-12 characters)

IMPLEMENTATION:
```javascript
export function generateProductId(url, title, domain) {
  const productId = extractProductIdentifier(url, domain);
  const normalizedTitle = normalizeTitle(title);
  const combined = `${domain}|${productId}|${normalizedTitle}`;
  return simpleHash(combined);
}

function extractProductIdentifier(url, domain) {
  // Domain-specific extraction
  if (domain.includes('amazon')) {
    // Extract ASIN: /dp/XXXXX or /gp/product/XXXXX
    const match = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
    return match ? match[1] : getPathHash(url);
  }
  
  if (domain.includes('ebay')) {
    // Extract item ID: /itm/123456789
    const match = url.match(/\/itm\/(\d+)/);
    return match ? match[1] : getPathHash(url);
  }
  
  // Generic: use pathname without query
  return getPathHash(url);
}

function getPathHash(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.replace(/\//g, '_');
  } catch {
    return url.slice(0, 100);
  }
}

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s-]/g, '')
    .slice(0, 50);
}

function simpleHash(str) {
  // djb2 hash algorithm
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).slice(0, 12);
}
```

Add JSDoc comments for all functions.
Include error handling for invalid inputs.
```

---

### **TASK 3.2: Create content-scripts/product-detector.js**

**Prompt:**
```
Create content-scripts/product-detector.js - the core product detection logic.

This runs on every page load to determine if the page is a product page.

Import parsePrice from utils/currency-parser.js
Import generateProductId from utils/product-hasher.js

DETECTION STRATEGY (Multi-layer fallback):

LAYER 1: Schema.org Structured Data (Highest Confidence: 0.95)
- Look for <script type="application/ld+json"> containing "@type": "Product"
- Extract: name, price, currency, image, sku, availability
- This is the MOST RELIABLE method as it's SEO-critical

LAYER 2: Open Graph Meta Tags (High Confidence: 0.85)
- Look for meta tags: og:type="product"
- Extract: og:title, og:price:amount, og:price:currency, og:image
- Common on many e-commerce sites

LAYER 3: Microdata/RDFa (Medium Confidence: 0.75)
- Look for itemtype="http://schema.org/Product"
- Extract from itemprop attributes

LAYER 4: URL Pattern + CSS Selectors (Lower Confidence: 0.65)
- Check URL for patterns: /product/, /item/, /dp/, /p/, /itm/
- Look for common price CSS classes: .price, [data-price], .product-price
- Look for product title in h1
- Look for product images

MAIN FUNCTION STRUCTURE:
```javascript
export async function detectProduct() {
  console.log('[Price Drop Tracker] Scanning page...');
  
  // Quick reject: ignore non-product pages
  if (isNonProductPage()) {
    console.log('[Price Drop Tracker] Non-product page, skipping');
    return null;
  }
  
  // Try detection methods in order
  let productData = null;
  
  // Layer 1: Schema.org
  productData = extractFromSchemaOrg();
  if (productData && productData.confidence >= 0.90) {
    console.log('[Price Drop Tracker] Product detected via Schema.org');
    return productData;
  }
  
  // Layer 2: Open Graph
  const ogData = extractFromOpenGraph();
  if (ogData && (!productData || ogData.confidence > productData.confidence)) {
    productData = ogData;
  }
  
  // Layer 3: Microdata
  const microdataData = extractFromMicrodata();
  if (microdataData && (!productData || microdataData.confidence > productData.confidence)) {
    productData = microdataData;
  }
  
  // Layer 4: CSS Selectors (fallback)
  if (!productData || productData.confidence < 0.70) {
    const cssData = extractFromSelectors();
    if (cssData && (!productData || cssData.confidence > productData.confidence)) {
      productData = cssData;
    }
  }
  
  if (!productData || productData.confidence < 0.60) {
    console.log('[Price Drop Tracker] No product detected');
    return null;
  }
  
  // Enhance and validate data
  productData = await enhanceProductData(productData);
  
  console.log('[Price Drop Tracker] Product detected:', productData);
  return productData;
}

function isNonProductPage() {
  const url = window.location.href;
  const nonProductPatterns = [
    '/cart', '/checkout', '/account', '/login', '/register',
    '/search', '/category', '/browse', '/help', '/support'
  ];
  return nonProductPatterns.some(pattern => url.includes(pattern));
}

function extractFromSchemaOrg() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent);
      
      // Handle both single object and array
      const products = Array.isArray(data) ? data : [data];
      
      for (const item of products) {
        if (item['@type'] === 'Product' || 
            item['@type'] === 'https://schema.org/Product') {
          
          // Extract offers (could be single object or array)
          const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
          
          if (!offers || !offers.price) continue;
          
          // Parse price using our currency parser
          const priceData = parsePrice(
            String(offers.price), 
            {
              domain: window.location.hostname,
              locale: document.documentElement.lang,
              expectedCurrency: offers.priceCurrency
            }
          );
          
          if (!priceData) continue;
          
          return {
            title: item.name,
            price: priceData,
            image: item.image?.url || item.image || null,
            url: window.location.href,
            domain: window.location.hostname,
            sku: item.sku || item.gtin || null,
            availability: offers.availability || null,
            confidence: 0.95,
            detectionMethod: 'schemaOrg'
          };
        }
      }
    } catch (e) {
      console.error('Error parsing Schema.org:', e);
    }
  }
  
  return null;
}

function extractFromOpenGraph() {
  const ogType = document.querySelector('meta[property="og:type"]')?.content;
  if (ogType !== 'product') return null;
  
  const title = document.querySelector('meta[property="og:title"]')?.content;
  const priceAmount = document.querySelector('meta[property="og:price:amount"]')?.content;
  const priceCurrency = document.querySelector('meta[property="og:price:currency"]')?.content;
  const image = document.querySelector('meta[property="og:image"]')?.content;
  
  if (!title || !priceAmount) return null;
  
  const priceString = priceCurrency ? 
    `${priceAmount} ${priceCurrency}` : 
    priceAmount;
  
  const priceData = parsePrice(priceString, {
    domain: window.location.hostname,
    locale: document.documentElement.lang
  });
  
  if (!priceData) return null;
  
  return {
    title,
    price: priceData,
    image,
    url: window.location.href,
    domain: window.location.hostname,
    sku: null,
    availability: null,
    confidence: 0.85,
    detectionMethod: 'openGraph'
  };
}

function extractFromMicrodata() {
  const productElement = document.querySelector('[itemtype*="schema.org/Product"]');
  if (!productElement) return null;
  
  const title = productElement.querySelector('[itemprop="name"]')?.textContent?.trim();
  const priceElement = productElement.querySelector('[itemprop="price"]');
  const currency = productElement.querySelector('[itemprop="priceCurrency"]')?.content;
  const image = productElement.querySelector('[itemprop="image"]')?.src;
  
  if (!title || !priceElement) return null;
  
  const priceString = currency ? 
    `${priceElement.content || priceElement.textContent} ${currency}` :
    (priceElement.content || priceElement.textContent);
  
  const priceData = parsePrice(priceString, {
    domain: window.location.hostname,
    locale: document.documentElement.lang
  });
  
  if (!priceData) return null;
  
  return {
    title,
    price: priceData,
    image,
    url: window.location.href,
    domain: window.location.hostname,
    sku: null,
    availability: null,
    confidence: 0.75,
    detectionMethod: 'microdata'
  };
}

function extractFromSelectors() {
  // URL must match product patterns
  const url = window.location.href;
  const urlPatterns = ['/product/', '/item/', '/dp/', '/p/', '/itm/', '/goods/'];
  const hasProductUrl = urlPatterns.some(pattern => url.includes(pattern));
  
  if (!hasProductUrl) return null;
  
  // Try to find title
  const title = 
    document.querySelector('h1[class*="product"]')?.textContent?.trim() ||
    document.querySelector('h1.title')?.textContent?.trim() ||
    document.querySelector('h1')?.textContent?.trim();
  
  if (!title || title.length < 3) return null;
  
  // Try to find price with common selectors
  const priceSelectors = [
    '[data-price]',
    '.price',
    '.product-price',
    '[class*="price"]',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '.a-price .a-offscreen', // Amazon
    '[data-testid="price"]'
  ];
  
  let priceData = null;
  
  for (const selector of priceSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      const priceText = element.getAttribute('data-price') || 
                       element.getAttribute('content') ||
                       element.textContent;
      
      const parsed = parsePrice(priceText, {
        domain: window.location.hostname,
        locale: document.documentElement.lang
      });
      
      if (parsed && parsed.confidence >= 0.70) {
        priceData = parsed;
        break;
      }
    }
    if (priceData) break;
  }
  
  if (!priceData) return null;
  
  // Try to find image
  const image = 
    document.querySelector('[data-product-image]')?.src ||
    document.querySelector('.product-image img')?.src ||
    document.querySelector('[class*="product"] img')?.src ||
    null;
  
  return {
    title,
    price: priceData,
    image,
    url: window.location.href,
    domain: window.location.hostname,
    sku: null,
    availability: null,
    confidence: 0.65,
    detectionMethod: 'cssSelectors'
  };
}

async function enhanceProductData(data) {
  // Generate unique product ID
  data.productId = generateProductId(data.url, data.title, data.domain);
  
  // Add timestamps
  data.detectedAt = Date.now();
  
  // CRITICAL: Store image URL, NOT base64 data
  // Storing base64 images wastes ~8KB per product (800KB for 100 products!)
  // Instead, store the URL and let the popup load images on-demand
  if (data.image) {
    // Validate it's a URL, not already base64
    if (!data.image.startsWith('data:')) {
      data.imageUrl = data.image;
    }
    delete data.image; // Remove to prevent accidental base64 storage
  }
  
  // Validate and clean title
  if (data.title.length > 200) {
    data.title = data.title.slice(0, 197) + '...';
  }
  
  return data;
}
```

INITIALIZATION:
- Run detectProduct() on page load (document_idle)
- If product detected, save to storage
- Show subtle notification to user
- Add event listener for future navigation

Add comprehensive error handling and logging.
```

---

### **TASK 3.3: Create content-scripts/price-extractor.js**

**Prompt:**
```
Create content-scripts/price-extractor.js - helper functions for extracting prices.

This module is imported by product-detector.js and provides utility functions.

Import parsePrice from utils/currency-parser.js

Export these functions:

1. extractPriceFromElement(element, context)
   - Takes a DOM element that might contain a price
   - Returns parsed price data or null
   - Handles various element types (text, data attributes, etc.)

2. findPriceElements(rootElement)
   - Searches for all potential price elements in a container
   - Returns array of candidate elements
   - Uses common selectors and patterns

3. validatePrice(priceData)
   - Validates that price data is reasonable
   - Checks for: positive number, reasonable range, valid currency
   - Returns boolean

4. comparePrices(price1, price2)
   - Safely compares two price objects
   - Returns { comparable, dropped, amount, percentage }
   - Handles currency mismatches

IMPLEMENTATION:
```javascript
import { parsePrice } from '../utils/currency-parser.js';

export function extractPriceFromElement(element, context = {}) {
  if (!element) return null;
  
  // Try data attributes first
  const dataPrice = element.getAttribute('data-price') ||
                   element.getAttribute('data-product-price') ||
                   element.getAttribute('content');
  
  if (dataPrice) {
    const parsed = parsePrice(dataPrice, context);
    if (parsed && parsed.confidence >= 0.70) {
      return parsed;
    }
  }
  
  // Try text content
  const text = element.textContent?.trim();
  if (text) {
    const parsed = parsePrice(text, context);
    if (parsed && parsed.confidence >= 0.70) {
      return parsed;
    }
  }
  
  // Try child elements
  const priceSpan = element.querySelector('[class*="price"], [data-price]');
  if (priceSpan) {
    return extractPriceFromElement(priceSpan, context);
  }
  
  return null;
}

export function findPriceElements(rootElement = document) {
  const selectors = [
    '[data-price]',
    '[data-product-price]',
    '[itemprop="price"]',
    '.price',
    '.product-price',
    '[class*="price"]',
    '[id*="price"]',
    '.a-price', // Amazon
    '[data-testid="price"]'
  ];
  
  const elements = [];
  for (const selector of selectors) {
    const found = rootElement.querySelectorAll(selector);
    elements.push(...found);
  }
  
  // Remove duplicates
  return [...new Set(elements)];
}

export function validatePrice(priceData) {
  if (!priceData || typeof priceData.numeric !== 'number') {
    return false;
  }
  
  // Must be positive
  if (priceData.numeric <= 0) {
    return false;
  }
  
  // Reasonable range (0.01 to 9,999,999)
  if (priceData.numeric < 0.01 || priceData.numeric > 9999999) {
    return false;
  }
  
  // Must have currency
  if (!priceData.currency) {
    return false;
  }
  
  // Confidence must be reasonable
  if (priceData.confidence < 0.50) {
    return false;
  }
  
  return true;
}

export function comparePrices(oldPrice, newPrice) {
  // Can't compare if missing
  if (!oldPrice || !newPrice) {
    return { comparable: false, reason: 'missing_data' };
  }
  
  // Can't compare if different currencies
  if (oldPrice.currency !== newPrice.currency) {
    return { 
      comparable: false, 
      reason: 'currency_mismatch',
      oldCurrency: oldPrice.currency,
      newCurrency: newPrice.currency
    };
  }
  
  const difference = oldPrice.numeric - newPrice.numeric;
  const percentageChange = (difference / oldPrice.numeric) * 100;
  
  return {
    comparable: true,
    dropped: difference > 0,
    increased: difference < 0,
    unchanged: Math.abs(difference) < 0.01,
    amount: Math.abs(difference),
    percentage: Math.abs(percentageChange),
    oldPrice: oldPrice.numeric,
    newPrice: newPrice.numeric,
    currency: oldPrice.currency
  };
}
```

Add JSDoc comments for all functions.
Include unit tests in comments showing expected behavior.
```

---

### **SESSION 3 COMPLETION CHECKLIST**

- [ ] product-hasher.js created with hash function
- [ ] product-detector.js created with multi-layer detection
- [ ] price-extractor.js created with helper functions
- [ ] All functions have error handling
- [ ] Imports are correct
- [ ] Console logging is informative

### **Testing Session 3**

1. Load extension in Chrome
2. Visit Amazon product page
3. Open DevTools console
4. Check for detection logs
5. Verify product data structure is correct
6. Test on eBay, Walmart, Target product pages
7. Test on non-product pages (should not detect)

### **Manual Test**
```javascript
// In DevTools console on product page
import { detectProduct } from './content-scripts/product-detector.js';
const product = await detectProduct();
console.log(product);
// Should see: title, price, confidence, detectionMethod
```

---

## SESSION 4: Storage Management (45 minutes)

### **Objective**
Create the storage layer for persisting product data and settings using Chrome's storage API.

### **Files to Create**
1. `background/storage-manager.js` - CRUD operations for products and settings

---

### **TASK 4.1: Create background/storage-manager.js**

**Prompt:**
```
Create background/storage-manager.js as an ES6 module for managing product data and settings.

Use chrome.storage.local API (10MB limit).

STORAGE STRUCTURE:
```javascript
{
  products: {
    "product_id_hash": {
      // Full product object from detector
    },
    "another_product_id": { ... }
  },
  settings: {
    // Settings object
  },
  metadata: {
    totalProducts: 0,
    lastCleanup: timestamp,
    storageUsed: bytes
  }
}
```

EXPORT THESE FUNCTIONS:

1. **saveProduct(productData)**
   - Saves or updates a product
   - If product exists, updates price history
   - If new, creates new entry
   - Returns productId

2. **getProduct(productId)**
   - Retrieves single product
   - Returns null if not found

3. **getAllProducts()**
   - Returns object of all products
   - Empty object if none

4. **deleteProduct(productId)**
   - Removes product
   - Returns boolean success

5. **updateProductPrice(productId, newPriceData)**
   - Adds new price to history
   - Updates lastChecked timestamp
   - Limits price history to 30 entries
   - Returns updated product

6. **cleanupOldProducts()**
   - Removes products older than tracking duration (from settings)
   - Removes expired/stale products
   - Returns count of deleted products

7. **getSettings()**
   - Returns current settings
   - Returns defaults if not set

8. **updateSettings(newSettings)**
   - Merges with existing settings
   - Validates values
   - Returns updated settings

9. **getStorageStats()**
   - Returns storage usage info
   - Estimate of bytes used
   - Product count
   - Oldest/newest product dates

10. **exportData()**
    - Returns all data as JSON string
    - For backup/export feature

11. **importData(jsonString)**
    - Imports previously exported data
    - Validates structure
    - Merges or replaces existing data

12. **clearAllData()**
    - Removes ALL data (nuclear option)
    - Requires confirmation in implementation
    - Returns boolean success

IMPLEMENTATION TEMPLATE:
```javascript
// Default settings
const DEFAULT_SETTINGS = {
  tracking: {
    duration: 30,
    maxProducts: 100,
    autoRemoveExpired: true
  },
  checking: {
    interval: 6,
    batchSize: 5,
    timeout: 10000,
    retryAttempts: 3
  },
  notifications: {
    enabled: true,
    minDropPercentage: 5,
    maxPerDay: 3,
    sound: true,
    badge: true
  },
  privacy: {
    activityLog: true,
    analytics: false
  },
  advanced: {
    debugMode: false,
    verboseTiming: false
  }
};

export async function saveProduct(productData) {
  try {
    // Get existing products
    const result = await chrome.storage.local.get(['products', 'metadata']);
    const products = result.products || {};
    const metadata = result.metadata || { totalProducts: 0, lastCleanup: Date.now(), storageUsed: 0 };
    
    const productId = productData.productId;
    
    // Check if product exists
    if (products[productId]) {
      // Update existing
      const existing = products[productId];
      
      // Add to price history if price changed
      if (existing.price.numeric !== productData.price.numeric) {
        existing.priceHistory = existing.priceHistory || [];
        existing.priceHistory.push({
          price: productData.price.numeric,
          currency: productData.price.currency,
          timestamp: Date.now(),
          checkMethod: productData.detectionMethod
        });
        
        // Limit history to 30 entries
        if (existing.priceHistory.length > 30) {
          existing.priceHistory = existing.priceHistory.slice(-30);
        }
      }
      
      // Update fields
      existing.price = productData.price;
      existing.tracking.lastViewed = Date.now();
      existing.tracking.lastChecked = Date.now();
      
      products[productId] = existing;
    } else {
      // Check max products limit
      const settings = await getSettings();
      if (Object.keys(products).length >= settings.tracking.maxProducts) {
        throw new Error('Maximum product limit reached');
      }
      
      // Create new product entry
      products[productId] = {
        ...productData,
        priceHistory: [{
          price: productData.price.numeric,
          currency: productData.price.currency,
          timestamp: Date.now(),
          checkMethod: productData.detectionMethod
        }],
        tracking: {
          firstSeen: Date.now(),
          lastViewed: Date.now(),
          lastChecked: Date.now(),
          checkCount: 1,
          failedChecks: 0,
          status: 'tracking'
        },
        notifications: {
          lastNotified: null,
          notificationCount: 0,
          userDismissed: false
        }
      };
      
      metadata.totalProducts++;
    }
    
    // Save back to storage
    await chrome.storage.local.set({ products, metadata });
    
    console.log(`[Storage] Saved product: ${productId}`);
    return productId;
    
  } catch (error) {
    console.error('[Storage] Error saving product:', error);
    throw error;
  }
}

export async function getProduct(productId) {
  try {
    const result = await chrome.storage.local.get('products');
    const products = result.products || {};
    return products[productId] || null;
  } catch (error) {
    console.error('[Storage] Error getting product:', error);
    return null;
  }
}

export async function getAllProducts() {
  try {
    const result = await chrome.storage.local.get('products');
    return result.products || {};
  } catch (error) {
    console.error('[Storage] Error getting all products:', error);
    return {};
  }
}

export async function deleteProduct(productId) {
  try {
    const result = await chrome.storage.local.get(['products', 'metadata']);
    const products = result.products || {};
    const metadata = result.metadata || {};
    
    if (products[productId]) {
      delete products[productId];
      metadata.totalProducts = Math.max(0, (metadata.totalProducts || 0) - 1);
      
      await chrome.storage.local.set({ products, metadata });
      console.log(`[Storage] Deleted product: ${productId}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[Storage] Error deleting product:', error);
    return false;
  }
}

export async function updateProductPrice(productId, newPriceData) {
  try {
    const product = await getProduct(productId);
    if (!product) return null;
    
    // Add to price history
    product.priceHistory = product.priceHistory || [];
    product.priceHistory.push({
      price: newPriceData.numeric,
      currency: newPriceData.currency,
      timestamp: Date.now(),
      checkMethod: newPriceData.detectionMethod || 'unknown'
    });
    
    // Limit history
    if (product.priceHistory.length > 30) {
      product.priceHistory = product.priceHistory.slice(-30);
    }
    
    // Update price
    product.price = newPriceData;
    product.tracking.lastChecked = Date.now();
    product.tracking.checkCount++;
    product.tracking.failedChecks = 0; // Reset on success
    
    // Save
    const products = await getAllProducts();
    products[productId] = product;
    await chrome.storage.local.set({ products });
    
    return product;
  } catch (error) {
    console.error('[Storage] Error updating product price:', error);
    return null;
  }
}

export async function cleanupOldProducts() {
  try {
    const products = await getAllProducts();
    const settings = await getSettings();
    const now = Date.now();
    const maxAge = settings.tracking.duration * 24 * 60 * 60 * 1000; // Convert days to ms
    
    let deletedCount = 0;
    
    for (const [productId, product] of Object.entries(products)) {
      const age = now - product.tracking.firstSeen;
      
      // Delete if too old
      if (age > maxAge) {
        await deleteProduct(productId);
        deletedCount++;
        continue;
      }
      
      // Delete if marked expired
      if (product.tracking.status === 'expired') {
        await deleteProduct(productId);
        deletedCount++;
        continue;
      }
      
      // Delete if too many failed checks (7+ consecutive failures)
      if (product.tracking.failedChecks >= 7) {
        await deleteProduct(productId);
        deletedCount++;
        continue;
      }
    }
    
    // Update metadata
    const metadata = {
      totalProducts: Object.keys(products).length - deletedCount,
      lastCleanup: now,
      storageUsed: 0 // Will be calculated if needed
    };
    await chrome.storage.local.set({ metadata });
    
    console.log(`[Storage] Cleaned up ${deletedCount} old products`);
    return deletedCount;
    
  } catch (error) {
    console.error('[Storage] Error cleaning up:', error);
    return 0;
  }
}

export async function getSettings() {
  try {
    const result = await chrome.storage.local.get('settings');
    return result.settings || DEFAULT_SETTINGS;
  } catch (error) {
    console.error('[Storage] Error getting settings:', error);
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(newSettings) {
  try {
    const currentSettings = await getSettings();
    
    // Deep merge
    const updated = {
      tracking: { ...currentSettings.tracking, ...newSettings.tracking },
      checking: { ...currentSettings.checking, ...newSettings.checking },
      notifications: { ...currentSettings.notifications, ...newSettings.notifications },
      privacy: { ...currentSettings.privacy, ...newSettings.privacy },
      advanced: { ...currentSettings.advanced, ...newSettings.advanced }
    };
    
    // Validate
    if (updated.tracking.duration < 7 || updated.tracking.duration > 90) {
      throw new Error('Invalid tracking duration');
    }
    if (updated.checking.interval < 1 || updated.checking.interval > 48) {
      throw new Error('Invalid check interval');
    }
    
    await chrome.storage.local.set({ settings: updated });
    console.log('[Storage] Settings updated');
    return updated;
    
  } catch (error) {
    console.error('[Storage] Error updating settings:', error);
    throw error;
  }
}

export async function getStorageStats() {
  try {
    const result = await chrome.storage.local.get(null); // Get all data
    const products = result.products || {};
    const productIds = Object.keys(products);
    
    // Calculate approximate size
    const jsonSize = JSON.stringify(result).length;
    const bytesUsed = jsonSize * 2; // Rough estimate (Unicode characters)
    
    // Find oldest and newest
    let oldest = Date.now();
    let newest = 0;
    
    for (const product of Object.values(products)) {
      if (product.tracking.firstSeen < oldest) oldest = product.tracking.firstSeen;
      if (product.tracking.firstSeen > newest) newest = product.tracking.firstSeen;
    }
    
    return {
      productCount: productIds.length,
      bytesUsed,
      bytesAvailable: 10485760 - bytesUsed, // 10MB limit
      percentageUsed: (bytesUsed / 10485760) * 100,
      oldestProduct: oldest === Date.now() ? null : oldest,
      newestProduct: newest === 0 ? null : newest
    };
    
  } catch (error) {
    console.error('[Storage] Error getting stats:', error);
    return null;
  }
}

export async function exportData() {
  try {
    const result = await chrome.storage.local.get(null);
    return JSON.stringify(result, null, 2);
  } catch (error) {
    console.error('[Storage] Error exporting data:', error);
    return null;
  }
}

export async function importData(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    
    // Validate structure
    if (!data.products || typeof data.products !== 'object') {
      throw new Error('Invalid data structure');
    }
    
    // Import
    await chrome.storage.local.set(data);
    console.log('[Storage] Data imported successfully');
    return true;
    
  } catch (error) {
    console.error('[Storage] Error importing data:', error);
    return false;
  }
}

export async function clearAllData() {
  try {
    await chrome.storage.local.clear();
    console.log('[Storage] All data cleared');
    return true;
  } catch (error) {
    console.error('[Storage] Error clearing data:', error);
    return false;
  }
}
```

Add JSDoc comments for all functions.
Include error handling for storage quota exceeded.
Add logging for debugging.
```

---

### **SESSION 4 COMPLETION CHECKLIST**

- [ ] storage-manager.js created with all CRUD functions
- [ ] Default settings defined
- [ ] Error handling implemented
- [ ] Storage limits respected
- [ ] Functions well-documented

### **Testing Session 4**

```javascript
// In DevTools console (background context)
import * as storage from './background/storage-manager.js';

// Test saving product
const testProduct = {
  productId: 'test123',
  title: 'Test Product',
  price: { numeric: 99.99, currency: 'USD' },
  url: 'https://example.com/product',
  domain: 'example.com'
};

await storage.saveProduct(testProduct);

// Test retrieval
const product = await storage.getProduct('test123');
console.log(product);

// Test getting all
const all = await storage.getAllProducts();
console.log(all);

// Test stats
const stats = await storage.getStorageStats();
console.log(stats);
```

---

## SESSION 5: Site-Specific Adapters (1.5 hours)

### **Objective**
Create site-specific detection logic for major e-commerce platforms with currency awareness.

### **Important Note on Dynamic Content**
Many modern e-commerce sites load prices via JavaScript after initial HTML parsing. For content scripts running on the page, you can use MutationObserver to wait for price elements to appear. For background price checks (which parse static HTML), some sites may fail - this is an acceptable limitation without using a headless browser.

### **Files to Create**
1. `content-scripts/site-adapters/base-adapter.js` - Abstract base class
2. `content-scripts/site-adapters/amazon.js` - Amazon-specific logic
3. `content-scripts/site-adapters/ebay.js` - eBay-specific logic
4. `content-scripts/site-adapters/walmart.js` - Walmart-specific logic
5. `content-scripts/site-adapters/target.js` - Target-specific logic
6. `content-scripts/site-adapters/bestbuy.js` - Best Buy-specific logic

---

### **TASK 5.1: Create content-scripts/site-adapters/base-adapter.js**

**Prompt:**
```
Create base-adapter.js as an ES6 class that other adapters will extend.

This provides a common interface and shared functionality.

Import parsePrice from utils/currency-parser.js

```javascript
import { parsePrice } from '../../utils/currency-parser.js';

export class BaseAdapter {
  constructor(document, url) {
    this.document = document;
    this.url = url;
    this.domain = new URL(url).hostname;
    this.locale = document.documentElement.lang || 'en-US';
  }
  
  // Abstract methods (must be implemented by subclasses)
  detectProduct() {
    throw new Error('detectProduct() must be implemented');
  }
  
  extractPrice() {
    throw new Error('extractPrice() must be implemented');
  }
  
  extractTitle() {
    throw new Error('extractTitle() must be implemented');
  }
  
  extractImage() {
    throw new Error('extractImage() must be implemented');
  }
  
  extractProductId() {
    throw new Error('extractProductId() must be implemented');
  }
  
  // Shared helper methods
  getExpectedCurrency() {
    // Override in subclass if needed
    return null;
  }
  
  querySelector(selector) {
    return this.document.querySelector(selector);
  }
  
  querySelectorAll(selector) {
    return this.document.querySelectorAll(selector);
  }
  
  parsePrice WithContext(priceString) {
    return parsePrice(priceString, {
      domain: this.domain,
      locale: this.locale,
      expectedCurrency: this.getExpectedCurrency()
    });
  }
  
  validateCurrency(parsedPrice) {
    const expected = this.getExpectedCurrency();
    if (!expected) return parsedPrice;
    
    if (parsedPrice.currency !== expected) {
      console.warn(`Currency mismatch: expected ${expected}, got ${parsedPrice.currency}`);
      parsedPrice.confidence *= 0.8;
    }
    
    return parsedPrice;
  }
  
  /**
   * OPTIONAL: For sites with JavaScript-rendered prices
   * Use MutationObserver to wait for price element to appear
   * This is primarily useful for content scripts running on the page
   * Background checks won't have access to dynamic content
   */
  async waitForPriceElement(selectors, timeout = 10000) {
    return new Promise((resolve, reject) => {
      // Check if already present
      for (const selector of selectors) {
        const element = this.querySelector(selector);
        if (element?.textContent?.trim()) {
          resolve(element);
          return;
        }
      }
      
      // Wait for it to appear
      const observer = new MutationObserver(() => {
        for (const selector of selectors) {
          const element = this.querySelector(selector);
          if (element?.textContent?.trim()) {
            observer.disconnect();
            resolve(element);
            return;
          }
        }
      });
      
      observer.observe(this.document.body, {
        childList: true,
        subtree: true
      });
      
      setTimeout(() => {
        observer.disconnect();
        reject(new Error('Price element not found within timeout'));
      }, timeout);
    });
  }
}
```

Add JSDoc comments explaining the adapter pattern.
```

---

### **TASK 5.2: Create content-scripts/site-adapters/amazon.js**

**Prompt:**
```
Create Amazon adapter extending BaseAdapter.

Amazon has multiple regional domains with different currencies.

```javascript
import { BaseAdapter } from './base-adapter.js';

export class AmazonAdapter extends BaseAdapter {
  static CURRENCY_BY_DOMAIN = {
    'amazon.com': 'USD',
    'amazon.co.uk': 'GBP',
    'amazon.de': 'EUR',
    'amazon.fr': 'EUR',
    'amazon.it': 'EUR',
    'amazon.es': 'EUR',
    'amazon.ca': 'CAD',
    'amazon.com.au': 'AUD',
    'amazon.co.jp': 'JPY',
    'amazon.in': 'INR',
    'amazon.com.mx': 'MXN',
    'amazon.com.br': 'BRL',
    'amazon.nl': 'EUR',
    'amazon.se': 'SEK',
    'amazon.pl': 'PLN',
    'amazon.com.tr': 'TRY',
    'amazon.ae': 'AED',
    'amazon.sa': 'SAR',
    'amazon.sg': 'SGD'
  };
  
  getExpectedCurrency() {
    return AmazonAdapter.CURRENCY_BY_DOMAIN[this.domain] || 'USD';
  }
  
  detectProduct() {
    // Amazon product URLs contain /dp/ or /gp/product/
    return this.url.includes('/dp/') || this.url.includes('/gp/product/');
  }
  
  extractProductId() {
    // Extract ASIN (Amazon Standard Identification Number)
    // Format: /dp/B08N5WRWNW or /gp/product/B08N5WRWNW
    const match = this.url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
    return match ? match[1] : null;
  }
  
  extractTitle() {
    // Try multiple selectors (Amazon changes these frequently)
    const selectors = [
      '#productTitle',
      '#title',
      '.product-title',
      'h1[data-feature-name="title"]'
    ];
    
    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }
    
    return null;
  }
  
  extractPrice() {
    // Amazon has multiple price locations depending on deals
    const selectors = [
      '.a-price[data-a-color="price"] .a-offscreen',  // Main price
      '#priceblock_ourprice',                         // Our price
      '#priceblock_dealprice',                        // Deal price
      '.a-price-whole',                               // Whole price
      '[data-a-strike="true"] + .a-offscreen',       // Sale price
      '.priceToPay .a-offscreen'                      // Price to pay
    ];
    
    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        const text = element.textContent || element.getAttribute('content');
        const parsed = this.parsePriceWithContext(text);
        
        if (parsed && parsed.confidence >= 0.70) {
          return this.validateCurrency(parsed);
        }
      }
    }
    
    return null;
  }
  
  extractImage() {
    const selectors = [
      '#landingImage',
      '#imgBlkFront',
      '#main-image',
      '.a-dynamic-image'
    ];
    
    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        return element.src || element.getAttribute('data-old-hires');
      }
    }
    
    return null;
  }
}
```

Add comments explaining Amazon's DOM structure quirks.
```

---

### **TASK 5.3: Create content-scripts/site-adapters/ebay.js**

**Prompt:**
```
Create eBay adapter extending BaseAdapter.

eBay also has regional domains.

```javascript
import { BaseAdapter } from './base-adapter.js';

export class EbayAdapter extends BaseAdapter {
  static CURRENCY_BY_DOMAIN = {
    'ebay.com': 'USD',
    'ebay.co.uk': 'GBP',
    'ebay.de': 'EUR',
    'ebay.fr': 'EUR',
    'ebay.it': 'EUR',
    'ebay.es': 'EUR',
    'ebay.ca': 'CAD',
    'ebay.com.au': 'AUD',
    'ebay.ie': 'EUR',
    'ebay.nl': 'EUR',
    'ebay.be': 'EUR',
    'ebay.at': 'EUR',
    'ebay.ch': 'CHF',
    'ebay.in': 'INR',
    'ebay.com.sg': 'SGD',
    'ebay.com.my': 'MYR',
    'ebay.ph': 'PHP',
    'ebay.com.hk': 'HKD'
  };
  
  getExpectedCurrency() {
    return EbayAdapter.CURRENCY_BY_DOMAIN[this.domain] || 'USD';
  }
  
  detectProduct() {
    // eBay product URLs contain /itm/
    return this.url.includes('/itm/');
  }
  
  extractProductId() {
    // Extract item ID from URL
    // Format: /itm/123456789012
    const match = this.url.match(/\/itm\/(\d+)/);
    return match ? match[1] : null;
  }
  
  extractTitle() {
    const selectors = [
      'h1.x-item-title__mainTitle',
      '.it-ttl',
      '#itemTitle',
      'h1[itemprop="name"]'
    ];
    
    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }
    
    return null;
  }
  
  extractPrice() {
    const selectors = [
      '.x-price-primary [itemprop="price"]',
      '.x-price-primary span',
      '#prcIsum',
      '#mm-saleDscPrc',
      '[data-testid="x-price-primary"]'
    ];
    
    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        const text = element.textContent || element.getAttribute('content');
        const parsed = this.parsePriceWithContext(text);
        
        if (parsed && parsed.confidence >= 0.70) {
          return this.validateCurrency(parsed);
        }
      }
    }
    
    return null;
  }
  
  extractImage() {
    const selectors = [
      '.ux-image-carousel-item img',
      '#icImg',
      'img[itemprop="image"]'
    ];
    
    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        return element.src;
      }
    }
    
    return null;
  }
}
```
```

---

### **TASK 5.4-5.6: Create Walmart, Target, Best Buy Adapters**

**Prompt:**
```
Create three more adapters following the same pattern:

1. WalmartAdapter (content-scripts/site-adapters/walmart.js)
   - Domain: walmart.com
   - Currency: USD
   - URL pattern: /ip/
   - Price selectors: [itemprop="price"], .price-characteristic, [data-automation-id="product-price"]
   - Title selectors: [itemprop="name"], h1.prod-title, [data-automation-id="product-title"]
   - Image selectors: .prod-hero-image img, [data-testid="hero-image"]

2. TargetAdapter (content-scripts/site-adapters/target.js)
   - Domain: target.com
   - Currency: USD
   - URL pattern: /p/
   - Price selectors: [data-test="product-price"], .PriceRating, span[data-test="product-price"]
   - Title selectors: [data-test="product-title"], h1[data-test="product-detail-title"]
   - Image selectors: [data-test="image-gallery"] img, picture img

3. BestBuyAdapter (content-scripts/site-adapters/bestbuy.js)
   - Domain: bestbuy.com
   - Currency: USD
   - URL pattern: /site/
   - Price selectors: [data-testid="customer-price"], .priceView-customer-price, [itemprop="price"]
   - Title selectors: [data-testid="heading"], .sku-title, h1[itemprop="name"]
   - Image selectors: .primary-image, [data-testid="product-images"] img

All should:
- Extend BaseAdapter
- Implement all required methods
- Include currency validation
- Have error handling
- Use parsePriceWithContext() helper

Use the same structure as Amazon and eBay adapters.
Add helpful comments about each site's structure.
```

---

### **TASK 5.7: Create Adapter Factory**

**Prompt:**
```
Add to base-adapter.js (at the end, after the class):

```javascript
import { AmazonAdapter } from './amazon.js';
import { EbayAdapter } from './ebay.js';
import { WalmartAdapter } from './walmart.js';
import { TargetAdapter } from './target.js';
import { BestBuyAdapter } from './bestbuy.js';

export function getAdapter(document, url) {
  const domain = new URL(url).hostname;
  
  if (domain.includes('amazon')) {
    return new AmazonAdapter(document, url);
  }
  
  if (domain.includes('ebay')) {
    return new EbayAdapter(document, url);
  }
  
  if (domain.includes('walmart')) {
    return new WalmartAdapter(document, url);
  }
  
  if (domain.includes('target')) {
    return new TargetAdapter(document, url);
  }
  
  if (domain.includes('bestbuy')) {
    return new BestBuyAdapter(document, url);
  }
  
  // Return null if no adapter found
  // Will fall back to generic detection in product-detector.js
  return null;
}
```

This factory function will be used by product-detector.js to get the right adapter.
```

---

### **SESSION 5 COMPLETION CHECKLIST**

- [ ] base-adapter.js created with abstract class
- [ ] Amazon adapter created with multi-currency support
- [ ] eBay adapter created
- [ ] Walmart adapter created
- [ ] Target adapter created
- [ ] Best Buy adapter created
- [ ] Adapter factory function created
- [ ] All adapters properly extend BaseAdapter
- [ ] Currency validation implemented

### **Testing Session 5**

Test each adapter on real product pages:

```javascript
// In DevTools console on Amazon product page
import { getAdapter } from './content-scripts/site-adapters/base-adapter.js';

const adapter = getAdapter(document, window.location.href);
console.log('Adapter:', adapter.constructor.name);
console.log('Is product:', adapter.detectProduct());
console.log('Title:', adapter.extractTitle());
console.log('Price:', adapter.extractPrice());
console.log('Image:', adapter.extractImage());
console.log('Product ID:', adapter.extractProductId());
```

Test matrix:
- [ ] Amazon.com (USD)
- [ ] Amazon.co.uk (GBP)
- [ ] Amazon.de (EUR)
- [ ] Amazon.co.jp (JPY)
- [ ] eBay.com (USD)
- [ ] Walmart.com (USD)
- [ ] Target.com (USD)
- [ ] BestBuy.com (USD)

---

## SESSION 6: Background Service Worker & Price Checking (2 hours)

### **Objective**
Implement the background service worker that schedules and executes price checks.

### **Files to Create**
1. `background/service-worker.js` - Main background logic
2. `background/price-checker.js` - Price checking implementation
3. `utils/fetch-helper.js` - Network utilities

---

### **TASK 6.1: Create utils/fetch-helper.js**

**Prompt:**
```
Create fetch-helper.js with utilities for making network requests with proper error handling.

```javascript
export async function fetchWithTimeout(url, options = {}) {
  const timeout = options.timeout || 10000; // 10 seconds default
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control': 'no-cache',
        ...options.headers
      }
    });
    
    clearTimeout(timeoutId);
    return response;
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

export async function fetchWithRetry(url, options = {}) {
  const maxRetries = options.retries || 3;
  const retryDelay = options.retryDelay || 1000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchWithTimeout(url, options);
    } catch (error) {
      console.log(`[Fetch] Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      const delay = retryDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
}

export async function checkIfPageChanged(url, lastETag) {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'If-None-Match': lastETag || ''
      }
    });
    
    if (response.status === 304) {
      return { changed: false };
    }
    
    return {
      changed: true,
      etag: response.headers.get('ETag')
    };
  } catch (error) {
    // If HEAD fails, assume changed
    return { changed: true, etag: null };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class RateLimiter {
  constructor(maxRequests, timeWindow) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = [];
  }
  
  async waitIfNeeded() {
    const now = Date.now();
    
    // Remove old requests outside time window
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.timeWindow - (now - oldestRequest);
      
      if (waitTime > 0) {
        console.log(`[RateLimiter] Waiting ${waitTime}ms...`);
        await sleep(waitTime);
      }
    }
    
    this.requests.push(Date.now());
  }
}
```

Add JSDoc comments for all functions.
```

---

### **TASK 6.2: Create background/price-checker.js**

**Prompt:**
```
Create price-checker.js with the core price checking logic.

This file handles the actual fetching and parsing of product pages to check current prices.

Import all necessary modules:
- storage-manager.js
- fetch-helper.js
- getAdapter from site-adapters
- parsePrice from currency-parser
- comparePrices from price-extractor

```javascript
import { getAllProducts, updateProductPrice, getSettings } from './storage-manager.js';
import { fetchWithRetry, RateLimiter } from '../utils/fetch-helper.js';
import { getAdapter } from '../content-scripts/site-adapters/base-adapter.js';
import { parsePrice } from '../utils/currency-parser.js';
import { comparePrices } from '../content-scripts/price-extractor.js';

// Rate limiter: max 10 requests per minute
const rateLimiter = new RateLimiter(10, 60000);

export async function checkAllProducts() {
  console.log('[Price Checker] Starting price check cycle');
  
  try {
    const products = await getAllProducts();
    const productIds = Object.keys(products);
    
    if (productIds.length === 0) {
      console.log('[Price Checker] No products to check');
      return { checked: 0, updated: 0, failed: 0 };
    }
    
    const settings = await getSettings();
    const batches = createBatches(productIds, settings.checking.batchSize);
    
    let checked = 0;
    let updated = 0;
    let failed = 0;
    
    // Process batches with delays
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      console.log(`[Price Checker] Processing batch ${i + 1}/${batches.length}`);
      
      const results = await Promise.allSettled(
        batch.map(productId => checkSingleProduct(productId, products[productId]))
      );
      
      results.forEach((result, index) => {
        checked++;
        if (result.status === 'fulfilled' && result.value) {
          updated++;
        } else {
          failed++;
          console.error(`[Price Checker] Failed to check ${batch[index]}:`, result.reason);
        }
      });
      
      // Wait between batches (except last)
      if (i < batches.length - 1) {
        await sleep(2000); // 2 seconds between batches
      }
    }
    
    console.log(`[Price Checker] Completed: ${checked} checked, ${updated} updated, ${failed} failed`);
    
    return { checked, updated, failed };
    
  } catch (error) {
    console.error('[Price Checker] Error during check cycle:', error);
    return { checked: 0, updated: 0, failed: 0 };
  }
}

async function checkSingleProduct(productId, product) {
  try {
    // Rate limit
    await rateLimiter.waitIfNeeded();
    
    console.log(`[Price Checker] Checking: ${product.title}`);
    
    // Fetch product page
    const response = await fetchWithRetry(product.url, {
      timeout: 10000,
      retries: 3,
      retryDelay: 1000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    // Parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Try adapter-based extraction first
    const adapter = getAdapter(doc, product.url);
    let currentPrice = null;
    
    if (adapter && adapter.detectProduct()) {
      currentPrice = adapter.extractPrice();
    }
    
    // Fallback to generic extraction
    if (!currentPrice) {
      currentPrice = extractPriceGeneric(doc, product);
    }
    
    if (!currentPrice) {
      throw new Error('Could not extract price');
    }
    
    // Compare prices
    const comparison = comparePrices(product.price, currentPrice);
    
    if (!comparison.comparable) {
      console.warn(`[Price Checker] Currency mismatch for ${productId}`);
      // Handle currency change
      await handleCurrencyChange(productId, product, currentPrice);
      return false;
    }
    
    // Update product
    await updateProductPrice(productId, currentPrice);
    
    // Check if price dropped significantly
    if (comparison.dropped && comparison.percentage >= 5) {
      console.log(`[Price Checker] Price drop detected: ${comparison.percentage}%`);
      await handlePriceDrop(productId, product, currentPrice, comparison);
    }
    
    return true;
    
  } catch (error) {
    console.error(`[Price Checker] Error checking ${productId}:`, error);
    
    // Increment failed check counter
    const products = await getAllProducts();
    if (products[productId]) {
      products[productId].tracking.failedChecks++;
      
      // Mark as stale after 3 consecutive failures
      if (products[productId].tracking.failedChecks >= 3) {
        products[productId].tracking.status = 'stale';
      }
      
      await chrome.storage.local.set({ products });
    }
    
    return false;
  }
}

function extractPriceGeneric(doc, product) {
  // Try Schema.org first
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent);
      if (data['@type'] === 'Product' && data.offers?.price) {
        return parsePrice(String(data.offers.price), {
          domain: product.domain,
          expectedCurrency: product.price.currency
        });
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  // Try Open Graph
  const ogPrice = doc.querySelector('meta[property="og:price:amount"]')?.content;
  if (ogPrice) {
    return parsePrice(ogPrice, {
      domain: product.domain,
      expectedCurrency: product.price.currency
    });
  }
  
  // Try common selectors
  const selectors = [
    '[itemprop="price"]',
    '.price',
    '[data-price]',
    '[class*="price"]'
  ];
  
  for (const selector of selectors) {
    const elements = doc.querySelectorAll(selector);
    for (const element of elements) {
      const text = element.textContent || element.getAttribute('content');
      const parsed = parsePrice(text, {
        domain: product.domain,
        expectedCurrency: product.price.currency
      });
      
      if (parsed && parsed.confidence >= 0.70) {
        return parsed;
      }
    }
  }
  
  return null;
}

async function handlePriceDrop(productId, product, newPrice, comparison) {
  // Import notification manager
  const { showPriceDropNotification } = await import('../utils/notification-manager.js');
  
  const settings = await getSettings();
  
  // Check if notifications enabled
  if (!settings.notifications.enabled) {
    return;
  }
  
  // Check if drop is significant enough
  if (comparison.percentage < settings.notifications.minDropPercentage) {
    return;
  }
  
  // Check notification cooldown (max per day)
  const products = await getAllProducts();
  const productData = products[productId];
  
  const today = new Date().setHours(0, 0, 0, 0);
  const lastNotified = productData.notifications.lastNotified;
  
  if (lastNotified) {
    const lastNotifiedDay = new Date(lastNotified).setHours(0, 0, 0, 0);
    if (lastNotifiedDay === today) {
      const notifCountToday = productData.notifications.notificationCount || 0;
      if (notifCountToday >= settings.notifications.maxPerDay) {
        console.log('[Price Checker] Notification limit reached for today');
        return;
      }
    }
  }
  
  // Send notification
  await showPriceDropNotification(
    productData,
    product.price,
    newPrice,
    comparison.percentage
  );
  
  // Update notification metadata
  productData.notifications.lastNotified = Date.now();
  productData.notifications.notificationCount = (productData.notifications.notificationCount || 0) + 1;
  await chrome.storage.local.set({ products });
}

async function handleCurrencyChange(productId, product, newPrice) {
  // Currency changed - notify user and reset tracking
  console.warn(`[Price Checker] Currency changed for ${productId}: ${product.price.currency} -> ${newPrice.currency}`);
  
  // Update product with new currency
  const products = await getAllProducts();
  products[productId].price = newPrice;
  products[productId].priceHistory = [{
    price: newPrice.numeric,
    currency: newPrice.currency,
    timestamp: Date.now(),
    checkMethod: 'currency_reset'
  }];
  products[productId].tracking.currencyChangeDate = Date.now();
  
  await chrome.storage.local.set({ products });
  
  // Optionally notify user
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '../assets/icons/icon-128.png',
    title: 'Currency Changed',
    message: `${product.title} now shows in ${newPrice.currency} instead of ${product.price.currency}. Tracking restarted.`
  });
}

function createBatches(array, batchSize) {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function calculatePriority(product) {
  let score = 100;
  const now = Date.now();
  
  // Recently viewed = higher priority
  const daysSinceView = (now - product.tracking.lastViewed) / (1000 * 60 * 60 * 24);
  score -= daysSinceView * 2;
  
  // Price volatility = higher priority
  if (product.priceHistory && product.priceHistory.length > 1) {
    const prices = product.priceHistory.map(h => h.price);
    const variance = calculateVariance(prices);
    score += variance * 10;
  }
  
  // Approaching expiry = lower priority
  const daysTracked = (now - product.tracking.firstSeen) / (1000 * 60 * 60 * 24);
  if (daysTracked > 25) {
    score -= 50;
  }
  
  return Math.max(0, score);
}

function calculateVariance(numbers) {
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squareDiffs = numbers.map(n => Math.pow(n - mean, 2));
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / numbers.length);
}
```

Add extensive error handling and logging.
```

---

### **TASK 6.3: Create background/service-worker.js**

**Prompt:**
```
Create service-worker.js - the main background script that ties everything together.

This sets up alarms, listens for events, and orchestrates price checking.

```javascript
import { checkAllProducts } from './price-checker.js';
import { cleanupOldProducts, getSettings } from './storage-manager.js';
import { saveProduct } from './storage-manager.js';

console.log('[Service Worker] Initializing...');

// Set up alarm for periodic price checking
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Service Worker] Extension installed/updated');
  
  // Create alarm for price checking
  const settings = await getSettings();
  await setupPriceCheckAlarm(settings.checking.interval);
  
  // Create alarm for daily cleanup
  chrome.alarms.create('cleanup', { periodInMinutes: 1440 }); // 24 hours
  
  // Run initial check after 5 minutes
  chrome.alarms.create('initialCheck', { delayInMinutes: 5 });
});

// Listen for alarm triggers
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log(`[Service Worker] Alarm triggered: ${alarm.name}`);
  
  if (alarm.name === 'priceCheck' || alarm.name === 'initialCheck') {
    try {
      const result = await checkAllProducts();
      console.log('[Service Worker] Price check completed:', result);
      
      // Update badge with number of price drops
      if (result.updated > 0) {
        chrome.action.setBadgeText({ text: String(result.updated) });
        chrome.action.setBadgeBackgroundColor({ color: '#00AA00' });
      }
    } catch (error) {
      console.error('[Service Worker] Price check failed:', error);
    }
  }
  
  if (alarm.name === 'cleanup') {
    try {
      const deletedCount = await cleanupOldProducts();
      console.log(`[Service Worker] Cleanup completed: ${deletedCount} products removed`);
    } catch (error) {
      console.error('[Service Worker] Cleanup failed:', error);
    }
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Service Worker] Message received:', message.type);
  
  if (message.type === 'PRODUCT_DETECTED') {
    handleProductDetected(message.data)
      .then(result => sendResponse({ success: true, productId: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'CHECK_NOW') {
    checkAllProducts()
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.type === 'UPDATE_SETTINGS') {
    handleSettingsUpdate(message.settings)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Handle product detection from content script
async function handleProductDetected(productData) {
  try {
    const productId = await saveProduct(productData);
    console.log(`[Service Worker] Product saved: ${productId}`);
    
    // Show subtle notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '../assets/icons/icon-128.png',
      title: 'Now tracking price',
      message: `${productData.title.slice(0, 50)}${productData.title.length > 50 ? '...' : ''}`,
      silent: true,
      priority: 0
    });
    
    return productId;
  } catch (error) {
    console.error('[Service Worker] Error saving product:', error);
    throw error;
  }
}

// Handle settings updates
async function handleSettingsUpdate(newSettings) {
  const { updateSettings } = await import('./storage-manager.js');
  await updateSettings(newSettings);
  
  // Update alarm if check interval changed
  if (newSettings.checking?.interval) {
    await setupPriceCheckAlarm(newSettings.checking.interval);
  }
}

// Set up price check alarm with specified interval
async function setupPriceCheckAlarm(intervalHours) {
  // Clear existing alarm
  await chrome.alarms.clear('priceCheck');
  
  // Create new alarm
  chrome.alarms.create('priceCheck', {
    periodInMinutes: intervalHours * 60
  });
  
  console.log(`[Service Worker] Price check alarm set to ${intervalHours} hours`);
}

// Handle notification clicks
chrome.notifications.onClicked.addListener(async (notificationId) => {
  // If notification ID is a product ID, open that product
  const products = await getAllProducts();
  if (products[notificationId]) {
    chrome.tabs.create({ url: products[notificationId].url });
  }
  
  // Clear notification
  chrome.notifications.clear(notificationId);
});

console.log('[Service Worker] Ready');
```

Add comprehensive logging for debugging.
Ensure all async operations are properly handled.
```

---

### **SESSION 6 COMPLETION CHECKLIST**

- [ ] fetch-helper.js created with retry logic
- [ ] price-checker.js created with batching
- [ ] service-worker.js created with alarms
- [ ] Rate limiting implemented
- [ ] Priority system for products
- [ ] Currency change handling
- [ ] Error handling for all scenarios

### **Testing Session 6**

1. Load extension in Chrome
2. Open extension service worker console: chrome://extensions/ → Service Worker
3. Track a product by visiting a product page
4. Manually trigger check:
   ```javascript
   chrome.alarms.create('priceCheck', { delayInMinutes: 0.1 });
   ```
5. Watch console logs for check progress
6. Verify product prices update in storage

---

