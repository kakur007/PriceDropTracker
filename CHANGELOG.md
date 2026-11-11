# Changelog

All notable changes to Price Genius will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-11-11

### Added
- **"Is this deal real?"**: when a store shows a discount, Price Genius compares it with
  your own price history for that product, and with the "lowest price of the last 30 days"
  notice if the store prints one (EU Omnibus rule; read in 15+ EU languages). Verdicts:
  *Discount looks inflated*, *Real discount*, *Was cheaper recently*, *Lowest price in 30 days*
- **Price panel on product pages**: a small, dismissible card on tracked products (current
  price, lowest seen, your alert) and on untracked products whose store prints a 30-day
  price notice. Can be switched off in Settings → Appearance
- The popup's current-page card shows the same verdict; untracked products with a
  discount get a nudge to track them

### Changed
- New Price Genius icon everywhere: toolbar, extension list, popup, settings, price history,
  privacy and onboarding pages, on-page panel and notifications; toolbar count badge uses the
  brand teal
- **Removed the `tabs` permission**: Chrome no longer shows "Read your browsing history"
  when installing. The current page is read via `activeTab` only when the user clicks the
  icon or uses the shortcut

## [1.3.0] - 2026-11-11

Focus: work on (almost) every store, and a simpler, modern popup.

### Added
- **Price alerts per product**: bell icon on each product - notify on the default
  threshold, any drop, a drop of at least N %, when the price falls below a target, or
  never. Products with a custom alert show a badge
- **Back-in-stock alerts**: availability is read from the page on every check; you're
  notified when a product that was out of stock becomes available (on by default, per product)
- **Variant-aware tracking**: the size/pack/colour selected on the page is remembered
  (WooCommerce variations, Shopify variants, structured-data SKUs). Background checks read
  that variant's price instead of the default one, and never fall back to another
  variant's price. Re-picking the price on an older entry upgrades it in place
- **Keyboard shortcuts**: Alt+Shift+T tracks the product on the current page (or opens the
  price picker if none is found), Alt+Shift+P opens Price Genius. Change them in Settings
- **CSV export** for Excel / Numbers / Google Sheets (current, first, lowest and highest
  price, change, alert, availability); uses `;` and decimal commas in locales that expect them
- The "At most N alerts a day" setting is now actually enforced
- **Track any store from the popup**: the popup scans the current tab (using the
  `activeTab` permission) and shows the product it found with a **Track price** button -
  no permission prompt needed just to track
- **Pick price on page**: when automatic detection fails or picks the wrong number, click
  the price yourself. The chosen element is remembered and re-read on every background check
- Stores you grant access to now behave like built-in stores (detection runs on every
  visit, including single-page-app navigation)
- Visiting a product you already track refreshes its price from the live page and notifies
  you on a drop - this also keeps JavaScript-heavy stores accurate
- Background thumbnail fallback for stores whose images block cross-origin canvas use
- Setting: "Track every product I open" (opt-in, off by default). Only products you add
  are tracked; existing installs are switched to opt-in as well
- Undo after removing a product
- Every product shows its alert state at a glance (coloured pill with the rule, or a dashed
  "Set alert"), plus an "Alerts" filter in the popup
- Browser fixture tests (`tests/run-fixture-tests.mjs`) and an end-to-end extension test

### Changed
- Redesigned settings page (toggles, store-access list with "Remove access", theme
  choice) and onboarding page (pin-the-icon step, how-it-works, privacy summary);
  Price history and Privacy pages share the same header and theme
- Redesigned popup: current-page card, search, sort, filter chips (All / Price drops /
  Needs attention), price sparklines, follows the system light/dark theme
- One shared extractor (`utils/page-extractor.js`) is now used by the content script,
  the Firefox background page and the Chrome offscreen document - previously three
  copies had drifted apart, so the price found when tracking could differ from the price
  read on later checks
- Detection retries while JavaScript-rendered prices load, and re-runs when a store
  changes pages without reloading
- Cross-platform Node build script (`npm run build`); browser manifests are generated
  from `manifest.json`

