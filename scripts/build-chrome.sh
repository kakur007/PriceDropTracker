#!/bin/bash
# Build script for Chrome Web Store submission
# Creates a production-ready ZIP file for Chrome

set -e  # Exit on error

echo "🔨 Building Price Genius for Chrome..."

# Configuration
PROJECT_ROOT="/home/user/PriceDropTracker"
BUILD_DIR="$PROJECT_ROOT/dist/chrome"
VERSION=$(grep '"version"' "$PROJECT_ROOT/manifest.json" | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
OUTPUT_ZIP="$PROJECT_ROOT/dist/price-genius-chrome-v${VERSION}.zip"

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

# Copy Chrome manifest
echo "📄 Copying Chrome manifest..."
cp "$PROJECT_ROOT/manifest.json" "$BUILD_DIR/"

# Create ZIP file
echo "🗜️  Creating ZIP archive..."
cd "$BUILD_DIR"
zip -r "$OUTPUT_ZIP" . -x "*.DS_Store" -x "__MACOSX*" -x "*.bak"

# Calculate size
SIZE=$(du -h "$OUTPUT_ZIP" | cut -f1)

echo ""
echo "✅ Build complete!"
echo "📦 Output: $OUTPUT_ZIP"
echo "💾 Size: $SIZE"
echo "🔢 Version: $VERSION"
echo ""
echo "📋 Next steps:"
echo "   1. Test the extension by loading '$BUILD_DIR' in Chrome"
echo "   2. Upload '$OUTPUT_ZIP' to Chrome Web Store"
echo ""
