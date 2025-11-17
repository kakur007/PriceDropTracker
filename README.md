# Price Drop Tracker - Never miss a deal again

Automatically track product prices across major e-commerce sites and get notified when prices drop. No manual setup required - just browse normally and let the extension do the work.

## Features

- **Automatic Price Tracking** - No manual adding required. Browse any product page and it's automatically tracked.
- **Multi-Currency Support** - Works with 30+ currencies worldwide (USD, EUR, GBP, JPY, CAD, AUD, and more).
- **Background Price Monitoring** - Checks prices automatically every 6 hours in the background.
- **Smart Price Drop Notifications** - Get notified when prices drop below your threshold (configurable: 5%, 10%, 15%, 20%).
- **Works on Major E-commerce Sites** - Amazon, eBay, Walmart, Target, Best Buy, and their regional variants.
- **100% Privacy-Focused** - All data stored locally on your device. No external servers, no tracking, no data collection.
- **Lightweight & Fast** - Uses less than 50MB of memory and 10MB of storage.
- **30-Day Automatic Tracking** - Products are tracked for 30 days by default (configurable: 7, 14, 30, or 60 days).

## Installation

### From Chrome Web Store (Coming Soon)
1. Visit [Chrome Web Store](#) (link will be added after submission)
2. Click "Add to Chrome"
3. Start browsing - that's it!

### Manual Installation (For Development)
1. Download or clone this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/price-drop-tracker.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the `price-drop-tracker` directory
6. The extension icon will appear in your toolbar

## How It Works

1. **Browse Normally** - Visit any product page on supported e-commerce sites
2. **Automatic Tracking** - The extension detects the product and starts tracking its price
3. **Background Monitoring** - Prices are checked automatically every 6 hours
4. **Get Notified** - When a price drops below your threshold, you'll get a notification
5. **Click to Buy** - Click the notification to visit the product page and make your purchase

It's that simple! No accounts, no manual setup, no hassle.

## Supported Sites

### Tier 1 (Fully Supported)
- **Amazon** - All regional domains (.com, .co.uk, .de, .fr, .it, .es, .ca, .com.au, .co.jp, .in)
- **eBay** - All regional domains (.com, .co.uk, .de, and more)
- **Walmart** - Walmart.com
- **Target** - Target.com
- **Best Buy** - BestBuy.com

### Tier 2 (Planned)
- Etsy, AliExpress, Shopify stores
- Regional: Zalando, ASOS, MediaMarkt

## Privacy & Permissions

We take your privacy seriously. This extension is designed to be **100% privacy-focused**.

### Why We Need These Permissions

- **Storage** - To save your tracked products locally on your device
- **Alarms** - To schedule automatic price checks in the background
- **Notifications** - To alert you when prices drop
- **Tabs** - To detect when you visit product pages
- **Host Permissions** - To access product pages on supported e-commerce sites for price checking

### What We DON'T Do

- ❌ No external servers or cloud storage
- ❌ No user tracking or analytics
- ❌ No data collection or sharing
- ❌ No browsing history tracking
- ❌ No personal information access

**All data stays on your device.** You can export your data at any time from the settings page.

## Development Setup

### Prerequisites
- Google Chrome (version 88 or higher)
- Node.js (optional, for testing)
- Git

### Installation Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/price-drop-tracker.git
   cd price-drop-tracker
   ```

2. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the project directory

3. Test the extension:
   - Visit any product page on Amazon, eBay, Walmart, Target, or Best Buy
   - Check the extension popup to see tracked products
   - Open Chrome DevTools Console to see debug logs

### Testing Instructions

1. **Test Product Detection**:
   - Visit a product page on a supported site
   - Open the extension popup
   - Verify the product appears in the list

2. **Test Price Tracking**:
   - Open Chrome DevTools Console (F12)
   - Check for messages like "Product detected" and "Price extracted"
   - Verify the price is stored correctly in `chrome://extensions/` > Storage

3. **Test Notifications**:
   - Manually modify a product's price in storage to simulate a price drop
   - Trigger the background price check
   - Verify you receive a notification

## Project Structure

```
price-drop-tracker/
├── manifest.json              # Chrome Extension configuration
├── background/                # Background service worker
│   ├── service-worker.js      # Main background logic
│   ├── price-checker.js       # Scheduled price checking
│   └── storage-manager.js     # Data persistence
├── content-scripts/           # Content scripts for product detection
│   ├── product-detector.js    # Identifies product pages
│   ├── price-extractor.js     # Extracts price data
│   └── site-adapters/         # Site-specific logic
├── popup/                     # Extension popup UI
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── options/                   # Settings page
│   ├── settings.html
│   ├── settings.js
│   └── settings.css
├── utils/                     # Shared utilities
│   ├── currency-parser.js     # Multi-currency support
│   ├── currency-data.js       # Currency definitions
│   ├── notification-manager.js # Notification handling
│   ├── product-hasher.js      # Unique ID generation
│   └── fetch-helper.js        # Network utilities
├── assets/                    # Icons and images
└── tests/                     # Test files
```

## Contributing

We welcome contributions! Here's how you can help:

### Reporting Bugs
1. Check if the issue already exists in [Issues](https://github.com/YOUR_USERNAME/price-drop-tracker/issues)
2. Create a new issue with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser version and extension version
   - Screenshots if applicable

### Requesting Features
1. Open a new issue with the "Feature Request" label
2. Describe the feature and why it would be useful
3. Provide examples or mockups if possible

### Pull Request Guidelines
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Commit with clear messages (`git commit -m 'Add amazing feature'`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request with a clear description

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Roadmap

### Phase 1: MVP (Current)
- ✅ Basic product detection
- ✅ Multi-currency price extraction
- ✅ Background price checking
- ✅ Price drop notifications
- ✅ Popup dashboard
- ✅ Settings page

### Phase 2: Advanced Features (Planned)
- [ ] Price history charts
- [ ] Product comparison
- [ ] Wishlist sharing
- [ ] Price prediction (ML-based)
- [ ] Browser sync across devices
- [ ] Custom price alerts per product
- [ ] Weekly summary reports
- [ ] More e-commerce sites (Etsy, AliExpress, Shopify)

### Phase 3: Premium Features (Future)
- [ ] Export to CSV/JSON
- [ ] Import from Amazon wishlist
- [ ] Advanced filtering and sorting
- [ ] Dark mode
- [ ] Keyboard shortcuts
- [ ] Mobile companion app

## Support

### Need Help?
- **Developer**: [GoGoNano](https://gogonano.com)
- **Support**: Visit [GoGoNano Support](https://gogonano.com/support)
- **Issues**: Report bugs or request features in [Issues](https://github.com/kakur007/PriceDropTracker/issues)

### FAQ

**Q: Why isn't my product being tracked?**
A: Make sure you're on a supported site and the page is a product detail page (not search results or category pages).

**Q: How often are prices checked?**
A: By default, every 6 hours. You can change this in settings (3, 6, 12, or 24 hours).

**Q: Can I track more than 100 products?**
A: The default limit is 100 products to maintain performance. You can adjust this in settings.

**Q: Is my data synced across devices?**
A: Not yet. All data is stored locally. Browser sync is planned for a future release.

**Q: Why did I get a notification for a small price change?**
A: Check your notification threshold in settings. Default is 5%, but you can set it to 10%, 15%, or 20%.

## Acknowledgments

- Built with [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/)
- Developed by [GoGoNano](https://gogonano.com)
- Inspired by the need for a privacy-focused price tracker
- Thanks to all contributors and testers

## Statistics

- **Lines of Code**: ~2,500
- **Files**: 25+
- **Supported Currencies**: 30+
- **Supported Sites**: 5 (Tier 1)
- **Chrome Web Store Rating**: ⭐⭐⭐⭐⭐ (Coming soon!)

---

**Developed by [GoGoNano](https://gogonano.com)**

If you find this extension useful, please consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs at [GoGoNano Support](https://gogonano.com/support)
- 💡 Suggesting features
- 🤝 Contributing code
- 📢 Sharing with friends

Happy deal hunting! 🎉
