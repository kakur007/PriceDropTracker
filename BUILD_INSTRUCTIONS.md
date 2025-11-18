# 🔨 Build Instructions

Complete guide for building **Price Genius** for Chrome and Firefox from source.

## 📋 Overview

Price Genius is a **cross-browser extension** built with:
- **Single codebase** for Chrome and Firefox
- **No build tools** required (vanilla JavaScript ES6+)
- **No minification** or obfuscation
- **Browser API polyfill** for compatibility

## 🚀 Quick Build

### Prerequisites
```bash
# Check if you have bash
bash --version

# Optional: Node.js for npm scripts
node --version  # Should be 14+
```

### Build Commands

```bash
# Clone repository
git clone https://github.com/kakur007/PriceDropTracker.git
cd PriceDropTracker

# Build Chrome version
npm run build:chrome
# or: bash scripts/build-chrome.sh

# Build Firefox version
npm run build:firefox
# or: bash scripts/build-firefox.sh

# Build both
npm run build
# or: bash scripts/build-all.sh
```

### Build Output

```
dist/
├── chrome/                                   # Unpacked Chrome extension
│   ├── manifest.json                         # Chrome manifest
│   ├── background/
│   ├── content-scripts/
│   ├── popup/
│   ├── options/
│   ├── utils/
│   └── assets/
├── firefox/                                  # Unpacked Firefox extension
│   ├── manifest.json                         # Firefox manifest (from manifest-firefox.json)
│   ├── background/
│   ├── content-scripts/
│   ├── popup/
│   ├── options/
│   ├── utils/
│   └── assets/
├── price-genius-chrome-v1.0.0.zip           # Chrome Web Store package
├── price-genius-firefox-v1.0.0.zip          # Firefox Add-ons package
└── price-genius-firefox-source-v1.0.0.zip   # Firefox source code (for reviewers)
```

---

## 🔍 For Extension Reviewers

### No Build Process Required

**This extension does NOT use:**
- ❌ Webpack, Rollup, or any bundler
- ❌ Babel, TypeScript, or transpilation
- ❌ Minification or obfuscation
- ❌ Code generation or preprocessing

**This extension DOES use:**
- ✅ Vanilla JavaScript ES6+ modules
- ✅ Native browser APIs
- ✅ Browser API polyfill (for cross-browser support)

### How to Verify

1. **Extract the ZIP file**
   ```bash
   unzip price-genius-firefox-v1.0.0.zip -d extracted/
   ```

2. **Verify source code matches**
   ```bash
   # All JavaScript files are human-readable
   cat extracted/background/service-worker.js
   cat extracted/utils/browser-polyfill.js
   ```

3. **Load in browser directly**
   - **Firefox:** `about:debugging` → Load Temporary Add-on → Select `manifest.json`
   - **Chrome:** `chrome://extensions` → Load unpacked → Select `extracted/` folder

4. **No build step needed**
   - Extension works directly from source
   - All code is readable and unmodified

---

## 📦 What the Build Scripts Do

### Chrome Build (`scripts/build-chrome.sh`)

```bash
#!/bin/bash
# 1. Clean dist/chrome directory
rm -rf dist/chrome

# 2. Copy all extension files
cp -r background content-scripts popup options utils assets dist/chrome/

# 3. Copy Chrome manifest
cp manifest.json dist/chrome/

# 4. Create ZIP archive
cd dist/chrome && zip -r ../price-genius-chrome-v1.0.0.zip .
```

**That's it!** No compilation, no transformation.

### Firefox Build (`scripts/build-firefox.sh`)

```bash
#!/bin/bash
# 1. Clean dist/firefox directory
rm -rf dist/firefox

# 2. Copy all extension files (same as Chrome)
cp -r background content-scripts popup options utils assets dist/firefox/

# 3. Copy Firefox manifest (manifest-firefox.json → manifest.json)
cp manifest-firefox.json dist/firefox/manifest.json

# 4. Create extension ZIP
cd dist/firefox && zip -r ../price-genius-firefox-v1.0.0.zip .

# 5. Create source code ZIP (for AMO reviewers)
cd ../../ && zip -r dist/price-genius-firefox-source-v1.0.0.zip . \
  -x "*.git/*" -x "node_modules/*" -x "dist/*"
```

**Differences from Chrome:**
- Uses `manifest-firefox.json` instead of `manifest.json`
- Creates additional source ZIP for Mozilla reviewers
- Otherwise identical code

---

## 🔧 Cross-Browser Architecture

### Manifest Files

We maintain **two manifest files**:

1. **`manifest.json`** - Chrome/Edge/Brave
2. **`manifest-firefox.json`** - Firefox

**Key Difference:**
```json
// manifest-firefox.json adds:
{
  "browser_specific_settings": {
    "gecko": {
      "id": "price-genius@gogonano.com",
      "strict_min_version": "109.0"
    }
  },
  "background": {
    "scripts": ["background/service-worker.js"],  // vs "service_worker"
    "type": "module"
  }
}
```

### Browser API Polyfill

**File:** `utils/browser-polyfill.js`

```javascript
// Detects browser and uses the right API
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
export default browserAPI;
```

