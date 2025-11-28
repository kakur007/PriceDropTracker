# Changelog

All notable changes to Price Genius will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- **Alensa adapter detection**:
  - More detailed error logging shows exactly which detection checks failed
  - Multiple independent detection checks (OR logic) for better reliability
  - Schema detection, price box, add-to-cart button, product input, and body class checks
- **Both adapters**:
  - Comprehensive debug information logged for each detection attempt
  - Failures always visible via `debugError()` for production troubleshooting
  - More lenient detection to handle edge cases and page loading timing issues

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
