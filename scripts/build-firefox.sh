#!/bin/bash
# Build script for Firefox Add-ons (AMO) submission
# Creates a production-ready ZIP file for Firefox

set -e  # Exit on error

echo "🦊 Building Price Genius for Firefox..."

# Configuration
PROJECT_ROOT="/home/user/PriceDropTracker"
BUILD_DIR="$PROJECT_ROOT/dist/firefox"
VERSION=$(grep '"version"' "$PROJECT_ROOT/manifest.json" | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
OUTPUT_ZIP="$PROJECT_ROOT/dist/price-genius-firefox-v${VERSION}.zip"
SOURCE_ZIP="$PROJECT_ROOT/dist/price-genius-firefox-source-v${VERSION}.zip"

# Clean previous build
echo "📁 Cleaning previous build..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy all necessary files
echo "📦 Copying extension files..."
cp -r "$PROJECT_ROOT/assets" "$BUILD_DIR/"
cp -r "$PROJECT_ROOT/background" "$BUILD_DIR/"
cp -r "$PROJECT_ROOT/content-scripts" "$BUILD_DIR/"
cp -r "$PROJECT_ROOT/onboarding" "$BUILD_DIR/"
cp -r "$PROJECT_ROOT/options" "$BUILD_DIR/"
cp -r "$PROJECT_ROOT/popup" "$BUILD_DIR/"
cp -r "$PROJECT_ROOT/utils" "$BUILD_DIR/"

# Copy Firefox manifest
echo "📄 Copying Firefox manifest..."
cp "$PROJECT_ROOT/manifest-firefox.json" "$BUILD_DIR/manifest.json"

# Create extension ZIP file
echo "🗜️  Creating extension ZIP archive..."
cd "$BUILD_DIR"
zip -r "$OUTPUT_ZIP" . -x "*.DS_Store" -x "__MACOSX*" -x "*.bak"

# Create source code ZIP for Firefox reviewers (required for AMO)
echo "📚 Creating source code archive for reviewers..."
cd "$PROJECT_ROOT"
zip -r "$SOURCE_ZIP" . \
  -x "*.git/*" \
  -x "node_modules/*" \
  -x "dist/*" \
  -x "*.DS_Store" \
  -x "__MACOSX*" \
  -x "*.bak" \
  -x "*.zip"

# Calculate sizes
EXT_SIZE=$(du -h "$OUTPUT_ZIP" | cut -f1)
SRC_SIZE=$(du -h "$SOURCE_ZIP" | cut -f1)

echo ""
echo "✅ Build complete!"
echo "📦 Extension: $OUTPUT_ZIP ($EXT_SIZE)"
echo "📚 Source: $SOURCE_ZIP ($SRC_SIZE)"
echo "🔢 Version: $VERSION"
echo ""
echo "📋 Next steps:"
echo "   1. Test the extension by loading '$BUILD_DIR' in Firefox"
echo "   2. Upload both files to addons.mozilla.org (AMO):"
echo "      - Upload '$OUTPUT_ZIP' as the extension"
echo "      - Upload '$SOURCE_ZIP' as source code (if requested)"
echo ""
echo "⚠️  Note: Firefox requires source code for review if you use:"
echo "    - Minification, obfuscation, or build tools"
echo "    - Our extension uses vanilla JS, so source review should be quick"
echo ""
