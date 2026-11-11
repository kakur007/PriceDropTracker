# Build Instructions for Price Genius

`manifest.json` is the single source of truth. The build script generates the
Chrome and Firefox variants from it (they differ only in the `background` key and
the Chrome-only `offscreen` permission).

## Requirements

- [Node.js](https://nodejs.org) 18 or newer. Nothing else - no npm install needed.
  Works on Windows, macOS and Linux.

## Build

```bash
npm run build           # both browsers
npm run build:chrome    # Chrome / Edge / Brave only
npm run build:firefox   # Firefox only
```

(Same as `node scripts/build.mjs [chrome|firefox]`.)

Output in `dist/`:

| Path | Use |
| --- | --- |
| `dist/chrome/` | Load unpacked in `chrome://extensions` |
| `dist/firefox/` | Load temporary add-on in `about:debugging` |
| `dist/price-genius-chrome-vX.Y.Z.zip` | Upload to Chrome Web Store / Edge Add-ons |
| `dist/price-genius-firefox-vX.Y.Z.zip` | Upload to addons.mozilla.org |
| `dist/price-genius-firefox-source-vX.Y.Z.zip` | Source archive, if Mozilla reviewers ask |

## Releasing a new version

1. Bump `version` in `manifest.json` and `package.json`
2. Add an entry to `CHANGELOG.md`
3. `npm test`
4. `npm run build`
5. Upload the two zips to the stores

## Quick development loop (Chrome)

You can also load the repository root directly in Chrome (`chrome://extensions` →
Load unpacked → select the repo folder). Reload the extension after changes.
