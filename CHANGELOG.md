# Changelog

All notable changes to Price Genius will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-11-27

### Added
- **OpenCart Adapter**: Platform-agnostic adapter for OpenCart-based e-commerce sites
  - Detects OpenCart sites by page structure (URL-agnostic)
  - Supports localized paths: `/toode/` (Estonian), `/produkt/` (German), `/produit/` (French), `/producto/` (Spanish)
  - Priority 1: Meta tag extraction (`og:price:amount`) - same method as background refresh
  - Priority 2: `.price-new` with text node extraction (prevents concatenation errors)
  - Priority 3: `.price` with sanity checks (rejects prices > 50000)
  - Priority 4: JSON-LD fallback
  - Tested with hawaii.ee and compatible with other OpenCart stores
- **Alensa Adapter**: Site-specific adapter for alensa.ee
  - Schema-based detection (checks for Product in JSON-LD)
  - Uses JSON-LD WebPage with mainEntity.Product extraction
  - Handles `@graph` structure with nested product data
  - Falls back to DOM selectors if JSON-LD unavailable
  - Multiple detection methods for reliability
- **Critical Error Logging**: Added `debugError()` for detection and extraction failures
  - Always visible regardless of debug mode setting
  - Shows exact values that failed validation
  - Helps troubleshoot adapter issues in production

### Changed
- Updated adapter factory to register new OpenCart and Alensa adapters
- Improved platform-based detection logic to check OpenCart alongside WooCommerce
- Settings page version updated to 1.1.0
- Detection logic made much more lenient (multiple independent checks)

### Fixed
- OpenCart price extraction prevents "799999" concatenation errors
  - Added text node-only extraction method
  - Added sanity checks for all price sources
  - Meta tag extraction prioritized (most reliable)
- Alensa detection now works on all product pages
  - Multiple independent detection checks (OR logic)
  - No longer requires specific URL patterns
- Both adapters now log comprehensive debug information
  - Each detection check logged individually
  - Failures always visible via `debugError()`

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