### Fixed
- **Products could be added to the store cart by background checks**: if a product was
  saved from a URL carrying a cart action (e.g. WooCommerce `?add-to-cart=…`), every
  background check repeated it. Product URLs are now sanitized (canonical URL preferred,
  cart/action/session/tracking parameters stripped, cart/checkout URLs never tracked),
  existing stored URLs are cleaned on update, and background checks no longer send the
  store's cookies at all
- The price picker now intercepts clicks on `window` and swallows pointer/touch events,
  so picking a price inside a buy button can't trigger it
- "Allow checks" stayed visible after access was granted when the price had changed
- Products with variants recorded the default variant's price on background checks
  (e.g. single item instead of the selected 60-pack), showing fake price drops
- Summary notifications for more than 3 drops ignored the minimum-drop threshold
- Popup showed the text "null" on tracked products
- **Automatic background price checks never ran**: the service worker read settings keys
  that don't exist (`tracking.enabled` / `tracking.checkInterval`), so the periodic alarm
  was never created. It now uses the "Check frequency" setting
- WooCommerce/OpenCart adapters claimed unrelated stores (any page with an `<h1>` and a
  `.price`, or any URL containing `/product/`) and overrode correct structured data
- A site adapter saying "not a product page" stopped detection entirely instead of
  falling back to the generic layers
- Generic detection required specific URL patterns (`/product/`, `/p/`, …), so stores
  with plain slug URLs were never detected
- JSON-LD that real stores ship with HTML comments, raw newlines or trailing commas was
  ignored; `priceSpecification`, nested `AggregateOffer` and `ProductGroup` variants
  (selected by URL) are now supported; related/recommended products are skipped
- Microdata picked prices from nested related products
- Shopify prices under $10 were read as whole units (599 → $599 instead of $5.99)
- Missing currency in structured data defaulted to EUR instead of being inferred
- Struck-through "was" prices, shipping fees and recommendation carousels are no longer
  picked as the product price
- Failed-check counters and "stale" status were never saved for existing products
- Background checks ignore implausible jumps read by generic selectors and currency changes
- Chrome build was missing the `offscreen` permission, so background checks fell back to
  regex parsing
- Firefox build loaded the ES-module background script without `"type": "module"`
- Build scripts had a hard-coded `/home/user/...` path

### Removed
- `manifest-chrome.json`, `manifest-firefox.json`, `build.sh` and the bash build scripts
  (replaced by `scripts/build.mjs`)

## [1.2.1] - 2026-05-05

### Changed
- Converted options-page storage and message calls to promise-style browser APIs
- Updated user-facing version and browser-support references
- Added package module type for Node-based ES module tests

### Fixed
- Extension badge count now correctly counts stored product objects
- Data export now uses the shared browser polyfill instead of direct Chrome storage
- Notification cooldown checks now await storage reads correctly
- Notification price formatting now uses nested product price currency/locale data
- Shared fetch rate limiter now uses cross-browser storage APIs
- Notification click handling now uses cross-browser extension APIs

## [1.2.0] - 2026-05-05

### Added
- Embedded product JSON detection for Shopify-style product pages
- Background/offscreen refresh support for embedded product JSON prices
- Real `npm test` command for the currency parser test suite

### Changed
- Open Graph extraction now supports `product:price:*` meta tags and better title/image fallbacks
- Microdata extraction now reads `content`, `href`, and lazy image attributes
- Generic URL filtering is less aggressive for product pages nested under `/shop` or `/collections`
- Main content script now avoids duplicate detector auto-runs after dynamic import

### Fixed
- Firefox-safe content-script browser API lookup
- Nested Schema.org parsing in background/offscreen price refreshes
- Schema.org `@type` arrays and full schema.org URLs in product and offer detection
- Brazilian Real (`R$`) currency detection
- Sale text parsing now prefers the current `Now` price

## [1.1.0] - 2025-11-28

