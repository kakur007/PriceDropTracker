#!/bin/bash

# Build script for cross-browser extension
# Creates separate builds for Chrome and Firefox

echo "🔨 Building Price Genius extension for Chrome and Firefox..."

# Clean previous builds
rm -rf build/chrome/* build/firefox/*

# Create build directories
mkdir -p build/chrome build/firefox

# Copy all files except build directory and git files to both
echo "📦 Copying extension files..."

# List of directories and files to copy
for item in assets background content-scripts lib onboarding options popup utils *.json *.js; do
  if [ -e "$item" ] && [ "$item" != "build.sh" ]; then
    cp -r "$item" build/chrome/ 2>/dev/null || true
    cp -r "$item" build/firefox/ 2>/dev/null || true
  fi
done

# Create Chrome-specific manifest
echo "🌐 Creating Chrome manifest..."
cat > build/chrome/manifest.json << 'EOF'
{
  "manifest_version": 3,
  "name": "Price Genius by GoGoNano",
  "version": "1.0.0",
  "description": "Track product prices and get notified when they drop. Works on Amazon, eBay, Walmart, Etsy, Shopify, and thousands more sites.",
  "author": "GoGoNano",

  "permissions": [
    "storage",
    "alarms",
    "notifications",
    "tabs",
    "activeTab",
    "scripting"
  ],

  "host_permissions": [
    "*://*.amazon.com/*",
    "*://*.amazon.co.uk/*",
    "*://*.amazon.de/*",
    "*://*.amazon.fr/*",
    "*://*.amazon.it/*",
    "*://*.amazon.es/*",
    "*://*.amazon.ca/*",
    "*://*.amazon.com.au/*",
    "*://*.amazon.co.jp/*",
    "*://*.amazon.in/*",
    "*://*.amazon.com.mx/*",
    "*://*.amazon.com.br/*",
    "*://*.amazon.nl/*",
    "*://*.amazon.se/*",
    "*://*.ebay.com/*",
    "*://*.ebay.co.uk/*",
    "*://*.ebay.de/*",
    "*://*.ebay.fr/*",
    "*://*.ebay.it/*",
    "*://*.ebay.es/*",
    "*://*.ebay.ca/*",
    "*://*.ebay.com.au/*",
    "*://*.walmart.com/*",
    "*://*.target.com/*",
    "*://*.bestbuy.com/*",
    "*://*.etsy.com/*",
    "*://*.aliexpress.com/*",
    "*://*.newegg.com/*",
    "*://*.costco.com/*",
    "*://*.homedepot.com/*",
    "*://*.lowes.com/*",
    "*://*.wayfair.com/*",
    "*://*.overstock.com/*",
    "*://*.myshopify.com/*",
    "*://*.zalando.com/*",
    "*://*.zalando.co.uk/*",
    "*://*.zalando.de/*",
    "*://*.zalando.fr/*",
    "*://*.zalando.it/*",
    "*://*.zalando.es/*",
    "*://*.zalando.nl/*",
    "*://*.zalando.be/*",
    "*://*.zalando.ee/*",
    "*://*.zalando.fi/*",
    "*://*.zalando.se/*",
    "*://*.zalando.dk/*",
    "*://*.zalando.no/*",
    "*://*.zalando.pl/*",
    "*://*.zalando.at/*",
    "*://*.zalando.ch/*",
    "*://*.asos.com/*",
    "*://*.mediamarkt.com/*",
    "*://*.mediamarkt.de/*",
    "*://*.mediamarkt.nl/*",
    "*://*.mediamarkt.be/*",
    "*://*.mediamarkt.at/*",
    "*://*.mediamarkt.ch/*"
  ],

  "optional_host_permissions": [
    "<all_urls>"
  ],

  "background": {
    "service_worker": "background/background-wrapper.js",
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": [
        "*://*.amazon.com/*",
        "*://*.amazon.co.uk/*",
        "*://*.amazon.de/*",
        "*://*.amazon.fr/*",
        "*://*.amazon.it/*",
        "*://*.amazon.es/*",
        "*://*.amazon.ca/*",
        "*://*.amazon.com.au/*",
        "*://*.amazon.co.jp/*",
        "*://*.amazon.in/*",
        "*://*.amazon.com.mx/*",
        "*://*.amazon.com.br/*",
        "*://*.amazon.nl/*",
        "*://*.amazon.se/*",
        "*://*.ebay.com/*",
        "*://*.ebay.co.uk/*",
        "*://*.ebay.de/*",
        "*://*.ebay.fr/*",
        "*://*.ebay.it/*",
        "*://*.ebay.es/*",
        "*://*.ebay.ca/*",
        "*://*.ebay.com.au/*",
        "*://*.walmart.com/*",
        "*://*.target.com/*",
        "*://*.bestbuy.com/*",
        "*://*.etsy.com/*",
        "*://*.aliexpress.com/*",
        "*://*.newegg.com/*",
        "*://*.costco.com/*",
        "*://*.homedepot.com/*",
        "*://*.lowes.com/*",
        "*://*.wayfair.com/*",
        "*://*.overstock.com/*",
        "*://*.myshopify.com/*",
        "*://*.zalando.com/*",
        "*://*.zalando.co.uk/*",
        "*://*.zalando.de/*",
        "*://*.zalando.fr/*",
        "*://*.zalando.it/*",
        "*://*.zalando.es/*",
        "*://*.zalando.nl/*",
        "*://*.zalando.be/*",
        "*://*.asos.com/*",
        "*://*.mediamarkt.com/*",
        "*://*.mediamarkt.de/*",
        "*://*.mediamarkt.nl/*",
        "*://*.mediamarkt.be/*",
        "*://*.mediamarkt.at/*",
        "*://*.mediamarkt.ch/*"
      ],
      "js": [
        "content-scripts/main.js"
      ],
      "run_at": "document_idle",
      "all_frames": false
    }
  ],

  "web_accessible_resources": [
    {
      "resources": [
        "content-scripts/*.js",
        "content-scripts/site-adapters/*.js",
        "utils/*.js"
      ],
      "matches": ["<all_urls>"]
    }
  ],

  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "assets/icons/icon-16.png",
      "32": "assets/icons/icon-32.png",
      "48": "assets/icons/icon-48.png",
      "128": "assets/icons/icon-128.png"
    }
  },

  "icons": {
    "16": "assets/icons/icon-16.png",
    "32": "assets/icons/icon-32.png",
    "48": "assets/icons/icon-48.png",
    "128": "assets/icons/icon-128.png"
  },

  "options_ui": {
    "page": "options/settings.html",
    "open_in_tab": true
  },

  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
EOF

# Create Firefox-specific manifest
echo "🦊 Creating Firefox manifest..."
cat > build/firefox/manifest.json << 'EOF'
{
  "manifest_version": 3,
  "name": "Price Genius by GoGoNano",
  "version": "1.0.0",
  "description": "Track product prices and get notified when they drop. Works on Amazon, eBay, Walmart, Etsy, Shopify, and thousands more sites.",
  "author": "GoGoNano",

  "browser_specific_settings": {
    "gecko": {
      "id": "price-genius@gogonano.com",
      "strict_min_version": "109.0",
      "data_collection_permissions": {
        "allows_data_collection": false,
        "required": false
      }
    }
  },

  "permissions": [
    "storage",
    "alarms",
    "notifications",
    "tabs",
    "activeTab",
    "scripting"
  ],

  "host_permissions": [
    "*://*.amazon.com/*",
    "*://*.amazon.co.uk/*",
    "*://*.amazon.de/*",
    "*://*.amazon.fr/*",
    "*://*.amazon.it/*",
    "*://*.amazon.es/*",
    "*://*.amazon.ca/*",
    "*://*.amazon.com.au/*",
    "*://*.amazon.co.jp/*",
    "*://*.amazon.in/*",
    "*://*.amazon.com.mx/*",
    "*://*.amazon.com.br/*",
    "*://*.amazon.nl/*",
    "*://*.amazon.se/*",
    "*://*.ebay.com/*",
    "*://*.ebay.co.uk/*",
    "*://*.ebay.de/*",
    "*://*.ebay.fr/*",
    "*://*.ebay.it/*",
    "*://*.ebay.es/*",
    "*://*.ebay.ca/*",
    "*://*.ebay.com.au/*",
    "*://*.walmart.com/*",
    "*://*.target.com/*",
    "*://*.bestbuy.com/*",
    "*://*.etsy.com/*",
    "*://*.aliexpress.com/*",
    "*://*.newegg.com/*",
    "*://*.costco.com/*",
    "*://*.homedepot.com/*",
    "*://*.lowes.com/*",
    "*://*.wayfair.com/*",
    "*://*.overstock.com/*",
    "*://*.myshopify.com/*",
    "*://*.zalando.com/*",
    "*://*.zalando.co.uk/*",
    "*://*.zalando.de/*",
    "*://*.zalando.fr/*",
    "*://*.zalando.it/*",
    "*://*.zalando.es/*",
    "*://*.zalando.nl/*",
    "*://*.zalando.be/*",
    "*://*.zalando.ee/*",
    "*://*.zalando.fi/*",
    "*://*.zalando.se/*",
    "*://*.zalando.dk/*",
    "*://*.zalando.no/*",
    "*://*.zalando.pl/*",
    "*://*.zalando.at/*",
    "*://*.zalando.ch/*",
    "*://*.asos.com/*",
    "*://*.mediamarkt.com/*",
    "*://*.mediamarkt.de/*",
    "*://*.mediamarkt.nl/*",
    "*://*.mediamarkt.be/*",
    "*://*.mediamarkt.at/*",
    "*://*.mediamarkt.ch/*"
  ],

  "optional_host_permissions": [
    "<all_urls>"
  ],

  "background": {
    "scripts": ["background/background-wrapper.js"],
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": [
        "*://*.amazon.com/*",
        "*://*.amazon.co.uk/*",
        "*://*.amazon.de/*",
        "*://*.amazon.fr/*",
        "*://*.amazon.it/*",
        "*://*.amazon.es/*",
        "*://*.amazon.ca/*",
        "*://*.amazon.com.au/*",
        "*://*.amazon.co.jp/*",
        "*://*.amazon.in/*",
        "*://*.amazon.com.mx/*",
        "*://*.amazon.com.br/*",
        "*://*.amazon.nl/*",
        "*://*.amazon.se/*",
        "*://*.ebay.com/*",
        "*://*.ebay.co.uk/*",
        "*://*.ebay.de/*",
        "*://*.ebay.fr/*",
        "*://*.ebay.it/*",
        "*://*.ebay.es/*",
        "*://*.ebay.ca/*",
        "*://*.ebay.com.au/*",
        "*://*.walmart.com/*",
        "*://*.target.com/*",
        "*://*.bestbuy.com/*",
        "*://*.etsy.com/*",
        "*://*.aliexpress.com/*",
        "*://*.newegg.com/*",
        "*://*.costco.com/*",
        "*://*.homedepot.com/*",
        "*://*.lowes.com/*",
        "*://*.wayfair.com/*",
        "*://*.overstock.com/*",
        "*://*.myshopify.com/*",
        "*://*.zalando.com/*",
        "*://*.zalando.co.uk/*",
        "*://*.zalando.de/*",
        "*://*.zalando.fr/*",
        "*://*.zalando.it/*",
        "*://*.zalando.es/*",
        "*://*.zalando.nl/*",
        "*://*.zalando.be/*",
        "*://*.asos.com/*",
        "*://*.mediamarkt.com/*",
        "*://*.mediamarkt.de/*",
        "*://*.mediamarkt.nl/*",
        "*://*.mediamarkt.be/*",
        "*://*.mediamarkt.at/*",
        "*://*.mediamarkt.ch/*"
      ],
      "js": [
        "content-scripts/main.js"
      ],
      "run_at": "document_idle",
      "all_frames": false
    }
  ],

  "web_accessible_resources": [
    {
      "resources": [
        "content-scripts/*.js",
        "content-scripts/site-adapters/*.js",
        "utils/*.js"
      ],
      "matches": ["<all_urls>"]
    }
  ],

  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "assets/icons/icon-16.png",
      "32": "assets/icons/icon-32.png",
      "48": "assets/icons/icon-48.png",
      "128": "assets/icons/icon-128.png"
    }
  },

  "icons": {
    "16": "assets/icons/icon-16.png",
    "32": "assets/icons/icon-32.png",
    "48": "assets/icons/icon-48.png",
    "128": "assets/icons/icon-128.png"
  },

  "options_ui": {
    "page": "options/settings.html",
    "open_in_tab": true
  },

  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
EOF

echo ""
echo "✅ Build complete!"
echo ""
echo "📂 Chrome build: build/chrome/"
echo "📂 Firefox build: build/firefox/"
echo ""
echo "To load in Chrome:"
echo "  1. Go to chrome://extensions/"
echo "  2. Enable 'Developer mode'"
echo "  3. Click 'Load unpacked'"
echo "  4. Select the 'build/chrome' folder"
echo ""
echo "To load in Firefox:"
echo "  1. Go to about:debugging#/runtime/this-firefox"
echo "  2. Click 'Load Temporary Add-on'"
echo "  3. Select any file in 'build/firefox' folder (e.g., manifest.json)"
echo ""
