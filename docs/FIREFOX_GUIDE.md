# 🦊 Firefox Extension Development Guide

Complete guide for building, testing, and publishing **Price Genius** on Firefox Add-ons (AMO).

## 📋 Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Building for Firefox](#building-for-firefox)
- [Testing Locally](#testing-locally)
- [Submission Process](#submission-process)
- [Firefox-Specific Differences](#firefox-specific-differences)
- [Troubleshooting](#troubleshooting)

---

## Overview

Price Genius is built as a **cross-browser extension** that works on both Chrome and Firefox using a single codebase. The extension uses:

- **Manifest V3** (Firefox 109+)
- **Browser API polyfill** for cross-browser compatibility
- **Vanilla JavaScript** (no build process required)
- **Promise-based APIs** (Firefox native)

### Key Features
- ✅ Single codebase for Chrome and Firefox
- ✅ Cross-browser API compatibility layer
- ✅ No minification or obfuscation
- ✅ Privacy-first design (100% local storage)
- ✅ Automated build scripts

---

## Quick Start

### Prerequisites
- Firefox 109+ (for Manifest V3 support)
- Bash shell (for build scripts)
- Git (for version control)

### Build Commands

```bash
# Build only Firefox version
npm run build:firefox

# Build both Chrome and Firefox
npm run build

# Or use bash directly
bash scripts/build-firefox.sh
bash scripts/build-all.sh
```

---

## Building for Firefox

### Build Output

The Firefox build creates two files:

1. **Extension ZIP** (`price-genius-firefox-v1.0.0.zip`)
   - Ready to upload to AMO
   - Contains the extension code

2. **Source Code ZIP** (`price-genius-firefox-source-v1.0.0.zip`)
   - For Firefox reviewers
   - Contains all source files

### Build Directory Structure

```
dist/
├── firefox/                              # Unpacked extension
│   ├── manifest.json                     # Firefox manifest (from manifest-firefox.json)
│   ├── background/
│   ├── content-scripts/
│   ├── popup/
│   ├── options/
│   ├── utils/
│   └── assets/
├── price-genius-firefox-v1.0.0.zip      # Extension package
└── price-genius-firefox-source-v1.0.0.zip  # Source code
```

### What's Different in Firefox Build?

The build process:
1. ✅ Copies all extension files
2. ✅ Uses `manifest-firefox.json` (renamed to `manifest.json`)
3. ✅ Includes browser polyfill for API compatibility
4. ✅ Creates source code archive for reviewers

---

## Testing Locally

### Method 1: Load Temporary Add-on

1. **Open Firefox Developer Edition** (recommended) or regular Firefox
2. Navigate to `about:debugging#/runtime/this-firefox`
3. Click **"Load Temporary Add-on..."**
4. Select `manifest.json` from:
   - Source: `/path/to/PriceDropTracker/manifest-firefox.json`
   - Built: `/path/to/PriceDropTracker/dist/firefox/manifest.json`

5. Extension loads and appears in toolbar
6. Test all features:
   - ✅ Product detection on e-commerce sites
   - ✅ Price tracking and history
   - ✅ Notifications
   - ✅ Popup dashboard
   - ✅ Settings page
   - ✅ Data export/import

### Method 2: Using web-ext CLI (Optional)

Install web-ext tool:
```bash
npm install --global web-ext
```

Run extension:
```bash
cd /path/to/PriceDropTracker
web-ext run --source-dir=dist/firefox
```

This opens a new Firefox instance with the extension loaded.

### Testing Checklist

- [ ] Extension loads without errors
- [ ] Product detection works on Amazon, eBay, Walmart
- [ ] Prices are tracked correctly
- [ ] Background price checks run (check console)
- [ ] Notifications appear for price drops
- [ ] Popup shows tracked products
- [ ] Settings page opens and saves preferences
- [ ] Price history charts display correctly
- [ ] Data export/import works
- [ ] No console errors

---

## Submission Process

### Step 1: Create Firefox Account

1. Go to [addons.mozilla.org](https://addons.mozilla.org/developers/)
2. Sign up or log in
3. Complete developer profile

### Step 2: Prepare Submission Assets

#### Required:
- [x] Extension ZIP file
- [x] Add-on name: "Price Genius by GoGoNano"
- [x] Summary (250 chars max)
- [x] Description (full features list)
- [x] Category: Shopping, Productivity
- [x] Version: 1.0.0
- [x] License: MIT
- [x] Privacy Policy

#### Recommended:
- [ ] Screenshots (3-5 images, 1280x800 or 640x400)
  - Product tracking in action
  - Popup dashboard view
  - Settings page
  - Price history chart
  - Price drop notification

- [ ] Icon (already have 128x128)

### Step 3: Submit Extension

1. Navigate to [Submit a New Add-on](https://addons.mozilla.org/developers/addon/submit/)

2. **Upload Extension**
   - Choose "On this site" (listed add-on)
   - Upload `price-genius-firefox-v1.0.0.zip`

3. **Select Platforms**
   - [x] Firefox for Desktop
   - [x] Firefox for Android (optional)

4. **Fill Metadata**
   ```
   Name: Price Genius by GoGoNano
   Summary: Automatically track product prices and get notified when they drop
   Description: [Full description from README]
   Categories: Shopping, Productivity
   Tags: price-tracker, shopping, deals, e-commerce
   Support Email: support@gogonano.com
   Support URL: https://github.com/kakur007/PriceDropTracker
   Homepage: https://www.gogonano.com
   ```

5. **Upload Source Code** (if requested)
   - Upload `price-genius-firefox-source-v1.0.0.zip`
   - Include build instructions (see below)

6. **Privacy Policy**
   - Use the privacy policy from `PRIVACY_POLICY.md`
   - Or link to: `https://kakur007.github.io/PriceDropTracker/privacy-policy.html`

### Step 4: Build Instructions for Reviewers

If reviewers ask for build instructions, provide this:

```markdown
# Build Instructions

This extension uses vanilla JavaScript ES6 modules with NO build process.

## To Test the Extension:

1. Open Firefox Developer Edition (109+)
2. Navigate to about:debugging#/runtime/this-firefox
3. Click "Load Temporary Add-on"
4. Select manifest.json from the extracted ZIP

## No Build Required:
- No npm dependencies
- No transpilation
- No minification
- No obfuscation
- All code is human-readable source code

## Source Code Structure:
- manifest.json - Extension configuration
- background/ - Service worker and background tasks
- content-scripts/ - Page interaction scripts
- popup/ - Extension popup UI
- options/ - Settings page
- utils/ - Shared utilities including browser-polyfill.js

The extension works identically to the submitted ZIP.
```

### Step 5: Review Process

**Timeline:** 1-3 weeks

**What happens:**
1. Automated validation checks
2. Manual code review by Firefox team
3. Questions/feedback (respond within 7 days)
4. Approval or rejection

**Common review questions:**
- "Why do you need these permissions?"
  - Explain each permission clearly (see manifest comments)
- "What is browser-polyfill.js?"
  - Cross-browser compatibility layer for Chrome/Firefox APIs
- "Do you collect any data?"
  - No. 100% local storage, no analytics, no tracking

---

## Firefox-Specific Differences

### Manifest Differences

**Chrome (`manifest.json`):**
```json
{
  "manifest_version": 3,
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  }
}
```

**Firefox (`manifest-firefox.json`):**
```json
{
  "manifest_version": 3,
  "browser_specific_settings": {
    "gecko": {
      "id": "price-genius@gogonano.com",
      "strict_min_version": "109.0"
    }
  },
  "background": {
    "scripts": ["background/service-worker.js"],
    "type": "module"
  }
}
```

### API Differences

| Feature | Chrome | Firefox |
|---------|--------|---------|
| **Namespace** | `chrome.*` | `browser.*` |
| **API Style** | Callbacks (old), Promises (new) | Promises (native) |
| **Manifest ID** | Optional | Required (`browser_specific_settings`) |
| **Service Worker** | Full support | Supported (109+) |
| **Storage Limits** | ~10MB (local) | ~10MB (local) |
| **Notification API** | Slightly different styling | Slightly different styling |

### Browser Polyfill

Our `utils/browser-polyfill.js` handles these differences:

```javascript
// Automatically uses the right API
import browser from './utils/browser-polyfill.js';

// Works on both Chrome and Firefox
await browser.storage.local.get(['products']);
await browser.tabs.query({ active: true });
```

---

## Troubleshooting

### Extension Won't Load

**Problem:** "There was an error during installation"

**Solutions:**
- Check Firefox version (need 109+ for MV3)
- Validate manifest.json with [web-ext lint](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-lint)
- Check browser console for errors

### Service Worker Issues

**Problem:** Background tasks not running

**Firefox-specific:**
- Service workers in Firefox may behave differently
- Check `about:debugging` > Inspect > Console
- Verify alarms are created: `browser.alarms.getAll()`

### Permissions Not Working

**Problem:** "Permission denied" errors

**Solutions:**
- Ensure `browser_specific_settings` is set in manifest
- Check that host_permissions match the sites
- Test with optional_host_permissions first

### Storage Not Persisting

**Problem:** Data disappears after restart

**Solutions:**
- Firefox has strict storage quotas
- Check `browser.storage.local.getBytesInUse()`
- Verify no errors in storage operations

### Notifications Not Showing

**Problem:** Price drop notifications don't appear

**Firefox-specific:**
- Firefox notification styling differs from Chrome
- Check Firefox notification permissions
- Test with `browser.notifications.create()` directly

---

## Additional Resources

### Official Documentation
- [Firefox Extension Workshop](https://extensionworkshop.com/)
- [MDN WebExtensions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [Browser Compatibility](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Browser_support_for_JavaScript_APIs)
- [Manifest V3 Migration](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/)

### Tools
- [web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/) - CLI tool for testing
- [web-ext lint](https://github.com/mozilla/web-ext) - Validation tool
- [AMO Validator](https://addons.mozilla.org/developers/addon/validate) - Online validator

### Support
- [Extension Support Forum](https://discourse.mozilla.org/c/add-ons/35)
- [GitHub Issues](https://github.com/kakur007/PriceDropTracker/issues)
- [Developer Support](mailto:support@gogonano.com)

---

## Release Checklist

Before submitting to AMO:

- [ ] Test extension in Firefox (latest version)
- [ ] Test extension in Firefox Developer Edition
- [ ] Test extension in Firefox ESR (if targeting)
- [ ] All permissions are justified and documented
- [ ] Privacy policy is up to date
- [ ] Screenshots are ready (3-5 images)
- [ ] Description highlights Firefox compatibility
- [ ] Version number is correct in manifest
- [ ] Build both extension and source ZIPs
- [ ] No console errors or warnings
- [ ] All features work as expected
- [ ] Data export/import tested
- [ ] Notifications tested
- [ ] Cross-browser compatibility verified

---

**Ready to submit? 🚀**

Run the build, test thoroughly, and submit to [addons.mozilla.org](https://addons.mozilla.org/developers/)!

For questions, open an issue on [GitHub](https://github.com/kakur007/PriceDropTracker/issues).
