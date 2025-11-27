# Changelog

All notable changes to Price Genius will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-11-27

### Added
- **OpenCart Adapter**: Platform-agnostic adapter for OpenCart-based e-commerce sites
  - Detects OpenCart sites by URL patterns and page structure
  - Supports price extraction with sale/regular price differentiation
  - Tested with hawaii.ee and compatible with other OpenCart stores
- **Alensa Adapter**: Site-specific adapter for alensa.ee
  - Uses JSON-LD structured data extraction for reliable price detection
  - Supports both initial page load and background price checks
  - Leverages BaseAdapter's built-in JSON-LD extraction methods

### Changed
- Updated adapter factory to register new OpenCart and Alensa adapters
- Improved platform-based detection logic to check OpenCart alongside WooCommerce

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