### Added
- **OpenCart Adapter**: Platform-agnostic adapter for OpenCart-based e-commerce sites
  - Detects OpenCart sites by page structure (URL-agnostic)
  - Supports localized paths: `/toode/` (Estonian), `/produkt/` (German), `/produit/` (French), `/producto/` (Spanish)
  - Priority 1: Meta tag extraction (`og:price:amount`) - same method as background refresh
  - Priority 2: `.special` and `.price-new` for sale prices with text node extraction
  - Priority 3: `.price` with sanity checks (rejects prices > 50000)
  - Priority 4: JSON-LD fallback
  - Supports multiple OpenCart CSS variants (`.special`/`.old-price` for hawaii.ee)
  - JavaScript variable extraction for product IDs (`is_ajax_data`, `$product_id`)
  - Tested with hawaii.ee and compatible with other OpenCart stores
- **Alensa Adapter**: Site-specific adapter for alensa.ee
  - Schema-based detection (checks for Product in JSON-LD)
  - Uses JSON-LD WebPage with mainEntity.Product extraction
  - Handles `@graph` structure with nested product data
  - Falls back to DOM selectors if JSON-LD unavailable
  - Multiple detection methods for reliability
- **Thomann Adapter**: Site-specific adapter for music gear e-commerce (thomann.de/com/co.uk)
  - Multi-domain currency mapping (EUR for .de, USD for .com, GBP for .co.uk)
  - Priority extraction: JSON-LD Product schema → Meta tags → DOM selectors
  - Lenient detection using URL patterns (.html), JSON-LD, or page elements
  - Product ID extraction from sku, articleId input, or "Item no." text
  - Reusable `extractFromJsonLd()` helper for schema extraction
- **Critical Error Logging**: Added `debugError()` for detection and extraction failures
  - Always visible regardless of debug mode setting
  - Shows exact values that failed validation
  - Helps troubleshoot adapter issues in production
  - Detailed detection check logging shows which criteria passed/failed

### Changed
- Updated adapter factory to register new OpenCart, Alensa, and Thomann adapters
- Improved platform-based detection logic to check OpenCart alongside WooCommerce
- Settings page version updated to 1.1.0
- Detection logic made much more lenient (multiple independent checks with OR logic)
- OpenCart adapter now checks for JavaScript product data as detection signal
- Enhanced error messages show specific detection criteria results

### Fixed
- **OpenCart adapter for hawaii.ee**:
  - Added support for `.special` and `.old-price` CSS classes (hawaii.ee variant)
  - Fixed price extraction to handle multiple OpenCart theme variations
  - Improved product detection using JavaScript variables (`"page":"product"`, `product_id`)
  - Enhanced product ID extraction from JavaScript data structures
  - Price sanity checks prevent concatenation errors (e.g., "799999" instead of "799.99")
  - Check ALL price elements instead of just the first (querySelectorAll)
  - Skip prices inside product listings (`.product-grid`, `.product-thumb`) to avoid wrong products
  - Fallback to `<strong>` tags near h1 for non-standard themes
  - Always-visible console logging for price extraction (works without debug mode)
  - Log actual text content being parsed for easy troubleshooting
- **Alensa adapter detection**:
  - More detailed error logging shows exactly which detection checks failed
  - Multiple independent detection checks (OR logic) for better reliability
  - Schema detection, price box, add-to-cart button, product input, and body class checks
  - Check ALL matching elements for each selector (not just first)
  - Added `[class*="price"]` and `strong` tag selectors as fallbacks
  - Search h1 container for price patterns as last resort
  - Show confidence scores for failed parsing attempts
- **Both adapters**:
  - Comprehensive debug information logged for each detection attempt
  - Failures always visible via `debugError()` for production troubleshooting
  - More lenient detection to handle edge cases and page loading timing issues
  - Multiple fallback strategies for non-standard e-commerce themes
  - Always-visible diagnostic logging (console.log) for critical extraction steps

## [1.0.0] - 2025-11-XX

### Added
- Initial release of Price Genius extension
- Support for major retailers:
  - Amazon (all international domains)
  - eBay (all international domains)
  - Walmart, Target, Best Buy
  - Etsy, AliExpress
  - Zalando (all European domains)
  - Boozt and Booztlet
  - Sports Direct
- WooCommerce platform adapter for WordPress-based stores
- Automatic price monitoring with configurable check intervals
- Browser notifications for price drops
- Price history tracking and visualization
- Multi-currency support
- Chrome and Firefox compatibility