**Usage in code:**
```javascript
// Instead of: chrome.storage.local.get(...)
import browser from './utils/browser-polyfill.js';
await browser.storage.local.get(['products']);

// Works on both Chrome and Firefox!
```

### Code Compatibility

All JavaScript files use:
- `import browser from './utils/browser-polyfill.js'`
- `browser.storage.*` instead of `chrome.storage.*`
- `browser.runtime.*` instead of `chrome.runtime.*`
- `browser.tabs.*` instead of `chrome.tabs.*`
- etc.

This ensures **100% code reuse** across browsers.

---

## 🧪 Testing Builds

### Test Chrome Build

```bash
# Build
npm run build:chrome

# Load in Chrome
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select dist/chrome/
```

### Test Firefox Build

```bash
# Build
npm run build:firefox

# Load in Firefox
# 1. Open about:debugging#/runtime/this-firefox
# 2. Click "Load Temporary Add-on..."
# 3. Select dist/firefox/manifest.json
```

### Automated Testing (Optional)

```bash
# Install web-ext tool
npm install --global web-ext

# Run Firefox with extension
web-ext run --source-dir=dist/firefox

# Lint Firefox extension
web-ext lint --source-dir=dist/firefox
```

---

## 📂 Project Structure

```
PriceDropTracker/
├── manifest.json                    # Chrome manifest
├── manifest-firefox.json            # Firefox manifest
├── package.json                     # Build scripts
│
├── background/                      # Service worker
│   ├── service-worker.js            # Main background script
│   ├── storage-manager.js           # Data persistence
│   ├── price-checker.js             # Price monitoring
│   └── offscreen.js                 # Offscreen document
│
├── content-scripts/                 # Page interaction
│   ├── main.js                      # Content script entry
│   ├── product-detector.js          # Product detection
│   ├── price-extractor.js           # Price extraction
│   └── site-adapters/               # Site-specific logic
│       ├── amazon.js
│       ├── ebay.js
│       ├── walmart.js
│       └── ...
│
├── popup/                           # Extension popup
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
│
├── options/                         # Settings page
│   ├── settings.html
│   ├── settings.js
│   ├── settings.css
│   ├── price-history.html
│   └── price-history.js
│
├── utils/                           # Shared utilities
│   ├── browser-polyfill.js          # ⭐ Cross-browser API
│   ├── currency-parser.js
│   ├── notification-manager.js
│   └── ...
│
├── assets/                          # Icons and images
│   └── icons/
│       ├── icon-16.png
│       ├── icon-32.png
│       ├── icon-48.png
│       └── icon-128.png
│
├── scripts/                         # Build scripts
│   ├── build-chrome.sh
│   ├── build-firefox.sh
│   └── build-all.sh
│
└── docs/                            # Documentation
    ├── README.md
    ├── FIREFOX_GUIDE.md
    └── BUILD_INSTRUCTIONS.md
```

---

## 🔐 Security & Privacy

### No External Dependencies

The extension does NOT include:
- ❌ No npm packages in production code
- ❌ No third-party libraries (except Chart.js for visualization)
- ❌ No external API calls
- ❌ No analytics or tracking

### Data Storage

- **100% local storage** - All data stored in `browser.storage.local`
- **No cloud sync** - Data never leaves the device
- **No network requests** - Only fetches product pages for price checks

### Permissions Justification

```json
{
  "permissions": [
    "storage",        // Save tracked products locally
    "alarms",         // Schedule background price checks
    "notifications",  // Show price drop alerts
    "tabs",           // Detect product pages
    "activeTab",      // Read product info from active tab
    "scripting"       // Inject content scripts
  ],
  "host_permissions": [
    // Access to e-commerce sites for price checking
    "*://*.amazon.com/*",
    "*://*.ebay.com/*",
    // ... etc
  ]
}
```

---

## 📝 Version Management

### Updating Version

Edit version in **both** manifests:

```bash
# manifest.json
{
  "version": "1.0.1"
}

# manifest-firefox.json
{
  "version": "1.0.1"
}
```

Then rebuild:
```bash
npm run build
```

---

## 🆘 Support

### For Developers
- **GitHub Issues:** https://github.com/kakur007/PriceDropTracker/issues
- **Documentation:** See README.md and FIREFOX_GUIDE.md

### For Reviewers
- **Questions about build:** This file (BUILD_INSTRUCTIONS.md)
- **Questions about Firefox:** FIREFOX_GUIDE.md
- **Questions about privacy:** PRIVACY_POLICY.md
- **Contact:** support@gogonano.com

---

## ✅ Checklist for Reviewers

- [ ] Source code is human-readable (no minification)
- [ ] No build process required (vanilla JavaScript)
- [ ] Extension loads directly from extracted ZIP
- [ ] browser-polyfill.js provides cross-browser compatibility
- [ ] All code matches source repository
- [ ] No external API calls or tracking
- [ ] Permissions are justified and minimal
- [ ] Privacy policy is accurate

---

**Ready to build? 🚀**

```bash
git clone https://github.com/kakur007/PriceDropTracker.git
cd PriceDropTracker
npm run build
```

That's it! Your extensions are ready in `dist/` directory.
