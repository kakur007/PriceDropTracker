#!/bin/bash
# Build script for both Chrome and Firefox
# Convenience script to build both versions at once

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Building Price Genius for all browsers..."
echo ""

# Build Chrome version
bash "$SCRIPT_DIR/build-chrome.sh"

echo ""
echo "═══════════════════════════════════════"
echo ""

# Build Firefox version
bash "$SCRIPT_DIR/build-firefox.sh"

echo ""
echo "✅ All builds complete!"
echo ""
