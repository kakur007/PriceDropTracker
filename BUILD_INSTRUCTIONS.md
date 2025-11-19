# Build Instructions for Price Genius Extension

This extension requires **separate builds** for Chrome and Firefox due to Manifest V3 incompatibilities.

## Why Separate Builds?

- **Chrome MV3** requires: `"service_worker": "file.js"` in manifest
- **Firefox MV3** (current versions) requires: `"scripts": ["file.js"]` in manifest
- Chrome rejects manifests with both properties
- Firefox doesn't support `service_worker` yet in many versions

This is the industry-standard solution used by all major cross-browser extensions.

## Quick Build

Run the build script to create both versions:

```bash
./build.sh
```

This creates:
- `build/chrome/` - Chrome/Edge/Brave version
- `build/firefox/` - Firefox version

## Loading in Browsers

### Chrome / Edge / Brave

1. Go to `chrome://extensions/` (or `edge://extensions/`)
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the **`build/chrome`** folder
5. ✅ Extension loaded!

### Firefox

1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Navigate to the **`build/firefox`** folder
4. Select **`manifest.json`**
5. ✅ Extension loaded!

## Key Differences Between Builds

Both builds use identical source code. The **only difference** is the `manifest.json`:

### Chrome manifest
```json
{
  "background": {
    "service_worker": "background/background-wrapper.js",
    "type": "module"
  }
}
```

### Firefox manifest
```json
{
  "background": {
    "scripts": ["background/background-wrapper.js"],
    "type": "module"
  },
  "browser_specific_settings": {
    "gecko": {
      "id": "price-genius@gogonano.com",
      "strict_min_version": "109.0"
    }
  }
}
```

## Development Workflow

1. Make changes to source files (not in `build/` folders)
2. Run `./build.sh` to rebuild
3. Reload extension in browser:
   - **Chrome**: Click reload button on extension card
   - **Firefox**: Click "Reload" button in about:debugging

## Publishing

For store submission, create distribution packages:

### Chrome Web Store
```bash
cd build/chrome
zip -r ../../price-genius-chrome.zip . -x "*.git*"
```

### Firefox Add-ons (AMO)
```bash
cd build/firefox
zip -r ../../price-genius-firefox.zip . -x "*.git*"
```

## Notes

- The `build/` folder is gitignored (not tracked in version control)
- Always build before testing changes
- Source code is in the root directory, builds are in `build/`
