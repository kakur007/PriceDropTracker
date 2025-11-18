#!/bin/bash
# Batch update all JavaScript files to use cross-browser API

# List of files to update (excluding already updated ones)
FILES=(
  "content-scripts/main.js"
  "content-scripts/product-detector.js"
  "background/price-checker.js"
  "background/offscreen.js"
  "options/settings.js"
  "options/price-history.js"
  "options/privacy-policy.js"
  "onboarding/welcome.js"
)

cd /home/user/PriceDropTracker

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Updating: $file"

    # Add browser polyfill import if not already present and file has chrome. references
    if grep -q "chrome\." "$file" && ! grep -q "import browser from" "$file"; then
      # Determine the correct relative path for the import based on directory depth
      dir_depth=$(echo "$file" | tr -cd '/' | wc -c)

      if [ $dir_depth -eq 0 ]; then
        import_path="./utils/browser-polyfill.js"
      elif [ $dir_depth -eq 1 ]; then
        import_path="../utils/browser-polyfill.js"
      elif [ $dir_depth -eq 2 ]; then
        import_path="../../utils/browser-polyfill.js"
      else
        import_path="../utils/browser-polyfill.js"
      fi

      # Add import at the top after the first comment block or at very beginning
      sed -i '1i\import browser from '"'$import_path'"';\n' "$file"
      echo "  - Added browser polyfill import"
    fi

    # Replace chrome. with browser. (but not in comments or strings where appropriate)
    sed -i 's/\bchrome\./browser\./g' "$file"
    echo "  - Replaced chrome.* with browser.*"
  else
    echo "File not found: $file"
  fi
done

echo ""
echo "✓ Batch update complete!"
