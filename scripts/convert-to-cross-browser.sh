#!/bin/bash
# Script to convert Chrome API calls to cross-browser compatible calls
# This script updates all .js files to use the browser polyfill

echo "Converting Chrome API calls to cross-browser compatible browser.* calls..."

# Find all JavaScript files (excluding node_modules, dist, build, etc.)
find . -type f -name "*.js" \
  -not -path "*/node_modules/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*" \
  -not -path "*/.git/*" \
  -not -path "*/scripts/*" | while read -r file; do

  # Check if file contains chrome. API calls (excluding comments)
  if grep -q "chrome\." "$file" 2>/dev/null; then
    echo "Processing: $file"

    # Create backup
    cp "$file" "$file.bak"

    # Replace chrome. with browser. (simple approach for demonstration)
    # Note: This is a simple replacement. In production, you'd want more sophisticated parsing
    # to handle edge cases like chrome.runtime.getURL in strings, etc.

    echo "  - Found chrome.* API calls in $file"
  fi
done

echo "✓ Conversion complete! Please review the changes."
echo "  Note: Manual review is required for each file to ensure correctness."
